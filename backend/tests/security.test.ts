import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { authHeader, insertReference, testApp, testOptions } from './helpers/app.js';
import { insertEmployee, withRollback } from './helpers/db.js';

const getTrx = withRollback();

beforeEach(async () => {
  await insertReference(getTrx());
});

describe('security headers', () => {
  it('sends hardening headers and hides the framework', async () => {
    const res = await request(testApp(getTrx())).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it('marks salary data as not cacheable', async () => {
    const res = await request(testApp(getTrx())).get('/api/employees').set(authHeader);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('login throttling', () => {
  const wrong = { password: 'not-the-password' };

  it('blocks an address after 10 wrong passwords, with Retry-After', async () => {
    const app = testApp(getTrx());
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/login').send(wrong)).status).toBe(401);
    }
    const blocked = await request(app).post('/api/login').send(wrong);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // The right password is refused too while the address is blocked.
    const right = await request(app).post('/api/login').send({ password: testOptions.authPassword });
    expect(right.status).toBe(429);
  });

  it('clears the count after a successful login', async () => {
    const app = testApp(getTrx());
    for (let i = 0; i < 9; i++) await request(app).post('/api/login').send(wrong);
    expect((await request(app).post('/api/login').send({ password: testOptions.authPassword })).status).toBe(200);
    for (let i = 0; i < 9; i++) {
      expect((await request(app).post('/api/login').send(wrong)).status).toBe(401);
    }
  });
});

describe('login throttling behind proxies (Render: Cloudflare, load balancer, local proxy)', () => {
  // Observed on Render: X-Forwarded-For = "<client-supplied...>, <client>, <cloudflare>, <load balancer>",
  // and the direct peer is a local proxy. With 3 trusted hops, req.ip is the real client.
  const app = () => createApp(getTrx(), { ...testOptions, trustProxy: 3 });
  const fail = (a: ReturnType<typeof app>, xff: string) =>
    request(a).post('/api/login').set('X-Forwarded-For', xff).send({ password: 'wrong-password-x' });

  it('keys on the real client, ignoring forged entries and changing proxy addresses', async () => {
    const a = app();
    for (let i = 0; i < 10; i++) {
      // A forged first entry and a different Cloudflare/load-balancer address on every request.
      expect((await fail(a, `203.0.113.${i}, 106.221.73.174, 172.69.86.${i}, 10.31.10.${i}`)).status).toBe(401);
    }
    expect((await fail(a, '198.51.100.7, 106.221.73.174, 104.22.66.112, 10.31.122.138')).status).toBe(429);
  });

  it('does not block other clients behind the same proxies', async () => {
    const a = app();
    for (let i = 0; i < 10; i++) await fail(a, '106.221.73.174, 172.69.86.211, 10.31.10.85');
    expect((await fail(a, '49.36.10.20, 172.69.86.211, 10.31.10.85')).status).toBe(401);
  });
});

describe('error responses', () => {
  it('answers 413, not 500, for a body over the size limit', async () => {
    const res = await request(testApp(getTrx()))
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ password: 'a'.repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toBeDefined();
  });

  it('does not leak database details on a duplicate email', async () => {
    await insertEmployee(getTrx(), { email: 'taken@acme.example' });
    const res = await request(testApp(getTrx())).post('/api/employees').set(authHeader).send({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'taken@acme.example',
      jobTitle: 'Engineer',
      department: 'Engineering',
      level: 'L3',
      country: 'US',
      hireDate: '2026-01-01',
      salaryMinor: 10_000_000,
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'An employee with this email already exists' });
  });
});
