import { createDb } from '../../src/db/knex.js';

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error('DATABASE_URL_TEST is not set');

export const testDb = createDb(url);
