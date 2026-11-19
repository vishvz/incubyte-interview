import { createHash, timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import type { Knex } from 'knex';
import { z, ZodError } from 'zod';
import { HttpError, todayUtc } from './http.js';
import { signToken, verifyToken } from './lib/auth.js';
import { employeesRouter } from './routes/employees.js';
import { insightsRouter } from './routes/insights.js';
import { metaRouter } from './routes/meta.js';
import { salariesRouter } from './routes/salaries.js';

export interface AppOptions {
  /** One origin, or several separated by commas. */
  corsOrigin: string;
  authPassword: string;
  authSecret: string;
  /** Today's date as 'YYYY-MM-DD'; injectable so tests do not depend on the clock. */
  today?: () => string;
}

const TOKEN_TTL_MS = 12 * 3_600_000;
const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60_000;
const sha256 = (s: string) => createHash('sha256').update(s).digest();

export function createApp(db: Knex, options: AppOptions) {
  const today = options.today ?? todayUtc;
  const app = express();
  // Behind Render's proxy: trust one hop so req.ip is the client address (used by login throttling).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      // Salary data must not be kept in browser or proxy caches.
      'Cache-Control': 'no-store',
    });
    next();
  });
  // CORS_ORIGIN may list several origins, comma-separated (local dev plus a deployed frontend).
  app.use(cors({ origin: options.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean) }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Failed logins per client address. After LOGIN_MAX_FAILURES in the window, the address is
  // blocked until the window ends; a successful login clears its count.
  // ponytail: in-memory, per instance; move to a shared store (e.g. Redis) if the API is scaled out.
  const failures = new Map<string, { count: number; resetAt: number }>();
  app.post('/api/login', (req, res) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = failures.get(key);
    if (entry && entry.resetAt <= now) failures.delete(key);
    const current = failures.get(key);
    if (current && current.count >= LOGIN_MAX_FAILURES) {
      res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      throw new HttpError(429, 'Too many failed sign-in attempts. Try again later.');
    }

    const { password } = z.object({ password: z.string() }).parse(req.body);
    if (!timingSafeEqual(sha256(password), sha256(options.authPassword))) {
      failures.set(key, { count: (current?.count ?? 0) + 1, resetAt: current?.resetAt ?? now + LOGIN_WINDOW_MS });
      throw new HttpError(401, 'Wrong password');
    }
    failures.delete(key);
    res.json({ token: signToken(options.authSecret, now, TOKEN_TTL_MS) });
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
  app.use('/api/insights', insightsRouter(db));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Invalid request', issues: err.issues });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err?.code === '23505') {
      // Unique violation; employees.email is the only unique column a request can hit.
      // Database details (constraint names, values) are not sent to the client.
      res.status(409).json({ error: 'An employee with this email already exists' });
    } else if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON' });
    } else if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body is too large' });
    } else if (err?.expose && err.status >= 400 && err.status < 500) {
      // Other client errors raised by the body parser (bad charset, aborted request, ...).
      res.status(err.status).json({ error: 'Invalid request' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  app.use(onError);

  return app;
}
