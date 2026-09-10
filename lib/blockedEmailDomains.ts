/**
 * Comprehensive list of temporary, burner, and disposable email domains.
 * Blocks disposable email addresses from consuming free trials.
 */
export const BLOCKED_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'grr.la',
  'sharklasers.com',
  'tempmail.com',
  'temp-mail.org',
  'tempmail.net',
  'throwawaymail.com',
  'mailinator.com',
  'trashmail.com',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'dispostable.com',
  'nada.ltd',
  'getairmail.com',
  'fakeinbox.com',
  'mohmal.com',
  'burnermail.io',
  'fakemailgenerator.com',
  'crazymailing.com',
  'getnada.com',
  'inboxkitten.com',
  'maildrop.cc',
  'minuteinbox.com',
  'mytemp.email',
  'emailondeck.com',
  'generator.email',
  'tmail.ws',
  'mailcatch.com',
  'dropmail.me',
  'harakirimail.com',
  'internxt.com/temporary-email',
  'protonmail.ch', // specific aliases if needed, standard proton is fine but disposable proton clones blocked
  'tempail.com',
  'disposablemail.com',
  'trashmail.me',
  'tmpmail.net',
  'tmpmail.org'
]);

/**
 * Validates whether an email uses a disposable/temporary domain.
 * @param email - The email address to check.
 * @returns true if the email domain is blocked, false otherwise.
 */
export function isBlockedEmailDomain(email: string): boolean {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return true; // invalid format considered blocked/rejected
  }
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1] || !parts[1].includes('.')) {
    return true;
  }
  const domain = parts[1].trim();
  return BLOCKED_EMAIL_DOMAINS.has(domain);
}
