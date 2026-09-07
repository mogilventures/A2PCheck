# CLAUDE.md

Single-package repo: the `worker/` Cloudflare Worker scanner API. See `README.md` for full project context.

## Workspace relationship

This repo lives in the local workspace `/root/github_repos/ventures/a2pcheck/` beside `../a2pcheck-app/`.

Claude must treat this repo and `../a2pcheck-app/` as separate git repos with separate remotes, branches, commits, dependencies, and deployment surfaces. Do not merge the repos, initialize git in the parent workspace, create submodules, or move secrets/env files between repos unless Noah explicitly asks.

For cross-repo work, inspect `../CLAUDE.md` and add the sibling app repo with `/add-dir ../a2pcheck-app` if it is not already in scope. Keep commits separate per child repo and only commit if Noah explicitly asks.

## Commands

There are no root-level scripts. Always `cd worker` first.

### worker/

```bash
npm run dev       # Start Wrangler dev server
npm run deploy    # Deploy to Cloudflare
npm test                    # Run all offline Vitest tests
npm run test:watch
npm run test:worker         # Offline workerd contract checks; includes a real 45-second deadline
npm run typecheck           # Production source plus test/evaluation TypeScript
npm run eval:ai -- --model z-ai/glm-5.3-flash --output /tmp/a2p-evaluation.json # Billable; env required
npm run fixtures:ai:record  # Billable/networked; sequentially refresh AI replay fixtures
```

## Key conventions

- **Scanner pattern**: deterministic scanners take `ScanRequest`; AI scanners take the intentional `AiGateway` seam plus a model. Register scanners in `worker/src/scanners/index.ts` via `orchestrateScan()`. Construct the production gateway only at the HTTP composition boundary.
- **Scan phases**: deterministic checks run first. Independent AI checks (including consistency) start together; each policy check waits only for its own page. Full premium synthesis follows completed field checks. All operations share one caller-owned 45-second cancellation deadline; see `worker/docs/revision-pack.md`.
- **Path alias**: `@/` maps to `worker/src/` in the worker package.
- **TypeScript strict mode**. No linter configured.

## Environment setup

Copy the example files and fill in your keys:

- `worker/.dev.vars.example` → `worker/.dev.vars`
- `worker/wrangler.toml.example` → `worker/wrangler.toml`

See `README.md` for the full list of required variables.

## Testing

Tests live in `worker/test/` and use Vitest. `npm test` is offline and must not require AI, Firecrawl, or other external credentials. AI scanner tests replay parsed, request-bound fixtures under `worker/test/fixtures/ai/`; prompt, model, or request-control drift must fail until fixtures are intentionally re-recorded. Do not replace `AiGateway` with `vi.mock`, `vi.spyOn`, or patched global `fetch`.

AI fixture recording is an explicit billable/networked operation:

```bash
cd worker
AI_GATEWAY_URL='https://…' CF_AIG_TOKEN='…' npm run fixtures:ai:record
```

The command runs sequentially with the standard model, validates the provider envelope and scanner result schema, and atomically overwrites each fixture. It refuses to write anything if either credential is absent. Fixtures contain only synthetic campaign content and the minimum replay envelope; never add secrets or provider metadata.

Recording also rejects a successful retry: fixtures must not hide first-attempt
schema failures. See `worker/docs/model-evaluation.md` for the provider-pinned
synthetic bake-off, model request controls, and release gates. Never switch a model
or widen provider routing solely because it is available in a catalog.

GitHub issue #8 supersedes the earlier fixture-testing request in #5.
