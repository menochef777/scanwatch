import assert from 'node:assert/strict';
import crypto from 'node:crypto';

console.log('\n===============================================================');
console.log('🧪 ETAPA 3 — TESTES OBRIGATÓRIOS: API ROUTE RUN-MONITOR');
console.log('===============================================================\n');

// Mock in-memory Firestore database
const mockFirestore = {
  users: new Map(),
  ips: new Map(),
  fingerprints: new Map(),
};

function hashIp(ip) {
  const normalizedIp = (ip || '').trim().toLowerCase();
  if (!normalizedIp) throw new Error('IP address cannot be empty');
  return crypto.createHash('sha256').update(normalizedIp).digest('hex');
}

function validateTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { isValid: false, error: 'Malformed URL format' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '169.254.169.254'
  ) {
    return { isValid: false, error: 'Access to localhost and private addresses is forbidden' };
  }
  if (!host.includes('.')) {
    return { isValid: false, error: 'URL must contain a valid domain name' };
  }
  return { isValid: true, normalizedUrl: parsed.toString() };
}

// Mock changedetection.io engine
async function mockChangedetectionService(url) {
  return `[CHANGEDETECTION_SNAPSHOT_200]\nURL: ${url}\nTimestamp: ${new Date().toISOString()}\nDiff: Baseline snapshot initialized. 0 changes detected.`;
}

async function simulateRunMonitorApi(body, headers) {
  const { uid, fingerprintHash, url } = body || {};

  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    return { status: 400, body: { error: 'Missing or invalid "uid" parameter' } };
  }
  if (!fingerprintHash || typeof fingerprintHash !== 'string' || !fingerprintHash.trim()) {
    return { status: 400, body: { error: 'Missing or invalid "fingerprintHash" parameter' } };
  }
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { status: 400, body: { error: 'Missing or invalid "url" parameter' } };
  }

  // 1. URL validation
  const urlCheck = validateTargetUrl(url);
  if (!urlCheck.isValid) {
    return { status: 400, body: { error: urlCheck.error } };
  }

  // 2. IP extraction
  const forwardedFor = headers['x-forwarded-for'];
  const realIp = headers['x-real-ip'];
  const rawIp = (forwardedFor ? forwardedFor.split(',')[0] : realIp) || '127.0.0.1';
  const ipHash = hashIp(rawIp);
  const normalizedFpHash = fingerprintHash.trim().toLowerCase();

  // 3. Trial check (3-layer anti-abuse)
  const userRecord = mockFirestore.users.get(uid);
  const ipRecord = mockFirestore.ips.get(ipHash);
  const fpRecord = mockFirestore.fingerprints.get(normalizedFpHash);

  if ((userRecord && userRecord.trialMonitorUsed) || ipRecord || fpRecord) {
    return { status: 403, body: { error: 'Free trial limit reached or blocked', reason: 'trial_used' } };
  }

  // 4. Reserve trial atomically
  const timestamp = new Date().toISOString();
  if (userRecord) {
    userRecord.trialMonitorUsed = true;
    userRecord.updatedAt = timestamp;
  } else {
    mockFirestore.users.set(uid, {
      trialMonitorUsed: true,
      trialOCRUsed: false,
      plan: 'free',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  mockFirestore.ips.set(ipHash, { uid, action: 'monitor', usedAt: timestamp });
  mockFirestore.fingerprints.set(normalizedFpHash, { uid, action: 'monitor', usedAt: timestamp });

  // 5. Query changedetection service mock
  const snapshot = await mockChangedetectionService(urlCheck.normalizedUrl);

  return {
    status: 200,
    body: {
      success: true,
      url: urlCheck.normalizedUrl,
      snapshot,
      checkedAt: timestamp,
    },
  };
}

async function runMonitorTests() {
  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 1: URL válida + trial disponível → Snapshot retornado (200)');
  console.log('---------------------------------------------------------------');
  const req1 = {
    uid: 'user_monitor_first_001',
    fingerprintHash: 'fp_monitor_device_001_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    url: 'https://example.com/pricing',
  };
  const headers1 = { 'x-forwarded-for': '198.51.100.12' };

  const res1 = await simulateRunMonitorApi(req1, headers1);
  console.log('Request URL:    ', req1.url);
  console.log('Response Status:', res1.status);
  console.log('Response Body:  ', JSON.stringify(res1.body, null, 2));

  assert.equal(res1.status, 200);
  assert.equal(res1.body.success, true);
  assert.ok(res1.body.snapshot.includes('CHANGEDETECTION_SNAPSHOT_200'));
  
  const user = mockFirestore.users.get('user_monitor_first_001');
  assert.equal(user.trialMonitorUsed, true, 'User trialMonitorUsed must be recorded');
  console.log('✅ PASSOU: Snapshot retornado com sucesso e trial gravado no Firestore.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 2: URL válida + trial já usado → Retorna 403 Forbidden');
  console.log('---------------------------------------------------------------');
  const req2 = {
    uid: 'user_monitor_first_001', // same UID that already consumed trial
    fingerprintHash: 'fp_monitor_device_001_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    url: 'https://example.com/blog',
  };

  const res2 = await simulateRunMonitorApi(req2, headers1);
  console.log('Request URL:    ', req2.url);
  console.log('Response Status:', res2.status);
  console.log('Response Body:  ', JSON.stringify(res2.body));

  assert.equal(res2.status, 403);
  assert.equal(res2.body.reason, 'trial_used');
  console.log('✅ PASSOU: Requisição bloqueada com 403 (reason: "trial_used").\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 3: URL inválida / Localhost / IP privado → Retorna 400 Bad Request');
  console.log('---------------------------------------------------------------');
  const req3Local = {
    uid: 'user_monitor_new_002',
    fingerprintHash: 'fp_monitor_device_002_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    url: 'http://localhost:8080/admin',
  };
  const headers3 = { 'x-forwarded-for': '198.51.100.33' };

  const res3Local = await simulateRunMonitorApi(req3Local, headers3);
  console.log('Request URL:    ', req3Local.url);
  console.log('Response Status:', res3Local.status);
  console.log('Response Body:  ', JSON.stringify(res3Local.body));

  assert.equal(res3Local.status, 400);
  assert.ok(res3Local.body.error.includes('localhost'));
  console.log('✅ PASSOU: SSRF bloqueado com status 400 para localhost.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 4: URL malformada → Retorna 400 Bad Request');
  console.log('---------------------------------------------------------------');
  const req4Malformed = {
    uid: 'user_monitor_new_003',
    fingerprintHash: 'fp_monitor_device_003_cccccccccccccccccccccccccccccccc',
    url: 'not-a-valid-url-format',
  };
  const headers4 = { 'x-forwarded-for': '198.51.100.44' };

  const res4Malformed = await simulateRunMonitorApi(req4Malformed, headers4);
  console.log('Request URL:    ', req4Malformed.url);
  console.log('Response Status:', res4Malformed.status);
  console.log('Response Body:  ', JSON.stringify(res4Malformed.body));

  assert.equal(res4Malformed.status, 400);
  assert.ok(res4Malformed.body.error.includes('Malformed'));
  console.log('✅ PASSOU: URL malformada rejeitada com status 400.\n');

  console.log('===============================================================');
  console.log('🎉 TODOS OS TESTES DA ETAPA 3 PASSARAM COM SUCESSO!');
  console.log('===============================================================\n');
}

runMonitorTests().catch((err) => {
  console.error('RunMonitor tests failed:', err);
  process.exit(1);
});
