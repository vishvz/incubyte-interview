import type { Knex } from 'knex';

export interface ListFilters {
  q?: string;
  country?: string;
  department?: string;
  level?: string;
  status?: string;
  sort: 'name' | 'hire_date' | 'salary';
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

/** Escapes LIKE wildcards so user text matches literally. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

// Every listed employee needs a current salary and an FX rate; count with the same joins.
function filtered(db: Knex, f: ListFilters) {
  const query = db('employees as e')
    .join('current_salaries as s', 's.employee_id', 'e.id')
    .join('fx_rates as fx', 'fx.currency', 's.currency');
  if (f.country) query.where('e.country', f.country);
  if (f.department) query.where('e.department', f.department);
  if (f.level) query.where('e.level', f.level);
  if (f.status) query.where('e.status', f.status);
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    query.where((w) =>
      w
        .whereRaw(`e.first_name || ' ' || e.last_name ilike ?`, [like])
        .orWhereRaw('e.employee_code ilike ?', [like])
        .orWhereRaw('e.email ilike ?', [like]),
    );
  }
  return query;
}

export async function listEmployees(db: Knex, f: ListFilters) {
  const orderBy = {
    name: [db.raw('lower(e.last_name)'), db.raw('lower(e.first_name)')],
    hire_date: ['e.hire_date'],
    salary: ['usd_minor'],
  }[f.sort].map((column) => ({ column, order: f.order }));

  // Sequential, not Promise.all: a transaction is one connection and pg cannot run queries in parallel on it.
  const rows = await filtered(db, f)
      .select('e.*', 's.amount_minor', 's.currency', db.raw('round(s.amount_minor * fx.rate_to_usd)::bigint as usd_minor'))
      .orderBy([...orderBy, { column: 'e.id', order: f.order }])
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize);
  const [{ count }] = await filtered(db, f).count<{ count: string }[]>('* as count');
  return { rows, total: Number(count) };
}

export const findEmployee = (db: Knex, id: number) => db('employees').where({ id }).first();

export const salaryHistory = (db: Knex, employeeId: number) =>
  db('salaries').where({ employee_id: employeeId }).orderBy([
    { column: 'effective_date', order: 'desc' },
    { column: 'id', order: 'desc' },
  ]);

export async function insertEmployee(db: Knex, row: Record<string, unknown>) {
  // Take the id first so the employee code can be derived from it (E00001, E10001, ...).
  const { rows } = await db.raw(`select nextval('employees_id_seq')::int as id`);
  const id: number = rows[0].id;
  const [created] = await db('employees')
    .insert({ ...row, id, employee_code: `E${String(id).padStart(5, '0')}` })
    .returning('*');
  return created;
}

export async function updateEmployee(db: Knex, id: number, changes: Record<string, unknown>) {
  const [updated] = await db('employees')
    .where({ id })
    .update({ ...changes, updated_at: db.fn.now() })
    .returning('*');
  return updated;
}

export const insertSalary = async (db: Knex, row: Record<string, unknown>) =>
  (await db('salaries').insert(row).returning('*'))[0];
