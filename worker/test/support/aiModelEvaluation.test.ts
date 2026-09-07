import { describe, expect, it } from 'vitest';
import type { AiGateway, AiGatewayResponse } from '../../src/services/ai';
import { aiScannerCases } from './aiScannerCases';
import { evaluateAiScannerCase, evaluateQuickScan } from './aiModelEvaluation';
import { goodCampaign } from '../fixtures/campaigns';

function response(tier = 'GREEN', provider = 'OpenAI'): AiGatewayResponse {
  return { ok: true, status: 200, body: { provider,
    usage: { prompt_tokens: 10, completion_tokens: 20, cost: 0.001 },
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      tier, issues: tier === 'GREEN' ? [] : ['Synthetic issue'], suggestions: [], rationale: 'Synthetic.',
    }) } }],
  } };
}

function sequence(responses: AiGatewayResponse[]): AiGateway {
  return { async complete() { return responses.shift() ?? { ok: false, status: 503, body: null }; } };
}

const happy = aiScannerCases.find((item) => item.scanner === 'description' && item.fixtureCase === 'happy');
const yellow = aiScannerCases.find((item) => item.scanner === 'privacyPolicy' && item.fixtureCase === 'deficient');
if (!happy || !yellow) throw new Error('Missing synthetic evaluation cases.');

describe('synthetic AI evaluation', () => {
  it('accepts all ten real Quick fields after sample-message URL/AI deduplication', async () => {
    const result = await evaluateQuickScan(sequence(Array.from({ length: 5 }, () => response())),
      goodCampaign, 'openai/gpt-4o-mini', 'YELLOW', () => 0);
    expect(result.fieldsAnalyzed).toBe(10);
    expect(result.attempts).toHaveLength(5);
    expect(result.passed).toBe(true);
  });

  it('rejects a complete-looking Quick result when AI calls were unavailable', async () => {
    const result = await evaluateQuickScan(sequence([]), goodCampaign, 'openai/gpt-4o-mini', 'YELLOW', () => 0);
    expect(result.fieldsAnalyzed).toBe(10);
    expect(result.passed).toBe(false);
  });

  it('measures real scanner semantics, provider, schema and reported cost', async () => {
    let now = 0;
    const result = await evaluateAiScannerCase(sequence([response()]), happy, 'openai/gpt-4o-mini', () => now++);
    expect(result).toMatchObject({ semanticPass: true, firstAttemptValid: true, providerMatches: true, falseGreen: false });
    expect(result.attempts).toEqual([{ status: 200, durationMs: 1, schemaValid: true,
      providerMatches: true, provider: 'OpenAI', promptTokens: 10, completionTokens: 20, cost: 0.001 }]);
  });

  it('uses upstream BYOK cost rather than reporting a zero platform charge as free inference', async () => {
    const original = response();
    const providerResponse = { ...original, body: {
      provider: 'OpenAI', usage: { cost: 0, is_byok: true, cost_details: { upstream_inference_cost: 0.003 } },
      choices: [{ finish_reason: 'stop', message: { content: '{"tier":"GREEN","issues":[],"suggestions":[],"rationale":"Synthetic."}' } }],
    } };
    const result = await evaluateAiScannerCase(sequence([providerResponse]), happy, 'openai/gpt-4o-mini', () => 0);
    expect(result.attempts[0]?.cost).toBe(0.003);
  });

  it('does not confuse an inconclusive YELLOW fallback with a valid YELLOW result', async () => {
    const result = await evaluateAiScannerCase(sequence([]), yellow, 'openai/gpt-4o-mini', () => 0);
    expect(result.result.tier).toBe('YELLOW');
    expect(result.semanticPass).toBe(false);
    expect(result.firstAttemptValid).toBe(false);
    expect(result.providerMatches).toBe(false);
    expect(result.attempts).toHaveLength(2);
  });

  it('records first-attempt failures even when the retry succeeds', async () => {
    const result = await evaluateAiScannerCase(sequence([{ ok: false, status: 503, body: null }, response()]),
      happy, 'openai/gpt-4o-mini', () => 0);
    expect(result.semanticPass).toBe(true);
    expect(result.firstAttemptValid).toBe(false);
    expect(result.attempts).toHaveLength(2);
  });

  it('flags a false GREEN independently of schema validity and rejects unexpected hosting', async () => {
    const result = await evaluateAiScannerCase(sequence([response('GREEN', 'Anthropic')]),
      yellow, 'openai/gpt-4o-mini', () => 0);
    expect(result.firstAttemptValid).toBe(true);
    expect(result.falseGreen).toBe(true);
    expect(result.semanticPass).toBe(false);
    expect(result.providerMatches).toBe(false);
  });
});
