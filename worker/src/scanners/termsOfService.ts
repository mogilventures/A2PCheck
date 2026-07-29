import type { ScanRequest, FieldResult } from '../types';
import { runAiAnalysis, aiResultSchema } from '../services/ai';
import type { AiGateway, AiResult } from '../services/ai';
import type { FirecrawlResult } from '../services/firecrawl';

export function scanTermsOfServiceQuick(): FieldResult {
  return {
    field: 'termsOfService',
    displayName: 'Terms of Service',
    tier: 'YELLOW',
    rationale: 'Quick scan does not verify external pages. Submit a full scan to analyze your terms of service.',
    issues: [{ severity: 'warning', message: 'Terms of service not analyzed in quick scan mode' }],
    suggestions: [],
    evidence: { source: 'firecrawl' },
  };
}

export async function scanTermsOfService(
  input: ScanRequest,
  gateway: AiGateway,
  crawlResult: FirecrawlResult | undefined,
  model: string
): Promise<FieldResult> {
  if (!input.termsOfServiceUrl) {
    return {
      field: 'termsOfService',
      displayName: 'Terms of Service',
      tier: 'YELLOW',
      rationale: 'No terms of service URL provided.',
      issues: [{ severity: 'warning', message: 'No terms of service URL provided' }],
      suggestions: [
        { issue: 'Missing ToS URL', fix: 'Add a terms of service URL that covers your messaging practices.' },
      ],
      evidence: { source: 'firecrawl' },
    };
  }

  if (!crawlResult || !crawlResult.success) {
    const statusCode = crawlResult?.statusCode ?? 0;
    if (statusCode === 404) {
      return {
        field: 'termsOfService',
        displayName: 'Terms of Service',
        tier: 'RED',
        rationale: `Terms of service URL (${input.termsOfServiceUrl}) returned a 404 error.`,
        issues: [{ severity: 'critical', message: 'Terms of service URL returns 404' }],
        suggestions: [
          { issue: 'Broken ToS URL', fix: 'Provide a working URL to your terms of service page.' },
        ],
        evidence: { source: 'firecrawl' },
      };
    }

    return {
      field: 'termsOfService',
      displayName: 'Terms of Service',
      tier: 'YELLOW',
      rationale: `Could not fetch terms of service: ${crawlResult?.error ?? 'unknown error'}`,
      issues: [{ severity: 'warning', message: 'Could not verify terms of service URL' }],
      suggestions: [],
      evidence: { source: 'firecrawl' },
    };
  }

  const result = await runAiAnalysis<AiResult>(
    gateway,
    [
      {
        role: 'system',
        content: `You are an A2P 10DLC campaign compliance expert. Analyze terms of service for messaging compliance.

RULES:
- Terms of service should mention SMS/text messaging terms
- Should describe messaging frequency, costs, and opt-out procedures
- Should mention that message and data rates may apply
- A generic ToS without messaging terms = YELLOW
- A ToS that covers messaging terms = GREEN

Respond with ONLY valid JSON:
{"tier": "RED|YELLOW|GREEN", "issues": ["..."], "suggestions": ["..."], "rationale": "..."}`,
      },
      {
        role: 'user',
        content: `Terms of Service URL: ${input.termsOfServiceUrl}
Business name: ${input.businessName || 'not provided'}

Terms of Service content (first ${crawlResult.content.length} characters):
${crawlResult.content}`,
      },
    ],
    aiResultSchema,
    model
  );

  if (!result) {
    return {
      field: 'termsOfService',
      displayName: 'Terms of Service',
      tier: 'YELLOW',
      rationale: 'Could not analyze terms of service content.',
      issues: [{ severity: 'warning', message: 'AI analysis of ToS was inconclusive' }],
      suggestions: [],
      evidence: { source: 'ai+firecrawl' },
    };
  }

  return {
    field: 'termsOfService',
    displayName: 'Terms of Service',
    tier: result.tier,
    rationale: result.rationale,
    issues: result.issues.map((msg) => ({
      severity: result.tier === 'RED' ? 'critical' : 'warning',
      message: msg,
    })),
    suggestions: result.suggestions.map((fix) => ({
      issue: 'Terms of service compliance',
      fix,
    })),
    evidence: { source: 'ai+firecrawl' },
  };
}
