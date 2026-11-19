# ACME Salary Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web app where ACME's HR manager manages salaries for 10,000 employees and answers five pay questions without a spreadsheet.

**Architecture:** Two independent TypeScript projects in one repo. `backend/` is an Express API over PostgreSQL (Knex for migrations and SQL), layered as routes → services → db, with pure logic in `lib/`. `frontend/` is a React + Vite SPA that calls the API over HTTP.

**Tech Stack:** Node 24, TypeScript, Express 5, Knex, pg, Zod, Vitest, Supertest · React 19, Vite, TanStack Query, React Router, Mantine, Recharts · PostgreSQL 16+ · GitHub Actions.

**Spec:** `REQUIREMENTS.md`. Agent rules: `CLAUDE.md`.

## Global Constraints

- Money stored as integer minor units (`amount_minor bigint`) plus `currency char(3)`. Never floats for stored money.
- Salary history is append-only. Current salary = latest row by `effective_date desc, id desc`.
- Insights use medians (`percentile_cont`), plus P25 and P75.
- Base currency is USD. FX rates are static, dated, and every converted figure returns its `rateAsOf` date.
- Seed creates exactly 10,000 employees with a fixed seed (`SEED=42`), same output every run.
- Filtering, sorting, pagination, aggregation in SQL. `pageSize` max 100.
- Frontend and backend share no code.
- Salary reasons: `hire`, `promotion`, `annual_review`, `adjustment`.
- Out of scope (do not build): roles/permissions, payroll/tax, live FX, bonuses/equity, Excel import, AI questions, org chart, pay-equity by protected traits.

## Reference data (used by seed, tests and UI)

| Country | Code | Currency | rate_to_usd (as of 2026-11-01) |
| --- | --- | --- | --- |
| United States | US | USD | 1 |
| United Kingdom | GB | GBP | 1.27 |
| Germany | DE | EUR | 1.08 |
| India | IN | INR | 0.012 |
| Canada | CA | CAD | 0.73 |

- Departments: Engineering, Product, Sales, Marketing, Finance, People, Operations, Support.
- Levels: `L1`–`L6`. Pay bands per (level, country) in local minor units, min / mid / max.
- Salary currency always equals the employee's country currency (enforced in the service).

## Review Focus

1. Search text with `%`, `_` or `'` must match literally, not as wildcards, and never break SQL → test in Task 5.
2. Backdated salary change (effective date earlier than current) must appear in history but must not become the current salary; future effective dates are rejected with 400 → test in Task 6.
3. `page` past the last page returns empty `items` with correct `total`; `pageSize` above 100 returns 400 → test in Task 5.
4. Employee whose (level, country) has no pay band is left out of the band check, not a crash → test in Task 7.
5. Typing `85000.50` in the UI must save exactly `8500050` minor units (no float drift) → test in Task 8.

---

### Task 1: Requirements, rules and plan

**Files:** `REQUIREMENTS.md`, `CLAUDE.md`, `docs/plan.md`, `docs/ai/prompts.md`, `docs/ai/review-log.md`, `.gitignore`

- [x] Write files, commit `docs: add requirements, agent rules and build plan`, push `main`.

### Task 2: Scaffold and CI

**Files:**
- Create: `backend/{package.json,tsconfig.json,vitest.config.ts,.env.example,knexfile.ts}`, `backend/src/{app.ts,server.ts,config.ts}`, `backend/src/db/knex.ts`
- Create: `frontend/` via `npm create vite@latest frontend -- --template react-ts`, then add Mantine, TanStack Query, React Router, Recharts, Vitest
- Create: `docker-compose.yml` (postgres:16, db `acme`, port 5432), `backend/scripts/create-dbs.ts`
- Create: `.github/workflows/backend.yml` (postgres service container, `npm ci`, `npm run migrate`, `npm test`, `npm run typecheck`), `.github/workflows/frontend.yml` (`npm ci`, `npm test`, `npm run build`); each filtered by its project path
- Test: `backend/tests/health.test.ts`

**Interfaces — Produces:**
- `createDb(url: string): Knex` in `src/db/knex.ts`
- `createApp(db: Knex): Express` in `src/app.ts`; mounts routers under `/api`; JSON error handler; CORS from `CORS_ORIGIN`
- `config` in `src/config.ts`: `{ databaseUrl, port, corsOrigin, authPassword, authSecret }` parsed with Zod from env
- npm scripts (backend): `dev`, `build`, `start`, `test`, `test:unit`, `typecheck`, `migrate`, `seed`, `db:create`
- `.env.example`: `DATABASE_URL`, `DATABASE_URL_TEST`, `PORT=4000`, `CORS_ORIGIN=http://localhost:5173`, `AUTH_PASSWORD`, `AUTH_SECRET`

