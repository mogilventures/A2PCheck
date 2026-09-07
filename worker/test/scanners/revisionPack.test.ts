import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { orchestrateScan } from '../../src/scanners';
import type { AiGateway } from '../../src/services/ai';
import { MODELS } from '../../src/services/ai';
import type { PageCrawler } from '../../src/services/firecrawl';
import { campaignInputSchema } from '../../src/validators/campaignInput';
import { revisionPackSchema } from '../../src/services/revisionPack';
import { completion, revisionCampaign } from '../support/revisionPackCases';

const input = campaignInputSchema.parse({ ...revisionCampaign, privacyPolicyUrl: 'https://brightmarket.example/privacy', termsOfServiceUrl: 'https://brightmarket.example/terms' });
const config = { RULES_VERSION: 'synthetic-contract' };
const page: PageCrawler = { scrape: async () => ({ success: true, statusCode: 200, content: 'Synthetic messaging policy.' }) };
const findingsPayload = z.object({ findings: z.array(z.object({ field: z.string(), tier: z.enum(['RED', 'YELLOW', 'GREEN']) })) });

function syntheticGateway(options: { malformed?: boolean; tier?: 'YELLOW' | 'GREEN' } = {}): AiGateway {
  return { complete: async (request) => {
    if (request.max_tokens !== 4096) return completion({ tier: options.tier ?? 'YELLOW', rationale: 'Synthetic field evidence.', issues: [], suggestions: [] });
    if (options.malformed) return completion({ missing: 'required fields' });
    const payload = findingsPayload.parse(JSON.parse(request.messages[1].content));
    return completion({ actions: payload.findings.filter((finding) => finding.tier !== 'GREEN').map(({ field }) => ({
      field, instruction: 'Review the authoritative evidence and supply missing facts before resubmission.', kind: 'provide_information',
    })), replacements: [] });
  } };
}

afterEach(() => vi.useRealTimers());

