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
  plan?: string;
  reason?: string;
  error?: string;
}

/**
 * Core trial validation engine running strictly on the backend.
 * 1. Checks user plan in Firestore first (Pro / Basic bypasses all trial restrictions).
 * 2. If plan is free, checks 3 layers: UID trial flag, IP hash, and Device Fingerprint hash.
 * 3. If all clean, records usage in an atomic Firestore transaction.
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

  // 1. Busca o documento do usuário primeiro
  const userRef = adminDb.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  // 2. Se tem plano pago, libera imediatamente sem checar trial, IP ou fingerprint
  if (
    userData?.plan === 'pro' ||
    userData?.plan === 'basic' ||
    (userData?.plan && userData.plan !== 'free') ||
    userData?.role === 'admin'
  ) {
    return { allowed: true, plan: userData?.plan || 'pro' };
  }

  // 3. Checa se o usuário free já consumiu o trial desta ação
  if (userDoc.exists) {
    if (action === 'monitor' && userData?.trialMonitorUsed) {
      return { allowed: false, reason: 'trial_used' };
    }
    if (action === 'ocr' && userData?.trialOCRUsed) {
      return { allowed: false, reason: 'trial_used' };
    }
  }

  // 4. Checa camadas de anti-abuso de IP e Fingerprint para usuários free
  const ipHash = hashIp(rawIp);
  const normalizedFpHash = fingerprintHash.trim().toLowerCase();

  const ipRef = adminDb.collection('ips').doc(ipHash);
  const fpRef = adminDb.collection('fingerprints').doc(normalizedFpHash);

  const [ipSnap, fpSnap] = await Promise.all([
    ipRef.get(),
    fpRef.get(),
  ]);

  // Check IP hash
  if (ipSnap.exists) {
    return { allowed: false, reason: 'trial_used' };
  }

  // Check Fingerprint hash
  if (fpSnap.exists) {
    return { allowed: false, reason: 'trial_used' };
  }

  // 5. Executa transação atômica para reservar o trial do usuário free
  try {
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const [tUserSnap, tIpSnap, tFpSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(ipRef),
        transaction.get(fpRef),
      ]);

      if (tUserSnap.exists) {
        const uData = tUserSnap.data() || {};
        // Se foi atualizado para plano pago nesse ínterim, libera
        if (uData.plan === 'pro' || uData.plan === 'basic' || (uData.plan && uData.plan !== 'free') || uData.role === 'admin') {
          return { allowed: true, plan: uData.plan || 'pro' };
        }
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

      return { allowed: true, plan: 'free' };
    });

    return transactionResult;
  } catch (err: any) {
    console.error('Transaction error in checkTrial:', err);
    return { allowed: false, error: err.message || 'Transaction failed' };
  }
}
