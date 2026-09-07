import type { FieldResult, ScanRequest } from '../../src/types';
import type { AiGatewayResponse } from '../../src/services/ai';

/** Synthetic-only request used by contract tests, not a recorded model evaluation. */
export const revisionCampaign: ScanRequest = {
  useCaseType: 'MARKETING',
  businessName: 'BrightMarket',
  campaignDescription: 'BrightMarket sends weekly product offers to customers who explicitly subscribe at checkout. These messages identify the business and include opt-out instructions.',
  messageFlow: 'Customers select the optional unchecked SMS consent box at checkout.',
  sampleMessages: ['Your requested weekly offer is ready. Reply STOP to unsubscribe.', 'Save on your next order. Reply HELP for help.'],
  optOutKeywords: ['STOP'], helpKeywords: ['HELP'],
  optOutMessage: 'BrightMarket: You have been unsubscribed and will no longer receive messages.',
  embeddedLinks: false, embeddedPhoneNumbers: false,
};

/** Synthetic authoritative finding for testing the synthesis boundary. */
export function revisionFinding(field: string, tier: FieldResult['tier'], source: FieldResult['evidence']['source'] = 'ai'): FieldResult {
  return { field, displayName: field, tier, rationale: `Review ${field} evidence.`,
    issues: tier === 'GREEN' ? [] : [{ severity: tier === 'RED' ? 'critical' : 'warning', message: `Unresolved ${field}.` }],
    suggestions: [], evidence: { source } };
}

/** Provider-envelope adapter fixture; payload is deliberately untrusted. */
export function completion(body: unknown): AiGatewayResponse {
  return { ok: true, status: 200, body: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(body) } }] } };
}
