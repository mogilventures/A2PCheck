import { createServer } from 'node:http';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createOpenRouterAiGateway, runAiAnalysis } from '../../src/services/ai';

describe('OpenRouter gateway transport', () => {
  it('sends required policy and privacy headers over HTTP and propagates cancellation', async () => {
    const received: { headers: Record<string, string | string[] | undefined>; body: unknown }[] = [];
    const server = createServer((request, response) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => { body += chunk; });
      request.on('end', () => {
        const decoded: unknown = JSON.parse(body);
        received.push({ headers: request.headers, body: decoded });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }));
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing local test listener');
      const config = { url: `http://127.0.0.1:${address.port}`, token: 'synthetic-test-token' };
      const messages = [{ role: 'user', content: 'Synthetic test.' }] as const;
      const schema = z.object({ ok: z.literal(true) });
      const result = await runAiAnalysis(createOpenRouterAiGateway(config), messages, schema, 'z-ai/glm-5.3-flash');
      expect(result).toEqual({ ok: true });
      expect(received).toHaveLength(1);
      expect(received[0]?.headers).toMatchObject({
        'cf-aig-authorization': 'Bearer synthetic-test-token',
        'cf-aig-collect-log': 'false',
        'cf-aig-skip-cache': 'true',
      });
      expect(received[0]?.body).toMatchObject({
        model: 'z-ai/glm-5.3-flash', reasoning_effort: 'low',
        provider: { only: ['cloudflare'], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' },
      });
      const controller = new AbortController();
      controller.abort();
      await expect(runAiAnalysis(createOpenRouterAiGateway(config, { signal: controller.signal }),
        messages, schema)).resolves.toBeNull();
      expect(received).toHaveLength(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
