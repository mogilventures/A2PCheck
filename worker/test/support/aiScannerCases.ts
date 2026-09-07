import { scanAffiliateMarketing } from '../../src/scanners/affiliateMarketing';
import { scanConsistency } from '../../src/scanners/consistency';
import { scanDescription } from '../../src/scanners/description';
import { scanOptIn } from '../../src/scanners/optIn';
import { scanPrivacyPolicy } from '../../src/scanners/privacyPolicy';
import { scanSampleMessages } from '../../src/scanners/sampleMessages';
import { scanShaft } from '../../src/scanners/shaft';
import { scanTermsOfService } from '../../src/scanners/termsOfService';
import { DEFAULT_MODEL } from '../../src/services/ai';
import type { AiGateway } from '../../src/services/ai';
import type { FieldIssue, FieldResult, ScanRequest, ScanTier } from '../../src/types';
import type { FirecrawlResult } from '../../src/services/firecrawl';

export type AiScannerCase = {
  readonly scanner: string;
  readonly fixtureCase: 'happy' | 'deficient';
  readonly expectedTier: ScanTier;
  readonly expectedSeverity?: FieldIssue['severity'];
  readonly expectedEvidence: FieldResult['evidence']['source'];
  readonly expectedTwilioCode?: string;
  readonly run: (gateway: AiGateway, model?: string) => Promise<FieldResult>;
};

const compliantCampaign: ScanRequest = {
  useCaseType: 'MARKETING',
  campaignDescription:
    'BrightMarket sends weekly product offers and seasonal discounts to customers who explicitly consent on its checkout form. Messages identify BrightMarket and help customers save on products they requested updates about.',
  sampleMessages: [
    'BrightMarket: Hi [first name], save 20% on your next order through [date]. Reply STOP to unsubscribe.',
    'BrightMarket: Your requested weekly offer is ready. Visit https://brightmarket.example/offers. Reply HELP for help.',
  ],
  messageFlow:
    'Before acting, customers see this disclosure immediately beside an unchecked-by-default, optional consent box at https://brightmarket.example/checkout: “By checking this box, I explicitly agree to receive one BrightMarket promotional text per week. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.” Customers affirmatively check the box themselves, and BrightMarket retains the disclosure version, timestamp, page URL, and submitted consent record.',
  businessName: 'BrightMarket',
  websiteUrl: 'https://brightmarket.example',
  privacyPolicyUrl: 'https://brightmarket.example/privacy',
  termsOfServiceUrl: 'https://brightmarket.example/terms',
  optInKeywords: ['START'],
  optInMessage:
    'BrightMarket: You are subscribed to one promotional text per week. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.',
  optOutKeywords: ['STOP'],
  embeddedLinks: true,
  embeddedPhoneNumbers: false,
  ageGatedContent: false,
  directLending: false,
};

const compliantCrawl: FirecrawlResult = {
  success: true,
  statusCode: 200,
  content:
    'BrightMarket SMS Privacy Policy. We collect phone numbers and consent timestamps only after explicit opt-in. We use messaging providers to deliver texts, retain consent records for compliance, and do not sell messaging data. Customers may request deletion.',
};

const genericPrivacyCrawl: FirecrawlResult = {
  success: true,
  statusCode: 200,
  content:
    'BrightMarket values privacy. We may collect information when customers use our website. Contact support with questions.',
};

const compliantTermsCrawl: FirecrawlResult = {
  success: true,
  statusCode: 200,
  content:
    'BrightMarket SMS Terms. Subscribers receive one promotional text per week. Message and data rates may apply. Reply STOP to opt out or HELP for support. Message frequency may vary only for requested transactional updates.',
};

const genericTermsCrawl: FirecrawlResult = {
  success: true,
  statusCode: 200,
  content:
    'These website terms govern purchases from BrightMarket. Customers agree to pay for completed orders and follow the site rules.',
};

const vagueDescriptionCampaign: ScanRequest = {
  ...compliantCampaign,
  campaignDescription: 'Marketing messages.',
};

const deficientMessagesCampaign: ScanRequest = {
  ...compliantCampaign,
  sampleMessages: ['Great deals available now!', 'Click here to buy.'],
};

const smsOptInCampaign: ScanRequest = {
  ...compliantCampaign,
  messageFlow: 'People text YES to subscribe and then receive promotional texts.',
  optInKeywords: ['YES'],
};

const prohibitedContentCampaign: ScanRequest = {
  ...compliantCampaign,
  campaignDescription: 'RangeSupply markets firearms and ammunition directly to consumers.',
  businessName: 'RangeSupply',
  sampleMessages: [
    'RangeSupply: Ammunition sale this weekend. Order cases now. Reply STOP to unsubscribe.',
  ],
  ageGatedContent: true,
};

