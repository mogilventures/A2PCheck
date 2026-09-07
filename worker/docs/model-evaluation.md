# Model policy and synthetic evaluation

Latest decision and measured results: [2026-09-07 evaluation](model-evaluation-2026-09-07.md).

## Selected tiers and candidates

`src/services/ai.ts` owns model identifiers together with their required controls.
Callers select an authorized tier, never arbitrary provider/request parameters.
Unknown model identifiers fail closed without a network request.

| Model | Selection | Inference provider | Output mode | Required controls |
| --- | --- | --- | --- | --- |
| `openai/gpt-4o-mini` | Standard | OpenAI only | JSON object | temperature 0.1 |
| `anthropic/claude-sonnet-4-6` | Premium | Anthropic only | Native JSON schema | temperature 0.1 |
| `z-ai/glm-5.3-flash` | Evaluation candidate | Cloudflare only | JSON object | temperature 0.1, `reasoning_effort: low` |
| `anthropic/claude-opus-4.8` | Evaluation candidate | Anthropic only | Native JSON schema | `reasoning_effort: low`; omit unsupported temperature |

All field checks have a 1,024-completion-token budget and at most one application-level retry.
Explicitly truncated/filtered completions are rejected even if their content happens
to be parseable. Missing `finish_reason` remains supported for the existing minimal
replay-envelope contract. Malformed output remains inconclusive; no Markdown or
prose extraction converts invalid responses into apparent schema successes.

Claude's JSON-object mode returned fenced Markdown in the gateway baseline despite
JSON-only prompts. Native `json_schema` fixes the request rather than relaxing the
parser. `zod-to-json-schema` derives that schema from the existing Zod 3 parser;
there is no hand-maintained second result schema. Runtime validation still runs.

## Hosting and privacy policy

Each request sends `provider.only`, `allow_fallbacks: false`,
`require_parameters: true`, and `data_collection: deny`. GLM evaluation stays on
Cloudflare-hosted inference rather than allowing OpenRouter to choose an arbitrary
GLM host. Provider names in evaluation responses are checked against the requested
allowlist. These restrictions can reduce availability; do not widen them silently
when a provider is unavailable.

`cf-aig-collect-log: false` and `cf-aig-skip-cache: true` override the gateway's
logging/cache defaults per request. No raw completion, campaign, provider error
body, or credential is added to application telemetry. `data_collection: deny`
is an OpenRouter provider data-use filter, **not** a claim of zero retention or
region-specific processing. Reconfirm provider terms/region requirements before
changing that policy. Existing gateway logs are not deleted by this change.

Operator references:
- [Cloudflare BYOK](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)
- [Cloudflare request headers](https://developers.cloudflare.com/ai-gateway/glossary/)
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)

## Run the bake-off

From `worker/`, using Node 22 and credentials for the existing authenticated gateway:

```bash
npm ci
npm run typecheck
npm test
# Set AI_GATEWAY_URL and CF_AIG_TOKEN through your existing secure account profile.
# Do not substitute a direct Workers AI endpoint for the production OpenRouter route.
npm run eval:ai -- \
  --model openai/gpt-4o-mini \
  --model anthropic/claude-sonnet-4-6 \
  --model z-ai/glm-5.3-flash \
  --model anthropic/claude-opus-4.8 \
  --repetitions 2 \
  --output /tmp/a2p-model-evaluation.json
```

The command is billable/networked, uses **only the built-in synthetic campaigns**,
and refuses missing credentials, unsupported models, or non-Cloudflare gateway
URLs before sending requests. It does not read customer reports or accept campaign
input files. Choose a new output path: the final artifact is created with mode 600
and never overwrites an existing artifact. Console progress contains aggregate
metadata only. The local JSON artifact includes synthetic suggestions/rationales
for human comparison, not raw provider envelopes or credentials.

Cases run sequentially with a five-second minimum interval; Quick checks run their
five AI field checks in parallel, then wait before the next scan. This is bounded
against a 50-request/minute gateway, but stop the run if ordinary production traffic
needs that capacity. Each case/Quick scan receives a caller-owned 45-second abort
signal. This does not retrofit cancellation into the deployed Full orchestration.

Reports record semantic correctness, first-attempt validity, retries, false GREENs,
actual inference provider, p50/p95 **case** latency, and separate Quick-scan latency,
field completeness and partial-result checks. A fallback YELLOW cannot count as a
schema-valid result. BYOK cost uses reported upstream inference cost, not the zero
OpenRouter platform charge; missing cost evidence remains null. This is not total
Full-scan cost: crawling and future revision synthesis are not included.

The process exits 1 when any model misses a gate, while retaining its completed
report. Read the per-model result; a rejected candidate should not erase evidence
for the others. An interrupted process may leave only its aggregate console log.

## Selection and release gates

- At least 16/16 semantic cases and 16/16 first-attempt schema-valid responses;
  no deficient case GREEN; no retries or unexpected hosting.
- Both Quick fixtures complete with all 10 deduplicated fields (URL and AI sample-message
  checks merge into one), all five valid AI completions,
  the expected overall tier, no partial output, and duration under 45 seconds.
- Repeat the winning candidate before selection. These fixtures are a regression
  gate, not statistical proof; expand missing-information/adversarial coverage
  before making broader quality claims.
- Compare premium synthetic suggestions with human review. Keep Sonnet unless
  Opus materially improves actionable, grounded guidance within the budget.
- Confirm the evaluated URL is the deployed Worker's `AI_GATEWAY_URL`, not merely
  another working endpoint on the account. Deployed Worker secret values are
  write-only; API account/gateway discovery alone does not establish this equality.
- Re-record fixtures for the selected standard policy through the same gateway:
  `npm run fixtures:ai:record`. Recording rejects even a successful retry and does
  not begin writes until every case passes. Do not edit fixture requests by hand
  to conceal model, prompt, or control drift.
- Run `npm test` and `npm run typecheck`, review the diff, update OpenAPI/model docs,
  and obtain deployment approval. The bake-off never changes gateway settings,
  provider keys, credit grants, or a deployed Worker.

Full scans with real crawling, representative concurrent Full traffic, and revision
pack quality are separate checks. A Quick-only run does not prove those properties.