- [x] **Step 1:** Test `GET /api/health` returns `200 { ok: true }`. Run `npm test` → FAIL.
- [x] **Step 2:** Implement `createApp` with the health route. Run → PASS.
- [x] **Step 3:** `db:create` script connects to the `postgres` maintenance DB and creates `acme` and `acme_test` if missing (psql is not available locally).
- [x] **Step 4:** Frontend: `npm test` (one trivial test) and `npm run build` pass.
- [x] **Step 5:** Commit `chore: scaffold backend and frontend with CI`. Push.

### Task 3: Schema

**Files:** `backend/migrations/20261119_init.ts`, `backend/tests/helpers/db.ts`, `backend/tests/schema.test.ts`

Tables:
- `employees`: `id serial pk`, `employee_code text unique` (`E00001`), `first_name`, `last_name`, `email text unique`, `job_title`, `department`, `level`, `country char(2)`, `status text check in ('active','terminated') default 'active'`, `hire_date date`, `created_at`, `updated_at`
- `salaries`: `id serial pk`, `employee_id fk on delete cascade`, `amount_minor bigint check > 0`, `currency char(3)`, `effective_date date`, `reason text check in (4 reasons)`, `note text null`, `created_at`
- `fx_rates`: `currency char(3) pk`, `rate_to_usd numeric(18,8)`, `as_of date`
- `pay_bands`: `(level, country) pk`, `currency`, `min_minor`, `mid_minor`, `max_minor bigint`, check `min <= mid <= max`
- View `current_salaries`: `select distinct on (employee_id) * from salaries order by employee_id, effective_date desc, id desc`
- Indexes: `employees(country, level)`, `employees(department)`, `employees(lower(last_name), lower(first_name))`, `salaries(employee_id, effective_date desc)`, `salaries(effective_date desc)`

**Interfaces — Produces:** `withRollback()` test helper: `beforeEach` opens `trx = await db.transaction()`, `afterEach` `trx.rollback()`; exposes `getTrx(): Knex.Transaction`. Fixture `insertEmployee(trx, overrides?) : Promise<{ id: number }>` inserts an employee plus a `hire` salary.

- [x] **Step 1:** Test inserting a salary with `amount_minor = 0` fails; test `current_salaries` returns the latest of two rows. Run → FAIL.
- [x] **Step 2:** Write migration. `npm run migrate` against `acme_test`. Run → PASS.
- [x] **Step 3:** Commit `feat(db): add schema for employees, salaries, fx rates and pay bands`.

### Task 4: Seed

**Files:** `backend/src/lib/random.ts`, `backend/src/seed/reference.ts`, `backend/src/seed/generate.ts`, `backend/src/seed/run.ts`, tests in `backend/tests/unit/`

**Interfaces — Produces:**
- `mulberry32(seed: number): () => number` (values in [0,1))
- `COUNTRIES`, `DEPARTMENTS`, `LEVELS`, `FX_RATES`, `PAY_BANDS` constants in `seed/reference.ts` (values from Reference data above)
- `generateEmployees(seed: number, count: number): SeedEmployee[]` where `SeedEmployee = { employee: EmployeeRow; salaries: SalaryRow[] }`; pure, no I/O
- `run.ts`: truncates tables, inserts reference data, inserts employees and salaries in batches of 1,000 inside one transaction, logs count and duration

Generation rules: country weights US 40%, IN 25%, GB 15%, DE 12%, CA 8%. Salary drawn around the band mid (±25%), so roughly 10% fall outside the band. 1–4 salary rows per employee: first is `hire` at `hire_date`, later rows are increases of 2–15% with reason `annual_review` or `promotion` (promotion bumps level), occasional `adjustment`. All dates ≤ 2026-11-01 (fixed "today" for the seed; never `new Date()`).

