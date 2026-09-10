import { describe, it, expect } from 'vitest';
import { hashIp } from '../lib/hashIp';

describe('hashIp', () => {
  it('should generate a consistent 64-character hex SHA-256 hash', () => {
    const ip = '192.168.1.1';
    const hash1 = hashIp(ip);
    const hash2 = hashIp(ip);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash1)).toBe(true);
  });

  it('should produce different hashes for different IPs', () => {
    const hashA = hashIp('192.168.1.1');
    const hashB = hashIp('192.168.1.2');
    expect(hashA).not.toBe(hashB);
  });

  it('should trim and lowercase IP before hashing to avoid duplicate bypasses', () => {
    const hash1 = hashIp(' 2001:0db8:85a3::8a2e:0370:7334 ');
    const hash2 = hashIp('2001:0DB8:85A3::8A2E:0370:7334');
    expect(hash1).toBe(hash2);
  });

  it('should throw error for empty IP string', () => {
    expect(() => hashIp('')).toThrow('IP address cannot be empty');
    expect(() => hashIp('   ')).toThrow('IP address cannot be empty');
  });
});
