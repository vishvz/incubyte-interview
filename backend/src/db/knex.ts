import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import knex, { type Knex } from 'knex';
import pg from 'pg';

// Return bigint (int8) and numeric as JS numbers. Safe here: salaries in minor
// units and payroll totals stay far below Number.MAX_SAFE_INTEGER (9e15).
pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
// Keep DATE columns as 'YYYY-MM-DD' strings, avoiding timezone shifts.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));
const isMigration = (f: string) => /\.(ts|js)$/.test(f) && !f.endsWith('.d.ts');

/**
 * Migrations are recorded without their extension, so the same database can be
 * migrated from source (.ts via tsx) and from the build (.js via node).
 */
const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: async () => (await readdir(migrationsDir)).filter(isMigration).sort(),
  getMigrationName: (file) => file.replace(/\.(ts|js)$/, ''),
  getMigration: (file) => import(pathToFileURL(join(migrationsDir, file)).href),
};

export function createDb(connectionString: string): Knex {
  return knex({
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 10 },
    migrations: { migrationSource },
  });
}
