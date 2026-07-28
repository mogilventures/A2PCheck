import type { ScanRequest, FieldResult } from '../types';
import { runAiAnalysis, aiResultSchema } from '../services/ai';
import type { AiGateway, AiResult } from '../services/ai';

export async function scanSampleMessages(
  input: ScanRequest,
  gateway: AiGateway,
  model: string
): Promise<FieldResult> {
  const result = await runAiAnalysis<AiResult>(
    gateway,
    [
      {
        role: 'system',
        content: `You are an A2P 10DLC campaign compliance expert. Analyze sample messages for quality and use case alignment.

RULES (from Twilio/TCR guidelines):
- Sample messages must reflect actual messages to be sent under the campaign
- At least one sample message should include the business name
- Templated/variable fields should be indicated with brackets, e.g., [customer name]
- Messages must match the declared campaign use case
- Messages should not be generic or placeholder text
- Opt-out instructions (e.g., "Reply STOP to unsubscribe") should appear in at least one message
- Sample messages that are ONLY opt-out messages (e.g., "You've been unsubscribed") are rejected — they must show actual campaign content

Error code 30893 = "Invalid sample message" — messages are unclear, don't match use case, or are not representative.

Respond with ONLY valid JSON:
{"tier": "RED|YELLOW|GREEN", "issues": ["..."], "suggestions": ["..."], "rationale": "..."}

- RED: Messages are generic, don't match use case, or violate rules
- YELLOW: Messages are acceptable but could be improved
- GREEN: Messages are clear, match use case, and follow best practices`,
      },
      {
        role: 'user',
        content: `Campaign use case: ${input.useCaseType}
${input.businessName ? `Business name: ${input.businessName}` : 'Business name: not provided'}
Campaign description: "${input.campaignDescription}"

Sample messages:
${input.sampleMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}`,
      },
    ],
    aiResultSchema,
    model
  );

  if (!result) {
    return {
      field: 'sampleMessages',
      displayName: 'Sample Messages',
      tier: 'YELLOW',
      rationale: 'Analysis inconclusive — could not evaluate sample message quality.',
      issues: [{ severity: 'warning', message: 'AI analysis was inconclusive' }],
      suggestions: [],
      evidence: { source: 'ai' },
    };
  }

  return {
    field: 'sampleMessages',
    displayName: 'Sample Messages',
    tier: result.tier,
    rationale: result.rationale,
    issues: result.issues.map((msg) => ({
      severity: result.tier === 'RED' ? 'critical' : 'warning',
      message: msg,
      twilioErrorCode: result.tier === 'RED' ? '30893' : null,
    })),
    suggestions: result.suggestions.map((fix) => ({
      issue: 'Sample message quality',
      fix,
    })),
    evidence: { source: 'ai' },
  };
}
