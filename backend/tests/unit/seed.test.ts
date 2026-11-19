import { describe, expect, it } from 'vitest';
import { generateEmployees, SEED_TODAY } from '../../src/seed/generate.js';
import { COUNTRIES, PAY_BANDS } from '../../src/reference.js';

const currencyOf = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.currency]));
const full = generateEmployees(42, 10_000);

describe('generateEmployees', () => {
  it('is deterministic for a fixed seed', () => {
    expect(generateEmployees(42, 100)).toEqual(generateEmployees(42, 100));
  });

  it('changes with the seed', () => {
    expect(generateEmployees(1, 10)).not.toEqual(generateEmployees(2, 10));
  });

  it('creates the requested number of employees with unique codes and emails', () => {
    expect(full).toHaveLength(10_000);
    expect(new Set(full.map((e) => e.employee.employee_code)).size).toBe(10_000);
    expect(new Set(full.map((e) => e.employee.email)).size).toBe(10_000);
  });

  it('gives every employee a valid, ordered salary history', () => {
    for (const { employee, salaries } of full) {
      expect(salaries.length).toBeGreaterThanOrEqual(1);
      expect(salaries.length).toBeLessThanOrEqual(4);
      expect(salaries[0].reason).toBe('hire');
      expect(salaries[0].effective_date).toBe(employee.hire_date);
      for (let i = 0; i < salaries.length; i++) {
        const s = salaries[i];
        expect(Number.isInteger(s.amount_minor) && s.amount_minor > 0).toBe(true);
        expect(s.currency).toBe(currencyOf[employee.country]);
        expect(s.effective_date <= SEED_TODAY).toBe(true);
        if (i > 0) expect(s.effective_date > salaries[i - 1].effective_date).toBe(true);
        if (i > 0) expect(s.reason).not.toBe('hire');
      }
    }
  });

  it('puts some, but not most, current salaries outside their pay band', () => {
    let outside = 0;
    for (const { employee, salaries } of full) {
      const band = PAY_BANDS.find((b) => b.level === employee.level && b.country === employee.country)!;
      const current = salaries[salaries.length - 1].amount_minor;
      if (current < band.min_minor || current > band.max_minor) outside++;
    }
    expect(outside / full.length).toBeGreaterThan(0.03);
    expect(outside / full.length).toBeLessThan(0.25);
  });

  it('makes the US the largest country', () => {
    const counts: Record<string, number> = {};
    for (const { employee } of full) counts[employee.country] = (counts[employee.country] ?? 0) + 1;
    const largest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    expect(largest).toBe('US');
  });
});
