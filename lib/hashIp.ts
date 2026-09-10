import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of an IP address for privacy-preserving anti-abuse tracking.
 * Normalizes IPv4/IPv6 strings before hashing.
 */
export function hashIp(ip: string): string {
  const normalizedIp = (ip || '').trim().toLowerCase();
  if (!normalizedIp) {
    throw new Error('IP address cannot be empty');
  }
  return crypto.createHash('sha256').update(normalizedIp).digest('hex');
}
