import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { createAiCompletionRequest } from '../../src/services/ai';

const successfulHttpStatusSchema = z.number().int().min(200).max(299);

const messageSchema = z.object({
  role: z.enum(['system', 'user']),
  content: z.string(),
}).strict();

const requestSchema = z.object({
  model: z.string(),
  messages: z.array(messageSchema),
  max_tokens: z.literal(1024),
  temperature: z.literal(0.1).optional(),
  reasoning_effort: z.literal('low').optional(),
  provider: z.object({
    only: z.array(z.string()).length(1),
    allow_fallbacks: z.literal(false),
    require_parameters: z.literal(true),
    data_collection: z.literal('deny'),
  }).strict(),
  response_format: z.union([
    z.object({ type: z.literal('json_object') }).strict(),
    z.object({ type: z.literal('json_schema'), json_schema: z.object({
      name: z.literal('scan_result'), strict: z.literal(true), schema: z.record(z.unknown()),
    }).strict() }).strict(),
  ]),
}).strict().transform((request, ctx) => {
  // ponytail: these are aiResultSchema field fixtures; give revision-pack fixtures their own schema binding.
  const expected = createAiCompletionRequest(request.messages, request.model);
  if (expected === null || !isDeepStrictEqual(request, expected)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fixture request violates model policy' });
    return z.NEVER;
  }
  return expected;
});

const minimalResponseBodySchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }).strict(),
      finish_reason: z.literal('stop').optional(),
    }).strict()
  ).min(1),
}).strict();

/** Parses successful provider responses while discarding provider-only metadata. */
export const recordableAiGatewayResponseSchema = z.object({
  ok: z.literal(true),
  status: successfulHttpStatusSchema,
  body: z.object({
    choices: z.array(
      z.object({
        message: z.object({ content: z.string() }),
        finish_reason: z.literal('stop').optional(),
      })
    ).min(1),
  }),
});

/** Parses the strict, metadata-free exchange shape stored in replay fixtures. */
export const aiReplayFixtureSchema = z.object({
  request: requestSchema,
  response: z.object({
    ok: z.literal(true),
    status: successfulHttpStatusSchema,
    body: minimalResponseBodySchema,
  }).strict(),
}).strict();

export type AiReplayFixture = z.infer<typeof aiReplayFixtureSchema>;
export type RecordableAiGatewayResponse = z.infer<typeof recordableAiGatewayResponseSchema>;
