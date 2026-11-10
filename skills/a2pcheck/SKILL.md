---
name: a2pcheck
description: Check A2P 10DLC campaign drafts before registration or resubmission through Twilio, Telnyx, Vonage, Plivo, Bandwidth, or another provider. Returns readiness findings, not approval or registration.
homepage: https://www.a2pcheck.com
metadata:
  version: 0.2.0
  status: public-download
---

# A2PCheck — campaign readiness for agents

Use for campaign descriptions, sample messages, consent flows, and public policy
URLs before a human submits through a messaging provider. Do not use for sending
SMS, provisioning numbers, or guaranteeing approval. A2PCheck is independent of
Twilio, TCR and carriers; output is guidance, not legal advice or certification.

## Start safely

1. Collect campaign metadata using [the schema](references/campaign-schema.md).
   Never include real subscriber phone numbers, customer records, credentials,
   API keys, provider tokens, or signed/internal URLs. Ask the user to remove
   sensitive data instead of transmitting it.
2. Use truthful business facts. Never invent consent, policy wording, evidence,
   or business practices to improve a verdict. Examples are fictional and are
   not approved campaigns or proof that a website exists.
3. Default to **one anonymous Basic request**, subject to rate limits. Basic
   checks text, not external website/policy contents; fixes can be locked.
   From this installed skill's directory, the included fictional example runs as:

   ```bash
   curl --fail-with-body -sS -X POST https://www.a2pcheck.com/api/agent/validate \
     -H "Content-Type: application/json" \
     --data-binary @references/example-campaign.json
   ```

## Paid calls require explicit approval

- A human must sign in, verify their account, review
  [pricing](https://www.a2pcheck.com/pricing), and create a self-serve key at
  [API keys](https://www.a2pcheck.com/dashboard/api-keys). Do not create accounts,
  buy credits, or obtain keys without authorization.
- Authenticated Basic costs **one credit**; Full costs **two credits** and can
  crawl public URLs. Sending `tier: "full"` without a key returns
  `AUTH_REQUIRED` (401); it does **not** silently downgrade to Basic.
- Obtain explicit approval for the tier, credit cost, and total spending budget
  before any authenticated request. Default to **one paid request**. Any
  additional paid scan requires renewed explicit approval; never run an
  automatic retry/remediation loop to chase a GREEN result.
- Send the key from secret-backed environment configuration in the
  `Authorization: Bearer ...` header, never in campaign JSON, chat, logs, or git.
  The key is shown once at creation. See the complete guarded Full example in
  [the agent guide](https://www.a2pcheck.com/agents).
- For authenticated calls, assign an `idempotencyKey` to this exact campaign
  version. Keep it unchanged only for a retry of the same tier and payload.
  Successful same-key replays within 24 hours return `reused: true` and spend
  zero additional credits. A changed payload needs a new key and approval.
  Pending requests must be allowed to finish; failed/refunded scans can be billed
  again on retry, so stop and confirm the budget first.
- Stop on 400/401/402/429 or ambiguous transport errors and explain the next
  action. Never rotate identities, IPs or keys to bypass limits. Do not enable
  curl automatic retries for paid calls.

## Read the wrapped response

The response is `{ scanId, result, campaignId, version, reused, creditsSpent }`.
Read **`result.overallTier`**, `result.criticalIssues`, `result.warnings`, and
`result.fieldResults`—not a top-level `overallTier`. `result.suggestedUpdates`
and `result.revisionPack` may contain proposed text; availability varies.

Review suggestions against the actual business facts using
[the remediation workflow](references/remediation-workflow.md). Do not treat
YELLOW placeholders from Basic as a completed policy review. Present remaining
findings and proposed edits to the human, then stop. If another scan is explicitly
approved, submit the reviewed version within that budget.

A2PCheck does not submit campaigns. Provider registration and any decision to
proceed remain with the human, and GREEN is not a guarantee of carrier approval.

## Public distribution

This generic skill and its three references are publicly downloadable at
https://www.a2pcheck.com/skill/SKILL.md and the corresponding `/skill/references/`
URLs. Relative reference links work in the installed folder. Install instructions
for generic/Codex-style and Claude Code folders are at
https://www.a2pcheck.com/agents. Review downloaded instructions before enabling
them. No private-repository access is needed; no registry listing is claimed.

Machine-readable API references: https://www.a2pcheck.com/llms.txt,
https://www.a2pcheck.com/llms-full.txt, and https://www.a2pcheck.com/openapi.json.
