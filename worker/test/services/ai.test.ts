import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DEFAULT_MODEL,
  resolveModel,
  runAiAnalysis,
  type AiCompletionRequest,
  type AiGateway,
  type AiGatewayResponse,
} from '../../src/services/ai';

class SequenceAiGateway implements AiGateway {
  readonly requests: AiCompletionRequest[] = [];

  constructor(private readonly outcomes: Array<AiGatewayResponse | Error>) {}

  async complete(request: AiCompletionRequest): Promise<AiGatewayResponse> {
    this.requests.push(request);
    const outcome = this.outcomes.shift();
    if (!outcome) {
      throw new Error('No fake AI gateway outcome remains');
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    return outcome;
  }
}

const resultSchema = z.object({ verdict: z.literal('valid') });
const messages = [{ role: 'user', content: 'Analyze this synthetic campaign.' }] as const;

function successfulResponse(content: string): AiGatewayResponse {
  return {
    ok: true,
    status: 200,
    body: { choices: [{ message: { content } }] },
  };
}

describe('runAiAnalysis', () => {
  it('returns schema-parsed content from a valid provider response', async () => {
    const gateway = new SequenceAiGateway([
      successfulResponse('{"verdict":"valid"}'),
    ]);

    const result = await runAiAnalysis(gateway, messages, resultSchema);

    expect(result).toEqual({ verdict: 'valid' });
    expect(gateway.requests).toEqual([
      {
        model: DEFAULT_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        provider: { only: ['openai'], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' },
      },
    ]);
  });

  it.each([
    ['z-ai/glm-5.3-flash', 'cloudflare', 0.1],
    ['anthropic/claude-opus-4.8', 'anthropic', undefined],
  ] as const)('always supplies low reasoning and a pinned provider for %s', async (model, provider, temperature) => {
    const gateway = new SequenceAiGateway([successfulResponse('{"verdict":"valid"}')]);
    await expect(runAiAnalysis(gateway, messages, resultSchema, model)).resolves.toEqual({ verdict: 'valid' });
    expect(gateway.requests[0]).toMatchObject({
      model, reasoning_effort: 'low',
      provider: { only: [provider], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' },
    });
    if (temperature === undefined) expect(gateway.requests[0]).not.toHaveProperty('temperature');
    else expect(gateway.requests[0]).toHaveProperty('temperature', temperature);
  });

  it.each(['anthropic/claude-sonnet-4-6', 'anthropic/claude-opus-4.8'])(
    'uses the runtime schema for native constrained output on %s', async (model) => {
      const gateway = new SequenceAiGateway([successfulResponse('{"verdict":"valid"}')]);
      await runAiAnalysis(gateway, messages, resultSchema, model);
      expect(gateway.requests[0]?.response_format).toEqual({
        type: 'json_schema', json_schema: { name: 'scan_result', strict: true,
          schema: { type: 'object', properties: { verdict: { type: 'string', const: 'valid' } },
            required: ['verdict'], additionalProperties: false },
        },
      });
    },
  );

  it('does not send an unsupported model to an arbitrary provider', async () => {
    const gateway = new SequenceAiGateway([successfulResponse('{"verdict":"valid"}')]);
    await expect(runAiAnalysis(gateway, messages, resultSchema, 'unknown/model')).resolves.toBeNull();
    expect(gateway.requests).toHaveLength(0);
  });

  it('does not mistake inherited property names for authorized tiers', () => {
    for (const tier of ['constructor', '__proto__', 'toString']) {
      expect(resolveModel(tier)).toBe(DEFAULT_MODEL);
    }
  });

  it('retries a failed response and returns a later valid response', async () => {
    const gateway = new SequenceAiGateway([
      { ok: false, status: 503, body: null },
      successfulResponse('{"verdict":"valid"}'),
    ]);

    await expect(runAiAnalysis(gateway, messages, resultSchema)).resolves.toEqual({ verdict: 'valid' });
    expect(gateway.requests).toHaveLength(2);
  });

  it.each([
    ['non-2xx response', { ok: false, status: 429, body: null }],
    ['malformed provider envelope', { ok: true, status: 200, body: { choices: [] } }],
    ['truncated completion even with valid JSON', { ok: true, status: 200, body: {
      choices: [{ finish_reason: 'length', message: { content: '{"verdict":"valid"}' } }],
    } }],
    ['malformed JSON content', successfulResponse('not JSON')],
    ['schema-invalid content', successfulResponse('{"verdict":"invalid"}')],
    ['thrown transport failure', new Error('synthetic transport failure')],
  ] satisfies Array<[string, AiGatewayResponse | Error]>)
  ('returns null after exhausting retries for %s', async (_label, outcome) => {
    const secondOutcome = outcome instanceof Error ? new Error(outcome.message) : outcome;
    const gateway = new SequenceAiGateway([outcome, secondOutcome]);

    await expect(runAiAnalysis(gateway, messages, resultSchema)).resolves.toBeNull();
    expect(gateway.requests).toHaveLength(2);
  });
});
