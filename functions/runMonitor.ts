import { executeCheckTrial } from './checkTrial';
import { validateTargetUrl } from '../lib/urlValidator';

export interface RunMonitorInput {
  uid: string;
  fingerprintHash: string;
  url: string;
  rawIp: string;
  fetchClient?: typeof fetch;
}

export interface RunMonitorResult {
  success: boolean;
  status: number;
  snapshot?: string;
  watchId?: string;
  title?: string;
  domain?: string;
  message?: string;
  url?: string;
  checkedAt?: string;
  error?: string;
  reason?: string;
}

/**
 * Core RunMonitor execution logic - calls changedetection.io real API
 */
export async function executeRunMonitor({
  uid,
  fingerprintHash,
  url,
  rawIp,
  fetchClient = fetch,
}: RunMonitorInput): Promise<RunMonitorResult> {
  // 1. Validate URL
  const urlCheck = validateTargetUrl(url);
  if (!urlCheck.isValid || !urlCheck.normalizedUrl) {
    return {
      success: false,
      status: 400,
      error: urlCheck.error || 'Invalid target URL',
    };
  }

  // 2. Validate trial check
  const trialCheck = await executeCheckTrial({
    uid,
    fingerprintHash,
    action: 'monitor',
    rawIp,
  });

  if (!trialCheck.allowed) {
    return {
      success: false,
      status: 403,
      error: 'Free trial limit reached or blocked',
      reason: trialCheck.reason || 'trial_used',
    };
  }

  // 3. Call changedetection.io real API
  const serviceUrl = process.env.CHANGEDETECTION_URL;
  const token =
    process.env.CHANGEDETECTION_INTERNAL_TOKEN ||
    process.env.CHANGEDETECTION_INTERNAL_SECRET ||
    '';

  if (!serviceUrl) {
    return {
      success: false,
      status: 500,
      error: 'CHANGEDETECTION_URL environment variable is not configured',
    };
  }

  try {
    const response = await fetchClient(`${serviceUrl.replace(/\/$/, '')}/api/v1/watch`, {
      method: 'POST',
      headers: {
        'x-api-key': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: urlCheck.normalizedUrl,
        tag: uid,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`changedetection.io returned ${response.status}${errText ? `: ${errText}` : ''}`);
    }

    const data = await response.json();
    const watchId = data.uuid || data.watchId;

    // Derive readable title/domain
    let domain = '';
    let displayTitle = '';
    try {
      const parsedUrl = new URL(urlCheck.normalizedUrl);
      domain = parsedUrl.hostname.replace(/^www\./, '');
      displayTitle = domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      domain = urlCheck.normalizedUrl;
      displayTitle = domain;
    }

    const nowIso = new Date().toISOString();

    // Persist to user's Firestore monitors collection
    try {
      const { adminDb } = await import('../lib/firebaseAdmin');
      await adminDb.collection('users').doc(uid).collection('monitors').doc(watchId).set({
        uuid: watchId,
        url: urlCheck.normalizedUrl,
        title: displayTitle,
        domain,
        status: 'monitoring',
        createdAt: nowIso,
        lastChecked: nowIso,
        lastChanged: null,
      }, { merge: true });
    } catch (dbErr) {
      console.warn('Could not persist monitor to Firestore:', dbErr);
    }

    return {
      success: true,
      status: 200,
      url: urlCheck.normalizedUrl,
      watchId,
      title: displayTitle,
      domain,
      message: 'Monitoring started. Baseline captured successfully.',
      checkedAt: nowIso,
    };
  } catch (err: any) {
    console.error('Changedetection service error:', err.message);
    return {
      success: false,
      status: 500,
      error: `Monitoring service call failed: ${err.message}`,
    };
  }
}
