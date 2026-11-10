# Bounded remediation workflow

Read the report under `result`, especially `result.overallTier` and
`result.fieldResults`. Findings are readiness guidance, not an approval decision.

## 1. Review, do not fabricate

Work critical issues first, then RED/YELLOW field findings. Read the rationale
and issues before suggesting edits. Treat suggested text and revision packs as
proposals: verify every factual claim with the human, and never invent consent,
policy terms, a website, frequency, or evidence to make a verdict greener.

Basic does not crawl external pages. A YELLOW policy placeholder is not a
completed policy review. A Full scan checks supplied public URLs, but is still
not legal advice or a guarantee of provider/carrier approval.

## 2. Ask before spending

Get explicit approval for tier, cost and a total credit budget before an
authenticated call. Default to **one paid request**: Basic costs one credit,
Full costs two. Present edits and remaining findings, then stop. Another paid
scan requires renewed explicit approval, even if the result remains RED/YELLOW.
These are client operating instructions, not a new server-enforced spending cap.

Do not automatically buy credits, create keys, change identity, bypass a rate
limit, or run repeated scans. Stop if required facts are missing; explain what
needs to be changed in the actual business process, not just its description.

## 3. Keep retries separate from revisions

For an authenticated request, use an `idempotencyKey` for that exact payload and
tier. Within 24 hours, a successful same-key replay returns the stored report
without another debit. A pending scan should be allowed to finish. A failed,
refunded scan can be billed again if retried. Do not promise that every retry
is free, and do not enable curl automatic retries for paid calls.

A changed campaign version needs a new key and renewed explicit approval.
On 400/401/402/429, show the required action rather than retrying blindly. On an
ambiguous timeout or 5xx, retain the key and confirm status/budget before any
retry; do not switch keys to force another chargeable attempt.

## 4. Hand back the findings

Summarize the verdict, proposed changes, unresolved issues, scan count and credits
spent. Keep RED findings visible; have the human explicitly review any remaining
YELLOW findings. GREEN is not permission for an agent to submit automatically.
The human still controls registration through their own messaging provider.
