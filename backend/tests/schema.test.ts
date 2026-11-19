import { describe, expect, it } from 'vitest';
import { insertEmployee, withRollback } from './helpers/db.js';

const getTrx = withRollback();

describe('schema', () => {
  it('rejects a salary that is not positive', async () => {
    const trx = getTrx();
    const { id } = await insertEmployee(trx);
    await expect(
      trx('salaries').insert({
        employee_id: id,
        amount_minor: 0,
        currency: 'USD',
        effective_date: '2025-01-01',
        reason: 'adjustment',
      }),
    ).rejects.toThrow(/check/i);
  });

  it('rejects an unknown salary reason', async () => {
    const trx = getTrx();
    const { id } = await insertEmployee(trx);
    await expect(
      trx('salaries').insert({
        employee_id: id,
        amount_minor: 100,
        currency: 'USD',
        effective_date: '2025-01-01',
        reason: 'bonus',
      }),
    ).rejects.toThrow(/check/i);
  });

  it('current_salaries returns the latest row by effective date, not insert order', async () => {
    const trx = getTrx();
    const { id } = await insertEmployee(trx, { hireDate: '2023-01-01', salaryMinor: 9_000_000 });
    await trx('salaries').insert([
      { employee_id: id, amount_minor: 11_000_000, currency: 'USD', effective_date: '2025-01-01', reason: 'promotion' },
      // backdated row inserted later must not become current
      { employee_id: id, amount_minor: 9_500_000, currency: 'USD', effective_date: '2024-01-01', reason: 'annual_review' },
    ]);
    const current = await trx('current_salaries').where({ employee_id: id }).first();
    expect(current.amount_minor).toBe(11_000_000);
    expect(current.effective_date).toBe('2025-01-01');
  });

  it('rejects a pay band whose min is above its max', async () => {
    const trx = getTrx();
    await expect(
      trx('pay_bands').insert({ level: 'L9', country: 'US', currency: 'USD', min_minor: 300, mid_minor: 200, max_minor: 100 }),
    ).rejects.toThrow(/check/i);
  });
});
