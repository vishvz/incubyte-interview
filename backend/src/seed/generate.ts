import { mulberry32 } from '../lib/random.js';
import { COUNTRIES, DEPARTMENTS, LEVELS, PAY_BANDS } from './reference.js';

/** Fixed "today" for generated data, so the seed never depends on the real clock. */
export const SEED_TODAY = '2026-11-01';

export type SalaryReason = 'hire' | 'promotion' | 'annual_review' | 'adjustment';

export interface EmployeeRow {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  department: string;
  level: string;
  country: string;
  status: 'active' | 'terminated';
  hire_date: string;
}

export interface SalaryRow {
  amount_minor: number;
  currency: string;
  effective_date: string;
  reason: SalaryReason;
}

export interface SeedEmployee {
  employee: EmployeeRow;
  salaries: SalaryRow[];
}

const FIRST_NAMES = [
  'Aarav', 'Aisha', 'Alex', 'Amelia', 'Ananya', 'Ben', 'Carlos', 'Chloe', 'Daniel', 'Diya',
  'Elena', 'Emma', 'Ethan', 'Fatima', 'Felix', 'Grace', 'Hannah', 'Ishaan', 'Jack', 'Julia',
  'Kabir', 'Laura', 'Leon', 'Lucas', 'Maya', 'Mia', 'Noah', 'Olivia', 'Omar', 'Priya',
  'Rahul', 'Rohan', 'Sara', 'Sofia', 'Tom', 'Vikram', 'William', 'Yuki', 'Zara', 'Zoe',
];
const LAST_NAMES = [
  'Anderson', 'Becker', 'Brown', 'Chen', 'Clarke', 'Das', 'Davies', 'Evans', 'Fischer', 'Garcia',
  'Gupta', 'Hall', 'Hoffmann', 'Iyer', 'Johnson', 'Kapoor', 'Khan', 'Lee', 'Martin', 'Mehta',
  'Miller', 'Muller', 'Nair', 'Patel', 'Reddy', 'Roberts', 'Schmidt', 'Shah', 'Singh', 'Smith',
  'Taylor', 'Thomas', 'Tremblay', 'Wagner', 'Walker', 'Weber', 'Williams', 'Wilson', 'Wright', 'Young',
];

const DAY_MS = 86_400_000;
const HIRE_FROM = Date.UTC(2015, 0, 1);
const TODAY = Date.parse(`${SEED_TODAY}T00:00:00Z`);
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function generateEmployees(seed: number, count: number): SeedEmployee[] {
  const rand = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rand();
  const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const weighted = <T extends { weight: number }>(items: readonly T[]) => {
    let r = rand();
    for (const item of items) {
      r -= item.weight;
      if (r < 0) return item;
    }
    return items[items.length - 1];
  };
  // Sum of three uniforms: roughly normal, mean 0, standard deviation 1.
  const gaussian = () => (rand() + rand() + rand() - 1.5) * 2;
  const bandMid = (level: string, country: string) =>
    PAY_BANDS.find((b) => b.level === level && b.country === country)!.mid_minor;
  // Whole hundreds of the local currency, never below 100.
  const roundMinor = (minor: number) => Math.max(10_000, Math.round(minor / 10_000) * 10_000);

  const result: SeedEmployee[] = [];
  for (let i = 1; i <= count; i++) {
    const country = weighted(COUNTRIES);
    const department = weighted(DEPARTMENTS);
    const level = weighted(LEVELS);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const totalDays = (TODAY - HIRE_FROM) / DAY_MS;
    const hireMs = HIRE_FROM + Math.floor(rand() * (totalDays - 30)) * DAY_MS;
    const years = Math.floor((TODAY - hireMs) / (365 * DAY_MS));
    const changes = Math.min(Math.floor(rand() * 4), years); // 0-3 changes, at most one per year

    // Build history backwards from the current salary, so current pay sits around the band mid.
    let levelIndex = LEVELS.indexOf(level);
    let amount = roundMinor(bandMid(level.code, country.code) * (1 + 0.11 * gaussian()));
    const later: SalaryRow[] = [];
    const gapDays = Math.floor((TODAY - hireMs) / DAY_MS / (changes + 1));
    for (let k = changes; k >= 1; k--) {
      const r = rand();
      const reason: SalaryReason =
        r < 0.25 && levelIndex > 0 ? 'promotion' : r < 0.35 ? 'adjustment' : 'annual_review';
      const raise =
        reason === 'promotion' ? between(0.08, 0.15) : reason === 'adjustment' ? between(0.01, 0.04) : between(0.02, 0.06);
      // Change k falls in the last third of its slot, so dates stay strictly ascending.
      const dayOffset = k * gapDays - Math.floor(rand() * (gapDays / 3));
      later.unshift({
        amount_minor: amount,
        currency: country.currency,
        effective_date: toDate(hireMs + dayOffset * DAY_MS),
        reason,
      });
      amount = roundMinor(amount / (1 + raise));
      if (reason === 'promotion') levelIndex--;
    }

    const hireDate = toDate(hireMs);
    result.push({
      employee: {
        employee_code: `E${String(i).padStart(5, '0')}`,
        first_name: firstName,
        last_name: lastName,
        email: `${firstName}.${lastName}.${i}@acme.example`.toLowerCase(),
        job_title: level.code === 'L6' ? `Head of ${department.name}` : `${level.title} ${department.role}`.trim(),
        department: department.name,
        level: level.code,
        country: country.code,
        status: rand() < 0.04 ? 'terminated' : 'active',
        hire_date: hireDate,
      },
      salaries: [{ amount_minor: amount, currency: country.currency, effective_date: hireDate, reason: 'hire' }, ...later],
    });
  }
  return result;
}
