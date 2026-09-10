/**
 * SSRF & URL Validation utility.
 * Rejects malformed URLs, non-HTTP(S) protocols, and local/private network ranges.
 */
export function validateTargetUrl(rawUrl: string): { isValid: boolean; error?: string; normalizedUrl?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL is required and must be a string' };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Malformed URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Localhost & loopback
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return { isValid: false, error: 'Access to localhost and loopback addresses is forbidden' };
  }

  // AWS / Cloud Metadata endpoint
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return { isValid: false, error: 'Access to cloud metadata services is forbidden' };
  }

  // Private RFC 1918 ranges (IPv4)
  const isIpv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (isIpv4) {
    const octet1 = parseInt(isIpv4[1], 10);
    const octet2 = parseInt(isIpv4[2], 10);

    // 10.0.0.0/8
    if (octet1 === 10) {
      return { isValid: false, error: 'Access to private 10.0.0.0/8 subnet is forbidden' };
    }
    // 172.16.0.0/12
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
      return { isValid: false, error: 'Access to private 172.16.0.0/12 subnet is forbidden' };
    }
    // 192.168.0.0/16
    if (octet1 === 192 && octet2 === 168) {
      return { isValid: false, error: 'Access to private 192.168.0.0/16 subnet is forbidden' };
    }
    // 0.0.0.0/8
    if (octet1 === 0) {
      return { isValid: false, error: 'Access to 0.0.0.0/8 is forbidden' };
    }
  }

  // Must have a valid domain dot if not an IP
  if (!isIpv4 && !hostname.includes('.')) {
    return { isValid: false, error: 'URL must contain a valid domain name' };
  }

  return { isValid: true, normalizedUrl: parsed.toString() };
}
