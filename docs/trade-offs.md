# Trade-offs

What was chosen, what was left out, and when to revisit.

## Choices

| Decision | Why | Cost, and when to change it |
| --- | --- | --- |
| Express + Knex, not a full framework or ORM | Small surface; the analytics are plain SQL that reads like the question it answers | More wiring by hand. Fine for this size. |
| Real PostgreSQL in tests, no in-memory fake | Insights rely on `percentile_cont`, `DISTINCT ON` and lateral joins, which fakes do not support | Tests need a database (Docker Compose locally, a service container in CI). The suite still runs in about 6 seconds. |
| Rolled-back transaction per test | Isolation without truncating tables; tests can run in any order | Code under test must accept an injected `db`. It already does (`createApp(db)`). |
| Append-only salary history, current salary derived by a view | History can never be overwritten; backdated corrections are safe | Every list query computes the latest row per employee. That is about 10 ms at 10,000 employees (see `performance.md`). |
| Integer minor units for money | No float rounding in storage or sums | Every currency is assumed to have 2 decimals. True for the five currencies here; JPY or KWD would need a per-currency exponent. |
| Static, dated FX rates | Reproducible and testable; every converted figure states its date | Not live. Updating rates means a new `fx_rates` row set. |
| Salary currency fixed by country; country not editable | A salary and its pay band always share a currency | A relocation needs a new employee record for now. A proper fix is a "relocation" salary change that sets the new country and currency together. |
| No future-dated salary changes (one day of grace) | Keeps "current salary" a simple view | Planned raises cannot be entered ahead of time. Supporting them means filtering the view by `effective_date <= today`. |
| Medians and quartiles, not means | Salary distributions are skewed | None. |
| One shared HR password, HMAC token | Matches the single persona and keeps salary data private in a demo | No per-user audit trail, no roles and no login throttling. First things to add for production: real identity (OIDC/SSO), roles, rate limiting and an audit log of who changed which salary. |
| Token in `localStorage` | Simple with a separate API origin | Readable by injected scripts. With real identity, move to an httpOnly, SameSite cookie. |
| Search with `ILIKE '%text%'` | Correct and simple; wildcards in user text are escaped | Cannot use a B-tree index. Fine at 10,000 rows; add a `pg_trgm` GIN index if search slows down. |
| API and frontend on Render free plan, database on Neon | Free tiers; Render region matches Neon (Singapore) | The free Render service sleeps after 15 minutes idle, so the first request after a pause takes up to about a minute. Migrations run at start because the free plan has no pre-deploy step. |

## Left out on purpose

The requirements list these as out of scope, and the build kept to that:

- Roles and permissions beyond one login
- Payroll processing, tax and payslips
- Live FX rates
- Bonuses, equity and benefits (the salary history model can take more pay components later)
- Excel import (the top follow-up for a real migration)
- Free-text AI questions (could sit on top of the same endpoints)
- Org chart and performance data
- Pay equity by gender or other protected traits

## Known limits

- The seed uses 40 first names and 40 last names, so names repeat (sorting by name shows several "Aarav Anderson"). This is cosmetic, and every employee code and email is unique.
- Recent changes are ordered by effective date, not by when they were recorded. A backdated raise entered today does not appear at the top.
- When a login expires, the user returns to the login page without the page they were on.
