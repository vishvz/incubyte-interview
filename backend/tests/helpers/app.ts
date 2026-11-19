import type { Knex } from 'knex';
import { createApp, type AppOptions } from '../../src/app.js';
import { signToken } from '../../src/lib/auth.js';
import { FX_RATES, PAY_BANDS } from '../../src/reference.js';

export const TEST_TODAY = '2026-11-19';

export const testOptions: AppOptions = {
  corsOrigin: 'http://localhost:5173',
  authPassword: 'test-password',
  authSecret: 'test-secret-at-least-16',
  today: () => TEST_TODAY,
};

export const testApp = (db: Knex) => createApp(db, testOptions);

export const authHeader = {
  Authorization: `Bearer ${signToken(testOptions.authSecret, Date.now(), 3_600_000)}`,
};

/** Loads the static FX rates and pay bands into the (rolled-back) transaction. */
export async function insertReference(db: Knex): Promise<void> {
  await db('fx_rates').insert(FX_RATES);
  await db('pay_bands').insert(PAY_BANDS);
}
