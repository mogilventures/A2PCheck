import { aiResultSchema } from '../../src/services/ai';
import type {
  AiCompletionRequest,
  AiGateway,
  AiGatewayResponse,
} from '../../src/services/ai';
import type { FieldResult } from '../../src/types';
import type { AiScannerCase } from './aiScannerCases';
import { recordableAiGatewayResponseSchema } from './aiFixtureSchema';
import type { RecordableAiGatewayResponse } from './aiFixtureSchema';

export type RecordedExchange = {
  readonly request: AiCompletionRequest;
  readonly response: RecordableAiGatewayResponse;
};

export type PendingAiFixtureWrite = {
  readonly scannerCase: AiScannerCase;
  readonly exchange: RecordedExchange;
};

class CapturingValidatedGateway implements AiGateway {
  readonly exchanges: RecordedExchange[] = [];
  attempts = 0;

  constructor(private readonly productionGateway: AiGateway) {}

  async complete(request: AiCompletionRequest): Promise<AiGatewayResponse> {
    this.attempts += 1;
    const response = await this.productionGateway.complete(request);
    const parsedResponse = recordableAiGatewayResponseSchema.parse(response);
    const content = parsedResponse.body.choices[0]?.message.content;
    if (content === undefined) {
      throw new Error('AI provider response did not contain completion content');
    }

    const decoded: unknown = JSON.parse(content);
    aiResultSchema.parse(decoded);

    const sanitizedResponse: RecordableAiGatewayResponse = {
      ok: true,
      status: parsedResponse.status,
      body: {
        choices: [{ message: { content },
          ...(parsedResponse.body.choices[0]?.finish_reason === undefined ? {} : { finish_reason: 'stop' as const }),
        }],
      },
    };
    this.exchanges.push({ request, response: sanitizedResponse });
    return sanitizedResponse;
  }
}

function assertExpectedSemantics(scannerCase: AiScannerCase, result: FieldResult): void {
  if (result.tier !== scannerCase.expectedTier) {
    throw new Error(
      `${scannerCase.scanner}/${scannerCase.fixtureCase} returned ${result.tier}; expected ${scannerCase.expectedTier}`
    );
  }
  if (result.evidence.source !== scannerCase.expectedEvidence) {
    throw new Error(`${scannerCase.scanner}/${scannerCase.fixtureCase} returned unexpected evidence source`);
  }

  if (scannerCase.expectedSeverity === undefined) {
    if (result.issues.length !== 0) {
      throw new Error(`${scannerCase.scanner}/${scannerCase.fixtureCase} unexpectedly returned issues`);
    }
  } else if (
    result.issues.length === 0 ||
    !result.issues.every((issue) => issue.severity === scannerCase.expectedSeverity)
  ) {
    throw new Error(`${scannerCase.scanner}/${scannerCase.fixtureCase} returned unexpected issue severity`);
  }

  if (
    scannerCase.expectedTwilioCode !== undefined &&
    !result.issues.some((issue) => issue.twilioErrorCode === scannerCase.expectedTwilioCode)
  ) {
    throw new Error(`${scannerCase.scanner}/${scannerCase.fixtureCase} omitted its expected Twilio code`);
  }
}

/**
 * Sequentially collects every validated exchange in memory.
 * A provider, schema, or semantic failure rejects without exposing a partial write set.
 */
export async function collectValidatedAiFixtures(
  productionGateway: AiGateway,
  scannerCases: readonly AiScannerCase[]
): Promise<readonly PendingAiFixtureWrite[]> {
  const pendingWrites: PendingAiFixtureWrite[] = [];

  for (const scannerCase of scannerCases) {
    const gateway = new CapturingValidatedGateway(productionGateway);
    const result = await scannerCase.run(gateway);
    assertExpectedSemantics(scannerCase, result);

    if (gateway.exchanges.length !== 1) {
      throw new Error(
        `${scannerCase.scanner}/${scannerCase.fixtureCase} produced ${gateway.exchanges.length} valid exchanges; expected exactly one`
      );
    }
    if (gateway.attempts !== 1) {
      throw new Error(`${scannerCase.scanner}/${scannerCase.fixtureCase} required a retry; refusing to hide first-attempt failure`);
    }
    const exchange = gateway.exchanges[0];
    if (exchange === undefined) {
      throw new Error(`${scannerCase.scanner}/${scannerCase.fixtureCase} produced no valid exchange`);
    }

    pendingWrites.push({ scannerCase, exchange });
  }

  return pendingWrites;
}
