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
