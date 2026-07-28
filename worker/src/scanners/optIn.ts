import type { ScanRequest, FieldResult } from '../types';
import { runAiAnalysis, aiResultSchema } from '../services/ai';
import type { AiGateway, AiResult } from '../services/ai';

export async function scanOptIn(
  input: ScanRequest,
  gateway: AiGateway,
  model: string
): Promise<FieldResult> {
  const result = await runAiAnalysis<AiResult>(
    gateway,
    [
      {
        role: 'system',
        content: `You are an A2P 10DLC campaign compliance expert. Analyze opt-in/consent flow for compliance.

RULES (from Twilio/TCR guidelines):
- Opt-in must be EXPLICIT — users must affirmatively consent to receive messages
- Opt-in cannot happen via SMS itself (e.g., "Text YES to subscribe" is not valid for initial opt-in)
- Valid opt-in methods: website form, paper form, IVR, point-of-sale
- The message flow must clearly describe HOW users opt in
- Must describe what happens after opt-in (what messages they'll receive, frequency)
- Implied consent or pre-checked boxes are not acceptable
- Must be verifiable — there should be a record of consent

Respond with ONLY valid JSON:
{"tier": "RED|YELLOW|GREEN", "issues": ["..."], "suggestions": ["..."], "rationale": "..."}

- RED: Opt-in is via SMS, not explicit, or not described
- YELLOW: Opt-in described but missing details
- GREEN: Clear, explicit, verifiable opt-in flow`,
      },
      {
        role: 'user',
        content: `Message flow / opt-in description: "${input.messageFlow}"
${input.optInKeywords?.length ? `Opt-in keywords: ${input.optInKeywords.join(', ')}` : 'No opt-in keywords provided'}
${input.optInMessage ? `Opt-in message: "${input.optInMessage}"` : 'No opt-in confirmation message provided'}
${input.websiteUrl ? `Website URL: ${input.websiteUrl}` : 'No website URL provided'}`,
      },
    ],
    aiResultSchema,
    model
  );

  if (!result) {
    return {
      field: 'messageFlow',
      displayName: 'Opt-In / Consent Flow',
      tier: 'YELLOW',
      rationale: 'Analysis inconclusive — could not evaluate opt-in compliance.',
      issues: [{ severity: 'warning', message: 'AI analysis was inconclusive' }],
      suggestions: [],
      evidence: { source: 'ai' },
    };
  }

  return {
    field: 'messageFlow',
    displayName: 'Opt-In / Consent Flow',
    tier: result.tier,
    rationale: result.rationale,
    issues: result.issues.map((msg) => ({
      severity: result.tier === 'RED' ? 'critical' : 'warning',
      message: msg,
    })),
    suggestions: result.suggestions.map((fix) => ({
      issue: 'Opt-in compliance',
      fix,
    })),
    evidence: { source: 'ai' },
  };
}
