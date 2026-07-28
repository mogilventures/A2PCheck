import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL } from '../../src/services/ai';
import type { AiCompletionRequest, AiGateway, AiGatewayResponse } from '../../src/services/ai';
import { scanDescription } from '../../src/scanners/description';
import type { ScanRequest } from '../../src/types';
import { aiScannerCases } from '../support/aiScannerCases';
import { FixtureReplayAiGateway } from '../support/fixtureReplayAiGateway';

class FailingAiGateway implements AiGateway {
  async complete(_request: AiCompletionRequest): Promise<AiGatewayResponse> {
    throw new Error('synthetic gateway outage');
  }
}

const fallbackCampaign: ScanRequest = {
  useCaseType: 'MARKETING',
  campaignDescription: 'Synthetic campaign description.',
  sampleMessages: ['SyntheticCo: Requested update. Reply STOP to unsubscribe.'],
  messageFlow: 'Customers consent using an unchecked website form.',
};

describe('AI scanner fixture replay', () => {
  it.each(aiScannerCases)(
    '$scanner/$fixtureCase preserves semantic scanner behavior',
    async (scannerCase) => {
      const gateway = await FixtureReplayAiGateway.load(
        scannerCase.scanner,
        scannerCase.fixtureCase
      );

      const result = await scannerCase.run(gateway);
      gateway.assertSatisfied();

      expect(result.tier).toBe(scannerCase.expectedTier);
      expect(result.evidence.source).toBe(scannerCase.expectedEvidence);

      if (scannerCase.expectedSeverity === undefined) {
        expect(result.issues).toHaveLength(0);
      } else {
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues.every((issue) => issue.severity === scannerCase.expectedSeverity)).toBe(true);
      }

      if (scannerCase.expectedTwilioCode !== undefined) {
        expect(result.issues.some((issue) => issue.twilioErrorCode === scannerCase.expectedTwilioCode)).toBe(true);
      }
    }
  );

  it('fails loudly when an actual scanner request drifts from its fixture binding', async () => {
    const gateway = await FixtureReplayAiGateway.load('description', 'happy');

    await scanDescription(fallbackCampaign, gateway, DEFAULT_MODEL);

    expect(() => gateway.assertSatisfied()).toThrow(/AI fixture request mismatch/);
  });

  it('returns the representative scanner fallback when the gateway remains unavailable', async () => {
    const result = await scanDescription(fallbackCampaign, new FailingAiGateway(), DEFAULT_MODEL);

    expect(result.tier).toBe('YELLOW');
    expect(result.issues).toEqual([
      expect.objectContaining({ severity: 'warning' }),
    ]);
    expect(result.evidence.source).toBe('ai');
  });
});
