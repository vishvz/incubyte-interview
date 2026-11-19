import type { Knex } from 'knex';

export interface Scope {
  country?: string;
  level?: string;
}

/** Active employees with their current salary; the base of every insight. */
function activeWithSalary(db: Knex, scope: Scope = {}) {
  const q = db('employees as e')
    .join('current_salaries as s', 's.employee_id', 'e.id')
    .where('e.status', 'active');
  if (scope.country) q.where('e.country', scope.country);
  if (scope.level) q.where('e.level', scope.level);
  return q;
}

const QUARTILES = `percentile_cont(array[0.25, 0.5, 0.75]) within group (order by %s) as quartiles`;

export const fxRates = (db: Knex) => db('fx_rates').select('currency', 'rate_to_usd', 'as_of');

/** Quartiles in each country's own currency (one currency per group). */
export const distributionByCountryLevel = (db: Knex, scope: Scope) =>
  activeWithSalary(db, scope)
    .leftJoin('pay_bands as b', (j) => j.on('b.level', 'e.level').andOn('b.country', 'e.country'))
    .select('e.country', 'e.level', 's.currency', 'b.min_minor', 'b.mid_minor', 'b.max_minor')
    .count('* as headcount')
    .select(db.raw(QUARTILES.replace('%s', 's.amount_minor')))
    .groupBy('e.country', 'e.level', 's.currency', 'b.min_minor', 'b.mid_minor', 'b.max_minor')
    .orderBy(['e.country', 'e.level']);

/** Quartiles in USD: departments mix currencies, so each salary is converted first. */
export const distributionByDepartment = (db: Knex, scope: Scope) =>
  activeWithSalary(db, scope)
    .join('fx_rates as fx', 'fx.currency', 's.currency')
    .select('e.department')
    .count('* as headcount')
    .select(db.raw(QUARTILES.replace('%s', 's.amount_minor * fx.rate_to_usd')))
    .groupBy('e.department')
    .orderBy('e.department');

export const payrollByDepartment = (db: Knex) =>
  activeWithSalary(db)
    .join('fx_rates as fx', 'fx.currency', 's.currency')
    .select('e.department')
    .count('* as headcount')
    .sum({ total_usd: db.raw('s.amount_minor * fx.rate_to_usd') })
    .groupBy('e.department')
    .orderBy('e.department');

function withBand(db: Knex, scope: Scope) {
  return activeWithSalary(db, scope).join('pay_bands as b', (j) =>
    j.on('b.level', 'e.level').andOn('b.country', 'e.country'),
  );
}

export async function bandCheck(
  db: Knex,
  args: Scope & { position: 'below' | 'above'; page: number; pageSize: number },
) {
  const outside = (q: Knex.QueryBuilder) =>
    args.position === 'below'
      ? q.whereRaw('s.amount_minor < b.min_minor')
      : q.whereRaw('s.amount_minor > b.max_minor');
  const gap =
    args.position === 'below' ? 'b.min_minor - s.amount_minor' : 's.amount_minor - b.max_minor';
  const bound = args.position === 'below' ? 'b.min_minor' : 'b.max_minor';

  const rows = await outside(withBand(db, args))
      .select(
        'e.*',
        's.amount_minor',
        's.currency',
        'b.min_minor',
        'b.mid_minor',
        'b.max_minor',
        db.raw(`(${gap}) as gap_minor`),
        db.raw(`round((${gap}) * 100.0 / ${bound}, 1) as gap_pct`),
      )
      .orderByRaw(`(${gap}) * 1.0 / ${bound} desc, e.id`)
      .limit(args.pageSize)
      .offset((args.page - 1) * args.pageSize);
  const [{ count }] = await outside(withBand(db, args)).count<{ count: string }[]>('* as count');
  const [counts] = await withBand(db, args).select(
      db.raw('count(*) filter (where s.amount_minor < b.min_minor)::int as below'),
      db.raw('count(*) filter (where s.amount_minor between b.min_minor and b.max_minor)::int as within'),
      db.raw('count(*) filter (where s.amount_minor > b.max_minor)::int as above'),
  );
  return { rows, total: Number(count), counts: counts as { below: number; within: number; above: number } };
}

export const findBand = (db: Knex, level: string, country: string) =>
  db('pay_bands').where({ level, country }).first();
