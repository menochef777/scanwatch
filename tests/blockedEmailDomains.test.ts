import { describe, it, expect } from 'vitest';
import { isBlockedEmailDomain, BLOCKED_EMAIL_DOMAINS } from '../lib/blockedEmailDomains';

describe('isBlockedEmailDomain', () => {
  it('should block disposable email domains', () => {
    expect(isBlockedEmailDomain('user@tempmail.com')).toBe(true);
    expect(isBlockedEmailDomain('test@10minutemail.com')).toBe(true);
    expect(isBlockedEmailDomain('attacker@guerrillamail.com')).toBe(true);
    expect(isBlockedEmailDomain('bot@mailinator.com')).toBe(true);
    expect(isBlockedEmailDomain('scammer@sharklasers.com')).toBe(true);
  });

  it('should allow legitimate domains', () => {
    expect(isBlockedEmailDomain('user@gmail.com')).toBe(false);
    expect(isBlockedEmailDomain('developer@outlook.com')).toBe(false);
    expect(isBlockedEmailDomain('ceo@company.io')).toBe(false);
    expect(isBlockedEmailDomain('admin@watchdocs.com')).toBe(false);
  });

  it('should handle case insensitivity and whitespace', () => {
    expect(isBlockedEmailDomain('User@TEMPMAIL.COM ')).toBe(true);
    expect(isBlockedEmailDomain(' user@GMAIL.com ')).toBe(false);
  });

  it('should reject invalid or malformed emails', () => {
    expect(isBlockedEmailDomain('')).toBe(true);
    expect(isBlockedEmailDomain('invalid-email')).toBe(true);
    expect(isBlockedEmailDomain('user@')).toBe(true);
  });
});
