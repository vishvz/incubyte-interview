import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import type { Knex } from 'knex';
import { ZodError } from 'zod';

export interface AppOptions {
  corsOrigin?: string;
}

export function createApp(db: Knex, options: AppOptions = {}) {
  const app = express();
  app.use(cors({ origin: options.corsOrigin ?? 'http://localhost:5173' }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Invalid request', issues: err.issues });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(onError);

  void db; // routers that use db are mounted in later milestones
  return app;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
