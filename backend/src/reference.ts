// Static reference data. FX rates are fixed and dated so results are reproducible.

export const FX_AS_OF = '2026-11-01';

export const COUNTRIES = [
  { code: 'US', name: 'United States', currency: 'USD', rateToUsd: 1, weight: 0.4, payFactor: 1 },
  { code: 'IN', name: 'India', currency: 'INR', rateToUsd: 0.012, weight: 0.25, payFactor: 0.28 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', rateToUsd: 1.27, weight: 0.15, payFactor: 0.75 },
  { code: 'DE', name: 'Germany', currency: 'EUR', rateToUsd: 1.08, weight: 0.12, payFactor: 0.75 },
  { code: 'CA', name: 'Canada', currency: 'CAD', rateToUsd: 0.73, weight: 0.08, payFactor: 0.8 },
] as const;

export const DEPARTMENTS = [
  { name: 'Engineering', role: 'Software Engineer', weight: 0.3 },
  { name: 'Product', role: 'Product Manager', weight: 0.07 },
  { name: 'Sales', role: 'Account Executive', weight: 0.18 },
  { name: 'Marketing', role: 'Marketing Specialist', weight: 0.08 },
  { name: 'Finance', role: 'Financial Analyst', weight: 0.06 },
  { name: 'People', role: 'People Partner', weight: 0.05 },
  { name: 'Operations', role: 'Operations Analyst', weight: 0.11 },
  { name: 'Support', role: 'Support Specialist', weight: 0.15 },
] as const;

/** Midpoint of each level's band in USD (major units) for a US employee. */
export const LEVELS = [
  { code: 'L1', title: 'Associate', usdMid: 70_000, weight: 0.15 },
  { code: 'L2', title: '', usdMid: 90_000, weight: 0.25 },
  { code: 'L3', title: 'Senior', usdMid: 115_000, weight: 0.25 },
  { code: 'L4', title: 'Lead', usdMid: 145_000, weight: 0.18 },
  { code: 'L5', title: 'Principal', usdMid: 185_000, weight: 0.11 },
  { code: 'L6', title: 'Head of', usdMid: 235_000, weight: 0.06 },
] as const;

export const FX_RATES = COUNTRIES.map((c) => ({ currency: c.currency, rate_to_usd: c.rateToUsd, as_of: FX_AS_OF }));

/** Rounds a major-unit amount to the nearest 100 and returns minor units. */
const toMinorRounded = (major: number) => Math.round(major / 100) * 100 * 100;

/** Bands are the local midpoint ±20%. */
export const PAY_BANDS = COUNTRIES.flatMap((c) =>
  LEVELS.map((l) => {
    const midMajor = (l.usdMid * c.payFactor) / c.rateToUsd;
    return {
      level: l.code,
      country: c.code,
      currency: c.currency,
      min_minor: toMinorRounded(midMajor * 0.8),
      mid_minor: toMinorRounded(midMajor),
      max_minor: toMinorRounded(midMajor * 1.2),
    };
  }),
);
