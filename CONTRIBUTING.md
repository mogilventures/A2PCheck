# Contributing to A2PCheck

This repo contains the OSS scanner engine — a Cloudflare Worker. The web frontend at [a2pcheck.com](https://a2pcheck.com) lives in a separate repo.

## Local development setup

```bash
cd worker
npm ci
cp wrangler.toml.example wrangler.toml   # Fill in your Cloudflare resource IDs
cp .dev.vars.example .dev.vars           # Fill in your API keys
npm run dev
```

## Adding a new scanner

Scanners live in `worker/src/scanners/`. This is the most common type of contribution.

1. Create a new file in `worker/src/scanners/` (e.g., `myCheck.ts`)
2. Export a function that takes a `ScanRequest` and returns a `FieldResult`
3. For deterministic scanners, return results synchronously. For AI scanners, accept the narrow `AiGateway` seam and use `runAiAnalysis()` in `worker/src/services/ai.ts`; do not pass `Env` into an AI scanner
4. Register your scanner in `worker/src/scanners/index.ts` by importing it and adding it to the appropriate phase in `orchestrateScan()`
5. Add a test in `worker/test/scanners/`

Look at `worker/src/scanners/optOut.ts` (deterministic) or `worker/src/scanners/description.ts` (AI) as examples.

### Scanner return format

Every scanner returns a `FieldResult` with:
- `field` — machine-readable field name
- `displayName` — human-readable name
- `tier` — `RED` | `YELLOW` | `GREEN`
- `rationale` — explanation of the result
- `issues` — array of `{ severity, message }` objects
- `suggestions` — array of `{ issue, fix, example }` objects
- `evidence` — `{ source: 'deterministic' | 'ai' }`

## Running tests

```bash
cd worker
npm test              # Offline run; no external credentials required
npm run test:watch    # Watch mode
npx tsc --noEmit      # Type check production source
```

### AI scanner replay fixtures

Every AI scanner has semantic happy and deficient/noncompliant replay cases in `worker/test/fixtures/ai/`. Each JSON fixture is parsed at runtime and bound to the complete production request. Any prompt, standard model, or request-control drift therefore fails loudly rather than replaying a stale response. Tests assert stable semantics (tier, issues/severity, evidence source, and relevant Twilio code), never exact provider prose. Privacy Policy and Terms of Service cases supply static successful crawl content and never call Firecrawl.

Do not use `vi.mock`, `vi.spyOn`, or a patched global `fetch` for AI coverage. Supply a replay or recording implementation through the production `AiGateway` seam.

To intentionally refresh all AI fixtures:

```bash
cd worker
AI_GATEWAY_URL='https://gateway.example/…' \
CF_AIG_TOKEN='your-token' \
npm run fixtures:ai:record
```

**This command is billable and networked.** It uses the production gateway and standard model, records all cases sequentially, validates the provider envelope plus `aiResultSchema`, checks expected scanner semantics, and then atomically overwrites each stable JSON fixture. It fails before any writes when either credential is missing. Review fixture diffs before committing; fixtures must contain only synthetic campaign content and must not contain credentials or provider metadata.

Issue #8 supersedes the earlier AI fixture-testing request in issue #5.

## Pull requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Ensure `npm test` passes in `worker/`
5. Open a PR with a clear description of what changed and why
