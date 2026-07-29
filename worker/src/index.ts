import { AutoRouter, cors, error, json, IRequest } from 'itty-router';
import type { Env, CallerContext, ErrorResponse } from './types';
import { campaignInputSchema } from './validators/campaignInput';
import { handlePreflight, withCors } from './middleware/cors';
import { checkRateLimit } from './middleware/rateLimit';
import { orchestrateScan } from './scanners/index';
import { createOpenRouterAiGateway, resolveModel } from './services/ai';
import openapiSpec from '../openapi.yaml';

const router = AutoRouter<IRequest, [Env]>();

router.options('*', (request, env) => handlePreflight(request, env));

router.get('/api/v1/health', () => json({ status: 'ok' }));

router.get('/api/v1/openapi.yaml', () => {
  return new Response(openapiSpec, {
    headers: { 'Content-Type': 'text/yaml; charset=utf-8' },
  });
});

router.post('/api/v1/scan', async (request, env) => {
  return handleScan(request, env, false);
});

router.post('/api/v1/scan/quick', async (request, env) => {
  return handleScan(request, env, true);
});

router.all('*', () => error(404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }));

async function handleScan(request: IRequest, env: Env, quickScan: boolean): Promise<Response> {
  const traceId = crypto.randomUUID();

  try {
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '0.0.0.0';
    const caller: CallerContext = { ip };

    const rateLimitResult = await checkRateLimit(caller, env);
    if (rateLimitResult) {
      return json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded',
            retryAfterSeconds: rateLimitResult.retryAfterSeconds,
            traceId,
          },
        } satisfies ErrorResponse,
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid JSON body',
            traceId,
          },
        } satisfies ErrorResponse,
        { status: 400 }
      );
    }

    const parsed = campaignInputSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        issue: i.message,
      }));
      return json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details,
            traceId,
          },
        } satisfies ErrorResponse,
        { status: 400 }
      );
    }

    const requestedTier = request.headers.get('X-AI-Tier');
    const effectiveTier = authorizeTier(requestedTier, request, env, traceId);
    const model = resolveModel(effectiveTier);
    const aiGateway = createOpenRouterAiGateway({
      url: env.AI_GATEWAY_URL,
      token: env.CF_AIG_TOKEN,
    });

    const result = await orchestrateScan(parsed.data, env, aiGateway, quickScan, traceId, model);
    return json(result);
  } catch (err) {
    console.error('Scan error:', err);
    return json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          traceId,
        },
      } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}

function authorizeTier(
  requestedTier: string | null,
  request: IRequest,
  env: Env,
  traceId: string
): string | null {
  if (requestedTier !== 'premium') {
    return requestedTier;
  }

  const auth = request.headers.get('Authorization');
  const provided = auth?.replace(/^Bearer\s+/i, '').trim();

  if (env.PREMIUM_API_KEY && provided && timingSafeEqual(provided, env.PREMIUM_API_KEY)) {
    return 'premium';
  }

  console.warn('Premium tier requested without a valid key; falling back to standard', { traceId });
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await router.fetch(request, env);
    return withCors(response, request, env);
  },
} satisfies ExportedHandler<Env>;
