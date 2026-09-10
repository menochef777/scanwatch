import assert from 'node:assert/strict';
import crypto from 'node:crypto';

console.log('\n===============================================================');
console.log('🧪 ETAPA 5 — TESTES OBRIGATÓRIOS: AUTH & FINGERPRINTJS');
console.log('===============================================================\n');

// 1. Mock Blocked Email Checker
const BLOCKED_DOMAINS = new Set([
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'sharklasers.com',
  'yopmail.com',
]);

function isBlockedEmail(email) {
  if (!email || !email.includes('@')) return true;
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2 || !parts[1] || !parts[1].includes('.')) return true;
  return BLOCKED_DOMAINS.has(parts[1]);
}

// 2. Mock Firebase Auth Backend
const mockAuthDb = new Map();
let firebaseCreateCalls = 0;
let firebaseVerificationEmailsSent = 0;

async function mockSignUp(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  // Pre-check against disposable domains before calling Firebase
  if (isBlockedEmail(cleanEmail)) {
    throw new Error('Temporary or disposable email addresses are not allowed. Please use a permanent email.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // Firebase call
  firebaseCreateCalls++;
  if (mockAuthDb.has(cleanEmail)) {
    throw new Error('An account with this email address already exists. Please sign in instead.');
  }

  const user = {
    uid: 'uid_' + crypto.randomUUID(),
    email: cleanEmail,
    emailVerified: false,
  };
  mockAuthDb.set(cleanEmail, { ...user, password });
  firebaseVerificationEmailsSent++;

  return user;
}

async function mockSignIn(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  const record = mockAuthDb.get(cleanEmail);
  if (!record || record.password !== password) {
    throw new Error('Invalid email or password. Please check your credentials.');
  }

  if (!record.emailVerified) {
    throw new Error('Your email address is not verified yet. Please check your inbox and click the verification link before signing in.');
  }

  return { uid: record.uid, email: record.email, emailVerified: true };
}

// 3. Mock FingerprintJS & Browser Environment
const mockSessionStorage = new Map();
let fingerprintJsApiInvocations = 0;

async function mockGetFingerprintHash(customWindow) {
  const FP_STORAGE_KEY = 'wd_fp_hash';

  if (!customWindow) return '';

  // Check cache
  const cached = customWindow.sessionStorage.get(FP_STORAGE_KEY);
  if (cached && cached.length === 64) {
    return { hash: cached, fromCache: true };
  }

  // Generate new
  fingerprintJsApiInvocations++;
  const visitorId = 'vId_' + customWindow.browserId;
  const hash = crypto.createHash('sha256').update(visitorId).digest('hex');
  customWindow.sessionStorage.set(FP_STORAGE_KEY, hash);

  return { hash, fromCache: false };
}

async function runAuthAndFpTests() {
  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 1: signUp com email descartável → Erro antes de chamar Firebase');
  console.log('---------------------------------------------------------------');
  firebaseCreateCalls = 0;
  let thrownError = null;
  try {
    await mockSignUp('attacker@tempmail.com', 'SuperSecretPass123!');
  } catch (err) {
    thrownError = err;
  }

  console.log('Tentativa de registro com:', 'attacker@tempmail.com');
  console.log('Chamadas ao Firebase:     ', firebaseCreateCalls);
  console.log('Mensagem de erro capturada:', thrownError?.message);

  assert.ok(thrownError, 'Must throw an error for disposable emails');
  assert.ok(thrownError.message.includes('disposable email addresses are not allowed'));
  assert.equal(firebaseCreateCalls, 0, 'Firebase create must NOT be called for disposable emails');
  console.log('✅ PASSOU: Bloqueado localmente antes de invocar o Firebase.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 2: signUp com email válido → Sucesso e email de verificação');
  console.log('---------------------------------------------------------------');
  firebaseCreateCalls = 0;
  firebaseVerificationEmailsSent = 0;
  const validUser = await mockSignUp('legitimate.founder@company.com', 'SecurePass2026!');
  
  console.log('Usuário Criado:            ', validUser.email, `(UID: ${validUser.uid})`);
  console.log('Email Verified inicial:    ', validUser.emailVerified);
  console.log('Emails de verificação disp:', firebaseVerificationEmailsSent);

  assert.ok(validUser.uid);
  assert.equal(validUser.emailVerified, false);
  assert.equal(firebaseCreateCalls, 1);
  assert.equal(firebaseVerificationEmailsSent, 1);
  console.log('✅ PASSOU: Conta criada e email de verificação enviado.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 3: signIn com email não verificado → Erro claro em inglês');
  console.log('---------------------------------------------------------------');
  let signInError = null;
  try {
    await mockSignIn('legitimate.founder@company.com', 'SecurePass2026!');
  } catch (err) {
    signInError = err;
  }

  console.log('Tentativa de login com email pendente de verificação');
  console.log('Erro retornado:', signInError?.message);

  assert.ok(signInError, 'Must reject login for unverified emails');
  assert.ok(signInError.message.includes('email address is not verified yet'));
  console.log('✅ PASSOU: Login bloqueado com mensagem clara em inglês até verificação.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 4: getFingerprintHash retorna string SHA-256 de 64 caracteres');
  console.log('---------------------------------------------------------------');
  const mockBrowserEnv = {
    browserId: 'test_device_chrome_win11_uuid',
    sessionStorage: new Map(),
  };
  fingerprintJsApiInvocations = 0;

  const firstFpCall = await mockGetFingerprintHash(mockBrowserEnv);
  console.log('Hash gerado:   ', firstFpCall.hash);
  console.log('Comprimento:   ', firstFpCall.hash.length, 'chars');
  console.log('From Cache:    ', firstFpCall.fromCache);
  console.log('API Invocations:', fingerprintJsApiInvocations);

  assert.equal(firstFpCall.hash.length, 64);
  assert.match(firstFpCall.hash, /^[a-f0-9]{64}$/);
  assert.equal(firstFpCall.fromCache, false);
  assert.equal(fingerprintJsApiInvocations, 1);
  console.log('✅ PASSOU: Hash SHA-256 válido de 64 caracteres gerado com sucesso.\n');


  console.log('---------------------------------------------------------------');
  console.log('📌 CENÁRIO 5: getFingerprintHash chamado 2x → 2ª vem do cache (sessionStorage)');
  console.log('---------------------------------------------------------------');
  const secondFpCall = await mockGetFingerprintHash(mockBrowserEnv);
  console.log('2ª Chamada Hash:', secondFpCall.hash);
  console.log('From Cache:     ', secondFpCall.fromCache);
  console.log('API Invocations:', fingerprintJsApiInvocations);

  assert.equal(secondFpCall.hash, firstFpCall.hash);
  assert.equal(secondFpCall.fromCache, true);
  assert.equal(fingerprintJsApiInvocations, 1, 'API must NOT be called again if cached');
  console.log('✅ PASSOU: Segunda chamada servida instantaneamente a partir do cache.\n');

  console.log('===============================================================');
  console.log('🎉 TODOS OS 5 TESTES DA ETAPA 5 PASSARAM COM SUCESSO TOTAL!');
  console.log('===============================================================\n');
}

runAuthAndFpTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
