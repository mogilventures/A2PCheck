import { z } from 'zod';
import { aiResultSchema } from '../../src/services/ai';
import type { AiCompletionRequest, AiGateway, AiGatewayResponse } from '../../src/services/ai';
import type { AiScannerCase } from './aiScannerCases';
import { recordableAiGatewayResponseSchema } from './aiFixtureSchema';
import { orchestrateScan } from '../../src/scanners';
import { campaignInputSchema } from '../../src/validators/campaignInput';
import type { ScanRequest, ScanTier } from '../../src/types';

const metadataSchema = z.object({
  provider: z.enum(['OpenAI', 'Anthropic', 'Cloudflare']).optional(),
  usage: z.object({
    prompt_tokens: z.number().nonnegative().optional(),
    completion_tokens: z.number().nonnegative().optional(),
    cost: z.number().nonnegative().optional(),
    is_byok: z.boolean().optional(),
    cost_details: z.object({ upstream_inference_cost: z.number().nonnegative().optional() }).optional(),
  }).optional(),
});

type Attempt = {
  readonly status: number;
  readonly durationMs: number;
  readonly schemaValid: boolean;
  readonly providerMatches: boolean;
  readonly provider: string | null;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly cost: number | null;
};

/** Measure synthetic requests without retaining raw envelopes or transport errors. */
export class MeasuredAiGateway implements AiGateway {
  readonly attempts: Attempt[] = [];

  constructor(private readonly gateway: AiGateway, private readonly now: () => number) {}

  /** Preserve the production exchange while recording bounded, content-free attempt metadata. */
  async complete(request: AiCompletionRequest, options: { readonly signal?: AbortSignal } = {}) {
      const attemptStarted = this.now();
      let response: AiGatewayResponse;
      try {
        response = await this.gateway.complete(request, options);
      } catch {
        // Never retain provider errors, URLs, headers, or arbitrary exception text.
        response = { ok: false, status: 0, body: null };
      }
      const envelope = recordableAiGatewayResponseSchema.safeParse(response);
      const metadata = metadataSchema.safeParse(response.body);
      let schemaValid = false;
      const content = envelope.success ? envelope.data.body.choices[0]?.message.content : undefined;
      if (content !== undefined) {
        try {
          const decoded: unknown = JSON.parse(content);
          schemaValid = aiResultSchema.safeParse(decoded).success;
        } catch { /* Malformed content is an evaluation failure, not a CLI failure. */ }
      }
      const provider = metadata.success ? metadata.data.provider ?? null : null;
      this.attempts.push({
        status: response.status,
        durationMs: Math.round(this.now() - attemptStarted),
        schemaValid,
        providerMatches: provider !== null && request.provider.only.some((allowed) => allowed === provider.toLowerCase()),
        provider,
        promptTokens: metadata.success ? metadata.data.usage?.prompt_tokens ?? null : null,
        completionTokens: metadata.success ? metadata.data.usage?.completion_tokens ?? null : null,
        cost: metadata.success
          ? metadata.data.usage?.is_byok
            ? metadata.data.usage.cost_details?.upstream_inference_cost ?? null
            : metadata.data.usage?.cost ?? null
          : null,
      });
      return response;
  }
}

/** Evaluate only caller-supplied synthetic cases through real scanner parsing/retries. */
export async function evaluateAiScannerCase(
  gateway: AiGateway,
  scannerCase: AiScannerCase,
  model: string,
  now: () => number,
) {
  const started = now();
  const measuredGateway = new MeasuredAiGateway(gateway, now);
  const result = await scannerCase.run(measuredGateway, model);
  const attempts = measuredGateway.attempts;
  const semanticPass = attempts.some((attempt) => attempt.schemaValid)
    && result.tier === scannerCase.expectedTier
    && result.evidence.source === scannerCase.expectedEvidence
    && (scannerCase.expectedSeverity === undefined
      ? result.issues.length === 0
      : result.issues.length > 0 && result.issues.every((issue) => issue.severity === scannerCase.expectedSeverity))
    && (scannerCase.expectedTwilioCode === undefined
      || result.issues.some((issue) => issue.twilioErrorCode === scannerCase.expectedTwilioCode));
  return {
    scanner: scannerCase.scanner,
    fixtureCase: scannerCase.fixtureCase,
    expectedTier: scannerCase.expectedTier,
    semanticPass,
    falseGreen: scannerCase.expectedTier !== 'GREEN' && result.tier === 'GREEN',
    firstAttemptValid: attempts[0]?.schemaValid === true,
    providerMatches: attempts.length > 0 && attempts.every((attempt) => attempt.providerMatches),
    durationMs: Math.round(now() - started),
    attempts,
    // These are built-in synthetic outputs for human comparison, never production telemetry.
    result,
  };
}

/** Check real Quick orchestration, including its deduplicated fields and all five AI completions. */
export async function evaluateQuickScan(
  gateway: AiGateway,
  request: ScanRequest,
  model: string,
  expectedTier: ScanTier,
  now: () => number,
) {
  const measured = new MeasuredAiGateway(gateway, now);
  const result = await orchestrateScan(campaignInputSchema.parse(request),
    { RULES_VERSION: 'synthetic-evaluation' },
    measured, true, 'synthetic-quick-evaluation', model);
  // URL and AI sample-message checks merge into one field during rollup.
  const expectedFields = ['sampleMessages', 'optOutKeywords', 'helpKeywords', 'contentFlags',
    'campaignDescription', 'messageFlow', 'shaftContent', 'affiliateMarketing', 'privacyPolicy', 'termsOfService'].sort();
  const actualFields = result.fieldResults.map((field) => field.field).sort();
  return {
    expectedTier, actualTier: result.overallTier,
    durationMs: result.metadata.scanDurationMs,
    fieldsAnalyzed: result.metadata.fieldsAnalyzed,
    fieldTiers: Object.fromEntries(result.fieldResults.map((field) => [field.field, field.tier])),
    partial: result.metadata.partial === true,
    attempts: measured.attempts,
    passed: result.overallTier === expectedTier && result.metadata.partial !== true
      && result.metadata.scanDurationMs < 45_000 && result.metadata.fieldsAnalyzed === expectedFields.length
      && actualFields.length === expectedFields.length && actualFields.every((field, index) => field === expectedFields[index])
      && measured.attempts.length === 5 && measured.attempts.every((attempt) => attempt.schemaValid && attempt.providerMatches),
  };
}
