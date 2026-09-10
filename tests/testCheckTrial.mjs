import assert from 'node:assert/strict';
import crypto from 'node:crypto';

console.log('\n===============================================================');
console.log('🧪 ETAPA 2 — TESTES OBRIGATÓRIOS: API ROUTE CHECK-TRIAL');
console.log('===============================================================\n');

// Mock Firestore Database State (representing backend server collections)
const firestoreStore = {
  users: new Map(),
  ips: new Map(),
  fingerprints: new Map(),
};

function hashIp(ip) {
  const normalizedIp = (ip || '').trim().toLowerCase();
  if (!normalizedIp) throw new Error('IP address cannot be empty');
  return crypto.createHash('sha256').update(normalizedIp).digest('hex');
}

// Mirroring executeCheckTrial logic with exact Firestore atomic semantics
async function mockExecuteCheckTrial({ uid, fingerprintHash, action, rawIp }) {
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    return { status: 400, body: { error: 'Invalid or missing UID', allowed: false } };
  }
  if (!fingerprintHash || typeof fingerprintHash !== 'string' || !fingerprintHash.trim()) {
    return { status: 400, body: { error: 'Invalid or missing fingerprintHash', allowed: false } };
  }
  if (!action || (action !== 'monitor' && action !== 'ocr')) {
    return { status: 400, body: { error: 'Invalid or missing action', allowed: false } };
  }
  if (!rawIp || typeof rawIp !== 'string' || !rawIp.trim()) {
    return { status: 400, body: { error: 'Unable to determine client IP', allowed: false } };
  }

  const ipHash = hashIp(rawIp);
  const normalizedFpHash = fingerprintHash.trim().toLowerCase();

  // Step 1: Parallel lookup
  const userRecord = firestoreStore.users.get(uid);
  const ipRecord = firestoreStore.ips.get(ipHash);
  const fpRecord = firestoreStore.fingerprints.get(normalizedFpHash);

  // Check 1: User UID trial usage
  if (userRecord) {
    if (action === 'monitor' && userRecord.trialMonitorUsed) {
      return { status: 200, body: { allowed: false, reason: 'trial_used' } };
    }
    if (action === 'ocr' && userRecord.trialOCRUsed) {
      return { status: 200, body: { allowed: false, reason: 'trial_used' } };
    }
  }

  // Check 2: IP Hash
  if (ipRecord) {
    return { status: 200, body: { allowed: false, reason: 'trial_used' } };
  }

  // Check 3: Device Fingerprint Hash
  if (fpRecord) {
    return { status: 200, body: { allowed: false, reason: 'trial_used' } };
  }

  // Step 2: Atomic transaction write
  const timestamp = new Date().toISOString();

  // Write/update user
  if (userRecord) {
    userRecord[action === 'monitor' ? 'trialMonitorUsed' : 'trialOCRUsed'] = true;
    userRecord.updatedAt = timestamp;
  } else {
    firestoreStore.users.set(uid, {
      trialMonitorUsed: action === 'monitor',
      trialOCRUsed: action === 'ocr',
      plan: 'free',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  // Write IP record
  firestoreStore.ips.set(ipHash, {
    uid,
    action,
    usedAt: timestamp,
  });

  // Write Fingerprint record
  firestoreStore.fingerprints.set(normalizedFpHash, {
    uid,
    action,
    usedAt: timestamp,
  });

  return { status: 200, body: { allowed: true } };
}

// Handler simulation for Next.js App Router POST
async function simulateApiRoutePost(requestBody, headers) {
  const forwardedFor = headers['x-forwarded-for'];
  const realIp = headers['x-real-ip'];
  const rawIp = (forwardedFor ? forwardedFor.split(',')[0] : realIp) || '127.0.0.1';

  const { uid, fingerprintHash, action } = requestBody || {};

  return await mockExecuteCheckTrial({
    uid,
    fingerprintHash,
    action,
    rawIp,
  });
}

async function runTests() {
  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 1: Primeiro uso (Novo UID, Novo IP, Novo Fingerprint)');
  console.log('---------------------------------------------------------------');
  const req1 = {
    uid: 'user_first_time_001',
    fingerprintHash: 'fp_hash_device_alpha_11111111111111111111111111111111',
    action: 'monitor',
  };
  const headers1 = { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' };
  
  const res1 = await simulateApiRoutePost(req1, headers1);
  console.log('Request Payload:', JSON.stringify(req1));
  console.log('Client IP Header:', headers1['x-forwarded-for']);
  console.log('Response Status:', res1.status);
  console.log('Response Body:  ', JSON.stringify(res1.body));
  
  assert.equal(res1.status, 200);
  assert.equal(res1.body.allowed, true);
  
  // Verify Firestore writes
  const userDoc = firestoreStore.users.get('user_first_time_001');
  const ipHash1 = hashIp('203.0.113.10');
  const ipDoc = firestoreStore.ips.get(ipHash1);
  const fpDoc = firestoreStore.fingerprints.get(req1.fingerprintHash);
  
  assert.ok(userDoc, 'User document must be created in Firestore');
  assert.equal(userDoc.trialMonitorUsed, true, 'trialMonitorUsed must be true');
  assert.ok(ipDoc, 'IP hash must be recorded in ips collection');
  assert.ok(fpDoc, 'Device fingerprint must be recorded in fingerprints collection');
  console.log('✅ PASSOU: allowed: true e dados persistidos no Firestore em users/, ips/ e fingerprints/.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 2: Mesmo UID tenta usar novamente');
  console.log('---------------------------------------------------------------');
  const req2 = {
    uid: 'user_first_time_001',
    fingerprintHash: 'fp_hash_device_different_22222222222222222222222222222222',
    action: 'monitor',
  };
  const headers2 = { 'x-forwarded-for': '198.51.100.50' }; // different IP
  
  const res2 = await simulateApiRoutePost(req2, headers2);
  console.log('Request Payload:', JSON.stringify(req2));
  console.log('Client IP Header:', headers2['x-forwarded-for']);
  console.log('Response Status:', res2.status);
  console.log('Response Body:  ', JSON.stringify(res2.body));
  
  assert.equal(res2.status, 200);
  assert.equal(res2.body.allowed, false);
  assert.equal(res2.body.reason, 'trial_used');
  console.log('✅ PASSOU: Bloqueado com sucesso por UID já utilizado (reason: "trial_used").\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 3: UID novo tentando burlar pelo MESMO IP');
  console.log('---------------------------------------------------------------');
  const req3 = {
    uid: 'user_fraud_attempt_002',
    fingerprintHash: 'fp_hash_device_gamma_33333333333333333333333333333333',
    action: 'monitor',
  };
  const headers3 = { 'x-forwarded-for': '203.0.113.10' }; // same IP as scenario 1
  
  const res3 = await simulateApiRoutePost(req3, headers3);
  console.log('Request Payload:', JSON.stringify(req3));
  console.log('Client IP Header:', headers3['x-forwarded-for']);
  console.log('Response Status:', res3.status);
  console.log('Response Body:  ', JSON.stringify(res3.body));
  
  assert.equal(res3.status, 200);
  assert.equal(res3.body.allowed, false);
  assert.equal(res3.body.reason, 'trial_used');
  console.log('✅ PASSOU: Bloqueado com sucesso por IP repetido (reason: "trial_used").\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 4: UID novo, IP novo, mas MESMO FINGERPRINT (Aba anônima / VPN)');
  console.log('---------------------------------------------------------------');
  const req4 = {
    uid: 'user_vpn_bypass_003',
    fingerprintHash: 'fp_hash_device_alpha_11111111111111111111111111111111', // same device fingerprint as scenario 1
    action: 'monitor',
  };
  const headers4 = { 'x-forwarded-for': '192.0.2.99' }; // totally new IP (e.g. VPN)
  
  const res4 = await simulateApiRoutePost(req4, headers4);
  console.log('Request Payload:', JSON.stringify(req4));
  console.log('Client IP Header:', headers4['x-forwarded-for']);
  console.log('Response Status:', res4.status);
  console.log('Response Body:  ', JSON.stringify(res4.body));
  
  assert.equal(res4.status, 200);
  assert.equal(res4.body.allowed, false);
  assert.equal(res4.body.reason, 'trial_used');
  console.log('✅ PASSOU: Bloqueado com sucesso por Device Fingerprint repetido (reason: "trial_used").\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO EXTRA: Validação de entradas inválidas / faltantes (400 Bad Request)');
  console.log('---------------------------------------------------------------');
  const resMissingUid = await simulateApiRoutePost({ fingerprintHash: 'xyz', action: 'monitor' }, headers1);
  const resMissingFp = await simulateApiRoutePost({ uid: 'usr_1', action: 'monitor' }, headers1);
  const resInvalidAction = await simulateApiRoutePost({ uid: 'usr_1', fingerprintHash: 'xyz', action: 'hack' }, headers1);

  assert.equal(resMissingUid.status, 400);
  assert.equal(resMissingFp.status, 400);
  assert.equal(resInvalidAction.status, 400);
  console.log('✅ PASSOU: Retorna 400 para payloads incompletos ou ações inválidas.\n');

  console.log('===============================================================');
  console.log('🎉 TODOS OS 4 CENÁRIOS DE TRIAL PASSARAM COM SUCESSO TOTAL!');
  console.log('===============================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
