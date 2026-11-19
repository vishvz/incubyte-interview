import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authHeader, insertReference, TEST_TODAY, testApp } from './helpers/app.js';
import { insertEmployee, withRollback } from './helpers/db.js';

const getTrx = withRollback();
const api = () => request(testApp(getTrx()));

beforeEach(async () => {
  await insertReference(getTrx());
});

const profile = async (id: number) => (await api().get(`/api/employees/${id}`).set(authHeader)).body;

describe('POST /api/employees/:id/salaries', () => {
  it('makes a raise the current salary and keeps the old row', async () => {
    const { id } = await insertEmployee(getTrx(), { hireDate: '2024-01-01', salaryMinor: 9_000_000 });
    const res = await api()
      .post(`/api/employees/${id}/salaries`)
      .set(authHeader)
      .send({ amountMinor: 9_900_000, effectiveDate: '2025-04-01', reason: 'annual_review', note: 'Strong year' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ amountMinor: 9_900_000, currency: 'USD', reason: 'annual_review', note: 'Strong year' });

    const p = await profile(id);
    expect(p.currentSalary.amountMinor).toBe(9_900_000);
    expect(p.history).toHaveLength(2);
  });

  it('uses the employee country currency', async () => {
    const { id } = await insertEmployee(getTrx(), { country: 'IN', currency: 'INR' });
    const res = await api()
      .post(`/api/employees/${id}/salaries`)
      .set(authHeader)
      .send({ amountMinor: 250_000_000, effectiveDate: '2025-04-01', reason: 'promotion' });
    expect(res.body.currency).toBe('INR');
  });

  it('records a backdated change in history without making it current', async () => {
    const { id } = await insertEmployee(getTrx(), { hireDate: '2023-01-01', salaryMinor: 9_000_000 });
    await api().post(`/api/employees/${id}/salaries`).set(authHeader)
      .send({ amountMinor: 11_000_000, effectiveDate: '2025-01-01', reason: 'promotion' });
    await api().post(`/api/employees/${id}/salaries`).set(authHeader)
      .send({ amountMinor: 9_500_000, effectiveDate: '2024-01-01', reason: 'annual_review' });

    const p = await profile(id);
    expect(p.currentSalary.amountMinor).toBe(11_000_000);
    expect(p.history.map((s: { amountMinor: number }) => s.amountMinor)).toEqual([11_000_000, 9_500_000, 9_000_000]);
  });

  it('accepts today and tomorrow (UTC, for time zones ahead of UTC) but nothing later', async () => {
    const { id } = await insertEmployee(getTrx());
    const post = (effectiveDate: string) =>
      api().post(`/api/employees/${id}/salaries`).set(authHeader)
        .send({ amountMinor: 10_100_000, effectiveDate, reason: 'adjustment' });
    expect((await post(TEST_TODAY)).status).toBe(201);
    expect((await post('2026-11-20')).status).toBe(201);
    expect((await post('2026-11-21')).status).toBe(400);
  });

  it('rejects a date before the hire date', async () => {
    const { id } = await insertEmployee(getTrx(), { hireDate: '2024-01-01' });
    const res = await api().post(`/api/employees/${id}/salaries`).set(authHeader)
      .send({ amountMinor: 10_100_000, effectiveDate: '2023-12-31', reason: 'adjustment' });
    expect(res.status).toBe(400);
  });

  it('rejects the hire reason, zero amounts and fractional amounts', async () => {
    const { id } = await insertEmployee(getTrx());
    const post = (body: object) => api().post(`/api/employees/${id}/salaries`).set(authHeader).send(body);
    expect((await post({ amountMinor: 1, effectiveDate: '2025-01-01', reason: 'hire' })).status).toBe(400);
    expect((await post({ amountMinor: 0, effectiveDate: '2025-01-01', reason: 'adjustment' })).status).toBe(400);
    expect((await post({ amountMinor: 10.5, effectiveDate: '2025-01-01', reason: 'adjustment' })).status).toBe(400);
  });

  it('returns 409 for a terminated employee', async () => {
    const { id } = await insertEmployee(getTrx(), { status: 'terminated' });
    const res = await api().post(`/api/employees/${id}/salaries`).set(authHeader)
      .send({ amountMinor: 10_100_000, effectiveDate: '2025-01-01', reason: 'adjustment' });
    expect(res.status).toBe(409);
  });

  it('makes the change recorded last current when two share an effective date', async () => {
    const { id } = await insertEmployee(getTrx(), { hireDate: '2024-01-01', salaryMinor: 9_000_000 });
    const post = (amountMinor: number) =>
      api().post(`/api/employees/${id}/salaries`).set(authHeader)
        .send({ amountMinor, effectiveDate: '2025-04-01', reason: 'adjustment' });
    await post(9_500_000);
    await post(9_400_000); // a same-day correction
    const p = await profile(id);
    expect(p.currentSalary.amountMinor).toBe(9_400_000);
    expect(p.history.map((s: { amountMinor: number }) => s.amountMinor)).toEqual([9_400_000, 9_500_000, 9_000_000]);
  });

  it('returns 404 for an unknown employee', async () => {
    const res = await api().post('/api/employees/999999/salaries').set(authHeader)
      .send({ amountMinor: 100, effectiveDate: '2025-01-01', reason: 'adjustment' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/salary-changes/recent', () => {
  it('lists newest changes first with the previous amount and percent change', async () => {
    const { id } = await insertEmployee(getTrx(), {
      firstName: 'Ada', lastName: 'Lovelace', hireDate: '2024-01-01', salaryMinor: 10_000_000,
    });
    await api().post(`/api/employees/${id}/salaries`).set(authHeader)
      .send({ amountMinor: 11_000_000, effectiveDate: '2025-06-01', reason: 'promotion' });

    const res = await api().get('/api/salary-changes/recent?limit=2').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      employeeId: id,
      employeeName: 'Ada Lovelace',
      previousMinor: 10_000_000,
      amountMinor: 11_000_000,
      changePct: 10,
      reason: 'promotion',
      effectiveDate: '2025-06-01',
    });
    expect(res.body.items[1]).toMatchObject({ reason: 'hire', previousMinor: null, changePct: null });
  });

  it('rejects a limit above 100', async () => {
    const res = await api().get('/api/salary-changes/recent?limit=101').set(authHeader);
    expect(res.status).toBe(400);
  });
});
