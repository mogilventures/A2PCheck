import { z } from 'zod';
import type { ZodSchema } from 'zod';

/** A chat message accepted by the configured AI provider. */
export interface AiMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

/** The stable provider request assembled by the AI analysis service. */
export interface AiCompletionRequest {
  readonly model: string;
  readonly messages: readonly AiMessage[];
  readonly max_tokens: 1024;
  readonly temperature: 0.1;
  readonly response_format: { readonly type: 'json_object' };
}

/** The transport-level provider response consumed by the AI analysis service. */
export interface AiGatewayResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}

/** Intentional seam for completing an AI request without moving parsing or retry policy out of production code. */
export interface AiGateway {
  complete(request: AiCompletionRequest): Promise<AiGatewayResponse>;
}

/** Configuration for the OpenRouter-compatible Cloudflare AI Gateway adapter. */
export interface OpenRouterAiGatewayConfig {
  readonly url: string;
  readonly token: string;
}

export const MODELS = {
  standard: 'openai/gpt-4o-mini',
  premium: 'anthropic/claude-sonnet-4-6',
} as const;

export type AiTier = keyof typeof MODELS;

export const DEFAULT_MODEL = MODELS.standard;

const aiGatewayEnvelopeSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    })
  ).min(1),
});

/** Resolves an authorized model tier, defaulting unknown values to the standard model. */
export function resolveModel(tier: string | null | undefined): string {
  if (tier && tier in MODELS) {
    return MODELS[tier as AiTier];
  }
  return DEFAULT_MODEL;
}

/** Creates the production adapter for an OpenRouter-compatible Cloudflare AI Gateway endpoint. */
export function createOpenRouterAiGateway(config: OpenRouterAiGatewayConfig): AiGateway {
  return {
    async complete(request: AiCompletionRequest): Promise<AiGatewayResponse> {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-aig-authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        return { ok: false, status: response.status, body: null };
      }

      const body: unknown = await response.json();
      return { ok: true, status: response.status, body };
    },
  };
}

/**
 * Runs a schema-constrained AI completion with production-owned response parsing and retry policy.
 * Returns null when every attempt fails transport, envelope, JSON-content, or result-schema validation.
 */
export async function runAiAnalysis<T>(
  gateway: AiGateway,
  messages: readonly AiMessage[],
  schema: ZodSchema<T>,
  model: string = DEFAULT_MODEL,
  retries = 1
): Promise<T | null> {
  const request: AiCompletionRequest = {
    model,
    messages,
    max_tokens: 1024,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await gateway.complete(request);
      if (!response.ok) continue;

      const envelope = aiGatewayEnvelopeSchema.safeParse(response.body);
      if (!envelope.success) continue;

      const content = envelope.data.choices[0]?.message.content;
      if (content === undefined) continue;

      const decoded: unknown = JSON.parse(content.trim());
      const validated = schema.safeParse(decoded);
      if (validated.success) {
        return validated.data;
      }
    } catch {
      // A failed transport or malformed JSON content is retryable.
    }
  }

  return null;
}

export const aiResultSchema = z.object({
  tier: z.enum(['RED', 'YELLOW', 'GREEN']),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  rationale: z.string(),
});

export type AiResult = z.infer<typeof aiResultSchema>;
