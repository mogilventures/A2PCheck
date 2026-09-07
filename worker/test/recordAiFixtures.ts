import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createOpenRouterAiGateway } from '../src/services/ai';
import { aiScannerCases } from './support/aiScannerCases';
import type { AiScannerCase } from './support/aiScannerCases';
import { collectValidatedAiFixtures } from './support/aiFixtureRecorder';
import type { RecordedExchange } from './support/aiFixtureRecorder';

function requireCredentials(): { readonly url: string; readonly token: string } {
  const url = process.env.AI_GATEWAY_URL?.trim();
  const token = process.env.CF_AIG_TOKEN?.trim();
  const missing = [
    ...(url ? [] : ['AI_GATEWAY_URL']),
    ...(token ? [] : ['CF_AIG_TOKEN']),
  ];

  if (!url || !token) {
    throw new Error(
      `Refusing to record AI fixtures before writes: missing ${missing.join(', ')}`
    );
  }

  return { url, token };
}

async function atomicWriteFixture(scannerCase: AiScannerCase, exchange: RecordedExchange): Promise<void> {
  const directory = path.resolve('test', 'fixtures', 'ai', scannerCase.scanner);
  const destination = path.join(directory, `${scannerCase.fixtureCase}.json`);
  const temporary = `${destination}.tmp`;
  const fixture = `${JSON.stringify(exchange, null, 2)}\n`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporary, fixture, 'utf8');
  await rename(temporary, destination);
}

async function main(): Promise<void> {
  // This guard intentionally runs before network calls, directory creation, or fixture writes.
  const config = requireCredentials();
  const productionGateway = createOpenRouterAiGateway(config, { signal: AbortSignal.timeout(10 * 60_000) });

  // Collection is deliberately sequential to avoid bursting a billable provider. It must
  // fully succeed before this command begins any fixture write.
  const pendingWrites = await collectValidatedAiFixtures(productionGateway, aiScannerCases);
  for (const { scannerCase } of pendingWrites) {
    console.log(`Validated ${scannerCase.scanner}/${scannerCase.fixtureCase}`);
  }

  for (const { scannerCase, exchange } of pendingWrites) {
    await atomicWriteFixture(scannerCase, exchange);
    console.log(`Recorded ${scannerCase.scanner}/${scannerCase.fixtureCase}`);
  }
}

await main();
