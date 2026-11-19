import type { Knex } from 'knex';
import * as repo from '../db/employees.js';
import { findBand } from '../db/insights.js';
import { classifyBand } from '../lib/bands.js';
import { COUNTRIES } from '../reference.js';

// Rows from Postgres are snake_case; the API speaks camelCase.

export const toEmployee = (r: Record<string, any>) => ({
  id: r.id,
  employeeCode: r.employee_code,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  jobTitle: r.job_title,
  department: r.department,
  level: r.level,
  country: r.country,
  status: r.status,
  hireDate: r.hire_date,
});

export const toSalary = (r: Record<string, any>) => ({
  id: r.id,
  amountMinor: r.amount_minor,
  currency: r.currency,
  effectiveDate: r.effective_date,
  reason: r.reason,
  note: r.note ?? null,
});

export const currencyFor = (country: string) => COUNTRIES.find((c) => c.code === country)!.currency;

export async function listEmployees(db: Knex, filters: repo.ListFilters) {
  const { rows, total } = await repo.listEmployees(db, filters);
  return {
    items: rows.map((r) => ({
      ...toEmployee(r),
      salary: { amountMinor: r.amount_minor, currency: r.currency, usdMinor: r.usd_minor },
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getEmployeeProfile(db: Knex, id: number) {
  const employee = await repo.findEmployee(db, id);
  if (!employee) return undefined;
  const [rows, bandRow] = await Promise.all([
    repo.salaryHistory(db, id),
    findBand(db, employee.level, employee.country),
  ]);
  const history = rows.map(toSalary);
  const currentSalary = history[0] ?? null;
  const band =
    bandRow && currentSalary
      ? {
          minMinor: bandRow.min_minor,
          midMinor: bandRow.mid_minor,
          maxMinor: bandRow.max_minor,
          position: classifyBand(currentSalary.amountMinor, { minMinor: bandRow.min_minor, maxMinor: bandRow.max_minor }),
        }
      : null;
  return { ...toEmployee(employee), currentSalary, band, history };
}

export interface NewEmployee {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  level: string;
  country: string;
  hireDate: string;
  salaryMinor: number;
}

const toColumns = (e: Partial<Omit<NewEmployee, 'hireDate' | 'salaryMinor'>> & { status?: string }) => {
  const map: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    jobTitle: 'job_title',
    department: 'department',
    level: 'level',
    country: 'country',
    status: 'status',
  };
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [map[k], v]));
};

/** Creates the employee and their `hire` salary in one transaction. */
export async function createEmployee(db: Knex, input: NewEmployee) {
  const { hireDate, salaryMinor, ...fields } = input;
  return db.transaction(async (trx) => {
    const employee = await repo.insertEmployee(trx, { ...toColumns(fields), hire_date: hireDate });
    await repo.insertSalary(trx, {
      employee_id: employee.id,
      amount_minor: salaryMinor,
      currency: currencyFor(input.country),
      effective_date: hireDate,
      reason: 'hire',
    });
    return toEmployee(employee);
  });
}

export async function updateEmployee(
  db: Knex,
  id: number,
  changes: Partial<Omit<NewEmployee, 'hireDate' | 'salaryMinor'>> & { status?: string },
) {
  const updated = await repo.updateEmployee(db, id, toColumns(changes));
  return updated ? toEmployee(updated) : undefined;
}
