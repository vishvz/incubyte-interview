import type { Knex } from 'knex';
import * as employees from '../db/employees.js';
import * as repo from '../db/salaries.js';
import { HttpError } from '../http.js';
import { currencyFor, toSalary } from './employees.js';

export interface SalaryChange {
  amountMinor: number;
  effectiveDate: string;
  reason: 'promotion' | 'annual_review' | 'adjustment';
  note?: string;
}

/** Appends a salary row. History is never updated or deleted. */
export async function recordSalaryChange(db: Knex, employeeId: number, change: SalaryChange) {
  const employee = await employees.findEmployee(db, employeeId);
  if (!employee) throw new HttpError(404, 'Employee not found');
  if (change.effectiveDate < employee.hire_date) {
    throw new HttpError(400, `Effective date cannot be before the hire date (${employee.hire_date})`);
  }
  const row = await employees.insertSalary(db, {
    employee_id: employeeId,
    amount_minor: change.amountMinor,
    currency: currencyFor(employee.country),
    effective_date: change.effectiveDate,
    reason: change.reason,
    note: change.note || null,
  });
  return toSalary(row);
}

export async function recentChanges(db: Knex, limit: number) {
  const rows = await repo.recentChanges(db, limit);
  return {
    items: rows.map((r) => ({
      ...toSalary(r),
      employeeId: r.employee_id,
      employeeCode: r.employee_code,
      employeeName: `${r.first_name} ${r.last_name}`,
      previousMinor: r.previous_minor ?? null,
      // Percent with one decimal place, e.g. 10.0
      changePct:
        r.previous_minor == null ? null : Math.round(((r.amount_minor - r.previous_minor) / r.previous_minor) * 1000) / 10,
    })),
  };
}
