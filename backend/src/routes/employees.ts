import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { HttpError, idParam, pastOrToday } from '../http.js';
import { COUNTRIES, DEPARTMENTS, LEVELS } from '../reference.js';
import * as service from '../services/employees.js';

const text = z.string().trim().min(1).max(200);
const countryCode = z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]]);
const department = z.enum(DEPARTMENTS.map((d) => d.name) as [string, ...string[]]);
const level = z.enum(LEVELS.map((l) => l.code) as [string, ...string[]]);
const status = z.enum(['active', 'terminated']);

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  country: countryCode.optional(),
  department: department.optional(),
  level: level.optional(),
  status: status.optional(),
  sort: z.enum(['name', 'hire_date', 'salary']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const employeeFields = {
  firstName: text,
  lastName: text,
  email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
  jobTitle: text,
  department,
  level,
};

export function employeesRouter(db: Knex, { today }: { today: () => string }) {
  const createBody = z.strictObject({
    ...employeeFields,
    country: countryCode,
    hireDate: pastOrToday(today),
    salaryMinor: z.number().int().positive().max(1e12),
  });
  // Country is not editable: the salary currency follows the country.
  const updateBody = z
    .strictObject({ ...employeeFields, status })
    .partial()
    .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await service.listEmployees(db, listQuery.parse(req.query)));
  });

  router.get('/:id', async (req, res) => {
    const profile = await service.getEmployeeProfile(db, idParam.parse(req.params.id));
    if (!profile) throw new HttpError(404, 'Employee not found');
    res.json(profile);
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.createEmployee(db, createBody.parse(req.body)));
  });

  router.patch('/:id', async (req, res) => {
    const id = idParam.parse(req.params.id);
    const updated = await service.updateEmployee(db, id, updateBody.parse(req.body));
    if (!updated) throw new HttpError(404, 'Employee not found');
    res.json(updated);
  });

  return router;
}
