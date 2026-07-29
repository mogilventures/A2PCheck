import type { ScanRequest, ScanResponse, FieldResult, Env, ScanTier } from '../types';
import type { CampaignInput } from '../validators/campaignInput';
import { rollupResults } from '../scoring/rollup';
import { crawlUrls } from '../services/firecrawl';
import type { FirecrawlResult } from '../services/firecrawl';
import type { AiGateway } from '../services/ai';

// Deterministic scanners
import { scanUrls } from './urls';
import { scanOptOut } from './optOut';
import { scanHelpKeywords } from './helpKeywords';
import { scanContentFlags } from './contentFlags';

// AI scanners
import { scanDescription } from './description';
import { scanSampleMessages } from './sampleMessages';
import { scanOptIn } from './optIn';
import { scanShaft } from './shaft';
import { scanAffiliateMarketing } from './affiliateMarketing';
import { scanConsistency } from './consistency';

// Firecrawl-dependent scanners
import { scanPrivacyPolicy, scanPrivacyPolicyQuick } from './privacyPolicy';
import { scanTermsOfService, scanTermsOfServiceQuick } from './termsOfService';

const GLOBAL_TIMEOUT_MS = 45000;

export async function orchestrateScan(
  input: CampaignInput,
  env: Env,
  aiGateway: AiGateway,
  quickScan: boolean,
  traceId: string,
  model: string
): Promise<ScanResponse> {
  const startTime = Date.now();
  const fieldResults: FieldResult[] = [];
  const urlsCrawled: string[] = [];

  // --- Phase 1: Deterministic checks (instant) ---
  fieldResults.push(scanUrls(input as ScanRequest));
  fieldResults.push(scanOptOut(input as ScanRequest));
  fieldResults.push(scanHelpKeywords(input as ScanRequest));
  fieldResults.push(scanContentFlags(input as ScanRequest));

  // --- Phase 2a: Parallel AI + Firecrawl ---
  const phase2aPromises: Promise<FieldResult>[] = [
    wrapScanner(() => scanDescription(input as ScanRequest, aiGateway, model), 'campaignDescription', 'Campaign Description'),
    wrapScanner(() => scanSampleMessages(input as ScanRequest, aiGateway, model), 'sampleMessages', 'Sample Messages'),
    wrapScanner(() => scanOptIn(input as ScanRequest, aiGateway, model), 'messageFlow', 'Opt-In / Consent Flow'),
    wrapScanner(() => scanShaft(input as ScanRequest, aiGateway, model), 'shaftContent', 'SHAFT Content Check'),
    wrapScanner(
      () => scanAffiliateMarketing(input as ScanRequest, aiGateway, model),
      'affiliateMarketing',
      'Affiliate Marketing Check'
    ),
  ];

  // Firecrawl URLs (parallel, only for full scan)
  let crawlResults: Map<string, FirecrawlResult> | undefined;

  if (!quickScan) {
    const urlsToCrawl: { label: string; url: string }[] = [];
    if (input.privacyPolicyUrl) {
      urlsToCrawl.push({ label: 'privacyPolicy', url: input.privacyPolicyUrl });
      urlsCrawled.push(input.privacyPolicyUrl);
    }
    if (input.termsOfServiceUrl) {
      urlsToCrawl.push({ label: 'termsOfService', url: input.termsOfServiceUrl });
      urlsCrawled.push(input.termsOfServiceUrl);
    }
    if (input.websiteUrl) {
      urlsToCrawl.push({ label: 'website', url: input.websiteUrl });
      urlsCrawled.push(input.websiteUrl);
    }

    if (urlsToCrawl.length > 0) {
      const crawlPromise = crawlUrls(urlsToCrawl, env);

      // Run AI scanners and crawl in parallel
      const [aiResults, crawled] = await Promise.all([
        withTimeout(Promise.allSettled(phase2aPromises), GLOBAL_TIMEOUT_MS - (Date.now() - startTime)),
        withTimeout(crawlPromise, GLOBAL_TIMEOUT_MS - (Date.now() - startTime)),
      ]);

      // Collect phase 2a results
      if (aiResults) {
        for (const result of aiResults) {
          if (result.status === 'fulfilled') {
            fieldResults.push(result.value);
          }
        }
      }

      crawlResults = crawled ?? undefined;
    } else {
      // No URLs to crawl, just run AI scanners
      const aiResults = await withTimeout(
        Promise.allSettled(phase2aPromises),
        GLOBAL_TIMEOUT_MS - (Date.now() - startTime)
      );
      if (aiResults) {
        for (const result of aiResults) {
          if (result.status === 'fulfilled') {
            fieldResults.push(result.value);
          }
        }
      }
    }
  } else {
    // Quick scan: run AI scanners only
    const aiResults = await withTimeout(
      Promise.allSettled(phase2aPromises),
      GLOBAL_TIMEOUT_MS - (Date.now() - startTime)
    );
    if (aiResults) {
      for (const result of aiResults) {
        if (result.status === 'fulfilled') {
          fieldResults.push(result.value);
        }
      }
    }
  }

  // --- Phase 2b: Firecrawl-dependent scanners ---
  if (quickScan) {
    fieldResults.push(scanPrivacyPolicyQuick());
    fieldResults.push(scanTermsOfServiceQuick());
  } else {
    const phase2bPromises: Promise<FieldResult>[] = [
      wrapScanner(
        () => scanPrivacyPolicy(input as ScanRequest, aiGateway, crawlResults?.get('privacyPolicy'), model),
        'privacyPolicy',
        'Privacy Policy'
      ),
      wrapScanner(
        () => scanTermsOfService(input as ScanRequest, aiGateway, crawlResults?.get('termsOfService'), model),
        'termsOfService',
        'Terms of Service'
      ),
    ];

    // Consistency check uses all data
    phase2bPromises.push(
      wrapScanner(() => scanConsistency(input as ScanRequest, aiGateway, model), 'consistency', 'Cross-Field Consistency')
    );

    const phase2bResults = await withTimeout(
      Promise.allSettled(phase2bPromises),
      GLOBAL_TIMEOUT_MS - (Date.now() - startTime)
    );

    if (phase2bResults) {
      for (const result of phase2bResults) {
        if (result.status === 'fulfilled') {
          fieldResults.push(result.value);
        }
      }
    }
  }

  // --- Phase 3: Scoring rollup ---
  // Deduplicate: if deterministic scanner already flagged a field as RED,
  // ensure AI can't downgrade it
  const deduped = deduplicateFieldResults(fieldResults);
  const { overallTier, overallSummary, criticalIssues, warnings } = rollupResults(deduped);

  const scanDurationMs = Date.now() - startTime;

  return {
    scanId: traceId,
    timestamp: new Date().toISOString(),
    rulesVersion: env.RULES_VERSION,
    overallTier,
    overallSummary,
    criticalIssues,
    warnings,
    fieldResults: deduped,
    metadata: {
      scanDurationMs,
      fieldsAnalyzed: deduped.length,
      aiModel: model,
      urlsCrawled,
      quickScan: quickScan || undefined,
      partial: scanDurationMs > GLOBAL_TIMEOUT_MS ? true : undefined,
    },
  };
}

