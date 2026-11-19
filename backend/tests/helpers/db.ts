import type { Knex } from 'knex';
import { afterAll, afterEach, beforeEach } from 'vitest';
import { createDb } from '../../src/db/knex.js';

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error('DATABASE_URL_TEST is not set');

export const testDb = createDb(url);

/**
 * Runs each test in a transaction that is rolled back afterwards,
 * so tests never see each other's data. Call once per test file.
 */
export function withRollback(): () => Knex.Transaction {
  let trx: Knex.Transaction | undefined;
  beforeEach(async () => {
    trx = await testDb.transaction();
  });
  afterEach(async () => {
    await trx?.rollback();
  });
  afterAll(async () => {
    await testDb.destroy();
  });
  return () => {
    if (!trx) throw new Error('No transaction: call getTrx() inside a test');
    return trx;
  };
}

let counter = 0;

export interface EmployeeFixture {
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  level?: string;
  country?: string;
  status?: 'active' | 'terminated';
  hireDate?: string;
  salaryMinor?: number;
  currency?: string;
}

/** Inserts an employee plus a `hire` salary row. Returns the new id. */
export async function insertEmployee(db: Knex, f: EmployeeFixture = {}): Promise<{ id: number }> {
  counter += 1;
  const code = `T${String(counter).padStart(5, '0')}`;
  const hireDate = f.hireDate ?? '2024-01-15';
  const [row] = await db('employees')
    .insert({
      employee_code: code,
      first_name: f.firstName ?? 'Test',
      last_name: f.lastName ?? `Person${counter}`,
      email: f.email ?? `${code.toLowerCase()}@test.acme`,
      job_title: f.jobTitle ?? 'Engineer',
      department: f.department ?? 'Engineering',
      level: f.level ?? 'L3',
      country: f.country ?? 'US',
      status: f.status ?? 'active',
      hire_date: hireDate,
    })
    .returning('id');
  await db('salaries').insert({
    employee_id: row.id,
    amount_minor: f.salaryMinor ?? 10_000_000,
    currency: f.currency ?? 'USD',
    effective_date: hireDate,
    reason: 'hire',
  });
  return { id: row.id };
}
