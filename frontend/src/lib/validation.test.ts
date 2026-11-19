import { describe, expect, it } from 'vitest';
import { validateEmployee, validateSalaryChange } from './validation';

const valid = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.example',
  jobTitle: 'Engineer',
  department: 'Engineering',
  level: 'L3',
  country: 'GB',
  hireDate: '2026-01-15',
  salary: '85,000.50',
};
const TODAY = '2026-11-19';

describe('validateEmployee', () => {
  it('accepts a complete new employee', () => {
    expect(validateEmployee(valid, { editing: false, today: TODAY })).toEqual({});
  });

  it('reports every missing required field', () => {
    const errors = validateEmployee(
      { ...valid, firstName: ' ', lastName: '', jobTitle: '', department: '', level: '', country: '', salary: '' },
      { editing: false, today: TODAY },
    );
    expect(Object.keys(errors).sort()).toEqual(['country', 'department', 'firstName', 'jobTitle', 'lastName', 'level', 'salary']);
    expect(errors.firstName).toBe('Enter a first name');
  });

  it('checks the email format', () => {
    expect(validateEmployee({ ...valid, email: 'ada@' }, { editing: false, today: TODAY }).email).toBe(
      'Enter a valid email address, like name@acme.com',
    );
  });

  it('rejects a salary with more than two decimals or zero', () => {
    expect(validateEmployee({ ...valid, salary: '1.005' }, { editing: false, today: TODAY }).salary).toBeDefined();
    expect(validateEmployee({ ...valid, salary: '0' }, { editing: false, today: TODAY }).salary).toBeDefined();
  });

  it('rejects a hire date in the future', () => {
    expect(validateEmployee({ ...valid, hireDate: '2026-11-20' }, { editing: false, today: TODAY }).hireDate).toBe(
      'Hire date cannot be in the future',
    );
  });

  it('ignores salary, country and hire date when editing', () => {
    const errors = validateEmployee({ ...valid, salary: '', country: '', hireDate: '' }, { editing: true, today: TODAY });
    expect(errors).toEqual({});
  });

  it('limits names to 200 characters', () => {
    expect(validateEmployee({ ...valid, lastName: 'x'.repeat(201) }, { editing: false, today: TODAY }).lastName).toBeDefined();
  });
});

describe('validateSalaryChange', () => {
  const base = { amount: '90,000', effectiveDate: '2026-06-01', hireDate: '2024-05-14', today: TODAY };

  it('accepts a valid change', () => {
    expect(validateSalaryChange(base)).toEqual({});
  });

  it('requires a valid amount', () => {
    expect(validateSalaryChange({ ...base, amount: '' }).amount).toBe('Enter the new annual salary');
    expect(validateSalaryChange({ ...base, amount: 'abc' }).amount).toBe('Enter an amount like 85000 or 85,000.50');
  });

  it('keeps the date between the hire date and today', () => {
    expect(validateSalaryChange({ ...base, effectiveDate: '2026-11-20' }).effectiveDate).toBe(
      'Effective date cannot be in the future',
    );
    expect(validateSalaryChange({ ...base, effectiveDate: '2024-05-13' }).effectiveDate).toBe(
      'Effective date cannot be before the hire date (14 May 2024)',
    );
    expect(validateSalaryChange({ ...base, effectiveDate: '' }).effectiveDate).toBe('Choose the effective date');
  });
});
