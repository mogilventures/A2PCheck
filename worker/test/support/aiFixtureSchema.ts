import { z } from 'zod';

const successfulHttpStatusSchema = z.number().int().min(200).max(299);

const messageSchema = z.object({
  role: z.enum(['system', 'user']),
  content: z.string(),
}).strict();

const requestSchema = z.object({
  model: z.string(),
  messages: z.array(messageSchema),
  max_tokens: z.literal(1024),
  temperature: z.literal(0.1),
  response_format: z.object({ type: z.literal('json_object') }).strict(),
}).strict();

const minimalResponseBodySchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }).strict(),
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
