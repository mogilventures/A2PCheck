# Model evaluation — 2026-09-07

## Decision

Keep `openai/gpt-4o-mini` as standard and `anthropic/claude-sonnet-4-6` as premium.
Do not enable GLM or upgrade to Opus on this evidence. This is a code/evaluation
result, not a production rollout: no gateway configuration, deployed Worker,
commercial app, grants, balances, or billing configuration was changed.

## Findings and fixes

The existing authenticated gateway's OpenRouter route and stored provider key were
used, with only built-in synthetic campaigns. No customer reports were sampled.

1. Sonnet's old `json_object` request produced Markdown-fenced completions despite
   JSON-only prompts. Those were correctly rejected by the parser. Native
   `json_schema`, derived from the runtime Zod schema, produced valid output without
   stripping fences or weakening validation.
2. GPT initially claimed the compliant opt-in fixture omitted a pre-consent message
   frequency disclosure, although the quoted disclosure included it. The prompt
   now requires checking all supplied disclosure text before claiming an omission.
3. Both Claude models initially escalated a short generic privacy-policy stub to
   RED despite the existing generic-policy=YELLOW rule. The prompt now makes that
   rule explicit for short content and no longer implies truncation merely from
   the supplied character count. Deterministic 404 RED is unchanged; affirmative
   non-compliance is not exempted by the clarification.
4. The first evaluation draft incorrectly expected 11 Quick fields. The real
   orchestrator merges deterministic URL and AI sample-message findings, leaving
   **10** fields. The evaluator now checks the exact field set, all five valid AI
   completions, and has positive/negative tests through real Quick orchestration.

Fixture inputs and expected tiers were **not relabeled**. The first standard
fixture-recording attempt failed on opt-in and wrote nothing. After the prompt
fix, a genuine network recording passed all 16 cases on the first attempt and
refreshed the request-bound fixtures.

## Final repeated comparison

Each model ran the same 16 field cases twice with the final prompts, plus the good
and bad Quick fixtures. Provider pinning, no fallback, required-parameter checking,
and the provider data-use filter were active. Gateway logging and caching were
skipped per request.

| Model | Semantic / first-attempt valid | False GREEN / retries | Case p50 / p95 | Quick good / bad | Reported inference cost, 32 field cases |
| --- | --- | --- | --- | --- | --- |
| GPT-4o Mini | 32/32 / 32/32 | 0 / 0 | 1.360s / 1.795s | 1.311s / 2.159s | $0.003087 |
| Sonnet 4.6 | 32/32 / 32/32 | 0 / 0 | 8.836s / 14.382s | 10.417s / 12.262s | $0.198606 |
| Opus 4.8 | 32/32 / 32/32 | 0 / 0 | 5.840s / 25.867s | 5.217s / 7.308s | $0.334775 |

All six final Quick scans had the expected YELLOW/RED overall tier, the complete
10-field set, five first-attempt-valid AI results, and no partial flag. Each was
under 45 seconds. All field-case hosting checks matched the selected provider.
The final evaluation process exited 0.

These are case-level nearest-rank percentiles and provider-reported inference
costs, **not** Full-scan latency or total cost. BYOK upstream inference charges were
used instead of treating a zero OpenRouter platform charge as free inference.

The independent synthetic-output review found no material accuracy improvement
from Opus. Its more concise suggestions and faster median do not establish a
better revision deliverable; its final p95 was worse and the field-case cost was
about 69% higher than Sonnet. Keep Sonnet, and re-evaluate the actual revision-pack
prompt if a later quality/latency need warrants it.

## GLM: rejected for gateway availability

On the pinned Cloudflare inference endpoint through OpenRouter, the earlier
16-case candidate run made 30 field attempts: **27 HTTP 429 and 3 HTTP 200**.
Only **2/16 cases** had a schema-valid first attempt. There were 14 application
retries. No alternate GLM host was allowed. This fails the availability/schema
cutover gate regardless of the earlier direct-Workers-AI 16/16 result.

Do not represent fallback YELLOWs as semantic successes. The evaluator now requires
a valid model completion before counting a semantic pass. The earlier draft
artifact's semantic total included fallback YELLOWs and is not a selection metric;
its raw attempt statuses and first-attempt validity establish the rejection.

## Verification and retained evidence

- `npm test`: **77 passed, 10 files**, including real HTTP adapter behavior, model
  controls, malformed/truncated responses, retry accounting, fixture replay,
  cost accounting, and real Quick orchestration.
- `npm run typecheck`: production source and all test/evaluation TypeScript passed.
- A local bundled `workerd`/Miniflare smoke test exercised the real HTTP Worker:
  authorized premium used native schema; an invalid premium key fell back to
  standard. Both completed five policy-bound requests and ten fields. Bundle size:
  235,345 bytes. Only a synthetic localhost AI server was used for this runtime test.
- Independent cross-family code review: no outstanding substantive findings.

Local operator artifacts (not needed by a build; synthetic only):
- `/tmp/a2p-gateway-eval-structured-20260907.json`: initial native-schema comparison,
  including GLM attempt evidence; **old Quick pass flags are invalid** because this
  run predated the field-count correction.
- `/tmp/a2p-gateway-eval-final-20260907.json`: final repeated comparison, including
  request policy, synthetic outputs, attempts, costs, and corrected Quick checks.
- `/tmp/a2p-model-policy-workerd-smoke.mjs`: local runtime verification script.

## Remaining release checks

The discovered gateway route is working, but the deployed Worker's `AI_GATEWAY_URL`
is a write-only secret. Confirm that exact configured URL matches the evaluated
route before deployment; account/gateway discovery alone does not prove equality.
No model cutover was made on an inferred secret value.

Full scans with real crawling, representative concurrent Full traffic, and the
new revision pack are **not validated by this Quick-only orchestration run**.
Preserve the 45-second Full budget and truthful unavailable/refund behavior in the
next work package. The dependency audit also still reports the pre-existing
11 advisories seen at the initial `npm ci`; no broad dependency upgrade was mixed
into this change.
