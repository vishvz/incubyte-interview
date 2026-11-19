import type { Knex } from 'knex';
import * as repo from '../db/insights.js';
import { HttpError } from '../http.js';
import { convertMinor } from '../lib/money.js';
import { toEmployee } from './employees.js';

/** Loads the static FX table and resolves the display currency. */
async function rates(db: Knex, currency: string) {
  const rows = await repo.fxRates(db);
  const rateOf = new Map(rows.map((r) => [r.currency as string, r.rate_to_usd as number]));
  if (currency !== 'local' && !rateOf.has(currency)) throw new HttpError(400, `Unknown currency ${currency}`);
  const rateAsOf = rows.reduce((max, r) => (r.as_of > max ? r.as_of : max), '');
  return { rateOf, rateAsOf };
}

const toBand = (r: Record<string, any>, convert: (m: number) => number) =>
  r.min_minor == null
    ? null
    : { minMinor: convert(r.min_minor), midMinor: convert(r.mid_minor), maxMinor: convert(r.max_minor) };

export async function distribution(
  db: Knex,
  args: repo.Scope & { by: 'country_level' | 'department'; currency: string },
) {
  const { rateOf, rateAsOf } = await rates(db, args.currency);

  if (args.by === 'department') {
    if (args.currency === 'local') throw new HttpError(400, 'Departments mix currencies; choose a currency');
    const target = rateOf.get(args.currency)!;
    const fromUsd = (usd: number) => Math.round(usd / target);
    const rows = await repo.distributionByDepartment(db, args);
    return {
      currency: args.currency,
      rateAsOf,
      rows: rows.map((r: Record<string, any>) => ({
        department: r.department,
        headcount: Number(r.headcount),
        p25Minor: fromUsd(r.quartiles[0]),
        medianMinor: fromUsd(r.quartiles[1]),
        p75Minor: fromUsd(r.quartiles[2]),
        currency: args.currency,
      })),
    };
  }

  const rows = await repo.distributionByCountryLevel(db, args);
  return {
    currency: args.currency,
    rateAsOf,
    rows: rows.map((r: Record<string, any>) => {
      const local = args.currency === 'local';
      const convert = (m: number) =>
        local ? Math.round(m) : convertMinor(m, rateOf.get(r.currency)!, rateOf.get(args.currency)!);
      return {
        country: r.country,
        level: r.level,
        headcount: Number(r.headcount),
        p25Minor: convert(r.quartiles[0]),
        medianMinor: convert(r.quartiles[1]),
        p75Minor: convert(r.quartiles[2]),
        currency: local ? r.currency : args.currency,
        band: toBand(r, convert),
      };
    }),
  };
}

export async function bandCheck(
  db: Knex,
  args: repo.Scope & { position: 'below' | 'above'; page: number; pageSize: number },
) {
  const { rows, total, counts } = await repo.bandCheck(db, args);
  return {
    items: rows.map((r: Record<string, any>) => ({
      ...toEmployee(r),
      amountMinor: r.amount_minor,
      currency: r.currency,
      band: toBand(r, (m) => m),
      gapMinor: r.gap_minor,
      gapPct: r.gap_pct,
    })),
    total,
    counts,
    page: args.page,
    pageSize: args.pageSize,
  };
}

export async function payroll(db: Knex, currency: string) {
  if (currency === 'local') throw new HttpError(400, 'Payroll mixes currencies; choose a currency');
  const { rateOf, rateAsOf } = await rates(db, currency);
  const target = rateOf.get(currency)!;
  const rows = await repo.payrollByDepartment(db);
  // Total from unrounded USD sums, so it can differ from the sum of the rows by a cent or two.
  const totalUsd = rows.reduce((sum, r: Record<string, any>) => sum + r.total_usd, 0);
  return {
    currency,
    rateAsOf,
    totalMinor: Math.round(totalUsd / target),
    rows: rows.map((r: Record<string, any>) => ({
      department: r.department,
      headcount: Number(r.headcount),
      totalMinor: Math.round(r.total_usd / target),
    })),
  };
}
