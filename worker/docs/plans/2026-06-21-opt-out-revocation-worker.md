# Opt-out / Revocation Worker Scanner Plan

Goal: strengthen the deterministic worker scan for SMS opt-out/revocation readiness without changing request/response schemas, OpenAPI, Convex, frontend app contracts, auth, payments, or deployment config.

Use marketer-friendly/readiness language in result copy. Avoid legal guarantees.

## Scope

Modify only worker scanner/test/docs-plan files unless tests reveal a direct need.

Primary files:
- `worker/src/scanners/optOut.ts`
- `worker/test/scanners/optOut.test.ts`

## Source-backed rules to encode cautiously

- FCC 47 CFR §64.1200(a)(10)-(12): consent revocation can use any reasonable method; per se reasonable SMS reply keywords include STOP, QUIT, END, REVOKE, OPT OUT, CANCEL, UNSUBSCRIBE; revocations should be honored within a reasonable time not exceeding 10 business days; one confirmation text should be non-promotional.
- Twilio policy/common product behavior also recognizes STOPALL and OPTOUT.

## Desired behavior

Keep one `FieldResult`:
- `field: 'optOutKeywords'`
- displayName: `Opt-Out / Revocation Handling`
- `evidence: { source: 'deterministic' }`

Rules:

1. RED only if no STOP keyword is configured.
   - Keep this as the hard fail.
   - Matching should be case-insensitive and punctuation-tolerant for configured keywords.
   - Do not let STOPALL count as STOP.

2. YELLOW if STOP exists but `optOutMessage` is missing.
   - Suggest adding a plain unsubscribe confirmation.

3. YELLOW if `optOutMessage` exists but does not clearly acknowledge revocation/unsubscribe.
   - Accepted signals: `unsubscribed`, `opted out`, `will no longer receive`, `no longer receive`, `no more`, `removed`, `cancelled`, `canceled`.

4. YELLOW if `optOutMessage` appears promotional.
   - Terms: sale, discount, offer, shop, buy, save, deal, coupon, promo.

5. YELLOW if no user-facing messaging mentions STOP.
   - Check sampleMessages, optInMessage, helpMessage, optOutMessage.
   - This is warning-only because configured keyword support may still exist.

6. GREEN if STOP exists, confirmation exists, confirmation acknowledges unsubscribe, confirmation is non-promotional, and user-facing messaging mentions STOP.

Also surface helpful suggestions/details for:
- support standard revocation keywords: STOP, QUIT, END, REVOKE, OPT OUT, CANCEL, UNSUBSCRIBE, plus STOPALL/OPTOUT if using Twilio-style handling.
- honor opt-outs promptly and no later than 10 business days.
- keep one-time confirmation non-promotional.

## Tests

Update `worker/test/scanners/optOut.test.ts` to cover:
- Missing STOP remains RED.
- STOP keyword only, no confirmation message => YELLOW.
- STOP keyword + vague confirmation like `Thanks` => YELLOW.
- STOP keyword + clear unsubscribe confirmation + STOP in sample => GREEN.
- Case-insensitive/punctuation-tolerant keyword matching.
- STOPALL does not satisfy bare STOP.
- Promotional confirmation downgrades to YELLOW.
- STOP in user-facing sample text is detected.

## Verification

From `worker/`:

```bash
npm test
```

Do not commit or push.
