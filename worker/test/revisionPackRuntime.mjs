import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Log, LogLevel, Miniflare } from 'miniflare';

// Real workerd / HTTP composition, synthetic upstreams only. No secrets or live traffic.
const logs = [];
class CapturedLog extends Log {
  logWithLevel(_level, message) { logs.push(message); }
}
const requests = [];
const bundle = await build({ entryPoints: ['src/index.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', loader: { '.yaml': 'text' }, write: false });
const worker = new Miniflare({
  modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2024-12-01', kvNamespaces: ['RATE_LIMIT'],
  log: new CapturedLog(LogLevel.DEBUG),
  handleRuntimeStdio: (stdout, stderr) => {
    stdout.on('data', (chunk) => logs.push(String(chunk)));
    stderr.on('data', (chunk) => logs.push(String(chunk)));
  },
  bindings: {
    AI_GATEWAY_URL: 'https://gateway.synthetic.test/chat/completions', CF_AIG_TOKEN: 'synthetic-token',
    FIRECRAWL_API_KEY: 'synthetic-crawl-token', PREMIUM_API_KEY: 'synthetic-premium-key',
    RULES_VERSION: 'synthetic', ALLOWED_ORIGINS: 'https://synthetic.test',
  },
  outboundService: { node: async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({ body, headers: request.headers });
    response.setHeader('Content-Type', 'application/json');
    if (body.formats) {
      if (body.url.endsWith('/missing')) { response.writeHead(404); response.end('{}'); return; }
      if (body.url.endsWith('/slow')) { response.writeHead(200); response.write('{'); return; }
      response.end(JSON.stringify({ success: true, data: { markdown: 'Synthetic policy mentions messaging.' } }));
      return;
    }
    const synthesis = body.max_tokens === 4096;
    const payload = synthesis ? JSON.parse(body.messages[1].content) : undefined;
    if (synthesis && payload.campaign.businessName === 'STALL_PRIVATE_SENTINEL') {
      // Deliberately never finish the upstream response. workerd must abort its
      // fetch and return the completed field checks at the real 45-second deadline.
      return;
    }
    const content = synthesis
      ? payload.campaign.businessName === 'MALFORMED_PRIVATE_SENTINEL' ? { unexpected: true } : {
        actions: payload.findings.filter((finding) => finding.tier !== 'GREEN').map(({ field }) => ({
          field, instruction: 'Review the original evidence and provide missing campaign facts.', kind: 'provide_information',
        })), replacements: [],
      }
      : { tier: 'YELLOW', rationale: 'Synthetic field evidence.', issues: [], suggestions: [] };
    response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }));
  } },
});
const campaign = {
  useCaseType: 'MARKETING', businessName: 'PRIVATE_SENTINEL',
  campaignDescription: 'BrightMarket sends weekly product offers to customers who explicitly subscribe at checkout. Messages identify the business and include opt-out instructions.',
  sampleMessages: ['Your requested offer. Reply STOP to unsubscribe.', 'Your weekly offer. Reply HELP for help.'],
  messageFlow: 'Customers select an optional unchecked consent box.',
  optOutKeywords: ['CANCEL'], helpKeywords: ['HELP'], privacyPolicyUrl: 'https://brightmarket.example/missing',
  termsOfServiceUrl: 'https://brightmarket.example/terms',
};
let nextIp = 1;
async function scan({ quick = false, key = 'synthetic-premium-key', name = 'PRIVATE_SENTINEL' } = {}) {
  const response = await worker.dispatchFetch(`https://worker.test/api/v1/scan${quick ? '/quick' : ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AI-Tier': 'premium', Authorization: `Bearer ${key}`, 'CF-Connecting-IP': `192.0.2.${nextIp++}` },
    body: JSON.stringify({ ...campaign, businessName: name,
      ...(name === 'SLOW_PAGE_PRIVATE_SENTINEL' ? { privacyPolicyUrl: 'https://brightmarket.example/slow' } : {}),
    }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
try {
  const quick = await scan({ quick: true });
  assert(!Object.hasOwn(quick, 'revisionPack'));
  const before = requests.length;
  const standard = await scan({ key: 'incorrect' });
  assert.deepEqual(standard.revisionPack, { status: 'unavailable', reason: 'not_authorized' });
  assert(requests.slice(before).filter(({ body }) => body.messages).every(({ body }) => body.model === 'openai/gpt-4o-mini' && body.max_tokens === 1024));
  const concurrent = await Promise.all([scan(), scan(), scan({ name: 'MALFORMED_PRIVATE_SENTINEL' }), scan({ name: 'STALL_PRIVATE_SENTINEL' }), scan({ name: 'SLOW_PAGE_PRIVATE_SENTINEL' })]);
  for (const result of concurrent) {
    assert.equal(result.metadata.fieldsAnalyzed, 11);
    assert.equal(result.metadata.partial, undefined);
    assert.equal(result.overallTier, 'RED');
    assert(result.fieldResults.some((field) => field.field === 'optOutKeywords' && field.tier === 'RED' && field.evidence.source === 'deterministic'));
    assert(result.fieldResults.some((field) => field.field === 'privacyPolicy' && field.tier === (result === concurrent[4] ? 'YELLOW' : 'RED')));
    // One shared 45s work budget; allow 1s scheduler/HTTP delivery overhead in CI.
    assert(result.metadata.scanDurationMs < 46000);
  }
  assert.equal(concurrent[0].revisionPack.status, 'available');
  assert.equal(concurrent[1].revisionPack.status, 'available');
  assert.deepEqual(concurrent[2].revisionPack, { status: 'unavailable', reason: 'generation_failed' });
  assert.deepEqual(concurrent[3].revisionPack, { status: 'unavailable', reason: 'timeout' });
  assert.equal(concurrent[4].revisionPack.status, 'available');
  assert(concurrent[4].metadata.scanDurationMs >= 15000 && concurrent[4].metadata.scanDurationMs < 20000);
  assert(concurrent[4].fieldResults.find((field) => field.field === 'privacyPolicy').rationale.includes('cancelled or timed out'));
  for (const { body, headers } of requests.filter(({ body }) => body.messages)) {
    assert.equal(headers['cf-aig-collect-log'], 'false');
    assert.equal(headers['cf-aig-skip-cache'], 'true');
    assert.equal(body.provider.allow_fallbacks, false);
    assert.equal(body.provider.data_collection, 'deny');
    if (body.max_tokens === 4096) {
      assert.equal(body.model, 'anthropic/claude-sonnet-4-6');
      assert.equal(body.response_format.type, 'json_schema');
    }
  }
  assert(logs.join('\n').includes('Premium tier requested without a valid key'));
  assert(!logs.join('\n').includes('PRIVATE_SENTINEL'));
  assert(!logs.join('\n').includes('synthetic-token'));
  console.log(`PASS workerd: Quick absent, auth fallback, concurrent Full available/malformed/45s-timeout, RED preserved, privacy headers/logs; ${bundle.outputFiles[0].contents.length} byte bundle.`);
  console.log(`Synthetic concurrent Full durations (ms): ${concurrent.map((result) => result.metadata.scanDurationMs).join(', ')}`);
} finally {
  await worker.dispose();
}
