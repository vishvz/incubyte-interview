import { createHash, timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import type { Knex } from 'knex';
import { z, ZodError } from 'zod';
import { HttpError, todayUtc } from './http.js';
import { signToken, verifyToken } from './lib/auth.js';
import { employeesRouter } from './routes/employees.js';
import { metaRouter } from './routes/meta.js';
import { salariesRouter } from './routes/salaries.js';

export interface AppOptions {
  corsOrigin: string;
  authPassword: string;
  authSecret: string;
  /** Today's date as 'YYYY-MM-DD'; injectable so tests do not depend on the clock. */
  today?: () => string;
}

const TOKEN_TTL_MS = 12 * 3_600_000;
const sha256 = (s: string) => createHash('sha256').update(s).digest();

export function createApp(db: Knex, options: AppOptions) {
  const today = options.today ?? todayUtc;
  const app = express();
  app.use(cors({ origin: options.corsOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/login', (req, res) => {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    if (!timingSafeEqual(sha256(password), sha256(options.authPassword))) {
      throw new HttpError(401, 'Wrong password');
    }
    res.json({ token: signToken(options.authSecret, Date.now(), TOKEN_TTL_MS) });
  });

  const requireAuth: RequestHandler = (req, _res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    if (!verifyToken(token, options.authSecret, Date.now())) throw new HttpError(401, 'Not logged in');
    next();
  };
  app.use('/api', requireAuth);

  app.use('/api/meta', metaRouter(db));
  app.use('/api/employees', employeesRouter(db, { today }));
  app.use('/api', salariesRouter(db, { today }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Invalid request', issues: err.issues });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err?.code === '23505') {
      res.status(409).json({ error: 'Already exists', detail: err.detail });
    } else if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  app.use(onError);

  return app;
}
