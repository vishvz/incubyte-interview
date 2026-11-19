import type { SalaryReason } from '../api/types';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** '2026-11-01' -> '1 Nov 2026'. Parsed as UTC so the day never shifts. */
export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

export const REASON_LABELS: Record<SalaryReason, string> = {
  hire: 'Hire',
  promotion: 'Promotion',
  annual_review: 'Annual review',
  adjustment: 'Adjustment',
};

/** Today in the user's own time zone, as 'YYYY-MM-DD'. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Accessible names for Mantine Pagination's arrow buttons. */
export const paginationLabels = (control: 'first' | 'previous' | 'last' | 'next') => ({
  'aria-label': { first: 'First page', previous: 'Previous page', next: 'Next page', last: 'Last page' }[control],
});
