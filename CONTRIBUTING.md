# Contributing to A2PCheck

This repo contains the OSS scanner engine — a Cloudflare Worker. The web frontend at [a2pcheck.com](https://a2pcheck.com) lives in a separate repo.

## Local development setup

```bash
cd worker
npm install
cp wrangler.toml.example wrangler.toml   # Fill in your Cloudflare resource IDs
cp .dev.vars.example .dev.vars           # Fill in your API keys
npm run dev
```

## Adding a new scanner

Scanners live in `worker/src/scanners/`. This is the most common type of contribution.

1. Create a new file in `worker/src/scanners/` (e.g., `myCheck.ts`)
2. Export a function that takes `(input: ScanRequest, env: Env)` and returns a `FieldResult`
3. For deterministic scanners, return results synchronously. For AI scanners, use the AI service in `worker/src/services/ai.ts`
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
npm test              # Run once
npm run test:watch    # Watch mode
```

## Pull requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Ensure `npm test` passes in `worker/`
5. Open a PR with a clear description of what changed and why
