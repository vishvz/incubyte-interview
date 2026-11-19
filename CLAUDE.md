# Agent instructions — ACME Salary Management

These are the rules any AI agent (and I) follow in this repository. The spec is `REQUIREMENTS.md`; the build plan is `docs/plan.md`.

## Repository shape
- Two independent TypeScript projects: `backend/` (Express + Knex + PostgreSQL) and `frontend/` (React + Vite).
- They share no code. The frontend defines its own API types and calls the API through `VITE_API_URL`.
- Each project has its own `package.json`, tests, README and CI workflow.

## Engineering rules
- **Money is integers.** Store and compute salaries as minor units (`amount_minor`, integer cents) with a currency code. Never use floats for stored money. Convert to a display value only at the edge (formatting).
- **Salary history is append-only.** Never update or delete a `salaries` row. The current salary is the latest row by `effective_date` (then `id`).
- **Validate at the boundary.** Every request body and query string is parsed with Zod in the route. Invalid input returns `400` with `{ error, issues }`.
- **Layering.** `routes/` parse and respond, `services/` hold business rules, `db/` holds SQL. Pure logic (conversion, formatting, band classification) has no I/O and lives in `lib/`.
- **SQL does the heavy lifting.** Filtering, sorting, pagination and aggregation run in Postgres. The browser never loads all 10,000 employees.
- **Medians, not means**, for pay insights (`percentile_cont`).
- **Deterministic data.** The seed uses a fixed-seed PRNG. FX rates are static and dated.
- No new dependency when a few lines or the standard library will do.

## Testing rules
- Test-driven: write the failing test first for any logic with a branch, loop, money or SQL.
- Unit tests (Vitest) for pure logic: no database, no network.
- Integration tests (Vitest + Supertest) run against real Postgres (`DATABASE_URL_TEST`). Each test runs in a transaction that is rolled back.
- Tests must be fast and deterministic: no real clock, no random without a seed.

## Workflow rules
- One commit per milestone in `docs/plan.md`, Conventional Commits, normal English.
- Run the project's tests and type check before every commit.
- Never commit `.env` files or credentials. Keep `.env.example` up to date.
- Record notable prompts in `docs/ai/prompts.md`.
- When AI output is wrong (a bug, a wrong assumption, a failing test), add an entry to `docs/ai/review-log.md`: what it produced, how it was caught, the fix.
