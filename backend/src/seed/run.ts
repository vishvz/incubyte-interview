// Usage: npm run seed  (DATABASE_URL_UNPOOLED, else DATABASE_URL; SEED and SEED_COUNT are optional)
// The seed is one long transaction, so it uses the direct connection when there is one.
import { createDb } from '../db/knex.js';
import { generateEmployees } from './generate.js';
import { FX_RATES, PAY_BANDS } from '../reference.js';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const seed = Number(process.env.SEED ?? 42);
const count = Number(process.env.SEED_COUNT ?? 10_000);
const BATCH = 1_000;

const started = performance.now();
const data = generateEmployees(seed, count);
const db = createDb(url);

let salaryCount = 0;
await db.transaction(async (trx) => {
  await trx.raw('truncate salaries, employees, pay_bands, fx_rates restart identity cascade');
  await trx('fx_rates').insert(FX_RATES);
  await trx('pay_bands').insert(PAY_BANDS);

  for (let i = 0; i < data.length; i += BATCH) {
    const chunk = data.slice(i, i + BATCH);
    // Postgres returns ids in insert order for a multi-row insert.
    const ids: { id: number }[] = await trx('employees').insert(chunk.map((d) => d.employee)).returning('id');
    const salaries = chunk.flatMap((d, j) => d.salaries.map((s) => ({ ...s, employee_id: ids[j].id })));
    salaryCount += salaries.length;
    await trx.batchInsert('salaries', salaries, BATCH);
  }
});
await db.destroy();

const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(`Seeded ${data.length} employees and ${salaryCount} salary rows (seed ${seed}) in ${seconds}s`);
