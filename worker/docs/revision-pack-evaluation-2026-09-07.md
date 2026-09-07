# Revision-pack evaluation — 2026-09-07

## Outcome

Two final runs passed all three concurrent synthetic Full cases each: **6/6** tier and pack-behavior gates, **50/50 HTTP 200 responses from Anthropic**, no application retries, all packs available. Standard/premium model selection is unchanged.

| Case | Run 1 Full latency | Run 2 Full latency | Run 1 cost | Run 2 cost |
| --- | ---: | ---: | ---: | ---: |
| GREEN | 9.661s | 8.493s | $0.039621 | $0.041601 |
| YELLOW generic privacy policy | 14.223s | 13.560s | $0.055230 | $0.054477 |
| RED missing consent facts / broken policy / missing sample branding | 25.498s | 21.664s | $0.063282 | $0.060717 |

Costs include field checks and synthesis, using reported upstream inference cost for BYOK. The two final runs total $0.314928. This small synthetic sample is not a p95/SLA claim.

Each batch ran three scans concurrently against the existing Cloudflare OpenRouter gateway, with Sonnet 4.6 pinned to Anthropic, no provider fallback, and Gateway log/cache opt-outs. Retrieved page content was supplied synthetically: **live Firecrawl latency/availability was not measured**.

Artifact references retained locally (synthetic content only, owner-only permissions):
- `/tmp/a2p-revision-evaluation-constrained-20260907.json` — 15:49:33Z, exit 0.
- `/tmp/a2p-revision-evaluation-confirmation-20260907.json` — 15:50:59Z, exit 0.

Run the committed `npm run eval:revision-pack -- --output <new-file>` to reproduce; credentials and artifacts are not committed. Retained synthetic drafts allow human review beyond the automated gates.

## Behavior observed in both final runs

- **GREEN:** all checks GREEN; empty actions, replacements and residual risks. No synthesis call.
- **YELLOW:** a messaging-generic privacy policy produces a privacy-policy action, no invented policy text or replacement URL.
- **RED:** missing STOP configuration and policy 404 remain RED; missing consent mechanics are `provide_information`, with **no message-flow rewrite**. Samples receive only the submitted business-name block plus each unchanged original sample. Cross-field STOP/CANCEL and consent inconsistencies remain explicit owner-review actions.
- Original field findings and tiers remain intact; pack summaries state unresolved risks rather than claiming corrections have already cleared them.

## Failed exploratory runs and correction

Do not treat the earlier artifacts as acceptance evidence:

1. `/tmp/a2p-revision-evaluation-20260907.json` failed 2/3 gates. The intended GREEN samples were too vague, and the model defensibly returned YELLOW. The RED pack was unavailable after validation; this first evaluator did not retain its synthesis draft, so its exact validation failure is unknown. The artifact remains preserved.
2. The synthetic GREEN examples were made substantively representative by supplying an actual product category, offers, and URLs, keeping the expected GREEN tier unchanged. This changes the test construct, not the model rubric or expected outcome.
3. `/tmp/a2p-revision-evaluation-substantive-20260907.json` passed its original structural/status checks, **but manual review rejected its RED pack**. It appended a subscription confirmation to marketing copy and bundled confirmations/URLs into a flow whose action required missing customer facts. The strings were source-backed, but their composition was misleading. Its aggregate PASS was insufficient.
4. Production now enforces target-specific source allowlists and rejects replacements for `provide_information` actions. Samples can only receive their own original text plus the submitted business name. Regression tests cover both rejected compositions. The evaluator now checks these exact useful-output properties instead of treating available status as sufficient.

Neither field-scanner expected tiers nor golden replay fixtures were relabeled. No provider-policy restrictions were relaxed and no retry was added to hide synthesis errors.

## Offline/runtime evidence

- `npm test`: 109/109 tests, 13 files. Includes source constraints, unchanged/invalid/missing/oversized data, Quick omission, standard auth gating, deterministic RED/404 preservation, failures, per-request cancellation and timeouts, and exact OpenAPI/runtime-schema equality.
- `npm run typecheck`: source plus tests/evaluators pass.
- `npm run test:worker`: real bundled HTTP entry point in workerd; five concurrent synthetic Full requests covering available, malformed synthesis, stalled synthesis, and stalled page-body responses. Final durations: 147ms, 98ms, 79ms, 45,019ms, 15,013ms. The 45s deadline timer has a documented 1s scheduler/response-delivery tolerance, not an extended work budget. Field results survive synthesis failure and remain non-partial when already complete.
- Runtime tests assert Gateway privacy headers, provider restrictions, actual Worker stdout/stderr exclusion of synthetic private sentinels/token, unauthorized premium fallback, Quick absence, and a 248,273-byte Worker bundle.
- Separate app mirror: two gating tests, `npx tsc --noEmit`, and `npm run build` pass (76 pages). No frontend rendering or billing behavior changed.

Independent read-only review confirmed the source constraints, immutable findings/auth/deadline logic, both final live artifacts, and the app type mirror/privacy projection; no blocking findings remain. The reviewer independently ran Worker type checks/offline tests and the app's two gating tests; the workerd and live calls were run by the implementing agent.

Existing dependency advisories were not bundled into this feature (Worker: 11; app: 18). No dependency-audit success is claimed.

## Remaining limits

- Exact replacement copy is deliberately source composition, not unrestricted paraphrasing. Deletions, new facts, unconfirmed consent practices, and substantive rewrites require human editing.
- Model-written action prose can still be wrong. Original evidence, immutable risks, human review and re-scan are required.
- A single invalid model draft makes the pack unavailable; this is an explicit safety trade-off.
- Frontend consumption, generated OpenAPI types, refunds/credit policy and real-customer behavior belong to subsequent issues.
- This is not deployed. Before release, verify the deployed write-only Gateway URL matches the evaluated route and complete app consumption/release review.
