import { z } from 'zod';
import type { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** A chat message accepted by the configured AI provider. */
export interface AiMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

const providerRestrictions = {
  allow_fallbacks: false,
  require_parameters: true,
  data_collection: 'deny',
} as const;

// Model and required controls travel together. Adding a model requires an explicit
// hosting decision; OpenRouter must not silently choose another inference provider.
const modelPolicies = [
  { model: 'openai/gpt-4o-mini', temperature: 0.1,
    provider: { ...providerRestrictions, only: ['openai'] } },
  { model: 'anthropic/claude-sonnet-4-6', temperature: 0.1,
    provider: { ...providerRestrictions, only: ['anthropic'] } },
  { model: 'z-ai/glm-5.3-flash', temperature: 0.1, reasoning_effort: 'low',
    provider: { ...providerRestrictions, only: ['cloudflare'] } },
  // Opus 4.8 does not support temperature on the direct Anthropic endpoint.
  { model: 'anthropic/claude-opus-4.8', reasoning_effort: 'low',
    provider: { ...providerRestrictions, only: ['anthropic'] } },
] as const;

/** Models with an explicit, provider-pinned request policy; not all are selected tiers. */
export type AiModel = (typeof modelPolicies)[number]['model'];

/** The stable request, including controls required by the selected model. */
export type AiCompletionRequest = (typeof modelPolicies)[number] & {
  readonly messages: readonly AiMessage[];
  readonly max_tokens: 1024 | 4096;
  readonly response_format: { readonly type: 'json_object' } | {
    readonly type: 'json_schema';
    readonly json_schema: {
      readonly name: 'scan_result';
      readonly strict: true;
      readonly schema: ReturnType<typeof zodToJsonSchema>;
    };
  };
};

/** Build a policy-complete request, or reject an unevaluated/unknown model identifier. */
export function createAiCompletionRequest(
  messages: readonly AiMessage[],
  model: string,
  schema: ZodSchema = aiResultSchema,
  options: { readonly maxTokens?: 1024 | 4096 } = {},
): AiCompletionRequest | null {
  const policy = modelPolicies.find((candidate) => candidate.model === model);
  if (policy === undefined) return null;
  if (policy.model === 'anthropic/claude-sonnet-4-6' || policy.model === 'anthropic/claude-opus-4.8') {
    // Claude's JSON-object mode returned fenced Markdown in the live bake-off.
    // Derive its native constrained output schema from the same runtime parser.
    const { $schema: _dialect, ...jsonSchema } = zodToJsonSchema(schema, { $refStrategy: 'none' });
    return { ...policy, messages, max_tokens: options.maxTokens ?? 1024,
      response_format: { type: 'json_schema', json_schema: { name: 'scan_result', strict: true, schema: jsonSchema } },
    };
  }
  return { ...policy, messages, max_tokens: options.maxTokens ?? 1024, response_format: { type: 'json_object' } };
}

/** The transport-level provider response consumed by the AI analysis service. */
export interface AiGatewayResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}

/** Intentional seam for completing an AI request without moving parsing or retry policy out of production code. */
export interface AiGateway {
  complete(request: AiCompletionRequest, options?: { readonly signal?: AbortSignal }): Promise<AiGatewayResponse>;
}

/** Configuration for the OpenRouter-compatible Cloudflare AI Gateway adapter. */
export interface OpenRouterAiGatewayConfig {
  readonly url: string;
  readonly token: string;
}

/** Selected tiers remain unchanged until the gateway bake-off supports a cutover. */
export const MODELS = {
  standard: 'openai/gpt-4o-mini',
  premium: 'anthropic/claude-sonnet-4-6',
} as const satisfies Record<'standard' | 'premium', AiModel>;

export type AiTier = keyof typeof MODELS;

export const DEFAULT_MODEL = MODELS.standard;

const aiGatewayEnvelopeSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
      finish_reason: z.literal('stop').optional(),
    })
  ).min(1),
});

/** Resolves an authorized model tier, defaulting unknown values to the standard model. */
export function resolveModel(tier: string | null | undefined): AiModel {
  return tier === 'premium' ? MODELS.premium : MODELS.standard;
}

/** Creates the production adapter for an OpenRouter-compatible Cloudflare AI Gateway endpoint. */
export function createOpenRouterAiGateway(
  config: OpenRouterAiGatewayConfig,
  options: { readonly signal?: AbortSignal } = {},
): AiGateway {
  return {
    async complete(request: AiCompletionRequest, callOptions = {}): Promise<AiGatewayResponse> {
      const signals = [options.signal, callOptions.signal].filter((signal): signal is AbortSignal => signal !== undefined);
      const signal = signals.length ? AbortSignal.any(signals) : undefined;
      if (signal?.aborted) return { ok: false, status: 408, body: null };
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-aig-authorization': `Bearer ${config.token}`,
          'cf-aig-collect-log': 'false',
          'cf-aig-skip-cache': 'true',
        },
        body: JSON.stringify(request),
        signal,
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
  retries = 1,
  options: { readonly signal?: AbortSignal; readonly maxTokens?: 1024 | 4096 } = {},
): Promise<T | null> {
  const request = createAiCompletionRequest(messages, model, schema, options);
  if (request === null) return null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (options.signal?.aborted) return null;
      const response = await gateway.complete(request, options);
      if (options.signal?.aborted) return null;
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
