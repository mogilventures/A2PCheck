# Campaign schema

POST JSON to `https://www.a2pcheck.com/api/agent/validate`.
The [complete fictional example](example-campaign.json) defaults to `basic`.
It illustrates request shape, not approval or real reachable policy pages.

## Envelope, authentication and cost

| Field | Type | Meaning |
| --- | --- | --- |
| `campaign` | object | Required; fields below. |
| `tier` | `basic` or `full` | Optional, defaults to `basic`. Full requires authentication; it never silently downgrades. |
| `campaignName` | string | Optional label, at most 200 characters. |
| `idempotencyKey` | string | Optional, at most 128 characters; set for authenticated calls and reuse only for the exact same campaign version/tier when retrying. |

Anonymous Basic is free within usage limits, skips URL crawling, and may lock
fixes. Authenticated Basic spends one credit; Full spends two and checks public
URLs. A human creates the key in their verified account at
https://www.a2pcheck.com/dashboard/api-keys and approves spending first. See
https://www.a2pcheck.com/pricing. Keys belong only in the Authorization header.

## Required campaign fields

| Field | Type | Notes |
| --- | --- | --- |
| `useCaseType` | string enum | Use an exact value listed below, not a provider alias. |
| `campaignDescription` | string | Sender, recipients and purpose; nonempty, at most 4,096 characters. |
| `sampleMessages` | string[] | Two to five nonempty, representative examples; no real subscriber data. |
| `messageFlow` | string | Actual consent methods/evidence; nonempty, at most 4,096 characters. |

Use-case values: `MARKETING`, `ACCOUNT_NOTIFICATION`, `CUSTOMER_CARE`,
`DELIVERY_NOTIFICATION`, `FRAUD_ALERT`, `HIGHER_EDUCATION`, `LOW_VOLUME`, `MIXED`,
`POLLING_VOTING`, `PUBLIC_SERVICE_ANNOUNCEMENT`, `SECURITY_ALERT`,
`TWO_FACTOR_AUTH`, `CHARITY`, `EMERGENCY`, `POLITICAL`, `SWEEPSTAKE`.

These are scanner input limits, not a promise that a provider will accept a
submission at those limits. Follow your provider's current instructions too.

## Optional campaign fields

| Field | Type | Notes |
| --- | --- | --- |
| `businessName` | string | Actual sender brand. |
| `privacyPolicyUrl`, `termsOfServiceUrl` | string | Public HTTP(S) URLs, at most 2,048 characters; fetched only by Full. |
| `websiteUrl` | string | Public HTTP(S) URL, at most 2,048 characters; accepted as campaign metadata, but not fetched by either tier. |
| `optInKeywords`, `optOutKeywords`, `helpKeywords` | string[] | Actual supported keywords. |
| `optInMessage`, `optOutMessage`, `helpMessage` | string | Actual enrollment, STOP, and HELP replies. |
| `embeddedLinks`, `embeddedPhoneNumbers` | boolean | Match the planned message content. |
| `ageGatedContent`, `directLending`, `numberPool` | boolean | Accurate program flags. |

Never put credentials, real subscriber records, or signed/internal URLs in any
field. Do not invent a consent flow or policy just to fill the schema.

## Response

Success returns a wrapper, not a flat verdict:

| Field | Type | Meaning |
| --- | --- | --- |
| `scanId` | string | Saved scan identifier. |
| `result` | object | The scanner report below. |
| `campaignId`, `version` | string/integer or null | Account-owned campaign/version when applicable. |
| `reused` | boolean | True when returning a prior successful authenticated scan. |
| `creditsSpent` | number | Credits spent by this call; zero for a successful idempotency replay. |

Read `result.overallTier` (`RED`, `YELLOW`, `GREEN`), `result.overallSummary`,
`result.criticalIssues[]`, `result.warnings[]` and `result.fieldResults[]`.
Field results contain `field`, `displayName`, `tier`, `rationale`, `issues[]`,
and `suggestions[]`; suggestions have `issue`, `fix`, and optional `example`.
`result.suggestedUpdates[]` and `result.revisionPack` can contain proposed edits;
`result.metadata` includes duration, analyzed-field count, URLs crawled, and
`quickScan`. Fixes may be locked and revision packs may be unavailable.

Errors are JSON with `error.code`, `error.message`, `error.traceId`, and optional
`error.details` / `error.retryAfterSeconds`:

- 400 `BAD_REQUEST`: repair the request; do not retry unchanged.
- 401 `AUTH_REQUIRED` or `INVALID_API_KEY`: ask for authorized account/key setup.
- 402 `INSUFFICIENT_CREDITS`: ask the human; do not buy credits automatically.
- 429 `ANON_SCAN_LIMIT` / `RATE_LIMITED`: respect the retry delay; do not bypass limits.
- 400 or 5xx `SCAN_FAILED`, or a transport timeout: do not assume no work happened.
  Retain the exact authenticated idempotency key and confirm the budget/status
  before retrying. Successful replays within 24 hours are not charged again;
  a previously failed/refunded scan may be billed again on retry.
