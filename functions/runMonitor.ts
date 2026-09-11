import { executeCheckTrial } from './checkTrial';
import { validateTargetUrl } from '../lib/urlValidator';

export interface RunMonitorInput {
  uid: string;
  fingerprintHash: string;
  url: string;
  rawIp: string;
  fetchClient?: typeof fetch; // Injectable for mocking / unit tests
}

export interface RunMonitorResult {
  success: boolean;
  status: number;
  snapshot?: string;
  watchId?: string;
  message?: string;
  url?: string;
  checkedAt?: string;
  error?: string;
  reason?: string;
}

/**
 * Core RunMonitor execution logic
 */
export async function executeRunMonitor({
  uid,
  fingerprintHash,
  url,
  rawIp,
  fetchClient = fetch,
}: RunMonitorInput): Promise<RunMonitorResult> {
  // Step 1: Validate URL first before reserving trial resources
  const urlCheck = validateTargetUrl(url);
  if (!urlCheck.isValid || !urlCheck.normalizedUrl) {
    return {
      success: false,
      status: 400,
      error: urlCheck.error || 'Invalid target URL',
    };
  }

  // Step 2: Validate 3-layer anti-abuse trial check
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

  // Step 3: Call changedetection.io
  const serviceUrl = process.env.CHANGEDETECTION_URL;
  const token =
    process.env.CHANGEDETECTION_INTERNAL_TOKEN ||
    process.env.CHANGEDETECTION_INTERNAL_SECRET ||
    '';

  if (!serviceUrl) {
    // If running in local mock mode without changedetection service configured
    return {
      success: true,
      status: 200,
      url: urlCheck.normalizedUrl,
      watchId: 'mock-watch-uuid',
      message: 'Monitoring started. You will be notified when changes are detected.',
      snapshot: `[SNAPSHOT 200 OK]\nURL: ${urlCheck.normalizedUrl}\nCaptured: ${new Date().toISOString()}\nStatus: Active monitoring initialized.`,
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await fetchClient(`${serviceUrl.replace(/\/$/, '')}/api/v1/watch`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CHANGEDETECTION_INTERNAL_TOKEN || process.env.CHANGEDETECTION_INTERNAL_SECRET || '',
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
    return {
      success: true,
      status: 200,
      url: urlCheck.normalizedUrl,
      watchId: data.uuid,
      message: 'Monitoring started. You will be notified when changes are detected.',
      snapshot: data.snapshot || data.content || `Watch registered (UUID: ${data.uuid})`,
      checkedAt: new Date().toISOString(),
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
