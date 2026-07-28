import { isDeepStrictEqual } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AiCompletionRequest,
  AiGateway,
  AiGatewayResponse,
} from '../../src/services/ai';
import { aiReplayFixtureSchema } from './aiFixtureSchema';
import type { AiReplayFixture } from './aiFixtureSchema';

/** Parses one checked-in fixture and replays it only for its exact bound request. */
export class FixtureReplayAiGateway implements AiGateway {
  private requestCount = 0;
  private mismatch: string | undefined;

  private constructor(private readonly fixture: AiReplayFixture) {}

  /** Loads and parses a fixture for one scanner case. */
  static async load(scanner: string, fixtureCase: string): Promise<FixtureReplayAiGateway> {
    const fixturePath = path.resolve('test', 'fixtures', 'ai', scanner, `${fixtureCase}.json`);
    const serialized = await readFile(fixturePath, 'utf8');
    const decoded: unknown = JSON.parse(serialized);
    return new FixtureReplayAiGateway(aiReplayFixtureSchema.parse(decoded));
  }

  /** Returns the fixture response only when the complete production request matches exactly. */
  async complete(request: AiCompletionRequest): Promise<AiGatewayResponse> {
    this.requestCount += 1;
    if (!isDeepStrictEqual(request, this.fixture.request)) {
      this.mismatch = [
        'AI fixture request mismatch. Re-record fixtures after intentional prompt/model/control changes.',
        `Expected: ${JSON.stringify(this.fixture.request)}`,
        `Received: ${JSON.stringify(request)}`,
      ].join('\n');
      throw new Error(this.mismatch);
    }

    return this.fixture.response;
  }

  /** Fails the test if replay did not make exactly one matching gateway request. */
  assertSatisfied(): void {
    if (this.mismatch !== undefined) {
      throw new Error(this.mismatch);
    }
    if (this.requestCount !== 1) {
      throw new Error(`Expected exactly one matching AI request, received ${this.requestCount}`);
    }
  }
}
