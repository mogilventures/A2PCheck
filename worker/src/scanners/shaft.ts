import type { ScanRequest, FieldResult } from '../types';
import { runAiAnalysis, aiResultSchema } from '../services/ai';
import type { AiGateway, AiResult } from '../services/ai';

export async function scanShaft(
  input: ScanRequest,
  gateway: AiGateway,
  model: string
): Promise<FieldResult> {
  const result = await runAiAnalysis<AiResult>(
    gateway,
    [
      {
        role: 'system',
        content: `You are an A2P 10DLC campaign compliance expert. Detect SHAFT content violations.

SHAFT = Sex, Hate, Alcohol, Firearms, Tobacco (also includes cannabis/marijuana).

RULES (from Twilio/TCR guidelines):
- Error code 30883 = Content Violation — campaign contains prohibited SHAFT content
- Content Violations are NOT remediable through resubmission
- Check ALL provided fields: description, sample messages, and use case
- Be thorough but avoid false positives — context matters
- Medical/pharmaceutical references are not automatically SHAFT unless promoting controlled substances
- News/educational content about SHAFT topics may be acceptable depending on use case
- Direct promotion, sales, or marketing of SHAFT products/services = RED

Respond with ONLY valid JSON:
{"tier": "RED|YELLOW|GREEN", "issues": ["..."], "suggestions": ["..."], "rationale": "..."}

- RED: Clear SHAFT content detected
- YELLOW: Borderline content that could be flagged
- GREEN: No SHAFT content concerns`,
      },
      {
        role: 'user',
        content: `Campaign use case: ${input.useCaseType}
Campaign description: "${input.campaignDescription}"
${input.businessName ? `Business name: ${input.businessName}` : ''}

Sample messages:
${input.sampleMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}

Content flags:
- Age-gated content: ${input.ageGatedContent ?? 'not specified'}
- Direct lending: ${input.directLending ?? 'not specified'}`,
      },
    ],
    aiResultSchema,
    model
  );

  if (!result) {
    return {
      field: 'shaftContent',
      displayName: 'SHAFT Content Check',
      tier: 'YELLOW',
      rationale: 'Analysis inconclusive — could not evaluate SHAFT content.',
      issues: [{ severity: 'warning', message: 'AI analysis was inconclusive' }],
      suggestions: [],
      evidence: { source: 'ai' },
    };
  }

  return {
    field: 'shaftContent',
    displayName: 'SHAFT Content Check',
    tier: result.tier,
    rationale: result.rationale,
    issues: result.issues.map((msg) => ({
      severity: result.tier === 'RED' ? 'critical' : 'warning',
      message: msg,
      twilioErrorCode: result.tier === 'RED' ? '30883' : null,
    })),
    suggestions: result.suggestions.map((fix) => ({
      issue: 'SHAFT content',
      fix,
    })),
    evidence: { source: 'ai' },
  };
}
