import { createHmac, timingSafeEqual } from 'node:crypto';

// A minimal signed token for the single HR login: "<expiresAtMs>.<hmac>".
// ponytail: one shared password, no users or roles; replace with real identity (OIDC) for production.

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function signToken(secret: string, nowMs: number, ttlMs: number): string {
  const expires = String(nowMs + ttlMs);
  return `${expires}.${sign(expires, secret)}`;
}

export function verifyToken(token: string, secret: string, nowMs: number): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [expires, sig] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) <= nowMs) return false;
  const expected = Buffer.from(sign(expires, secret));
  const actual = Buffer.from(sig);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
