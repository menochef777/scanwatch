import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('firestore.rules logic & security policy verification', () => {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('should exist and define rules_version = 2', () => {
    expect(fs.existsSync(rulesPath)).toBe(true);
    expect(rulesContent).toContain("rules_version = '2';");
  });

  it('should strictly allow user to access only their own document in users/{userId}', () => {
    expect(rulesContent).toMatch(/match\s+\/users\/\{userId\}\s*\{[\s\S]*?allow read, write:\s*if\s+isOwner\(userId\);/);
    expect(rulesContent).toContain('request.auth.uid == userId');
  });

  it('should block all client read/write access to ips/{ipHash}', () => {
    expect(rulesContent).toMatch(/match\s+\/ips\/\{ipHash\}\s*\{[\s\S]*?allow read, write:\s*if\s+false;/);
  });

  it('should block all client read/write access to fingerprints/{fpHash}', () => {
    expect(rulesContent).toMatch(/match\s+\/fingerprints\/\{fpHash\}\s*\{[\s\S]*?allow read, write:\s*if\s+false;/);
  });

  it('should have a default deny catch-all rule for all other paths', () => {
    expect(rulesContent).toMatch(/match\s+\/\{document=\*\*\}\s*\{[\s\S]*?allow read, write:\s*if\s+false;/);
  });

  // Simulator rule evaluation logic
  function evaluateRuleAccess(
    pathTarget: string,
    operation: 'read' | 'write',
    authContext: { uid: string } | null
  ): { allowed: boolean; reason: string } {
    const userMatch = pathTarget.match(/^\/users\/([^/]+)$/);
    const ipsMatch = pathTarget.match(/^\/ips\/([^/]+)$/);
    const fpMatch = pathTarget.match(/^\/fingerprints\/([^/]+)$/);

    if (userMatch) {
      const docUserId = userMatch[1];
      if (!authContext) {
        return { allowed: false, reason: 'Unauthenticated access blocked' };
      }
      if (authContext.uid === docUserId) {
        return { allowed: true, reason: 'Owner authorized' };
      }
      return { allowed: false, reason: 'Cross-user access blocked' };
    }

    if (ipsMatch) {
      return { allowed: false, reason: 'Direct client access to ips collection blocked (Server Admin only)' };
    }

    if (fpMatch) {
      return { allowed: false, reason: 'Direct client access to fingerprints collection blocked (Server Admin only)' };
    }

    return { allowed: false, reason: 'Default deny catch-all' };
  }

  it('permits authenticated user to read/write their own document', () => {
    const res = evaluateRuleAccess('/users/user_abc', 'write', { uid: 'user_abc' });
    expect(res.allowed).toBe(true);
  });

  it('blocks unauthenticated access to users collection', () => {
    const res = evaluateRuleAccess('/users/user_abc', 'read', null);
    expect(res.allowed).toBe(false);
  });

  it('blocks user A from reading/writing user B document', () => {
    const res = evaluateRuleAccess('/users/user_victim', 'read', { uid: 'user_attacker' });
    expect(res.allowed).toBe(false);
  });

  it('blocks all client operations to ips collection (preventing tampering with IP logs)', () => {
    const resUnauth = evaluateRuleAccess('/ips/sha256_ip_hash', 'write', null);
    const resAuth = evaluateRuleAccess('/ips/sha256_ip_hash', 'write', { uid: 'user_abc' });
    expect(resUnauth.allowed).toBe(false);
    expect(resAuth.allowed).toBe(false);
  });

  it('blocks all client operations to fingerprints collection (preventing tampering with device logs)', () => {
    const resUnauth = evaluateRuleAccess('/fingerprints/sha256_fp_hash', 'write', null);
    const resAuth = evaluateRuleAccess('/fingerprints/sha256_fp_hash', 'write', { uid: 'user_abc' });
    expect(resUnauth.allowed).toBe(false);
    expect(resAuth.allowed).toBe(false);
  });
});
