import { adminDb } from '../lib/firebaseAdmin';
import { hashIp } from '../lib/hashIp';
import { FieldValue } from 'firebase-admin/firestore';

export type TrialAction = 'monitor' | 'ocr';

export interface CheckTrialInput {
  uid: string;
  fingerprintHash: string;
  action: TrialAction;
  rawIp: string;
}

export interface CheckTrialResult {
  allowed: boolean;
  reason?: string;
  error?: string;
}

/**
 * Core trial validation engine running strictly on the backend.
 * Checks 3 layers: UID trial flag, IP hash, and Device Fingerprint hash.
 * If all 3 are clean, records usage in an atomic Firestore transaction.
 */
export async function executeCheckTrial({
  uid,
  fingerprintHash,
  action,
  rawIp,
}: CheckTrialInput): Promise<CheckTrialResult> {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    return { allowed: false, error: 'Invalid or missing UID' };
  }

  if (!fingerprintHash || typeof fingerprintHash !== 'string' || !fingerprintHash.trim()) {
    return { allowed: false, error: 'Invalid or missing fingerprintHash' };
  }

  if (!action || (action !== 'monitor' && action !== 'ocr')) {
    return { allowed: false, error: 'Invalid or missing action (must be "monitor" or "ocr")' };
  }

  if (!rawIp || typeof rawIp !== 'string' || !rawIp.trim()) {
    return { allowed: false, error: 'Unable to determine client IP address' };
  }

  const ipHash = hashIp(rawIp);
  const normalizedFpHash = fingerprintHash.trim().toLowerCase();

  const userRef = adminDb.collection('users').doc(uid);
  const ipRef = adminDb.collection('ips').doc(ipHash);
  const fpRef = adminDb.collection('fingerprints').doc(normalizedFpHash);

  // Run initial parallel lookup for fast blocking
  const [userSnap, ipSnap, fpSnap] = await Promise.all([
    userRef.get(),
    ipRef.get(),
    fpRef.get(),
  ]);

  // Check 1: User document exists and trial already consumed for this action
  if (userSnap.exists) {
    const userData = userSnap.data() || {};
    if (action === 'monitor' && userData.trialMonitorUsed) {
      return { allowed: false, reason: 'trial_used' };
    }
    if (action === 'ocr' && userData.trialOCRUsed) {
      return { allowed: false, reason: 'trial_used' };
    }
  }

  // Check 2: IP hash already exists in anti-abuse logs
  if (ipSnap.exists) {
    return { allowed: false, reason: 'trial_used' };
  }

  // Check 3: Device Fingerprint hash already exists in anti-abuse logs
  if (fpSnap.exists) {
    return { allowed: false, reason: 'trial_used' };
  }

  // All 3 checks passed -> perform atomic transaction to reserve trial and write records
  try {
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const [tUserSnap, tIpSnap, tFpSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(ipRef),
        transaction.get(fpRef),
      ]);

      if (tUserSnap.exists) {
        const uData = tUserSnap.data() || {};
        if (action === 'monitor' && uData.trialMonitorUsed) {
          return { allowed: false, reason: 'trial_used' };
        }
        if (action === 'ocr' && uData.trialOCRUsed) {
          return { allowed: false, reason: 'trial_used' };
        }
      }

      if (tIpSnap.exists || tFpSnap.exists) {
        return { allowed: false, reason: 'trial_used' };
      }

      const timestamp = FieldValue.serverTimestamp();

      // Update / Create user record
      if (tUserSnap.exists) {
        transaction.update(userRef, {
          [action === 'monitor' ? 'trialMonitorUsed' : 'trialOCRUsed']: true,
          updatedAt: timestamp,
        });
      } else {
        transaction.set(userRef, {
          trialMonitorUsed: action === 'monitor',
          trialOCRUsed: action === 'ocr',
          plan: 'free',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // Record IP hash
      transaction.set(ipRef, {
        uid,
        action,
        usedAt: timestamp,
      });

      // Record Fingerprint hash
      transaction.set(fpRef, {
        uid,
        action,
        usedAt: timestamp,
      });

      return { allowed: true };
    });

    return transactionResult;
  } catch (err: any) {
    console.error('Transaction error in checkTrial:', err);
    return { allowed: false, error: err.message || 'Transaction failed' };
  }
}