const affiliateCampaign: ScanRequest = {
  ...compliantCampaign,
  campaignDescription:
    'DealRelay shares collected opt-ins with partner brands and sends promotions for unrelated third-party businesses.',
  businessName: 'DealRelay',
  sampleMessages: [
    'DealRelay: A partner lender has an offer for you. Apply today. Reply STOP to unsubscribe.',
  ],
};

const inconsistentCampaign: ScanRequest = {
  ...compliantCampaign,
  useCaseType: 'MARKETING',
  campaignDescription: 'BrightMarket sends weekly retail discounts to opted-in shoppers.',
  sampleMessages: ['BrightMarket: Your one-time login code is 482913. Do not share it.'],
};

export const aiScannerCases: readonly AiScannerCase[] = [
  {
    scanner: 'description',
    fixtureCase: 'happy',
    expectedTier: 'GREEN',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanDescription(compliantCampaign, gateway, model),
  },
  {
    scanner: 'description',
    fixtureCase: 'deficient',
    expectedTier: 'RED',
    expectedSeverity: 'critical',
    expectedEvidence: 'ai',
    expectedTwilioCode: '30886',
    run: (gateway, model = DEFAULT_MODEL) => scanDescription(vagueDescriptionCampaign, gateway, model),
  },
  {
    scanner: 'sampleMessages',
    fixtureCase: 'happy',
    expectedTier: 'GREEN',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanSampleMessages(compliantCampaign, gateway, model),
  },
  {
    scanner: 'sampleMessages',
    fixtureCase: 'deficient',
    expectedTier: 'RED',
    expectedSeverity: 'critical',
    expectedEvidence: 'ai',
    expectedTwilioCode: '30893',
    run: (gateway, model = DEFAULT_MODEL) => scanSampleMessages(deficientMessagesCampaign, gateway, model),
  },
  {
    scanner: 'optIn',
    fixtureCase: 'happy',
    expectedTier: 'GREEN',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanOptIn(compliantCampaign, gateway, model),
  },
  {
    scanner: 'optIn',
    fixtureCase: 'deficient',
    expectedTier: 'RED',
    expectedSeverity: 'critical',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanOptIn(smsOptInCampaign, gateway, model),
  },
  {
    scanner: 'shaft',
    fixtureCase: 'happy',
    expectedTier: 'GREEN',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanShaft(compliantCampaign, gateway, model),
  },
  {
    scanner: 'shaft',
    fixtureCase: 'deficient',
    expectedTier: 'RED',
    expectedSeverity: 'critical',
    expectedEvidence: 'ai',
    expectedTwilioCode: '30883',
    run: (gateway, model = DEFAULT_MODEL) => scanShaft(prohibitedContentCampaign, gateway, model),
  },
  {
    scanner: 'affiliateMarketing',
    fixtureCase: 'happy',
    expectedTier: 'GREEN',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanAffiliateMarketing(compliantCampaign, gateway, model),
  },
  {
    scanner: 'affiliateMarketing',
    fixtureCase: 'deficient',
    expectedTier: 'RED',
    expectedSeverity: 'critical',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanAffiliateMarketing(affiliateCampaign, gateway, model),
  },
  {
    scanner: 'consistency',
    fixtureCase: 'happy',
    expectedTier: 'GREEN',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanConsistency(compliantCampaign, gateway, model),
  },
  {
    scanner: 'consistency',
    fixtureCase: 'deficient',
    expectedTier: 'RED',
    expectedSeverity: 'critical',
    expectedEvidence: 'ai',
    run: (gateway, model = DEFAULT_MODEL) => scanConsistency(inconsistentCampaign, gateway, model),
  },
  {
    scanner: 'privacyPolicy',
    fixtureCase: 'happy',
    expectedTier: 'GREEN',
    expectedEvidence: 'ai+firecrawl',
    run: (gateway, model = DEFAULT_MODEL) => scanPrivacyPolicy(compliantCampaign, gateway, compliantCrawl, model),
  },
  {
    scanner: 'privacyPolicy',
    fixtureCase: 'deficient',
    expectedTier: 'YELLOW',
    expectedSeverity: 'warning',
    expectedEvidence: 'ai+firecrawl',
    run: (gateway, model = DEFAULT_MODEL) => scanPrivacyPolicy(compliantCampaign, gateway, genericPrivacyCrawl, model),
  },
  {
    scanner: 'termsOfService',
    fixtureCase: 'happy',
    expectedTier: 'GREEN',
    expectedEvidence: 'ai+firecrawl',
    run: (gateway, model = DEFAULT_MODEL) => scanTermsOfService(compliantCampaign, gateway, compliantTermsCrawl, model),
  },
  {
    scanner: 'termsOfService',
    fixtureCase: 'deficient',
    expectedTier: 'YELLOW',
    expectedSeverity: 'warning',
    expectedEvidence: 'ai+firecrawl',
    run: (gateway, model = DEFAULT_MODEL) => scanTermsOfService(compliantCampaign, gateway, genericTermsCrawl, model),
  },
];
