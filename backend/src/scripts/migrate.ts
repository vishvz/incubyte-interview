import { createDb } from '../db/knex.js';

// Usage: npm run migrate            -> DATABASE_URL
//        npm run migrate -- --test  -> DATABASE_URL_TEST
const url = process.argv.includes('--test') ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
if (!url) throw new Error('Database URL is not set');

const db = createDb(url);
const [batch, files] = await db.migrate.latest();
console.log(files.length ? `Batch ${batch}: ${files.join(', ')}` : 'Already up to date');
await db.destroy();
