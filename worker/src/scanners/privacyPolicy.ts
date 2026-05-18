import { ScanRequest, FieldResult, Env } from '../types';
import { runAiAnalysis, aiResultSchema, AiResult } from '../services/ai';
import { FirecrawlResult } from '../services/firecrawl';

export function scanPrivacyPolicyQuick(): FieldResult {
  return {
    field: 'privacyPolicy',
    displayName: 'Privacy Policy',
    tier: 'YELLOW',
    rationale: 'Quick scan does not verify external pages. Submit a full scan to analyze your privacy policy.',
    issues: [{ severity: 'warning', message: 'Privacy policy not analyzed in quick scan mode' }],
    suggestions: [],
    evidence: { source: 'firecrawl' },
  };
}

export async function scanPrivacyPolicy(
  input: ScanRequest,
  env: Env,
  crawlResult: FirecrawlResult | undefined,
  model: string
): Promise<FieldResult> {
  if (!input.privacyPolicyUrl) {
    return {
      field: 'privacyPolicy',
      displayName: 'Privacy Policy',
      tier: 'YELLOW',
      rationale: 'No privacy policy URL provided. While not strictly required, providing one strengthens your campaign.',
      issues: [{ severity: 'warning', message: 'No privacy policy URL provided' }],
      suggestions: [
        {
          issue: 'Missing privacy policy URL',
          fix: 'Add a privacy policy URL that describes how you collect and use messaging data.',
        },
      ],
      evidence: { source: 'firecrawl' },
    };
  }

  if (!crawlResult || !crawlResult.success) {
    const statusCode = crawlResult?.statusCode ?? 0;
    if (statusCode === 404) {
      return {
        field: 'privacyPolicy',
        displayName: 'Privacy Policy',
        tier: 'RED',
        rationale: `Privacy policy URL (${input.privacyPolicyUrl}) returned a 404 error. The page does not exist.`,
        issues: [{ severity: 'critical', message: 'Privacy policy URL returns 404' }],
        suggestions: [
          { issue: 'Broken privacy policy URL', fix: 'Provide a working URL to your privacy policy page.' },
        ],
        evidence: { source: 'firecrawl' },
      };
    }

    return {
      field: 'privacyPolicy',
      displayName: 'Privacy Policy',
      tier: 'YELLOW',
      rationale: `Could not fetch privacy policy from ${input.privacyPolicyUrl}: ${crawlResult?.error ?? 'unknown error'}`,
      issues: [{ severity: 'warning', message: 'Could not verify privacy policy URL' }],
      suggestions: [
        { issue: 'Could not access privacy policy', fix: 'Ensure your privacy policy URL is publicly accessible.' },
      ],
      evidence: { source: 'firecrawl' },
    };
  }

  // AI analysis of the crawled content
  const result = await runAiAnalysis<AiResult>(
    env,
    [
      {
        role: 'system',
        content: `You are an A2P 10DLC campaign compliance expert. Analyze a privacy policy page for SMS/messaging compliance.

RULES:
- Privacy policy should mention SMS, text messaging, or mobile messaging data collection
- Should describe how messaging-related data (phone numbers, message content, opt-in records) is handled
- Should mention sharing of data with third parties (especially messaging service providers)
- Should cover data retention policies
- A generic privacy policy that doesn't mention messaging at all = YELLOW
- A privacy policy that explicitly covers messaging data = GREEN

Respond with ONLY valid JSON:
{"tier": "RED|YELLOW|GREEN", "issues": ["..."], "suggestions": ["..."], "rationale": "..."}`,
      },
      {
        role: 'user',
        content: `Privacy policy URL: ${input.privacyPolicyUrl}
Business name: ${input.businessName || 'not provided'}

Privacy policy content (first ${crawlResult.content.length} characters):
${crawlResult.content}`,
      },
    ],
    aiResultSchema,
    model
  );

  if (!result) {
    return {
      field: 'privacyPolicy',
      displayName: 'Privacy Policy',
      tier: 'YELLOW',
      rationale: 'Could not analyze privacy policy content. AI analysis was inconclusive.',
      issues: [{ severity: 'warning', message: 'AI analysis of privacy policy was inconclusive' }],
      suggestions: [],
      evidence: { source: 'ai+firecrawl' },
    };
  }

  return {
    field: 'privacyPolicy',
    displayName: 'Privacy Policy',
    tier: result.tier,
    rationale: result.rationale,
    issues: result.issues.map((msg) => ({
      severity: result.tier === 'RED' ? 'critical' : 'warning',
      message: msg,
    })),
    suggestions: result.suggestions.map((fix) => ({
      issue: 'Privacy policy compliance',
      fix,
    })),
    evidence: { source: 'ai+firecrawl' },
  };
}
