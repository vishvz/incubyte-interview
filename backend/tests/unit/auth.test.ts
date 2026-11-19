import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../../src/lib/auth.js';

const SECRET = 'test-secret-at-least-16';
const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

describe('signToken / verifyToken', () => {
  it('accepts a token before it expires', () => {
    const token = signToken(SECRET, NOW, HOUR);
    expect(verifyToken(token, SECRET, NOW + HOUR - 1)).toBe(true);
  });

  it('rejects an expired token', () => {
    const token = signToken(SECRET, NOW, HOUR);
    expect(verifyToken(token, SECRET, NOW + HOUR)).toBe(false);
  });

  it('rejects a token with a changed expiry', () => {
    const [, sig] = signToken(SECRET, NOW, HOUR).split('.');
    expect(verifyToken(`${NOW + 100 * HOUR}.${sig}`, SECRET, NOW)).toBe(false);
  });

  it('rejects a token signed with another secret', () => {
    const token = signToken('another-secret-of-16+', NOW, HOUR);
    expect(verifyToken(token, SECRET, NOW)).toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(verifyToken('', SECRET, NOW)).toBe(false);
    expect(verifyToken('abc', SECRET, NOW)).toBe(false);
    expect(verifyToken('1.2.3', SECRET, NOW)).toBe(false);
  });
});
