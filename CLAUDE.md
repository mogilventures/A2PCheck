# CLAUDE.md

Single-package repo: the `worker/` Cloudflare Worker scanner API. See `README.md` for full project context.

## Commands

There are no root-level scripts. Always `cd worker` first.

### worker/

```bash
npm run dev       # Start Wrangler dev server
npm run deploy    # Deploy to Cloudflare
npm test          # Run Vitest tests
npm run test:watch
```

## Key conventions

- **Scanner pattern**: each scanner exports a function `(input: ScanRequest, env: Env) => FieldResult | Promise<FieldResult>`, registered in `worker/src/scanners/index.ts` via `orchestrateScan()`.
- **Scan phases**: deterministic scanners run in Phase 1 (synchronous, instant). AI scanners run in Phase 2a (parallel async). Firecrawl-dependent scanners run in Phase 2b.
- **Path alias**: `@/` maps to `worker/src/` in the worker package.
- **TypeScript strict mode**. No linter configured.

## Environment setup

Copy the example files and fill in your keys:

- `worker/.dev.vars.example` → `worker/.dev.vars`
- `worker/wrangler.toml.example` → `worker/wrangler.toml`

See `README.md` for the full list of required variables.

## Testing

Only deterministic scanners have tests currently. Tests live in `worker/test/` and use Vitest.
