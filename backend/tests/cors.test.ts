import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { testOptions } from './helpers/app.js';
import { testDb, withRollback } from './helpers/db.js';

withRollback();

describe('CORS', () => {
  const app = () => createApp(testDb, { ...testOptions, corsOrigin: 'http://localhost:5173, https://acme.example' });

  it('allows every origin in a comma-separated CORS_ORIGIN', async () => {
    const res = await request(app()).get('/api/health').set('Origin', 'https://acme.example');
    expect(res.headers['access-control-allow-origin']).toBe('https://acme.example');
  });

  it('does not allow other origins', async () => {
    const res = await request(app()).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
