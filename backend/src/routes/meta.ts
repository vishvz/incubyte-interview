import { Router } from 'express';
import type { Knex } from 'knex';
import { COUNTRIES, DEPARTMENTS, LEVELS } from '../reference.js';

export function metaRouter(db: Knex) {
  const router = Router();
  router.get('/', async (_req, res) => {
    const rates = await db('fx_rates').select('currency', 'rate_to_usd', 'as_of').orderBy('currency');
    res.json({
      countries: COUNTRIES.map(({ code, name, currency }) => ({ code, name, currency })),
      departments: DEPARTMENTS.map((d) => d.name),
      levels: LEVELS.map((l) => l.code),
      fxRates: rates.map((r) => ({ currency: r.currency, rateToUsd: r.rate_to_usd, asOf: r.as_of })),
    });
  });
  return router;
}
