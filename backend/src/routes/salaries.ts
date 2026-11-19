import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { idParam, pastOrToday } from '../http.js';
import * as service from '../services/salaries.js';

export function salariesRouter(db: Knex, { today }: { today: () => string }) {
  const changeBody = z.strictObject({
    amountMinor: z.number().int().positive().max(1e12),
    effectiveDate: pastOrToday(today),
    // 'hire' is only set when the employee is created.
    reason: z.enum(['promotion', 'annual_review', 'adjustment']),
    note: z.string().trim().max(500).optional(),
  });
  const recentQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

  const router = Router();

  router.post('/employees/:id/salaries', async (req, res) => {
    const id = idParam.parse(req.params.id);
    res.status(201).json(await service.recordSalaryChange(db, id, changeBody.parse(req.body)));
  });

  router.get('/salary-changes/recent', async (req, res) => {
    res.json(await service.recentChanges(db, recentQuery.parse(req.query).limit));
  });

  return router;
}
