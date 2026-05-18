import { Env } from '../types';

export interface FirecrawlResult {
  success: boolean;
  content: string;
  statusCode: number;
  error?: string;
}

const TIMEOUT_MS = 15000;
const MAX_CONTENT_LENGTH = 50000;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '169.254.169.254', // AWS / GCP / Azure IMDS
  'metadata.google.internal',
  'metadata.goog',
  'metadata.azure.com',
]);

// Reject URLs that target loopback, private, link-local, or cloud-metadata
// addresses. This is a string-level defense — DNS rebinding can still bypass
// it since Firecrawl resolves the hostname independently — but it stops the
// obvious literal-IP attacks.
function isPubliclyRoutableUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (host.endsWith('.localhost') || host.endsWith('.internal')) return false;

  // IPv4 literal
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const octets = ipv4.slice(1).map((n) => parseInt(n, 10));
    if (octets.some((o) => o < 0 || o > 255)) return false;
    const [a, b] = octets;
    if (a === 10) return false; // 10.0.0.0/8
    if (a === 127) return false; // loopback
    if (a === 0) return false; // 0.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
    if (a === 192 && b === 168) return false; // 192.168.0.0/16
    if (a === 169 && b === 254) return false; // link-local
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64.0.0/10
    if (a >= 224) return false; // multicast + reserved
  }

  // IPv6 literal — URL hostnames are wrapped in [].
  if (host.startsWith('[') && host.endsWith(']')) {
    const v6 = host.slice(1, -1).toLowerCase();
    if (v6 === '::1' || v6 === '::') return false;
    if (v6.startsWith('fc') || v6.startsWith('fd')) return false; // unique local
    if (v6.startsWith('fe80:') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb')) return false; // link-local
    if (v6.startsWith('::ffff:')) return false; // IPv4-mapped — would need full v4 check; conservative reject
  }

  return true;
}

export async function scrapeUrl(url: string, env: Env): Promise<FirecrawlResult> {
  if (!isPubliclyRoutableUrl(url)) {
    return {
      success: false,
      content: '',
      statusCode: 400,
      error: 'URL is not a publicly routable http(s) address',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      return {
        success: false,
        content: '',
        statusCode: status,
        error: `HTTP ${status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as {
      success: boolean;
      data?: { markdown?: string };
      error?: string;
    };

    if (!data.success) {
      return {
        success: false,
        content: '',
        statusCode: 200,
        error: data.error || 'Firecrawl returned unsuccessful response',
      };
    }

    const content = (data.data?.markdown || '').slice(0, MAX_CONTENT_LENGTH);

    return {
      success: true,
      content,
      statusCode: 200,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        content: '',
        statusCode: 0,
        error: 'Request timed out after 15 seconds',
      };
    }

    return {
      success: false,
      content: '',
      statusCode: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function crawlUrls(
  urls: { label: string; url: string }[],
  env: Env
): Promise<Map<string, FirecrawlResult>> {
  const results = new Map<string, FirecrawlResult>();
  const settled = await Promise.allSettled(
    urls.map(async ({ label, url }) => {
      const result = await scrapeUrl(url, env);
      return { label, result };
    })
  );

  for (const entry of settled) {
    if (entry.status === 'fulfilled') {
      results.set(entry.value.label, entry.value.result);
    } else {
      results.set('unknown', {
        success: false,
        content: '',
        statusCode: 0,
        error: 'Promise rejected',
      });
    }
  }

  return results;
}