- [x] **Step 1:** Tests: `mulberry32(42)` gives the same first 3 values twice; `generateEmployees(42, 100)` deep-equals a second call; 10,000 employees have unique codes and emails; every salary row has integer `amount_minor > 0`, currency matching country, and history dates ascending. Run → FAIL.
- [x] **Step 2:** Implement. Run → PASS.
- [x] **Step 3:** `npm run seed` against `acme`. Expect `10000 employees` logged in under 10 s.
- [x] **Step 4:** Commit `feat(seed): generate 10,000 deterministic employees with salary history`.

### Task 5: Employee API

**Files:** `backend/src/routes/employees.ts`, `backend/src/services/employees.ts`, `backend/src/db/employees.ts`, `backend/src/routes/meta.ts`, `backend/src/lib/auth.ts`, `backend/src/routes/auth.ts`, `backend/tests/employees.test.ts`, `backend/tests/unit/auth.test.ts`

**Interfaces — Produces (HTTP):**
- `POST /api/login {password}` → `200 {token}` or `401`. All other `/api` routes except `/health` require `Authorization: Bearer <token>`, else `401`.
- `GET /api/meta` → `{ countries: {code,name,currency}[], departments, levels, fxRates: {currency, rateToUsd, asOf}[] }`
- `GET /api/employees?q&country&department&level&status&sort=name|hire_date|salary&order=asc|desc&page=1&pageSize=25` → `{ items: EmployeeListItem[], total, page, pageSize }`. `EmployeeListItem = { id, employeeCode, firstName, lastName, jobTitle, department, level, country, status, salary: { amountMinor, currency, usdMinor } }`. `q` matches name, code or email, case-insensitive, `%`/`_` escaped. Sort by `salary` uses USD value.
- `GET /api/employees/:id` → employee + `currentSalary` + `history` (newest first). `404` if missing, `400` if id not a positive integer.
- `POST /api/employees` body = employee fields + `{ hireDate, salaryMinor }` → `201` with employee; creates `hire` salary dated `hireDate` (not in the future) in same transaction. Duplicate email → `409`.
- `PATCH /api/employees/:id` partial employee fields (not salary) → `200`.

**Interfaces — Produces (code):** `signToken(secret: string, nowMs: number, ttlMs: number): string`, `verifyToken(token: string, secret: string, nowMs: number): boolean` using `node:crypto` HMAC-SHA256 over the expiry time.

- [x] **Step 1:** Unit tests for `signToken`/`verifyToken`: valid, expired, tampered. Run → FAIL. Implement. Run → PASS.
- [x] **Step 2:** Integration tests (rolled back): list paginates and returns `total`; filter by country+level; `q="50%_off"` matches only a literal name; page past end gives `items: []` with correct `total`; `pageSize=101` → 400; get unknown id → 404; create with invalid email → 400 with `issues`; duplicate email → 409; request without token → 401. Run → FAIL.
- [x] **Step 3:** Implement routes (Zod), service, db queries. Run → PASS.
- [x] **Step 4:** Commit `feat(api): employee directory, profile, create and edit`. Run `superpowers:requesting-code-review`.

### Task 6: Salary history

**Files:** `backend/src/routes/salaries.ts`, `backend/src/services/salaries.ts`, `backend/src/db/salaries.ts`, `backend/tests/salaries.test.ts`

**Interfaces — Produces (HTTP):**
- `POST /api/employees/:id/salaries { amountMinor, effectiveDate, reason, note? }` → `201` salary row. Currency set from employee country. `effectiveDate` after today → 400. `reason = 'hire'` → 400 (only set on create).
- `GET /api/salary-changes/recent?limit=20` (max 100) → `{ items: { id, employeeId, employeeName, previousMinor | null, amountMinor, currency, changePct | null, effectiveDate, reason, note }[] }` ordered by `effective_date desc, id desc`; `previousMinor` via `lag()` window.

