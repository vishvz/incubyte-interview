import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { countryCode, levelCode } from '../http.js';
import * as service from '../services/insights.js';

const currency = z.string().regex(/^([A-Z]{3}|local)$/, 'Use a 3-letter currency code or "local"').default('USD');
const scope = { country: countryCode.optional(), level: levelCode.optional() };

const distributionQuery = z.object({
  by: z.enum(['country_level', 'department']),
  currency,
  ...scope,
});
const bandCheckQuery = z.object({
  position: z.enum(['below', 'above']),
  ...scope,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const payrollQuery = z.object({ currency });

export function insightsRouter(db: Knex) {
  const router = Router();

  router.get('/distribution', async (req, res) => {
    res.json(await service.distribution(db, distributionQuery.parse(req.query)));
  });

  router.get('/band-check', async (req, res) => {
    res.json(await service.bandCheck(db, bandCheckQuery.parse(req.query)));
  });

  router.get('/payroll', async (req, res) => {
    res.json(await service.payroll(db, payrollQuery.parse(req.query).currency));
  });

  return router;
}
