// Shapes of the backend API responses. Kept here on purpose: frontend and backend share no code.

export type SalaryReason = 'hire' | 'promotion' | 'annual_review' | 'adjustment';
export type BandPosition = 'below' | 'within' | 'above';

export interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  level: string;
  country: string;
  status: 'active' | 'terminated';
  hireDate: string;
}

export interface EmployeeListItem extends Employee {
  salary: { amountMinor: number; currency: string; usdMinor: number };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Salary {
  id: number;
  amountMinor: number;
  currency: string;
  effectiveDate: string;
  reason: SalaryReason;
  note: string | null;
}

export interface Band {
  minMinor: number;
  midMinor: number;
  maxMinor: number;
}

export interface EmployeeProfile extends Employee {
  currentSalary: Salary | null;
  band: (Band & { position: BandPosition }) | null;
  history: Salary[];
}

export interface Meta {
  countries: { code: string; name: string; currency: string }[];
  departments: string[];
  levels: string[];
  fxRates: { currency: string; rateToUsd: number; asOf: string }[];
}

export interface RecentChange extends Salary {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  previousMinor: number | null;
  changePct: number | null;
}

export interface Quartiles {
  headcount: number;
  p25Minor: number;
  medianMinor: number;
  p75Minor: number;
  currency: string;
}

export interface Distribution<Row> {
  currency: string;
  rateAsOf: string;
  rows: Row[];
}

export type CountryLevelRow = Quartiles & { country: string; level: string; band: Band | null };
export type DepartmentRow = Quartiles & { department: string };

export interface BandCheck extends Page<EmployeeListItemOutside> {
  counts: Record<BandPosition, number>;
}

export interface EmployeeListItemOutside extends Employee {
  amountMinor: number;
  currency: string;
  band: Band;
  gapMinor: number;
  gapPct: number;
}

export interface Payroll {
  currency: string;
  rateAsOf: string;
  totalMinor: number;
  rows: { department: string; headcount: number; totalMinor: number }[];
}

export interface ApiIssue {
  path: (string | number)[];
  message: string;
}
