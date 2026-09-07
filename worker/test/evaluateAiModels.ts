import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createAiCompletionRequest, createOpenRouterAiGateway } from '../src/services/ai';
import { goodCampaign, badCampaign } from './fixtures/campaigns';
import { aiScannerCases } from './support/aiScannerCases';
import { evaluateAiScannerCase, evaluateQuickScan } from './support/aiModelEvaluation';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    model: { type: 'string', multiple: true },
    output: { type: 'string' },
    repetitions: { type: 'string', default: '2' },
  } });
  const url = process.env.AI_GATEWAY_URL?.trim();
  const token = process.env.CF_AIG_TOKEN?.trim();
  if (!url || !token) throw new Error('Set AI_GATEWAY_URL and CF_AIG_TOKEN before evaluating.');
  const endpoint = new URL(url);
  if (endpoint.origin !== 'https://gateway.ai.cloudflare.com'
    || !/^\/v1\/[a-f0-9]{32}\/[a-z0-9-]+\/openrouter\/(?:v1\/)?chat\/completions$/.test(endpoint.pathname)
    || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
    throw new Error('Evaluation requires the existing Cloudflare OpenRouter gateway endpoint.');
  }
  const models = values.model;
  const output = values.output;
  const repetitions = Number(values.repetitions);
  if (!models?.length || models.length > 4 || new Set(models).size !== models.length
    || models.some((model) => createAiCompletionRequest([], model) === null)
    || !output || !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3) {
    throw new Error('Supply 1–4 distinct policy-known --model values, --output, and --repetitions 1–3.');
  }

  const reports = [];
  // Sequential by design: the production gateway has a 50-request/minute limit.
  // A modest minimum case interval also leaves room for ordinary production traffic.
  for (const model of models) {
    const cases = [];
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      for (const scannerCase of aiScannerCases) {
        const started = performance.now();
        const gateway = createOpenRouterAiGateway({ url, token }, { signal: AbortSignal.timeout(45_000) });
        const result = await evaluateAiScannerCase(gateway, scannerCase, model, () => performance.now());
        cases.push({ repetition, ...result });
        console.log(JSON.stringify({ model, repetition, scanner: result.scanner, case: result.fixtureCase,
          semanticPass: result.semanticPass, firstAttemptValid: result.firstAttemptValid,
          providerMatches: result.providerMatches, attempts: result.attempts.length, durationMs: result.durationMs }));
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, 5_000 - (performance.now() - started))));
      }
    }

    const quickScans = [];
    for (const [fixture, request, expectedTier] of [
      ['good', goodCampaign, 'YELLOW'], ['bad', badCampaign, 'RED'],
    ] as const) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45_000);
      try {
        const gateway = createOpenRouterAiGateway({ url, token }, { signal: controller.signal });
        const result = await evaluateQuickScan(gateway, request, model, expectedTier, () => performance.now());
        quickScans.push({ fixture, ...result });
      } finally { clearTimeout(timer); controller.abort(); }
      // Quick runs five AI field checks concurrently; do not immediately burst another scan.
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }

    const durations = cases.map((item) => item.durationMs).sort((a, b) => a - b);
    const attempts = cases.flatMap((item) => item.attempts);
    reports.push({ model, repetitions, requestPolicy: createAiCompletionRequest([], model),
      summary: {
        cases: cases.length,
        semanticPasses: cases.filter((item) => item.semanticPass).length,
        firstAttemptValid: cases.filter((item) => item.firstAttemptValid).length,
        falseGreens: cases.filter((item) => item.falseGreen).length,
        retries: attempts.length - cases.length,
        providerMatches: cases.every((item) => item.providerMatches),
        p50Ms: durations[Math.ceil(durations.length * 0.5) - 1],
        p95Ms: durations[Math.ceil(durations.length * 0.95) - 1],
        reportedCost: attempts.every((attempt) => attempt.cost !== null)
          ? attempts.reduce((sum, attempt) => sum + (attempt.cost ?? 0), 0) : null,
        passed: cases.every((item) => item.semanticPass && item.firstAttemptValid && item.providerMatches
          && item.attempts.length === 1) && quickScans.every((scan) => scan.passed),
      }, cases, quickScans,
    });
  }
  // Explicit local artifact: synthetic rewrites are for reviewed quality comparisons, not analytics.
  await writeFile(output, JSON.stringify({ evaluatedAt: new Date().toISOString(), reports }, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(reports.map(({ model, summary, quickScans }) => ({ model, summary, quickScans })), null, 2));
  if (reports.some((report) => !report.summary.passed)) process.exitCode = 1;
}

main().catch(() => {
  // Do not print unexpected provider/transport exception bodies or credential-bearing URLs.
  console.error('Evaluation did not complete. Check credentials, model flags, gateway access, and a new output path.');
  process.exitCode = 1;
});
