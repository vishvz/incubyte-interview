import type { Knex } from 'knex';

/** Latest salary changes, each with the amount it replaced (by effective date). */
export const recentChanges = (db: Knex, limit: number, excludeHires = false) =>
  db
    .select(
      's.*',
      'e.first_name',
      'e.last_name',
      'e.employee_code',
      'prev.amount_minor as previous_minor',
    )
    .from('salaries as s')
    .join('employees as e', 'e.id', 's.employee_id')
    .joinRaw(
      `left join lateral (
         select p.amount_minor from salaries p
         where p.employee_id = s.employee_id and (p.effective_date, p.id) < (s.effective_date, s.id)
         order by p.effective_date desc, p.id desc
         limit 1
       ) prev on true`,
    )
    .orderBy([
      { column: 's.effective_date', order: 'desc' },
      { column: 's.id', order: 'desc' },
    ])
    // Constant SQL either way; no user input reaches it.
    .whereRaw(excludeHires ? "s.reason <> 'hire'" : 'true')
    .limit(limit);
