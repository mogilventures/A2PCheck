import type { ScanResponse, FieldResult, ScanTier } from '../types';
import type { CampaignInput } from '../validators/campaignInput';
import { rollupResults } from '../scoring/rollup';
import type { FirecrawlResult, PageCrawler } from '../services/firecrawl';
import { MODELS } from '../services/ai';
import type { AiGateway } from '../services/ai';
import { createRevisionPack } from '../services/revisionPack';
import type { RevisionPack } from '../services/revisionPack';
import { scanUrls } from './urls';
import { scanOptOut } from './optOut';
import { scanHelpKeywords } from './helpKeywords';
import { scanContentFlags } from './contentFlags';
import { scanDescription } from './description';
import { scanSampleMessages } from './sampleMessages';
import { scanOptIn } from './optIn';
import { scanShaft } from './shaft';
import { scanAffiliateMarketing } from './affiliateMarketing';
import { scanConsistency } from './consistency';
import { scanPrivacyPolicy, scanPrivacyPolicyQuick } from './privacyPolicy';
import { scanTermsOfService, scanTermsOfServiceQuick } from './termsOfService';

const GLOBAL_TIMEOUT_MS = 45000;

/** Runs independent checks and optional premium synthesis within one owned deadline. */
export async function orchestrateScan(
  input: CampaignInput,
  config: { readonly RULES_VERSION: string },
  aiGateway: AiGateway,
  quickScan: boolean,
  traceId: string,
  model: string,
  options: { readonly signal?: AbortSignal; readonly crawler?: PageCrawler } = {},
): Promise<ScanResponse> {
  const startTime = Date.now();
  const deadline = new AbortController();
  const timeout = setTimeout(() => deadline.abort(), GLOBAL_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline.signal]) : deadline.signal;
  // Bind the caller-owned lifetime once, including scanner retries and synthesis.
  const gateway: AiGateway = {
    complete: (request) => signal.aborted
      ? Promise.resolve({ ok: false, status: 408, body: null })
      : aiGateway.complete(request, { signal }),
  };
  const urlsCrawled: string[] = [];
  let incomplete = false;
  const check = async (field: string, displayName: string, run: () => Promise<FieldResult>): Promise<FieldResult> => {
    const result = await beforeAbort(run, signal);
    if (result) return result;
    incomplete = true;
    console.warn('Scanner incomplete', { traceId, field, reason: signal.aborted ? 'cancelled' : 'failed' });
    return {
      field, displayName, tier: 'YELLOW',
      rationale: signal.aborted ? 'Check did not complete before cancellation or the scan deadline.' : 'Check could not be completed.',
      issues: [{ severity: 'warning', message: 'Check incomplete; review this field manually.' }],
      suggestions: [], evidence: { source: 'ai' },
    };
  };
  const crawl = async (url: string | undefined): Promise<FirecrawlResult | undefined> => {
    const crawler = options.crawler;
    if (!url || !crawler || signal.aborted) return undefined;
    urlsCrawled.push(url);
    return await beforeAbort(() => crawler.scrape(url, { signal }), signal) ?? undefined;
  };

  try {
    // Deterministic findings exist even if every network operation times out.
    const fieldResults = [scanUrls(input), scanOptOut(input), scanHelpKeywords(input), scanContentFlags(input)];
    const checks = [
      check('campaignDescription', 'Campaign Description', () => scanDescription(input, gateway, model)),
      check('sampleMessages', 'Sample Messages', () => scanSampleMessages(input, gateway, model)),
      check('messageFlow', 'Opt-In / Consent Flow', () => scanOptIn(input, gateway, model)),
      check('shaftContent', 'SHAFT Content Check', () => scanShaft(input, gateway, model)),
      check('affiliateMarketing', 'Affiliate Marketing Check', () => scanAffiliateMarketing(input, gateway, model)),
    ];
    if (quickScan) {
      fieldResults.push(scanPrivacyPolicyQuick(), scanTermsOfServiceQuick());
    } else {
      // Consistency uses submitted data only; it need not wait for crawling.
      // Each policy check starts as soon as its own page arrives.
      checks.push(
        check('consistency', 'Cross-Field Consistency', () => scanConsistency(input, gateway, model)),
        check('privacyPolicy', 'Privacy Policy', async () => scanPrivacyPolicy(input, gateway, await crawl(input.privacyPolicyUrl), model)),
        check('termsOfService', 'Terms of Service', async () => scanTermsOfService(input, gateway, await crawl(input.termsOfServiceUrl), model)),
      );
      // No scanner consumed the old website crawl. Do not spend budget on unused data.
    }
    fieldResults.push(...await Promise.all(checks));
    const deduped = deduplicateFieldResults(fieldResults);
    const { overallTier, overallSummary, criticalIssues, warnings } = rollupResults(deduped);

    let revisionPack: RevisionPack | undefined;
    if (!quickScan) {
      if (model !== MODELS.premium) revisionPack = { status: 'unavailable', reason: 'not_authorized' };
      else if (signal.aborted) revisionPack = { status: 'unavailable', reason: 'timeout' };
      else if (incomplete) revisionPack = { status: 'unavailable', reason: 'incomplete_scan' };
      else revisionPack = await beforeAbort(() => createRevisionPack(input, deduped, gateway, { signal }), signal)
        ?? { status: 'unavailable', reason: signal.aborted ? 'timeout' : 'generation_failed' };
    }
    return {
      scanId: traceId, timestamp: new Date().toISOString(), rulesVersion: config.RULES_VERSION,
      overallTier, overallSummary, criticalIssues, warnings, fieldResults: deduped,
      ...(revisionPack === undefined ? {} : { revisionPack }),
      metadata: {
        scanDurationMs: Date.now() - startTime, fieldsAnalyzed: deduped.length, aiModel: model, urlsCrawled,
        quickScan: quickScan || undefined,
        // Synthesis failure alone does not make completed field checks partial.
        partial: incomplete || undefined,
      },
    };
  } finally {
    clearTimeout(timeout);
    deadline.abort();
  }
}

function deduplicateFieldResults(results: FieldResult[]): FieldResult[] {
  const byField = new Map<string, FieldResult[]>();
  for (const result of results) {
    const entries = byField.get(result.field) ?? [];
    entries.push(result);
    byField.set(result.field, entries);
  }
  return [...byField.values()].map((entries) => {
    const deterministicRed = entries.find((entry) => entry.evidence.source === 'deterministic' && entry.tier === 'RED');
    if (deterministicRed) return deterministicRed;
    const tierOrder: ScanTier[] = ['RED', 'YELLOW', 'GREEN'];
    return entries.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))[0];
  });
}

// Own the raced promise and remove listeners on every path. A late result is
// ignored, not written into the response. Adapter requests receive this signal.
async function beforeAbort<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T | null> {
  if (signal.aborted) return null;
  let onAbort = () => {};
  const aborted = new Promise<null>((resolve) => { onAbort = () => resolve(null); });
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    return await Promise.race([run(), aborted]);
  } catch {
    // Never return/log arbitrary dependency exceptions or campaign text.
    return null;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
