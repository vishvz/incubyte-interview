// Client-side form checks, shown inline before anything is sent.
// The API validates the same rules again (Zod); these exist for fast, clear feedback.
import { formatDate } from './format';
import { parseMajorToMinor } from './money';

export type FieldErrors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 200;

function amountError(input: string, emptyMessage: string): string | undefined {
  if (!input.trim()) return emptyMessage;
  const minor = parseMajorToMinor(input);
  if (minor === null) return 'Enter an amount like 85000 or 85,000.50';
  if (minor === 0) return 'Amount must be more than zero';
  return undefined;
}

export interface EmployeeFields {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  level: string;
  country: string;
  hireDate: string;
  salary: string;
}

export function validateEmployee(f: EmployeeFields, { editing, today }: { editing: boolean; today: string }): FieldErrors {
  const errors: FieldErrors = {};
  const text = (key: keyof EmployeeFields, label: string) => {
    const value = f[key].trim();
    if (!value) errors[key] = `Enter ${label}`;
    else if (value.length > MAX_TEXT) errors[key] = `Keep this under ${MAX_TEXT} characters`;
  };
  text('firstName', 'a first name');
  text('lastName', 'a last name');
  text('jobTitle', 'a job title');
  if (!f.email.trim()) errors.email = 'Enter a work email';
  else if (!EMAIL.test(f.email.trim())) errors.email = 'Enter a valid email address, like name@acme.com';
  if (!f.department) errors.department = 'Choose a department';
  if (!f.level) errors.level = 'Choose a level';

  if (!editing) {
    if (!f.country) errors.country = 'Choose a country';
    if (!f.hireDate) errors.hireDate = 'Choose the hire date';
    else if (f.hireDate > today) errors.hireDate = 'Hire date cannot be in the future';
    const salary = amountError(f.salary, 'Enter the starting salary');
    if (salary) errors.salary = salary;
  }
  return errors;
}

export function validateSalaryChange({
  amount,
  effectiveDate,
  hireDate,
  today,
}: {
  amount: string;
  effectiveDate: string;
  hireDate: string;
  today: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const a = amountError(amount, 'Enter the new annual salary');
  if (a) errors.amount = a;
  if (!effectiveDate) errors.effectiveDate = 'Choose the effective date';
  else if (effectiveDate > today) errors.effectiveDate = 'Effective date cannot be in the future';
  else if (effectiveDate < hireDate) {
    errors.effectiveDate = `Effective date cannot be before the hire date (${formatDate(hireDate)})`;
  }
  return errors;
}
