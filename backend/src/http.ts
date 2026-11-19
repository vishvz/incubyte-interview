import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const idParam = z.coerce.number().int().positive();

/** A calendar date as 'YYYY-MM-DD'. */
export const isoDate = z.iso.date();

export const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * A date that is not in the future. "Today" is the server's UTC date, so one extra day is
 * allowed for users in time zones ahead of UTC (for example India, where it may already be tomorrow).
 * ponytail: future-dated changes are not supported; that needs current_salaries to filter by date.
 */
export const pastOrToday = (today: () => string) =>
  isoDate.refine((d) => {
    const tomorrow = new Date(Date.parse(`${today()}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    return d <= tomorrow;
  }, 'Date cannot be in the future');
