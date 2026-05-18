import { ScanRequest, FieldResult, Env } from '../types';
import { runAiAnalysis, aiResultSchema, AiResult } from '../services/ai';

export async function scanConsistency(
  input: ScanRequest,
  env: Env,
  model: string
): Promise<FieldResult> {
  const result = await runAiAnalysis<AiResult>(
    env,
    [
      {
        role: 'system',
        content: `You are an A2P 10DLC campaign compliance expert. Check cross-field consistency across all campaign data.

Check for:
1. Use case vs sample messages — do messages match the declared purpose?
2. Use case vs description — does the description match the use case?
3. Description vs sample messages — are they telling a consistent story?
4. Business name in sample messages — is the business identified?
5. Opt-in flow vs message content — does the opt-in match what's being sent?
6. Content flags vs actual content — are URLs/phones flagged correctly?

Respond with ONLY valid JSON:
{"tier": "RED|YELLOW|GREEN", "issues": ["..."], "suggestions": ["..."], "rationale": "..."}

- RED: Major inconsistency (e.g., MARKETING use case but messages are OTP codes)
- YELLOW: Minor inconsistency or missing cross-references
- GREEN: All fields are consistent`,
      },
      {
        role: 'user',
        content: `Campaign use case: ${input.useCaseType}
Campaign description: "${input.campaignDescription}"
Business name: ${input.businessName || 'not provided'}
Message flow: "${input.messageFlow}"

Sample messages:
${input.sampleMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}

Opt-in keywords: ${input.optInKeywords?.join(', ') || 'none'}
Opt-out keywords: ${input.optOutKeywords?.join(', ') || 'none'}
Content flags - Embedded links: ${input.embeddedLinks ?? 'not specified'}, Embedded phone numbers: ${input.embeddedPhoneNumbers ?? 'not specified'}`,
      },
    ],
    aiResultSchema,
    model
  );

  if (!result) {
    return {
      field: 'consistency',
      displayName: 'Cross-Field Consistency',
      tier: 'YELLOW',
      rationale: 'Analysis inconclusive — could not evaluate cross-field consistency.',
      issues: [{ severity: 'warning', message: 'AI analysis was inconclusive' }],
      suggestions: [],
      evidence: { source: 'ai' },
    };
  }

  return {
    field: 'consistency',
    displayName: 'Cross-Field Consistency',
    tier: result.tier,
    rationale: result.rationale,
    issues: result.issues.map((msg) => ({
      severity: result.tier === 'RED' ? 'critical' : 'warning',
      message: msg,
    })),
    suggestions: result.suggestions.map((fix) => ({
      issue: 'Cross-field consistency',
      fix,
    })),
    evidence: { source: 'ai' },
  };
}
