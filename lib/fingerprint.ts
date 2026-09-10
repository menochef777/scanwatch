import FingerprintJS from '@fingerprintjs/fingerprintjs';

const FP_STORAGE_KEY = 'wd_fp_hash';

/**
 * Calculates SHA-256 hex hash from a plain text string in the browser (or Node).
 */
export async function sha256Browser(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback (for SSR or test environments)
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(message).digest('hex');
}

/**
 * Generates or retrieves the device fingerprint hash.
 * 1. Checks sessionStorage cache first to avoid repetitive API calls.
 * 2. If not cached, loads FingerprintJS, extracts visitorId, computes SHA-256.
 * 3. Stores in sessionStorage and returns the 64-char hex hash.
 */
export async function getFingerprintHash(): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    // 1. Check session cache
    const cachedHash = window.sessionStorage?.getItem(FP_STORAGE_KEY);
    if (cachedHash && cachedHash.length === 64) {
      return cachedHash;
    }

    // 2. Initialize FingerprintJS agent
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const visitorId = result.visitorId || 'anonymous_fallback_id';

    // 3. Compute SHA-256 hash
    const fpHash = await sha256Browser(visitorId);

    // 4. Save to session cache
    try {
      window.sessionStorage?.setItem(FP_STORAGE_KEY, fpHash);
    } catch {
      // Storage might be disabled or restricted in private mode
    }

    return fpHash;
  } catch (err) {
    console.error('Failed to generate device fingerprint:', err);
    // Deterministic fallback if script is blocked by ad-blocker
    const fallbackSeed = `${window.navigator.userAgent}_${window.screen.width}x${window.screen.height}_${window.navigator.language}`;
    const fallbackHash = await sha256Browser(fallbackSeed);
    return fallbackHash;
  }
}
