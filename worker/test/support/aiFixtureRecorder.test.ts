import { describe, expect, it } from 'vitest';
import type {
  AiCompletionRequest,
  AiGateway,
  AiGatewayResponse,
} from '../../src/services/ai';
import { aiScannerCases } from './aiScannerCases';
import { collectValidatedAiFixtures } from './aiFixtureRecorder';

class SequenceAiGateway implements AiGateway {
  readonly requests: AiCompletionRequest[] = [];

  constructor(private readonly responses: AiGatewayResponse[]) {}

  async complete(request: AiCompletionRequest): Promise<AiGatewayResponse> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (response === undefined) {
      throw new Error('No synthetic provider response remains');
    }
    return response;
  }
}

function validResponse(index: number, status = 201): AiGatewayResponse {
  const scannerCase = aiScannerCases[index];
  if (scannerCase === undefined) {
    throw new Error(`Missing scanner case ${index}`);
  }
  const hasIssue = scannerCase.expectedSeverity !== undefined;
  return {
    ok: true,
    status,
    body: {
      choices: [
        {
          message: {
            content: JSON.stringify({
              tier: scannerCase.expectedTier,
              issues: hasIssue ? ['Synthetic issue.'] : [],
              suggestions: hasIssue ? ['Synthetic fix.'] : [],
              rationale: 'Synthetic rationale.',
            }),
          },
        },
      ],
    },
  };
}

const malformedEnvelope: AiGatewayResponse = {
  ok: true,
  status: 200,
  body: { choices: [] },
};

describe('AI fixture recording collection', () => {
  it('collects all 16 validated exchanges before exposing the write set', async () => {
    const gateway = new SequenceAiGateway(aiScannerCases.map((_scannerCase, index) => validResponse(index)));

    const pendingWrites = await collectValidatedAiFixtures(gateway, aiScannerCases);

    expect(pendingWrites).toHaveLength(16);
    expect(pendingWrites.every(({ exchange }) => exchange.response.status === 201)).toBe(true);
    expect(gateway.requests).toHaveLength(16);
  });

  it('refuses to record a valid retry as if it were a first-attempt success', async () => {
    const gateway = new SequenceAiGateway([malformedEnvelope, validResponse(0)]);
    await expect(collectValidatedAiFixtures(gateway, aiScannerCases.slice(0, 1))).rejects.toThrow(/required a retry/);
  });

  it('rejects without exposing a partial write set when the final provider exchange is invalid', async () => {
    const firstFifteen = aiScannerCases.slice(0, 15).map((_scannerCase, index) => validResponse(index));
    const gateway = new SequenceAiGateway([
      ...firstFifteen,
      malformedEnvelope,
      malformedEnvelope,
    ]);

    await expect(collectValidatedAiFixtures(gateway, aiScannerCases)).rejects.toThrow(
      /produced 0 valid exchanges/
    );
    expect(gateway.requests).toHaveLength(17);
  });
});
