import knex, { type Knex } from 'knex';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Return bigint (int8) and numeric as JS numbers. Safe here: salaries in minor
// units and payroll totals stay far below Number.MAX_SAFE_INTEGER (9e15).
pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
// Keep DATE columns as 'YYYY-MM-DD' strings, avoiding timezone shifts.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export function createDb(connectionString: string): Knex {
  return knex({
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 10 },
    migrations: {
      directory: fileURLToPath(new URL('./migrations', import.meta.url)),
      loadExtensions: ['.ts', '.js'],
    },
  });
}