function deduplicateFieldResults(results: FieldResult[]): FieldResult[] {
  const byField = new Map<string, FieldResult[]>();

  for (const r of results) {
    const existing = byField.get(r.field) || [];
    existing.push(r);
    byField.set(r.field, existing);
  }

  const deduped: FieldResult[] = [];
  for (const [, entries] of byField) {
    if (entries.length === 1) {
      deduped.push(entries[0]);
      continue;
    }

    // If deterministic scanner says RED, that wins
    const deterministicRed = entries.find((e) => e.evidence.source === 'deterministic' && e.tier === 'RED');
    if (deterministicRed) {
      deduped.push(deterministicRed);
      continue;
    }

    // Otherwise pick the strictest tier
    const tierOrder: ScanTier[] = ['RED', 'YELLOW', 'GREEN'];
    entries.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier));
    deduped.push(entries[0]);
  }

  return deduped;
}

async function wrapScanner(
  fn: () => Promise<FieldResult>,
  field: string,
  displayName: string
): Promise<FieldResult> {
  try {
    return await fn();
  } catch (err) {
    console.error(`Scanner ${field} failed:`, err);
    return {
      field,
      displayName,
      tier: 'YELLOW',
      rationale: `Scanner failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      issues: [{ severity: 'warning', message: 'Scanner encountered an error' }],
      suggestions: [],
      evidence: { source: 'ai' },
    };
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  if (ms <= 0) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([promise, timeout]);
}
