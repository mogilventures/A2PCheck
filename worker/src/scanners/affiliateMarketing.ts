import type { ScanRequest, FieldResult } from '../types';
import { runAiAnalysis, aiResultSchema } from '../services/ai';
import type { AiGateway, AiResult } from '../services/ai';

export async function scanAffiliateMarketing(
  input: ScanRequest,
  gateway: AiGateway,
  model: string
): Promise<FieldResult> {
  const result = await runAiAnalysis<AiResult>(
    gateway,
    [
      {
        role: 'system',
        content: `You are an A2P 10DLC campaign compliance expert. Detect affiliate marketing patterns.

RULES:
- Affiliate marketing (sharing opt-ins with third parties) is a suspension reason
- Look for signs of lead generation, shared opt-in lists, or third-party promotions
- Messages that promote products/services from other businesses = RED flag
- Referral programs where the business itself runs the program = usually OK
- Multi-brand messages or generic "deals from our partners" = RED
- Single-brand marketing with clear business identity = GREEN

Respond with ONLY valid JSON:
{"tier": "RED|YELLOW|GREEN", "issues": ["..."], "suggestions": ["..."], "rationale": "..."}`,
      },
      {
        role: 'user',
        content: `Campaign use case: ${input.useCaseType}
Campaign description: "${input.campaignDescription}"
Business name: ${input.businessName || 'not provided'}

Sample messages:
${input.sampleMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}

Message flow: "${input.messageFlow}"`,
      },
    ],
    aiResultSchema,
    model
  );

  if (!result) {
    return {
      field: 'affiliateMarketing',
      displayName: 'Affiliate Marketing Check',
      tier: 'YELLOW',
      rationale: 'Analysis inconclusive — could not evaluate affiliate marketing patterns.',
      issues: [{ severity: 'warning', message: 'AI analysis was inconclusive' }],
      suggestions: [],
      evidence: { source: 'ai' },
    };
  }

  return {
    field: 'affiliateMarketing',
    displayName: 'Affiliate Marketing Check',
    tier: result.tier,
    rationale: result.rationale,
    issues: result.issues.map((msg) => ({
      severity: result.tier === 'RED' ? 'critical' : 'warning',
      message: msg,
    })),
    suggestions: result.suggestions.map((fix) => ({
      issue: 'Affiliate marketing',
      fix,
    })),
    evidence: { source: 'ai' },
  };
}
