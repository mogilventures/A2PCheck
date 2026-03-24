import { CallerContext, Env, ApiKeyRecord } from '../types';
import { IRequest } from 'itty-router';

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function identifyCaller(request: IRequest, env: Env): Promise<CallerContext> {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '0.0.0.0';
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return { type: 'web', ip };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthError('Invalid Authorization header format. Use: Bearer <api_key>', 401, 'UNAUTHORIZED');
  }

  const apiKey = parts[1];
  if (!apiKey.startsWith('a2p_live_')) {
    throw new AuthError('Invalid API key format', 401, 'UNAUTHORIZED');
  }

  const keyHash = await hashKey(apiKey);

  const result = await env.DB.prepare('SELECT * FROM api_keys WHERE key_hash = ?').bind(keyHash).first<ApiKeyRecord>();

  if (!result) {
    throw new AuthError('Invalid API key', 401, 'UNAUTHORIZED');
  }

  if (!result.is_active) {
    throw new AuthError('API key is inactive', 403, 'FORBIDDEN');
  }

  // Update last_used_at and total_scans
  await env.DB.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\'), total_scans = total_scans + 1 WHERE id = ?')
    .bind(result.id)
    .run();

  return { type: 'api', ip, apiKey: result };
}
