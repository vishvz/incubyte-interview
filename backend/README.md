# Backend

Express 5 API over PostgreSQL, written in TypeScript. Knex runs the migrations and builds the SQL. Zod validates every request.

## Setup

```bash
cp .env.example .env
npm install
npm run db:create          # creates the databases named in DATABASE_URL and DATABASE_URL_TEST
npm run migrate            # app database
npm run migrate -- --test  # test database
npm run seed               # 10,000 employees with salary history
npm run dev                # http://localhost:4000, reloads on change
```

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | App database |
| `DATABASE_URL_TEST` | Database used by the integration tests |
| `PORT` | API port (default 4000) |
| `CORS_ORIGIN` | Frontend origin allowed to call the API |
| `AUTH_PASSWORD` | Shared HR password, at least 12 characters |
| `AUTH_SECRET` | Key for signing login tokens, at least 16 characters |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the API with reload (tsx) |
| `npm test` | All tests (unit and integration) |
| `npm run test:unit` | Pure logic only, no database |
| `npm run typecheck` | TypeScript check |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run migrate` / `migrate:prod` | Apply migrations from source or from `dist/` |
| `npm run seed` / `seed:prod` | Reseed (truncates all tables). `SEED` and `SEED_COUNT` are optional |

## Code layout

```
src/
  app.ts            createApp(db, options): middleware, login, routers, error handler
  server.ts         Reads config and starts the server
  config.ts         Environment variables, checked with Zod
  http.ts           HttpError and shared Zod schemas (ids, dates, enums)
  reference.ts      Countries, currencies, departments, levels, FX rates, pay bands
  routes/           Parse the request with Zod, call a service, send the response
  services/         Business rules (currency follows country, history is append-only, ...)
  db/               Knex queries and the migration
  lib/              Pure logic: money conversion, band classification, tokens, seeded PRNG
  seed/             Deterministic data generator and the seed runner
tests/
  unit/             Pure functions
  *.test.ts         API integration tests against PostgreSQL
  helpers/          Rolled-back transaction per test, fixtures, test app
```

## Data model

- `employees`: identity, job title, department, level, country, status, hire date. No salary column.
- `salaries`: one row per pay change, `amount_minor` as an integer number of cents, with currency, effective date, reason (`hire`, `promotion`, `annual_review`, `adjustment`) and an optional note. Rows are never updated or deleted.
- `current_salaries` (view): the latest salary per employee, by `effective_date`, then `id`.
- `fx_rates`: rate to USD per currency, with an as-of date.
- `pay_bands`: min, mid and max per level and country, in that country's currency.

Money is never a float in storage. Conversion happens once, at the end, and is rounded to the nearest minor unit.

## API

All routes except `/api/health` and `/api/login` need `Authorization: Bearer <token>`. Invalid input returns `400 { error, issues }`.

| Method and path | Purpose |
| --- | --- |
| `POST /api/login` `{ password }` | Returns `{ token }`, valid for 12 hours |
| `GET /api/meta` | Countries, departments, levels and FX rates |
| `GET /api/employees` | Search (`q`), filter (`country`, `department`, `level`, `status`), sort (`name`, `hire_date`, `salary`), page (`page`, `pageSize` ≤ 100) |
| `GET /api/employees/:id` | Employee, current salary, band position and full history |
| `POST /api/employees` | Create an employee and their hire salary in one transaction |
| `PATCH /api/employees/:id` | Edit details; country and salary are not editable here |
| `POST /api/employees/:id/salaries` | Record a salary change (a new row; dated from the hire date up to today) |
| `GET /api/salary-changes/recent` | Latest changes with the previous amount and percent change |
| `GET /api/insights/distribution` | P25, median and P75 `by=country_level` or `by=department`, in `currency` |
| `GET /api/insights/band-check` | Employees `position=below` or `above` their band, biggest gap first, with counts |
| `GET /api/insights/payroll` | Active headcount and annual payroll per department, in `currency` |

## Tests

- **Unit** (`tests/unit`): money conversion, band classification, token signing, the PRNG and the seed generator. No I/O.
- **Integration** (`tests/*.test.ts`): each test runs inside a transaction that is rolled back, so tests never see each other's data. A real PostgreSQL is used because the insights depend on `percentile_cont`. Expected values in the insight tests are worked out by hand in comments.
- Time is injected (`today`), so date rules are tested without the real clock.