- [ ] **Step 1:** Tests: adding a raise makes it current and keeps the old row; backdated change appears in history but current stays the newer one; future date → 400; recent feed shows previous amount and percent. Run → FAIL.
- [x] **Step 2:** Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(api): append-only salary changes and recent changes feed`.

### Task 7: Insights

**Files:** `backend/src/lib/money.ts`, `backend/src/lib/bands.ts`, `backend/src/routes/insights.ts`, `backend/src/services/insights.ts`, `backend/src/db/insights.ts`, tests in `backend/tests/unit/` and `backend/tests/insights.test.ts`

**Interfaces — Produces (code):**
- `convertMinor(amountMinor: number, fromRateToUsd: number, toRateToUsd: number): number` — `Math.round(amountMinor * from / to)`
- `classifyBand(amountMinor: number, band: { minMinor: number; maxMinor: number }): 'below' | 'within' | 'above'` — inclusive bounds count as `within`

**Interfaces — Produces (HTTP):** all accept `currency` (any in `fx_rates`, default `USD`) or `currency=local` where meaningful; all responses include `rateAsOf`.
- `GET /api/insights/distribution?by=country_level|department&country?` → rows `{ country?, level?, department?, headcount, p25Minor, medianMinor, p75Minor, currency }`. `country_level` with `currency=local` stays in local currency; `department` always converts (mixed currencies).
- `GET /api/insights/band-check?position=below|above&country?&level?&page&pageSize` → `{ items: { employee…, amountMinor, currency, band: {minMinor,midMinor,maxMinor}, gapMinor, gapPct }[], total }`, sorted by largest `gapPct` first. Employees with no band are excluded.
- `GET /api/insights/payroll?currency=USD` → `{ rateAsOf, currency, rows: { department, headcount, totalMinor }[], totalMinor }`. Only `active` employees.

- [ ] **Step 1:** Unit tests: `convertMinor(100000, 1.27, 1) === 127000`; INR→USD rounding; GBP→EUR via USD; `classifyBand` at min, max, below, above. Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2:** Integration tests with a small fixture (5 employees, known amounts): median and P25/P75 equal hand-computed values; band check lists only the below-band employee; employee without band excluded; payroll totals in USD and EUR equal hand-computed values; terminated employee not in payroll. Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `feat(api): pay distribution, band check and payroll insights`. Run `superpowers:requesting-code-review`.

### Task 8: Frontend

Use `frontend-design:frontend-design` for visual direction and `dataviz` for charts and stat tiles before writing UI code.

**Files:** `frontend/src/api/{client.ts,types.ts}`, `frontend/src/lib/money.ts`, `frontend/src/pages/{Login,Employees,EmployeeProfile,EmployeeForm,Insights,Changes}.tsx`, `frontend/src/currency.tsx` (display-currency context), `frontend/src/App.tsx`, `frontend/.env.example` (`VITE_API_URL=http://localhost:4000`)

**Interfaces — Produces (code):**
- `parseMajorToMinor(input: string): number | null` — string-based, strips thousands separators, max 2 decimals, `null` on invalid
- `formatMinor(amountMinor: number, currency: string): string` — `Intl.NumberFormat`
- `apiFetch<T>(path: string, init?): Promise<T>` — adds base URL and bearer token from `localStorage`; on `401` clears token and goes to `/login`

Pages and the question each answers:
- `/employees` — directory: search box (debounced), filters, sortable columns, server pagination (Q1)
- `/employees/:id` — profile, current salary, history timeline chart + table, "Record salary change" form (Q1, Q5)
- `/employees/new`, `/employees/:id/edit` — form with field errors from API `issues`
- `/insights` — tabs: distribution (P25/median/P75 range chart by level per country, and by department), band check list, payroll by department with total (Q2, Q3, Q4)
- `/changes` — recent changes feed (Q5)
- Global display-currency selector (`local` / USD / other FX currencies); converted figures show "rates as of {date}".

- [ ] **Step 1:** Unit tests: `parseMajorToMinor("85000.50") === 8500050`, `"85,000" === 8500000`, `"1.005" === null`, `"abc" === null`; `formatMinor(8500050, "USD") === "$85,000.50"`. Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2:** Build pages. Run app against seeded DB; walk all five questions in the browser. Check a11y with `chrome-devtools-mcp:a11y-debugging`.
- [ ] **Step 3:** `npm test` and `npm run build` pass. Commit `feat(ui): directory, profiles, salary changes and insights`. Run `superpowers:requesting-code-review`.

### Task 9: Deployment (later session)

Managed Postgres (Neon), API on Render, frontend on Vercel. Set `CORS_ORIGIN`, `VITE_API_URL`, `AUTH_*`. Run migrate + seed on the hosted DB. Commit `chore: deployment config`.

### Task 10: Docs (later session)

Root `README.md` (links, live URL, video), `backend/README.md`, `frontend/README.md` with local setup, `docs/architecture.md`, `docs/trade-offs.md`, `docs/performance.md` (`EXPLAIN ANALYZE` of list, distribution and payroll queries on 10k rows), finalize `docs/ai/*`. Commit `docs: architecture, trade-offs, performance and AI notes`.
