import type { ScanRequest, FieldResult } from '../types';
import { runAiAnalysis, aiResultSchema } from '../services/ai';
import type { AiGateway, AiResult } from '../services/ai';

export async function scanDescription(
  input: ScanRequest,
  gateway: AiGateway,
  model: string
): Promise<FieldResult> {
  const result = await runAiAnalysis<AiResult>(
    gateway,
    [
      {
        role: 'system',
        content: `You are an A2P 10DLC campaign compliance expert. Analyze campaign descriptions for quality and compliance.

RULES (from Twilio/TCR guidelines):
- Description must clearly explain the campaign's purpose and objective
- Must describe the type of messages that will be sent
- Must not be vague, generic, or too short
- Should mention the target audience
- Should explain the value proposition to message recipients
- Descriptions that just restate the use case name (e.g., "Marketing messages") are rejected

Error code 30886 = "Invalid campaign description" — description was not detailed enough or didn't match the use case.

Respond with ONLY valid JSON in this format:
{"tier": "RED|YELLOW|GREEN", "issues": ["..."], "suggestions": ["..."], "rationale": "..."}

- RED: Description is vague, generic, or fails to explain campaign purpose
- YELLOW: Description is acceptable but could be more detailed
- GREEN: Description is clear, detailed, and explains the campaign well`,
      },
      {
        role: 'user',
        content: `Campaign use case: ${input.useCaseType}
Campaign description: "${input.campaignDescription}"
${input.businessName ? `Business name: ${input.businessName}` : ''}`,
      },
    ],
    aiResultSchema,
    model
  );

  if (!result) {
    return {
      field: 'campaignDescription',
      displayName: 'Campaign Description',
      tier: 'YELLOW',
      rationale: 'Analysis inconclusive — could not evaluate description quality.',
      issues: [{ severity: 'warning', message: 'AI analysis was inconclusive' }],
      suggestions: [],
      evidence: { source: 'ai' },
    };
  }

  return {
    field: 'campaignDescription',
    displayName: 'Campaign Description',
    tier: result.tier,
    rationale: result.rationale,
    issues: result.issues.map((msg) => ({
      severity: result.tier === 'RED' ? 'critical' : 'warning',
      message: msg,
      twilioErrorCode: result.tier === 'RED' ? '30886' : null,
    })),
    suggestions: result.suggestions.map((fix) => ({
      issue: 'Campaign description quality',
      fix,
    })),
    evidence: { source: 'ai' },
  };
}
