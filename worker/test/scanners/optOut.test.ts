import { describe, it, expect } from 'vitest';
import { scanOptOut } from '../../src/scanners/optOut';
import { ScanRequest } from '../../src/types';

const base: ScanRequest = {
  useCaseType: 'MARKETING',
  campaignDescription: 'Test',
  sampleMessages: ['Test'],
  messageFlow: 'Test',
};

// A request that should land on GREEN: STOP keyword, clear non-promotional
// confirmation, and STOP surfaced in user-facing sample text.
const green: ScanRequest = {
  ...base,
  optOutKeywords: ['STOP'],
  optOutMessage: "You've been unsubscribed and will no longer receive messages from us.",
  sampleMessages: ['Welcome! Reply STOP to unsubscribe.'],
};

describe('scanOptOut', () => {
  it('returns RED when no opt-out keywords provided', () => {
    expect(scanOptOut(base).tier).toBe('RED');
  });

  it('returns RED when STOP is not in keywords', () => {
    expect(scanOptOut({ ...base, optOutKeywords: ['CANCEL', 'QUIT'] }).tier).toBe('RED');
  });

  it('does not let STOPALL satisfy bare STOP (stays RED)', () => {
    expect(scanOptOut({ ...base, optOutKeywords: ['STOPALL'] }).tier).toBe('RED');
  });

  it('matches keywords case-insensitively and punctuation-tolerantly', () => {
    expect(scanOptOut({ ...green, optOutKeywords: ['stop'] }).tier).toBe('GREEN');
    expect(scanOptOut({ ...green, optOutKeywords: ['Stop!'] }).tier).toBe('GREEN');
    expect(scanOptOut({ ...green, optOutKeywords: ['STOP.'] }).tier).toBe('GREEN');
  });

  it('returns YELLOW when STOP exists but no confirmation message', () => {
    const result = scanOptOut({
      ...base,
      optOutKeywords: ['STOP'],
      sampleMessages: ['Reply STOP to unsubscribe.'],
    });
    expect(result.tier).toBe('YELLOW');
    expect(result.issues.some((i) => /confirmation/i.test(i.message))).toBe(true);
  });

  it('returns YELLOW when confirmation is vague (e.g. "Thanks")', () => {
    const result = scanOptOut({
      ...green,
      optOutMessage: 'Thanks',
    });
    expect(result.tier).toBe('YELLOW');
  });

  it('returns YELLOW when confirmation is promotional', () => {
    const result = scanOptOut({
      ...green,
      optOutMessage: "You've been unsubscribed. Check out our sale and save 20% before you go!",
    });
    expect(result.tier).toBe('YELLOW');
    expect(result.issues.some((i) => /promotional/i.test(i.message))).toBe(true);
  });

  it('returns YELLOW when no user-facing messaging mentions STOP', () => {
    const result = scanOptOut({
      ...green,
      sampleMessages: ['Welcome to our updates!'],
      optInMessage: undefined,
      helpMessage: undefined,
    });
    expect(result.tier).toBe('YELLOW');
    expect(result.issues.some((i) => /text STOP/i.test(i.message))).toBe(true);
  });

  it('detects STOP mentioned in user-facing sample text', () => {
    const result = scanOptOut(green);
    expect(result.tier).toBe('GREEN');
  });

  it('returns GREEN for a complete opt-out setup', () => {
    const result = scanOptOut(green);
    expect(result.tier).toBe('GREEN');
    expect(result.field).toBe('optOutKeywords');
    expect(result.displayName).toBe('Opt-Out / Revocation Handling');
    expect(result.evidence.source).toBe('deterministic');
  });
});
