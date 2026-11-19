import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authHeader, insertReference, testApp } from './helpers/app.js';
import { insertEmployee, withRollback } from './helpers/db.js';

const getTrx = withRollback();
const api = () => request(testApp(getTrx()));

/*
 * Fixture (current salaries, minor units):
 *   US L3 Engineering: 9.0M, 10.0M, 11.0M, 12.0M, 14.0M USD   (US L3 band: 9.2M - 11.5M - 13.8M)
 *   GB L3 Sales:       8.0M GBP                                (GB L3 band: 5.43M - 8.15M, within)
 *   CA L9 Support:     10.0M CAD, no pay band for L9
 *   US L3 Engineering: 50.0M USD, terminated (excluded from every insight)
 */
let below: number;
let lead: number;
beforeEach(async () => {
  const trx = getTrx();
  await insertReference(trx);
  const us = { country: 'US', level: 'L3', department: 'Engineering' };
  below = (await insertEmployee(trx, { ...us, salaryMinor: 9_000_000, lastName: 'Below' })).id;
  await insertEmployee(trx, { ...us, salaryMinor: 10_000_000 });
  await insertEmployee(trx, { ...us, salaryMinor: 11_000_000 });
  await insertEmployee(trx, { ...us, salaryMinor: 12_000_000 });
  lead = (await insertEmployee(trx, { ...us, salaryMinor: 14_000_000, lastName: 'Above' })).id;
  await insertEmployee(trx, { country: 'GB', currency: 'GBP', level: 'L3', department: 'Sales', salaryMinor: 8_000_000 });
  await insertEmployee(trx, { country: 'CA', currency: 'CAD', level: 'L9', department: 'Support', salaryMinor: 10_000_000 });
  await insertEmployee(trx, { ...us, salaryMinor: 50_000_000, status: 'terminated' });
});

describe('GET /api/insights/distribution', () => {
  it('gives P25, median and P75 per country and level in local currency', async () => {
    const res = await api().get('/api/insights/distribution?by=country_level&currency=local').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.rateAsOf).toBe('2026-11-01');
    const usL3 = res.body.rows.find((r: { country: string; level: string }) => r.country === 'US' && r.level === 'L3');
    expect(usL3).toMatchObject({
      headcount: 5, p25Minor: 10_000_000, medianMinor: 11_000_000, p75Minor: 12_000_000, currency: 'USD',
      band: { minMinor: 9_200_000, midMinor: 11_500_000, maxMinor: 13_800_000 },
    });
  });

  it('converts country and level figures to a chosen currency', async () => {
    const res = await api().get('/api/insights/distribution?by=country_level&currency=EUR').set(authHeader);
    const usL3 = res.body.rows.find((r: { country: string; level: string }) => r.country === 'US' && r.level === 'L3');
    expect(usL3).toMatchObject({ medianMinor: 10_185_185, currency: 'EUR' });
  });

  it('filters country and level rows by country', async () => {
    const res = await api().get('/api/insights/distribution?by=country_level&country=GB').set(authHeader);
    expect(res.body.rows.map((r: { country: string }) => r.country)).toEqual(['GB']);
  });

  it('gives department figures in USD across currencies', async () => {
    const res = await api().get('/api/insights/distribution?by=department').set(authHeader);
    expect(res.body.currency).toBe('USD');
    const eng = res.body.rows.find((r: { department: string }) => r.department === 'Engineering');
    const sales = res.body.rows.find((r: { department: string }) => r.department === 'Sales');
    expect(eng).toMatchObject({ headcount: 5, medianMinor: 11_000_000, currency: 'USD' });
    expect(sales).toMatchObject({ headcount: 1, medianMinor: 10_160_000 });
  });

  it('rejects local currency for departments, which mix currencies', async () => {
    const res = await api().get('/api/insights/distribution?by=department&currency=local').set(authHeader);
    expect(res.status).toBe(400);
  });

  it('rejects an unknown currency', async () => {
    const res = await api().get('/api/insights/distribution?by=department&currency=JPY').set(authHeader);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/insights/band-check', () => {
  it('lists employees below their band with the gap, and counts each position', async () => {
    const res = await api().get('/api/insights/band-check?position=below').set(authHeader);
    expect(res.status).toBe(200);
    // US: 9M below, 10M/11M/12M within, 14M above; GB within. CA L9 has no band.
    expect(res.body.counts).toEqual({ below: 1, within: 4, above: 1 });
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      id: below, amountMinor: 9_000_000, currency: 'USD', gapMinor: 200_000, gapPct: 2.2,
      band: { minMinor: 9_200_000, midMinor: 11_500_000, maxMinor: 13_800_000 },
    });
  });

  it('lists employees above their band', async () => {
    const res = await api().get('/api/insights/band-check?position=above').set(authHeader);
    expect(res.body.items.map((e: { id: number }) => e.id)).toEqual([lead]);
    expect(res.body.items[0]).toMatchObject({ gapMinor: 200_000, gapPct: 1.4 });
  });

  it('applies country filters to the list and the counts', async () => {
    const res = await api().get('/api/insights/band-check?position=below&country=GB').set(authHeader);
    expect(res.body.total).toBe(0);
    expect(res.body.counts).toEqual({ below: 0, within: 1, above: 0 });
  });
});

describe('GET /api/insights/payroll', () => {
  it('totals active payroll per department in USD', async () => {
    const res = await api().get('/api/insights/payroll').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currency: 'USD', rateAsOf: '2026-11-01', totalMinor: 73_460_000 });
    expect(res.body.rows).toContainEqual({ department: 'Engineering', headcount: 5, totalMinor: 56_000_000 });
    expect(res.body.rows).toContainEqual({ department: 'Sales', headcount: 1, totalMinor: 10_160_000 });
    expect(res.body.rows).toContainEqual({ department: 'Support', headcount: 1, totalMinor: 7_300_000 });
  });

  it('converts payroll to another currency', async () => {
    const res = await api().get('/api/insights/payroll?currency=EUR').set(authHeader);
    expect(res.body.rows).toContainEqual({ department: 'Engineering', headcount: 5, totalMinor: 51_851_852 });
  });
});

describe('employee profile band', () => {
  it('shows where the current salary sits in the band', async () => {
    const res = await api().get(`/api/employees/${below}`).set(authHeader);
    expect(res.body.band).toEqual({ minMinor: 9_200_000, midMinor: 11_500_000, maxMinor: 13_800_000, position: 'below' });
  });
});