describe('Full revision pack orchestration', () => {
  it('returns a validated pack after completed checks and preserves deterministic RED/404 evidence', async () => {
    const result = await orchestrateScan({ ...input, optOutKeywords: ['CANCEL'] }, config, syntheticGateway(), false, 'synthetic', MODELS.premium, {
      crawler: { scrape: async () => ({ success: false, statusCode: 404, content: '' }) },
    });
    expect(result.metadata.fieldsAnalyzed).toBe(11);
    expect(result.overallTier).toBe('RED');
    expect(result.fieldResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'optOutKeywords', tier: 'RED', evidence: { source: 'deterministic' } }),
      expect.objectContaining({ field: 'privacyPolicy', tier: 'RED', evidence: { source: 'firecrawl' } }),
    ]));
    expect(result.revisionPack).toMatchObject({ status: 'available', residualRisks: expect.arrayContaining([
      expect.objectContaining({ field: 'optOutKeywords', tier: 'RED' }), expect.objectContaining({ field: 'privacyPolicy', tier: 'RED' }),
    ]) });
    expect(revisionPackSchema.safeParse(result.revisionPack).success).toBe(true);
  });

  it('omits packs and crawling for Quick, and does not upgrade a standard Full scan for synthesis', async () => {
    let premiumCalls = 0;
    const delegate = syntheticGateway();
    const gateway: AiGateway = { complete: async (request, options) => {
      if (request.max_tokens === 4096) premiumCalls++;
      return delegate.complete(request, options);
    } };
    const quick = await orchestrateScan(input, config, gateway, true, 'quick', MODELS.premium, { crawler: page });
    expect(quick).not.toHaveProperty('revisionPack');
    expect(quick.metadata.urlsCrawled).toEqual([]);
    const full = await orchestrateScan(input, config, gateway, false, 'standard', MODELS.standard, { crawler: page });
    expect(full.revisionPack).toEqual({ status: 'unavailable', reason: 'not_authorized' });
    expect(premiumCalls).toBe(0);
  });

  it('keeps the complete scan usable when synthesis is malformed', async () => {
    const result = await orchestrateScan(input, config, syntheticGateway({ malformed: true }), false, 'bad', MODELS.premium, { crawler: page });
    expect(result.revisionPack).toEqual({ status: 'unavailable', reason: 'generation_failed' });
    expect(result.fieldResults).toHaveLength(11);
    expect(result.metadata.partial).toBeUndefined();
    // Existing rollup escalates three or more YELLOW findings to RED.
    expect(result.overallTier).toBe('RED');
  });

  it('does not invent actions for an entirely GREEN scan', async () => {
    const result = await orchestrateScan(input, config, syntheticGateway({ tier: 'GREEN' }), false, 'green', MODELS.premium, { crawler: page });
    expect(result.overallTier).toBe('GREEN');
    expect(result.revisionPack).toMatchObject({ status: 'available', actions: [], replacements: [], residualRisks: [] });
  });

  it('cancels all stalled AI/crawl work at the global deadline, preserving completed checks', async () => {
    vi.useFakeTimers();
    let calls = 0;
    let aborted = 0;
    const signals: AbortSignal[] = [];
    const gateway: AiGateway = { complete: async (_request, options) => {
      calls++;
      if (calls === 1) return completion({ tier: 'GREEN', rationale: 'Fast completed result', issues: [], suggestions: [] });
      const signal = options?.signal;
      if (!signal) throw new Error('Caller lifetime was not propagated');
      signals.push(signal);
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => { aborted++; resolve(); }, { once: true }));
      return { ok: false, status: 408, body: null };
    } };
    const crawler: PageCrawler = { scrape: async (_url, { signal }) => {
      signals.push(signal);
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => { aborted++; resolve(); }, { once: true }));
      return { success: false, statusCode: 0, content: '' };
    } };
    const pending = orchestrateScan({ ...input, optOutKeywords: ['CANCEL'] }, config, gateway, false, 'deadline', MODELS.premium, { crawler });
    await vi.advanceTimersByTimeAsync(45000);
    const result = await pending;
    expect(result.metadata).toMatchObject({ scanDurationMs: 45000, partial: true, fieldsAnalyzed: 11 });
    expect(result.revisionPack).toEqual({ status: 'unavailable', reason: 'timeout' });
    expect(result.overallTier).toBe('RED');
    expect(result.fieldResults).toContainEqual(expect.objectContaining({ field: 'campaignDescription', rationale: 'Fast completed result' }));
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(aborted).toBe(7); // five stalled field calls + two page requests
    expect(calls).toBe(6); // no network retries or dependent/synthesis calls after timeout
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out synthesis alone without marking completed field results partial', async () => {
    vi.useFakeTimers();
    const delegate = syntheticGateway();
    let synthesisAborted = false;
    const gateway: AiGateway = { complete: async (request, options) => {
      if (request.max_tokens !== 4096) return delegate.complete(request, options);
      const signal = options?.signal;
      if (!signal) throw new Error('Missing lifetime');
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => { synthesisAborted = true; resolve(); }, { once: true }));
      return { ok: false, status: 408, body: null };
    } };
    const pending = orchestrateScan(input, config, gateway, false, 'synthesis-timeout', MODELS.premium, { crawler: page });
    await vi.advanceTimersByTimeAsync(45000);
    const result = await pending;
    expect(result.revisionPack).toEqual({ status: 'unavailable', reason: 'timeout' });
    expect(result.metadata.partial).toBeUndefined();
    expect(result.fieldResults).toHaveLength(11);
    expect(synthesisAborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds concurrent Full requests and keeps each cancellation lifetime independent', async () => {
    const controllers = Array.from({ length: 6 }, () => new AbortController());
    controllers[0].abort();
    const results = await Promise.all(controllers.map((controller, index) => orchestrateScan(
      input, config, syntheticGateway(), false, `concurrent-${index}`, MODELS.premium, { crawler: page, signal: controller.signal },
    )));
    expect(results[0].revisionPack).toEqual({ status: 'unavailable', reason: 'timeout' });
    expect(results.slice(1).every((result) => result.revisionPack?.status === 'available' && result.metadata.scanDurationMs < 45000)).toBe(true);
    expect(new Set(results.map((result) => result.scanId)).size).toBe(6);
    expect(controllers.slice(1).every((controller) => !controller.signal.aborted)).toBe(true);
  });
});
