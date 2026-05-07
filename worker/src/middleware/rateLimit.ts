import { CallerContext, Env } from '../types';

interface RateLimitResult {
  retryAfterSeconds: number;
}

interface WindowConfig {
  key: string;
  limit: number;
  windowSeconds: number;
}

function getWindowKey(prefix: string, windowSeconds: number): string {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  return `rl:${prefix}:${windowStart}`;
}

async function checkWindow(env: Env, config: WindowConfig): Promise<RateLimitResult | null> {
  const kvKey = getWindowKey(config.key, config.windowSeconds);
  const current = parseInt((await env.RATE_LIMIT.get(kvKey)) || '0', 10);

  if (current >= config.limit) {
    const windowStart = Math.floor(Date.now() / 1000 / config.windowSeconds) * config.windowSeconds;
    const windowEnd = windowStart + config.windowSeconds;
    const retryAfterSeconds = Math.max(1, windowEnd - Math.floor(Date.now() / 1000));
    return { retryAfterSeconds };
  }

  await env.RATE_LIMIT.put(kvKey, String(current + 1), {
    expirationTtl: config.windowSeconds + 60,
  });

  return null;
}

export async function checkRateLimit(
  caller: CallerContext,
  env: Env
): Promise<RateLimitResult | null> {
  const windows: WindowConfig[] = [
    { key: `web:${caller.ip}`, limit: 5, windowSeconds: 3600 },
    { key: `web:day:${caller.ip}`, limit: 20, windowSeconds: 86400 },
  ];

  for (const w of windows) {
    const result = await checkWindow(env, w);
    if (result) return result;
  }

  return null;
}
