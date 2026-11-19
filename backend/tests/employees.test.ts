import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authHeader, insertReference, testApp } from './helpers/app.js';
import { insertEmployee, withRollback } from './helpers/db.js';

const getTrx = withRollback();
const api = () => request(testApp(getTrx()));

beforeEach(async () => {
  await insertReference(getTrx());
});

describe('auth', () => {
  it('rejects requests without a token', async () => {
    const res = await api().get('/api/employees');
    expect(res.status).toBe(401);
  });

  it('logs in with the right password and the token works', async () => {
    const login = await api().post('/api/login').send({ password: 'test-password' });
    expect(login.status).toBe(200);
    const res = await api().get('/api/employees').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const res = await api().post('/api/login').send({ password: 'nope' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/employees', () => {
  it('paginates and reports the total', async () => {
    for (let i = 0; i < 3; i++) await insertEmployee(getTrx());
    const res = await api().get('/api/employees?pageSize=2&page=1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(2);
    expect(res.body).toMatchObject({ page: 1, pageSize: 2 });
  });

  it('returns no items but the right total for a page past the end', async () => {
    await insertEmployee(getTrx());
    const res = await api().get('/api/employees?page=5').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(1);
  });

  it('rejects a page size above 100', async () => {
    const res = await api().get('/api/employees?pageSize=101').set(authHeader);
    expect(res.status).toBe(400);
    expect(res.body.issues).toBeDefined();
  });

  it('filters by country and level', async () => {
    await insertEmployee(getTrx(), { country: 'GB', level: 'L2', currency: 'GBP' });
    await insertEmployee(getTrx(), { country: 'GB', level: 'L3', currency: 'GBP' });
    await insertEmployee(getTrx(), { country: 'US', level: 'L2' });
    const res = await api().get('/api/employees?country=GB&level=L2').set(authHeader);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({ country: 'GB', level: 'L2' });
  });

  it('treats % and _ in the search text literally', async () => {
    await insertEmployee(getTrx(), { lastName: '50%_off' });
    await insertEmployee(getTrx(), { lastName: '50xyoff' });
    const res = await api().get('/api/employees').query({ q: '50%_off' }).set(authHeader);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].lastName).toBe('50%_off');
  });

  it('searches by name case-insensitively', async () => {
    await insertEmployee(getTrx(), { firstName: 'Priya', lastName: 'Shah' });
    await insertEmployee(getTrx(), { firstName: 'Tom', lastName: 'Lee' });
    const res = await api().get('/api/employees?q=priya sh').set(authHeader);
    expect(res.body.total).toBe(1);
  });

  it('returns the current salary with its USD value and sorts by it', async () => {
    await insertEmployee(getTrx(), { lastName: 'Pound', country: 'GB', currency: 'GBP', salaryMinor: 10_000_000 });
    await insertEmployee(getTrx(), { lastName: 'Dollar', country: 'US', currency: 'USD', salaryMinor: 12_000_000 });
    const res = await api().get('/api/employees?sort=salary&order=desc').set(authHeader);
    expect(res.body.items.map((e: { lastName: string }) => e.lastName)).toEqual(['Pound', 'Dollar']);
    expect(res.body.items[0].salary).toEqual({ amountMinor: 10_000_000, currency: 'GBP', usdMinor: 12_700_000 });
  });
});

describe('GET /api/employees/:id', () => {
  it('returns the employee with current salary and history, newest first', async () => {
    const { id } = await insertEmployee(getTrx(), { hireDate: '2024-01-01', salaryMinor: 9_000_000 });
    await getTrx()('salaries').insert({
      employee_id: id, amount_minor: 9_900_000, currency: 'USD', effective_date: '2025-01-01', reason: 'annual_review',
    });
    const res = await api().get(`/api/employees/${id}`).set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.currentSalary).toMatchObject({ amountMinor: 9_900_000, reason: 'annual_review' });
    expect(res.body.history.map((s: { amountMinor: number }) => s.amountMinor)).toEqual([9_900_000, 9_000_000]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await api().get('/api/employees/999999').set(authHeader);
    expect(res.status).toBe(404);
  });

  it('returns 400 for an id that is not a positive integer', async () => {
    const res = await api().get('/api/employees/abc').set(authHeader);
    expect(res.status).toBe(400);
  });
});

const newEmployee = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.example',
  jobTitle: 'Senior Software Engineer',
  department: 'Engineering',
  level: 'L3',
  country: 'GB',
  hireDate: '2026-11-01',
  salaryMinor: 8_500_050,
};

describe('POST /api/employees', () => {
  it('creates the employee and a hire salary in the country currency', async () => {
    const res = await api().post('/api/employees').set(authHeader).send(newEmployee);
    expect(res.status).toBe(201);
    expect(res.body.employeeCode).toMatch(/^E\d{5,}$/);
    const profile = await api().get(`/api/employees/${res.body.id}`).set(authHeader);
    expect(profile.body.currentSalary).toMatchObject({
      amountMinor: 8_500_050, currency: 'GBP', reason: 'hire', effectiveDate: '2026-11-01',
    });
  });

  it('returns 400 with issues for an invalid email', async () => {
    const res = await api().post('/api/employees').set(authHeader).send({ ...newEmployee, email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toEqual(['email']);
  });

  it('rejects a fractional salary', async () => {
    const res = await api().post('/api/employees').set(authHeader).send({ ...newEmployee, salaryMinor: 100.5 });
    expect(res.status).toBe(400);
  });

  it('rejects a hire date in the future', async () => {
    const res = await api().post('/api/employees').set(authHeader).send({ ...newEmployee, hireDate: '2027-01-01' });
    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate email', async () => {
    await api().post('/api/employees').set(authHeader).send(newEmployee);
    const res = await api().post('/api/employees').set(authHeader).send(newEmployee);
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/employees/:id', () => {
  it('updates the given fields only', async () => {
    const { id } = await insertEmployee(getTrx(), { jobTitle: 'Engineer', department: 'Engineering' });
    const res = await api().patch(`/api/employees/${id}`).set(authHeader).send({ jobTitle: 'Staff Engineer' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ jobTitle: 'Staff Engineer', department: 'Engineering' });
  });

  it('does not accept salary fields', async () => {
    const { id } = await insertEmployee(getTrx());
    const res = await api().patch(`/api/employees/${id}`).set(authHeader).send({ salaryMinor: 1 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await api().patch('/api/employees/999999').set(authHeader).send({ jobTitle: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/meta', () => {
  it('lists countries with currencies, departments, levels and FX rates', async () => {
    const res = await api().get('/api/meta').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.countries).toContainEqual({ code: 'IN', name: 'India', currency: 'INR' });
    expect(res.body.levels).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    expect(res.body.fxRates).toContainEqual({ currency: 'GBP', rateToUsd: 1.27, asOf: '2026-11-01' });
  });
});
