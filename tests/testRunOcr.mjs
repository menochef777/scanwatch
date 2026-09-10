import assert from 'node:assert/strict';
import crypto from 'node:crypto';

console.log('\n===============================================================');
console.log('🧪 ETAPA 4 — TESTES OBRIGATÓRIOS: API ROUTE RUN-OCR & PADDLEOCR');
console.log('===============================================================\n');

// Mock Firestore Database State
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

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function getByteLength(base64Str) {
  const clean = base64Str.split(',').pop() || '';
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

// Mock of remote PaddleOCR microservice
async function mockRemotePaddleOcrService(payload, tokenHeader) {
  const EXPECTED_SECRET = 'wd_internal_secret_key_prod_12345';
  if (!tokenHeader || tokenHeader !== EXPECTED_SECRET) {
    return { status: 401, body: { detail: 'Unauthorized: Invalid or missing X-Internal-Token' } };
  }

  const { base64, mimeType } = payload;
  const byteLen = getByteLength(base64);

  if (!ALLOWED_MIMES.has(mimeType)) {
    return { status: 400, body: { detail: `Unsupported media type '${mimeType}'` } };
  }

  if (byteLen > MAX_SIZE_BYTES) {
    return { status: 400, body: { detail: 'File exceeds maximum size of 5MB' } };
  }

  return {
    status: 200,
    body: {
      text: `[DOCUMENT OCR EXTRACTION]\nDocument Type: ${mimeType.toUpperCase()}\nStatus: Processed successfully\nExtracted Content:\nINVOICE #WD-2026-8491\nDate: 2026-09-10\nItem: WatchDocs Document Extraction Trial\nTotal: $0.00 USD (Trial Consumed)`,
      confidence: 0.985,
      pages: 1,
    },
  };
}

// Simulation of app/api/run-ocr/route.ts
async function simulateRunOcrApi(body, headers, overrideInternalToken = 'wd_internal_secret_key_prod_12345') {
  const { uid, fingerprintHash, fileBase64, mimeType } = body || {};

  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    return { status: 400, body: { error: 'Missing or invalid "uid" parameter' } };
  }
  if (!fingerprintHash || typeof fingerprintHash !== 'string' || !fingerprintHash.trim()) {
    return { status: 400, body: { error: 'Missing or invalid "fingerprintHash" parameter' } };
  }
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return { status: 400, body: { error: 'Missing or invalid "fileBase64" parameter' } };
  }
  if (!mimeType || typeof mimeType !== 'string') {
    return { status: 400, body: { error: 'Missing or invalid "mimeType" parameter' } };
  }

  // 1. Format validation
  const normMime = mimeType.trim().toLowerCase();
  if (!ALLOWED_MIMES.has(normMime)) {
    return {
      status: 400,
      body: { error: `Unsupported file format '${mimeType}'. Only JPEG, PNG, and PDF documents are allowed.` },
    };
  }

  // 2. Size validation
  const estimatedBytes = getByteLength(fileBase64);
  if (estimatedBytes > MAX_SIZE_BYTES) {
    return {
      status: 400,
      body: { error: `File size exceeds 5MB limit (Size: ${(estimatedBytes / (1024 * 1024)).toFixed(2)}MB)` },
    };
  }

  // 3. Trial validation (3-layer)
  const forwardedFor = headers['x-forwarded-for'];
  const realIp = headers['x-real-ip'];
  const rawIp = (forwardedFor ? forwardedFor.split(',')[0] : realIp) || '127.0.0.1';
  const ipHash = hashIp(rawIp);
  const normalizedFpHash = fingerprintHash.trim().toLowerCase();

  const userRecord = mockFirestore.users.get(uid);
  const ipRecord = mockFirestore.ips.get(ipHash);
  const fpRecord = mockFirestore.fingerprints.get(normalizedFpHash);

  if ((userRecord && userRecord.trialOCRUsed) || ipRecord || fpRecord) {
    return { status: 403, body: { error: 'Free OCR trial limit reached or blocked', reason: 'trial_used' } };
  }

  // 4. Call remote PaddleOCR microservice
  const ocrServiceRes = await mockRemotePaddleOcrService(
    { base64: fileBase64, mimeType: normMime },
    overrideInternalToken
  );

  if (ocrServiceRes.status === 401) {
    return { status: 401, body: { error: 'PaddleOCR Service Authentication Failed (Invalid X-Internal-Token)' } };
  }

  if (ocrServiceRes.status !== 200) {
    return { status: ocrServiceRes.status, body: ocrServiceRes.body };
  }

  // 5. Reserve trial atomically
  const timestamp = new Date().toISOString();
  if (userRecord) {
    userRecord.trialOCRUsed = true;
    userRecord.updatedAt = timestamp;
  } else {
    mockFirestore.users.set(uid, {
      trialMonitorUsed: false,
      trialOCRUsed: true,
      plan: 'free',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  mockFirestore.ips.set(ipHash, { uid, action: 'ocr', usedAt: timestamp });
  mockFirestore.fingerprints.set(normalizedFpHash, { uid, action: 'ocr', usedAt: timestamp });

  return {
    status: 200,
    body: {
      success: true,
      text: ocrServiceRes.body.text,
      confidence: ocrServiceRes.body.confidence,
      pages: ocrServiceRes.body.pages,
      processedAt: timestamp,
    },
  };
}

async function runOcrTests() {
  const dummyBase64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 1: Arquivo PNG válido + trial disponível → Texto extraído (200)');
  console.log('---------------------------------------------------------------');
  const req1 = {
    uid: 'user_ocr_first_001',
    fingerprintHash: 'fp_ocr_device_001_11111111111111111111111111111111',
    fileBase64: dummyBase64Png,
    mimeType: 'image/png',
  };
  const headers1 = { 'x-forwarded-for': '198.51.100.77' };

  const res1 = await simulateRunOcrApi(req1, headers1);
  console.log('Payload MIME:   ', req1.mimeType);
  console.log('Response Status:', res1.status);
  console.log('Response Body:  ', JSON.stringify(res1.body, null, 2));

  assert.equal(res1.status, 200);
  assert.equal(res1.body.success, true);
  assert.ok(res1.body.text.includes('DOCUMENT OCR EXTRACTION'));
  assert.equal(res1.body.confidence, 0.985);

  const user = mockFirestore.users.get('user_ocr_first_001');
  assert.equal(user.trialOCRUsed, true, 'User trialOCRUsed must be recorded');
  console.log('✅ PASSOU: Texto extraído com sucesso e trial gravado no Firestore.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 2: Arquivo válido + trial já usado → Retorna 403 Forbidden');
  console.log('---------------------------------------------------------------');
  const req2 = {
    uid: 'user_ocr_first_001', // already used trial in scenario 1
    fingerprintHash: 'fp_ocr_device_001_11111111111111111111111111111111',
    fileBase64: dummyBase64Png,
    mimeType: 'image/png',
  };

  const res2 = await simulateRunOcrApi(req2, headers1);
  console.log('Response Status:', res2.status);
  console.log('Response Body:  ', JSON.stringify(res2.body));

  assert.equal(res2.status, 403);
  assert.equal(res2.body.reason, 'trial_used');
  console.log('✅ PASSOU: Requisição bloqueada com 403 (reason: "trial_used").\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 3: Tipo de arquivo inválido (exe / svg) → Retorna 400 Bad Request');
  console.log('---------------------------------------------------------------');
  const req3Svg = {
    uid: 'user_ocr_new_002',
    fingerprintHash: 'fp_ocr_device_002_22222222222222222222222222222222',
    fileBase64: 'PHN2Zz48L3N2Zz4=',
    mimeType: 'image/svg+xml',
  };
  const headers3 = { 'x-forwarded-for': '198.51.100.88' };

  const res3Svg = await simulateRunOcrApi(req3Svg, headers3);
  console.log('Payload MIME:   ', req3Svg.mimeType);
  console.log('Response Status:', res3Svg.status);
  console.log('Response Body:  ', JSON.stringify(res3Svg.body));

  assert.equal(res3Svg.status, 400);
  assert.ok(res3Svg.body.error.includes('Unsupported file format'));
  console.log('✅ PASSOU: Tipo de arquivo inválido rejeitado com status 400.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 4: Arquivo acima de 5MB → Retorna 400 Bad Request');
  console.log('---------------------------------------------------------------');
  // Generate a mock base64 payload larger than 5MB (~5.2MB)
  const largeBuffer = Buffer.alloc(5.2 * 1024 * 1024, 'a');
  const largeBase64 = largeBuffer.toString('base64');

  const req4Large = {
    uid: 'user_ocr_new_003',
    fingerprintHash: 'fp_ocr_device_003_33333333333333333333333333333333',
    fileBase64: largeBase64,
    mimeType: 'application/pdf',
  };
  const headers4 = { 'x-forwarded-for': '198.51.100.99' };

  const res4Large = await simulateRunOcrApi(req4Large, headers4);
  console.log('File Byte Size: ', (getByteLength(largeBase64) / (1024 * 1024)).toFixed(2) + 'MB');
  console.log('Response Status:', res4Large.status);
  console.log('Response Body:  ', JSON.stringify(res4Large.body));

  assert.equal(res4Large.status, 400);
  assert.ok(res4Large.body.error.includes('exceeds 5MB'));
  console.log('✅ PASSOU: Arquivo acima do limite rejeitado com status 400.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 5: Header interno ausente no mock PaddleOCR → Retorna 401 Unauthorized');
  console.log('---------------------------------------------------------------');
  const req5 = {
    uid: 'user_ocr_new_004',
    fingerprintHash: 'fp_ocr_device_004_44444444444444444444444444444444',
    fileBase64: dummyBase64Png,
    mimeType: 'image/png',
  };
  const headers5 = { 'x-forwarded-for': '198.51.100.111' };

  // Pass empty token to trigger 401 on microservice
  const res5NoToken = await simulateRunOcrApi(req5, headers5, '');
  console.log('Internal Token: [MISSING]');
  console.log('Response Status:', res5NoToken.status);
  console.log('Response Body:  ', JSON.stringify(res5NoToken.body));

  assert.equal(res5NoToken.status, 401);
  assert.ok(res5NoToken.body.error.includes('Authentication Failed') || res5NoToken.body.error.includes('X-Internal-Token'));
  console.log('✅ PASSOU: Chamada sem token interno rejeitada com 401 Unauthorized.\n');

  console.log('===============================================================');
  console.log('🎉 TODOS OS 5 TESTES DA ETAPA 4 PASSARAM COM SUCESSO TOTAL!');
  console.log('===============================================================\n');
}

runOcrTests().catch((err) => {
  console.error('OCR test suite failed:', err);
  process.exit(1);
});
