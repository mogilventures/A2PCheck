import { describe, expect, it } from 'vitest';
import { createRevisionPack, revisionPackSchema } from '../../src/services/revisionPack';
import type { AiCompletionRequest, AiGateway } from '../../src/services/ai';
import { MODELS } from '../../src/services/ai';
import { completion, revisionCampaign, revisionFinding } from '../support/revisionPackCases';

const signal = () => new AbortController().signal;
const findings = [revisionFinding('messageFlow', 'YELLOW'), revisionFinding('sampleMessages', 'RED', 'deterministic'), revisionFinding('campaignDescription', 'GREEN')];
const draft = {
  actions: [
    { field: 'messageFlow', instruction: 'Provide the complete disclosure shown before consent.', kind: 'provide_information' },
    { field: 'sampleMessages', instruction: 'Review the missing brand identification and verify the revised messages.', kind: 'review' },
  ],
  replacements: [{ field: 'sampleMessages', sourceIds: [['businessName', 'sampleMessages.0'], ['businessName', 'sampleMessages.1']] }],
};
const gateway = (body: unknown): AiGateway => ({ complete: async () => completion(body) });

describe('revision pack synthesis boundary', () => {
  it('retains authoritative risks, sorts RED first, and builds exact replacements from submitted blocks', async () => {
    const requests: AiCompletionRequest[] = [];
    const result = await createRevisionPack(revisionCampaign, findings, { complete: async (request) => {
      requests.push(request); return completion(draft);
    } }, { signal: signal() });
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(result.actions.map(({ field, tier }) => ({ field, tier }))).toEqual([
      { field: 'sampleMessages', tier: 'RED' }, { field: 'messageFlow', tier: 'YELLOW' },
    ]);
    expect(result.residualRisks).toContainEqual({ field: 'sampleMessages', tier: 'RED', rationale: findings[1].rationale });
    expect(result.replacements).toEqual([{ field: 'sampleMessages', value: revisionCampaign.sampleMessages.map((message) => `BrightMarket\n${message}`) }]);
    expect(result.summary).toContain('remain unresolved');
    expect(result.disclaimer).toContain('not a guarantee');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: MODELS.premium, max_tokens: 4096, response_format: { type: 'json_schema' },
      provider: { only: ['anthropic'], allow_fallbacks: false, data_collection: 'deny' } });
    expect(revisionPackSchema.safeParse(result).success).toBe(true);
  });

  it('does not invent work for GREEN fields or make a needless model call', async () => {
    const result = await createRevisionPack(revisionCampaign, [revisionFinding('campaignDescription', 'GREEN')], {
      complete: async () => { throw new Error('No model call expected'); },
    }, { signal: signal() });
    expect(result).toMatchObject({ status: 'available', actions: [], replacements: [], residualRisks: [] });
  });

  it.each([
    ['malformed', { arbitrary: 'data' }],
    ['omitted RED', { ...draft, actions: draft.actions.slice(0, 1) }],
    ['duplicate actions', { ...draft, actions: [draft.actions[0], draft.actions[0]] }],
    ['tier downgrade', { ...draft, actions: [{ ...draft.actions[0], tier: 'GREEN' }, draft.actions[1]] }],
    ['fabricated URL', { ...draft, replacements: [{ field: 'sampleMessages', sourceIds: [['sampleMessages.0', 'https://invented.example'], ['sampleMessages.1']] }] }],
    ['freeform replacement', { ...draft, replacements: [{ field: 'messageFlow', value: 'Customers consent at https://invented.example' }] }],
    ['discarded original', { ...draft, replacements: [{ field: 'messageFlow', sourceIds: [['campaignDescription']] }] }],
    ['confirmation used as marketing copy', { ...draft, replacements: [{ field: 'sampleMessages', sourceIds: [['sampleMessages.0', 'optOutMessage'], ['sampleMessages.1']] }] }],
    ['replacement despite missing facts', { ...draft, replacements: [{ field: 'messageFlow', sourceIds: [['messageFlow', 'businessName']] }] }],
    ['changed GREEN field', { ...draft, replacements: [{ field: 'campaignDescription', sourceIds: [['campaignDescription', 'messageFlow']] }] }],
    ['unchanged replacement', { ...draft, replacements: [{ field: 'messageFlow', sourceIds: [['messageFlow']] }] }],
    ['reordered samples', { ...draft, replacements: [{ field: 'sampleMessages', sourceIds: [['sampleMessages.1'], ['sampleMessages.0']] }] }],
    ['duplicate replacement', { ...draft, replacements: [draft.replacements[0], draft.replacements[0]] }],
    ['unbounded action', { ...draft, actions: [{ ...draft.actions[0], instruction: 'x'.repeat(1201) }, draft.actions[1]] }],
  ])('fails closed for %s without changing findings', async (_name, body) => {
    const before = JSON.stringify(findings);
    expect(await createRevisionPack(revisionCampaign, findings, gateway(body), { signal: signal() }))
      .toEqual({ status: 'unavailable', reason: 'generation_failed' });
    expect(JSON.stringify(findings)).toBe(before);
  });

  it('preserves missing consent facts as human input, not manufactured copy', async () => {
    const result = await createRevisionPack(revisionCampaign, findings, gateway({ ...draft, replacements: [] }), { signal: signal() });
    expect(result).toMatchObject({ status: 'available', replacements: [], actions: expect.arrayContaining([
      { field: 'messageFlow', tier: 'YELLOW', instruction: draft.actions[0].instruction, kind: 'provide_information' },
    ]) });
  });

  it('never retries synthesis and rejects a late response after caller cancellation', async () => {
    let attempts = 0;
    const controller = new AbortController();
    const result = await createRevisionPack(revisionCampaign, findings, { complete: async () => {
      attempts++; controller.abort(); return completion(draft);
    } }, { signal: controller.signal });
    expect(result).toEqual({ status: 'unavailable', reason: 'timeout' });
    expect(attempts).toBe(1);
  });

  it('bounds input without sending truncated or oversized campaign data', async () => {
    let attempts = 0;
    const result = await createRevisionPack({ ...revisionCampaign, businessName: 'x'.repeat(60001) }, findings, {
      complete: async () => { attempts++; return completion(draft); },
    }, { signal: signal() });
    expect(result).toEqual({ status: 'unavailable', reason: 'input_too_large' });
    expect(attempts).toBe(0);
  });
});
