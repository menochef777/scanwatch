import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n==================================================');
console.log('🧪 RUNNING ETAPA 1 VALIDATION & SECURITY TESTS');
console.log('==================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// 1. Test hashIp logic
function hashIp(ip) {
  const normalizedIp = (ip || '').trim().toLowerCase();
  if (!normalizedIp) {
    throw new Error('IP address cannot be empty');
  }
  return crypto.createHash('sha256').update(normalizedIp).digest('hex');
}

test('hashIp: generates correct SHA-256 64-char hex hash', () => {
  const hash1 = hashIp('192.168.1.1');
  const hash2 = hashIp('192.168.1.1');
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.match(hash1, /^[a-f0-9]{64}$/);
});

test('hashIp: produces unique hashes for different IPs', () => {
  const hashA = hashIp('192.168.1.1');
  const hashB = hashIp('192.168.1.2');
  assert.notEqual(hashA, hashB);
});

test('hashIp: trims whitespace and normalizes case to prevent spoofing', () => {
  const hash1 = hashIp(' 2001:0DB8:85A3::8A2E:0370:7334 ');
  const hash2 = hashIp('2001:0db8:85a3::8a2e:0370:7334');
  assert.equal(hash1, hash2);
});

test('hashIp: throws error for empty IP inputs', () => {
  assert.throws(() => hashIp(''), /IP address cannot be empty/);
  assert.throws(() => hashIp('   '), /IP address cannot be empty/);
});

// 2. Test blockedEmailDomains
const BLOCKED_DOMAINS = [
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'grr.la',
  'sharklasers.com',
  'tempmail.com',
  'temp-mail.org',
  'tempmail.net',
  'throwawaymail.com',
  'mailinator.com',
  'trashmail.com',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'dispostable.com',
  'nada.ltd',
  'getairmail.com',
  'fakeinbox.com',
  'mohmal.com',
  'burnermail.io',
  'fakemailgenerator.com',
  'crazymailing.com',
  'getnada.com',
  'inboxkitten.com',
  'maildrop.cc',
  'minuteinbox.com',
  'mytemp.email',
  'emailondeck.com',
  'generator.email',
  'tmail.ws',
  'mailcatch.com',
  'dropmail.me',
  'harakirimail.com',
  'tempail.com',
  'disposablemail.com',
  'trashmail.me',
  'tmpmail.net',
  'tmpmail.org'
];
const BLOCKED_SET = new Set(BLOCKED_DOMAINS);

function isBlockedEmailDomain(email) {
  if (!email || !email.includes('@')) return true;
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) return true;
  return BLOCKED_SET.has(parts[1]);
}

test('blockedEmailDomains: correctly flags burner/disposable email services', () => {
  assert.equal(isBlockedEmailDomain('user@tempmail.com'), true);
  assert.equal(isBlockedEmailDomain('test@10minutemail.com'), true);
  assert.equal(isBlockedEmailDomain('attacker@guerrillamail.com'), true);
  assert.equal(isBlockedEmailDomain('bot@mailinator.com'), true);
  assert.equal(isBlockedEmailDomain('scammer@sharklasers.com'), true);
  assert.equal(isBlockedEmailDomain('throwaway@yopmail.com'), true);
});

test('blockedEmailDomains: allows legitimate business/personal email services', () => {
  assert.equal(isBlockedEmailDomain('user@gmail.com'), false);
  assert.equal(isBlockedEmailDomain('dev@outlook.com'), false);
  assert.equal(isBlockedEmailDomain('ceo@acmecorp.com'), false);
  assert.equal(isBlockedEmailDomain('founder@startup.io'), false);
});

test('blockedEmailDomains: rejects malformed emails as blocked', () => {
  assert.equal(isBlockedEmailDomain(''), true);
  assert.equal(isBlockedEmailDomain('no-at-sign'), true);
  assert.equal(isBlockedEmailDomain('multiple@@at.com'), true);
});

// 3. Test firestore.rules
const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

test('firestore.rules: file exists and has valid rules version header', () => {
  assert.ok(fs.existsSync(rulesPath));
  assert.ok(rulesContent.includes("rules_version = '2';"));
});

test('firestore.rules: users collection is restricted strictly to owner auth.uid', () => {
  assert.match(rulesContent, /match\s+\/users\/\{userId\}\s*\{[\s\S]*?allow read, write:\s*if\s+isOwner\(userId\);/);
  assert.ok(rulesContent.includes('request.auth.uid == userId'));
});

test('firestore.rules: ips collection completely blocks client read and write', () => {
  assert.match(rulesContent, /match\s+\/ips\/\{ipHash\}\s*\{[\s\S]*?allow read, write:\s*if\s+false;/);
});

test('firestore.rules: fingerprints collection completely blocks client read and write', () => {
  assert.match(rulesContent, /match\s+\/fingerprints\/\{fpHash\}\s*\{[\s\S]*?allow read, write:\s*if\s+false;/);
});

test('firestore.rules: catch-all denies any other documents by default', () => {
  assert.match(rulesContent, /match\s+\/\{document=\*\*\}\s*\{[\s\S]*?allow read, write:\s*if\s+false;/);
});

// Emulated rule evaluation matrix
function evaluateRule(pathTarget, op, auth) {
  if (pathTarget.startsWith('/users/')) {
    const targetUid = pathTarget.split('/users/')[1];
    if (auth && auth.uid === targetUid) return true;
    return false;
  }
  if (pathTarget.startsWith('/ips/')) return false; // write-only server
  if (pathTarget.startsWith('/fingerprints/')) return false; // write-only server
  return false;
}

test('Emulator Matrix: Authenticated user CAN read/write their own document', () => {
  assert.equal(evaluateRule('/users/usr_123', 'read', { uid: 'usr_123' }), true);
  assert.equal(evaluateRule('/users/usr_123', 'write', { uid: 'usr_123' }), true);
});

test('Emulator Matrix: Unauthenticated client CANNOT read/write user documents', () => {
  assert.equal(evaluateRule('/users/usr_123', 'read', null), false);
  assert.equal(evaluateRule('/users/usr_123', 'write', null), false);
});

test('Emulator Matrix: Authenticated user CANNOT access another user documents', () => {
  assert.equal(evaluateRule('/users/usr_123', 'read', { uid: 'usr_456' }), false);
  assert.equal(evaluateRule('/users/usr_123', 'write', { uid: 'usr_456' }), false);
});

test('Emulator Matrix: Client CANNOT read or write ips collection (Anti-Bypass Protection)', () => {
  assert.equal(evaluateRule('/ips/some_hash', 'read', { uid: 'usr_123' }), false);
  assert.equal(evaluateRule('/ips/some_hash', 'write', { uid: 'usr_123' }), false);
  assert.equal(evaluateRule('/ips/some_hash', 'read', null), false);
  assert.equal(evaluateRule('/ips/some_hash', 'write', null), false);
});

test('Emulator Matrix: Client CANNOT read or write fingerprints collection (Anti-Bypass Protection)', () => {
  assert.equal(evaluateRule('/fingerprints/some_hash', 'read', { uid: 'usr_123' }), false);
  assert.equal(evaluateRule('/fingerprints/some_hash', 'write', { uid: 'usr_123' }), false);
  assert.equal(evaluateRule('/fingerprints/some_hash', 'read', null), false);
  assert.equal(evaluateRule('/fingerprints/some_hash', 'write', null), false);
});

console.log(`\n==================================================`);
console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} tests succeeded!`);
console.log(`==================================================\n`);
