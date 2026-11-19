import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { testDb, withRollback } from './helpers/db.js';
import { testOptions } from './helpers/app.js';

withRollback();

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(createApp(testDb, testOptions)).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
