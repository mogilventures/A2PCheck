import { describe, expect, it } from 'vitest';
import {
  aiReplayFixtureSchema,
  recordableAiGatewayResponseSchema,
} from './aiFixtureSchema';

const request = {
  model: 'openai/gpt-4o-mini',
  messages: [{ role: 'user' as const, content: 'Synthetic request.' }],
  max_tokens: 1024 as const,
  temperature: 0.1 as const,
  response_format: { type: 'json_object' as const },
};

function response(status: number) {
  return {
    ok: true as const,
    status,
    body: {
      choices: [{ message: { content: '{"tier":"GREEN","issues":[],"suggestions":[],"rationale":"Synthetic."}' } }],
    },
  };
}

describe('AI fixture schemas', () => {
  it.each([200, 201, 204, 299])(
    'accepts recorder status %i in replay fixtures',
    (status) => {
      const parsedResponse = recordableAiGatewayResponseSchema.parse(response(status));

      expect(() => aiReplayFixtureSchema.parse({ request, response: parsedResponse })).not.toThrow();
    }
  );

  it.each([199, 300])('rejects non-2xx status %i at both fixture boundaries', (status) => {
    expect(() => recordableAiGatewayResponseSchema.parse(response(status))).toThrow();
    expect(() => aiReplayFixtureSchema.parse({ request, response: response(status) })).toThrow();
  });
});
