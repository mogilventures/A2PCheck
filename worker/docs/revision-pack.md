# Full-scan revision packs (#15)

## Contract and scope

Goal: authorized premium Full scans return a bounded revision-and-review artifact without changing authoritative findings or inventing campaign facts.

In scope: Worker synthesis, response/OpenAPI contract, caller-owned cancellation, offline contract/runtime/concurrency verification, and the app's mirrored response type. Frontend presentation (#140), generated types (#3), billing/refunds, model changes, deployment and unrelated upgrades are separate work.

Completion checks:
- Full results contain runtime-validated available/unavailable status; Quick results omit it and standard Full cannot bypass premium authorization.
- Every non-GREEN finding remains authoritative and is represented in rejection-risk order; GREEN fields get no unnecessary replacements.
- Exact replacements contain only allowed complete submitted text blocks, retaining the original target. Missing facts require human input, not generated claims.
- Completed checks survive timeout/failure and downstream requests receive cancellation within the shared 45-second deadline.
- OpenAPI, malformed/failure/timeout tests, concurrent runtime checks and independent review agree with the implementation.

Stop before any unapproved commit, push, merge, deployment or billing change.

## API

`POST /api/v1/scan` includes `revisionPack`:

- `status: available`: `summary`, `disclaimer`, `actions`, `replacements`, `residualRisks`.
- `status: unavailable`: `reason` is one of `not_authorized`, `timeout`, `incomplete_scan`, `generation_failed`, `input_too_large`. No partial model draft is exposed.
- `POST /api/v1/scan/quick` omits the property entirely, even with premium authorization.

Premium synthesis requires the existing authorized `X-AI-Tier: premium` model selection. Missing/invalid keys still fall back to standard field analysis, without upgrading synthesis. Existing response fields and deterministic scoring are unchanged.

Actions carry the original field name and RED/YELLOW tier, a bounded instruction, and `kind: review | provide_information`. RED actions come first. The `consistency` action describes cross-field conflicts for owner resolution. Residual risks copy the original non-GREEN findings; synthesis cannot clear them. Summary and approval disclaimer are server-owned, not model-written.

Replacements use a discriminated field/value shape:

```json
{"field":"sampleMessages","value":["BrightMarket\nOriginal first sample","BrightMarket\nOriginal second sample"]}
```

`campaignDescription` and `messageFlow` values are strings; `sampleMessages` is a 2–5 item array. Each text is at most 4,096 characters. At most three replacement fields and eleven actions/risks are allowed. Generated actions are advisory model prose, **not** trustworthy replacement copy. Consumers must present original findings and require review; never auto-submit or auto-spend credits.

### Deliberately constrained replacement copy

The model selects source IDs, not replacement text. The server assembles complete submitted blocks with newlines and validates source membership, original retention, duplicate fields/IDs, unchanged values, bounds, and finding/action correspondence.

Allowed sources:

| Target | Allowed complete blocks |
| --- | --- |
| Campaign description | Original description, submitted business name, submitted message flow |
| Message flow | Original flow, submitted business name, submitted opt-in message |
| Each sample message | That original sample and submitted business name only |

An action requiring `provide_information` cannot have a replacement. Missing or changed consent mechanisms, actual business practices, new URLs, substantive paraphrasing and deletions require owner editing. This version does **not** claim unrestricted AI rewriting. Source composition avoids invented copy but does not establish the truth of submitted facts or guarantee that combining them is appropriate; review and re-scan remain mandatory.

A single invalid synthesis member rejects the whole pack. This deliberately favors unavailable output over exposing a partially validated draft.

## Execution and privacy

- Keep GPT-4o Mini standard / Sonnet 4.6 premium. Field completions remain 1,024 tokens with at most one retry; synthesis uses 4,096 tokens with **no application retry**.
- A wholly GREEN completed scan produces an empty-action pack without a needless synthesis call.
- All model calls retain provider pinning, no fallback, `data_collection: deny`, and Gateway log/cache opt-outs.
- Independent checks start together. Consistency does not wait for crawling. Each policy check waits only for its own page. The unused website crawl was removed; no scanner consumed it.
- One 45-second orchestration deadline covers checks and synthesis. Signals reach AI requests/retries and page fetches. Firecrawl's 15-second cap now includes reading the response body, and composes with caller cancellation.
- Completed checks survive other checks timing out; unfinished checks become explicit YELLOW placeholders and `metadata.partial` is true. Synthesis timeout alone does not make completed field checks partial.
- Production errors do not log/return raw dependency exception text. No new analytics, persistence, request-content or replacement logging was added. Gateway collection opt-outs are not a zero-retention guarantee for every upstream system.
- The complete synthesis payload is capped at 60,000 characters; oversized input returns `input_too_large`, not truncated context. Existing unbounded optional fields/sample lengths in request validation are not broadly migrated here.

## Verification and reproduction

From `worker/`:

```bash
npm ci
npm test
npm run typecheck
npm run test:worker
# Explicitly billable. Set the evaluated Cloudflare OpenRouter URL and gateway token securely.
npm run eval:revision-pack -- --output /tmp/revision-evaluation-new.json
```

`test:worker` bundles the real HTTP entry point and runs workerd with synthetic outbound services, including real 15s stalled-body and 45s synthesis timeouts. It takes about 45 seconds. The test allows one second for event-loop/HTTP delivery overhead around the 45s cancellation deadline; this is not an extra work budget.

The live evaluator runs exactly three concurrent built-in synthetic Full campaigns. It uses the actual premium gateway and synthetic retrieved pages, records owner-only (`0600`, exclusive creation) output for review, and exits nonzero on tier/pack/provider/deadline failures. It checks GREEN/no changes, YELLOW/policy action, and RED/brand-only samples plus human-required consent facts. These examples are not comprehensive quality proof. Live Firecrawl availability and real customer campaigns are not evaluated.

Results: [2026-09-07 evaluation](./revision-pack-evaluation-2026-09-07.md).

## App contract boundary

A separate app branch mirrors `RevisionPack` in `lib/types.ts` and adds `scripts/verify-revision-pack-gating.test.ts`. The existing explicit diagnosis allowlist already strips this new property for unentitled/shared viewers; no production gating change is needed for this contract-only slice. `lib/api.ts` already returns `ScanResponse`, so it needs no redundant adapter change. Verify there with:

```bash
node --experimental-strip-types --test scripts/verify-revision-pack-gating.test.ts
npx tsc --noEmit
npm run build
```

The mirror is manual until #3 pins/generates the OpenAPI contract. Entitled rendering/apply/verify/checkout remains #140. No Worker or app deployment was performed; the deployed write-only Gateway URL still needs equality verification before release.
