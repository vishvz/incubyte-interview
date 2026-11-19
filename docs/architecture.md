# Architecture

## Overview

```
Browser (React SPA)  ──HTTP + bearer token──▶  Express API  ──SQL──▶  PostgreSQL
  frontend/                                       backend/
  pages, display currency,                        routes → services → db
  money parsing and formatting                    lib/ (pure logic)
```

Two independent TypeScript projects in one repository. They share no code: the frontend knows the API only through HTTP and its own `api/types.ts`. Each has its own dependencies, tests, README and CI workflow, so either can change or deploy on its own.

## Backend layers

| Layer | Folder | Responsibility | Example |
| --- | --- | --- | --- |
| Routes | `src/routes` | Parse and validate input with Zod, pick the status code | `pastOrToday(today)` rejects a future effective date |
| Services | `src/services` | Business rules, snake_case → camelCase | Salary currency follows the employee's country; terminated employees get no salary changes |
| Data access | `src/db` | SQL through Knex | `current_salaries` view, `percentile_cont`, lateral join for the previous salary |
| Pure logic | `src/lib` | No I/O, unit tested | `convertMinor`, `classifyBand`, `signToken`, `mulberry32` |

`createApp(db, options)` receives the database and the clock (`today`) as arguments. Tests pass a rolled-back transaction and a fixed date, so integration tests are isolated and deterministic without mocks.

Errors flow to one handler: Zod errors become 400 with `issues`, `HttpError` keeps its status, a unique-constraint violation becomes 409, and everything else is logged and returned as 500.

## Data model

```
employees 1 ──── * salaries          fx_rates (currency → rate_to_usd, as_of)
    │                 │
    │                 └─ current_salaries (view: latest row per employee)
    └── (level, country) ──── pay_bands (min, mid, max in local currency)
```

Key decisions:

- **Salary history is append-only.** A change is a new row with an effective date and a reason. The current salary is derived (`DISTINCT ON (employee_id) ... ORDER BY effective_date DESC, id DESC`), so a backdated correction lands in history without replacing a newer salary.
- **Money is integer minor units** (`bigint`, cents) plus a currency code. Conversion multiplies by stored rates and rounds once at the end.
- **Salary currency follows the country.** Country cannot be edited after creation, so a salary and its pay band always share a currency.
- **FX rates are static and dated.** Results are reproducible and every converted figure reports `rateAsOf`.

## Insights

| Insight | How it is computed |
| --- | --- |
| Distribution by country and level | `percentile_cont(array[0.25, 0.5, 0.75])` on local amounts. Each group has one currency, and conversion is linear, so converting the percentiles afterwards is exact. |
| Distribution by department | Departments mix currencies, so each salary is converted to USD before the percentile is taken. A test with a GBP salary in a USD department pins this. |
| Band check | Join to `pay_bands` on (level, country). Edges count as within. Employees without a band are left out. Ordered by the gap as a percentage of the band edge. |
| Payroll | Sum of each salary × its rate to USD per department, then converted to the display currency. The total is the sum of the rounded rows, so the table always adds up. |

Only active employees count in insights. Terminated employees stay in the directory with their history.

## Frontend

- **Server state:** TanStack Query, with keys that mirror the API (`['employees', filters]`, `['employee', id]`, `['insights', ...]`). Mutations invalidate the keys they affect.
- **URL as state:** directory filters, sort and page live in the query string, so a filtered view can be bookmarked and Back works.
- **Display currency:** a context holds `local` or a currency code. Single-currency pages convert on the client with the rates from `/api/meta`. Mixed-currency insights ask the API for one currency.
- **Money input:** typed amounts are parsed as strings into cents (`parseMajorToMinor`); there is no float arithmetic.

## Auth

One shared HR password (`AUTH_PASSWORD`). `POST /api/login` returns an HMAC-SHA256 signed token with a 12-hour expiry (`<expires>.<signature>`, built with `node:crypto`). The password comparison is constant-time. This matches the single-persona scope; the trade-offs note covers what production would need.

## Testing and CI

- Backend: 77 tests. Unit tests cover pure logic. Integration tests drive the real Express app with Supertest against PostgreSQL, each inside a rolled-back transaction.
- Frontend: unit tests for money parsing, formatting and conversion.
- GitHub Actions: `backend.yml` starts a PostgreSQL 16 service container, migrates and runs the suite. `frontend.yml` runs tests and the production build. Each runs only when its project changes.
