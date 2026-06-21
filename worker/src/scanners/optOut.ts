import { ScanRequest, FieldResult, FieldIssue, FixSuggestion } from '../types';

const DISPLAY_NAME = 'Opt-Out / Revocation Handling';

// Per se reasonable revocation keywords (FCC 47 CFR §64.1200(a)(10)-(12)) plus
// Twilio-style STOPALL/OPTOUT. Surfaced as a readiness suggestion, not a hard rule.
const STANDARD_KEYWORDS =
  'STOP, QUIT, END, REVOKE, OPT OUT, CANCEL, UNSUBSCRIBE (plus STOPALL/OPTOUT for Twilio-style handling)';

// Signals that a confirmation message actually acknowledges the unsubscribe.
const ACK_SIGNALS = [
  'unsubscribed',
  'opted out',
  'will no longer receive',
  'no longer receive',
  'no more',
  'removed',
  'cancelled',
  'canceled',
];

// Promotional language that should not appear in a one-time opt-out confirmation.
const PROMO_TERMS = ['sale', 'discount', 'offer', 'shop', 'buy', 'save', 'deal', 'coupon', 'promo'];

// Uppercase + strip non-alphanumerics so "stop", "STOP." and "Stop!" all match,
// while keeping STOPALL distinct from STOP.
function normalizeKeyword(k: string): string {
  return k.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function mentionsStop(text: string | undefined): boolean {
  return !!text && /\bstop\b/i.test(text);
}

export function scanOptOut(input: ScanRequest): FieldResult {
  const keywords = input.optOutKeywords ?? [];
  const hasStop = keywords.some((k) => normalizeKeyword(k) === 'STOP');

  if (!hasStop) {
    return {
      field: 'optOutKeywords',
      displayName: DISPLAY_NAME,
      tier: 'RED',
      rationale:
        'No "STOP" opt-out keyword is configured. STOP is the baseline reply that carriers and customers expect for ending A2P messages, so it should always be supported.',
      issues: [
        {
          severity: 'critical',
          message: 'Missing required "STOP" opt-out keyword',
          twilioErrorCode: null,
        },
      ],
      suggestions: [
        {
          issue: 'Missing STOP keyword',
          fix: `Support the standard revocation keywords: ${STANDARD_KEYWORDS}.`,
          example: 'Opt-out keywords: STOP, UNSUBSCRIBE, CANCEL, QUIT, END',
        },
      ],
      evidence: { source: 'deterministic' },
    };
  }

  const issues: FieldIssue[] = [];
  const suggestions: FixSuggestion[] = [];
  const optOutMessage = input.optOutMessage?.trim();

  // Rule 2: STOP configured but no confirmation message.
  if (!optOutMessage) {
    issues.push({
      severity: 'warning',
      message: 'No opt-out confirmation message provided.',
    });
    suggestions.push({
      issue: 'Missing opt-out confirmation',
      fix: 'Add a plain, non-promotional confirmation that tells the customer they have been unsubscribed.',
      example: "You've been unsubscribed and will no longer receive messages from us.",
    });
  } else {
    const lower = optOutMessage.toLowerCase();

    // Rule 3: confirmation does not clearly acknowledge the unsubscribe.
    if (!ACK_SIGNALS.some((s) => lower.includes(s))) {
      issues.push({
        severity: 'warning',
        message: 'Opt-out confirmation does not clearly acknowledge that the customer was unsubscribed.',
      });
      suggestions.push({
        issue: 'Unclear opt-out confirmation',
        fix: 'Make the confirmation explicitly state the customer will no longer receive messages.',
        example: "You've been unsubscribed and will no longer receive messages from us.",
      });
    }

    // Rule 4: confirmation looks promotional.
    const promoHits = PROMO_TERMS.filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(optOutMessage));
    if (promoHits.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Opt-out confirmation appears promotional (contains: ${promoHits.join(', ')}).`,
      });
      suggestions.push({
        issue: 'Promotional opt-out confirmation',
        fix: 'Keep the one-time confirmation non-promotional — no offers, discounts, or calls to buy.',
        example: "You've been unsubscribed and will no longer receive messages from us.",
      });
    }
  }

  // Rule 5: no user-facing messaging mentions STOP.
  const userFacing = [
    ...(input.sampleMessages ?? []),
    input.optInMessage,
    input.helpMessage,
    input.optOutMessage,
  ];
  if (!userFacing.some(mentionsStop)) {
    issues.push({
      severity: 'warning',
      message: 'No user-facing messaging mentions how to text STOP to opt out.',
    });
    suggestions.push({
      issue: 'STOP not surfaced to customers',
      fix: 'Reference "Reply STOP to unsubscribe" in your opt-in, sample, or help messages so customers know the keyword.',
      example: 'Reply STOP to unsubscribe, HELP for help.',
    });
  }

  // General readiness reminder, always surfaced once STOP is configured.
  suggestions.push({
    issue: 'Revocation readiness',
    fix: `Honor opt-outs promptly and no later than 10 business days, and support standard revocation keywords: ${STANDARD_KEYWORDS}.`,
  });

  if (issues.length > 0) {
    return {
      field: 'optOutKeywords',
      displayName: DISPLAY_NAME,
      tier: 'YELLOW',
      rationale:
        'STOP is supported, but the opt-out experience could be strengthened for a smoother carrier review.',
      issues,
      suggestions,
      evidence: { source: 'deterministic' },
    };
  }

  return {
    field: 'optOutKeywords',
    displayName: DISPLAY_NAME,
    tier: 'GREEN',
    rationale:
      'STOP is supported, the confirmation clearly acknowledges the unsubscribe without promotional content, and user-facing messaging surfaces the STOP keyword.',
    issues: [],
    suggestions,
    evidence: { source: 'deterministic' },
  };
}
