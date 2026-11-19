# ACME Salary Management — Requirements

Nov 19, 2026 · @Vishvajeet

## Assessment context

This document scopes my submission for ACME's "Assessment with Product Framing": build web-based salary management software for an organization of 10,000 employees, using AI tools intentionally. Reviewers are looking for good engineering judgment, not the most complex system.

The brief asks for:

- A one-page requirements document before building (this document)
- An end-to-end, fully functional app with backend, UI and a relational database
- A seed script that creates 10,000 employees
- A deployed app and a video demo
- Meaningful unit tests that are fast, deterministic and easy to understand
- Incremental commits that show how the solution evolved
- Supporting artifacts: planning notes, architecture, AI prompts, trade-offs and performance notes

Submission is a Git repository link, sent as a reply to the assessment email.

## Goal and problem

Goal: replace ACME's salary spreadsheets with a web app where the HR manager can manage salary data for 10,000 employees and answer questions about how the organization pays people.

Today ACME's HR team tracks salaries for employees across multiple countries in Excel files. This is tedious, error-prone and gives no easy way to compare pay across countries, levels or departments. Because pay is in several local currencies, any cross-country comparison also needs a consistent currency conversion.

Success means the HR manager can find and update any employee's salary in seconds, see each person's pay history, and get answers to common pay questions without building a pivot table.

## User and key questions

The single user is ACME's HR manager. They know compensation well, are comfortable with spreadsheets, and need speed and trustworthy numbers more than flexibility.

The app is designed around the questions they ask most often:

1. What is this employee paid, and how has it changed over time?
2. What is the median pay (and the spread) for a role, level or department in a given country?
3. Who is paid below or above the pay band for their level and country?
4. What does each department cost in total payroll, in one common currency?
5. Whose salary changed recently, and why?

## In scope

| Feature | What the HR manager can do | Answers question |
| --- | --- | --- |
| Employee directory | Search by name or code; filter by country, department, level; sort; server-side pagination over 10,000 rows | 1 |
| Employee profile | View role, country, current salary and full salary history | 1 |
| Create and edit employees | Add or update employee details with validation and clear errors | 1 |
| Record a salary change | Add a new salary with effective date and reason (hire, promotion, annual review, adjustment); history is never overwritten | 1, 5 |
| Pay distribution | Median, P25 and P75 by country and level, plus by department | 2 |
| Pay band check | List employees below or above the band for their level and country | 3 |
| Payroll by department | Headcount and total annual payroll per department in a chosen display currency | 4 |
| Recent changes | Feed of the latest salary changes with amounts and reasons | 5 |
| Currency display | View any figure in local currency or converted to a base currency (USD) | 2, 4 |

Insights use medians rather than averages, because salary distributions are skewed and a few high earners distort the mean.

## Deliberately out of scope

| Left out | Why |
| --- | --- |
| Multi-user roles and permissions | There is one persona. A single protected login keeps salary data private in the demo; full role-based access is the first thing to add for production. |
| Payroll processing, tax and payslips | The problem is managing and understanding salary data, not paying people. Payroll is a separate, regulated system. |
| Live FX rates | Static, dated rates in a table make results reproducible and testable. Each converted figure states its rate date. |
| Bonuses, equity and benefits | Base salary answers the core questions. The salary history model can be extended to other pay components later. |
| Excel import | Valuable for migration, but the seed script covers demo data. Noted as the top follow-up. |
| Free-text AI questions | Fixed, well-chosen insights are accurate and testable. A natural-language layer could sit on top of the same endpoints later. |
| Org chart and performance data | Not needed to answer how ACME pays people. |
| Pay equity by gender or other protected traits | Important, but needs careful legal and privacy handling that a take-home cannot do justice to. |

## Technical approach

The app is two independent TypeScript projects in one Git repository: backend/ (an Express API over PostgreSQL) and frontend/ (a React app). Each has its own package.json, dependencies, scripts and README, and runs, tests and deploys on its own. They share no code: the frontend calls the API over HTTP through a configurable API URL, defines its own types for API responses, and the backend allows the frontend's origin through CORS.

| Layer | Choice | Reason |
| --- | --- | --- |
| Backend | Node.js, Express, TypeScript | Familiar, minimal framework; types catch errors in money and aggregation code |
| Database | PostgreSQL | Relational integrity, plus built-in percentile functions for medians and spreads |
| Data access | Knex (or Drizzle) with migrations | Plain, readable SQL for analytics; versioned schema changes |
| Validation | Zod at the API boundary | One schema for parsing and error messages |
| Frontend | React with Vite, TanStack Query, a component library, Recharts | Fast tooling, cached server state, ready-made tables and charts |
| Deployment | Managed Postgres, API on Render or Railway, frontend on Vercel | Free tiers, persistent data, simple setup |

Data model:

- **employees**: identity, job title, department, level, country, status, hire date. No salary column.
- **salaries**: one row per pay change, with amount in minor units (integer cents), currency, effective date and reason. The current salary is the latest row.
- **fx_rates**: rate to USD per currency, with an as-of date.
- **pay_bands**: minimum, midpoint and maximum per level and country.

Money is never stored as a floating-point number. Indexes cover the filtered and grouped columns, such as country with level, department, and employee with effective date.

The seed script uses a fixed random seed, so every run produces the same 10,000 employees. Salaries follow realistic per-country and per-level distributions, and some employees get several historical salary rows. Rows are inserted in batches, so seeding takes seconds.

At 10,000 employees, scale is modest. Filtering, pagination and aggregation run in SQL on the server, so the browser never loads the full dataset. No caching layer is planned; any query-plan checks will be recorded in a performance note.

## Quality, testing and AI use

Tests run in two layers, both fast and deterministic:

- **Unit tests** (Vitest) for pure logic: currency conversion, money formatting, pay band classification and validation rules. No database needed.
- **Integration tests** (Supertest) for API routes and SQL queries against a real Postgres in Docker. Each test runs in a transaction that is rolled back, so tests never affect each other.

A real database is used instead of an in-memory fake, because fakes do not support the percentile functions the insights depend on. GitHub Actions runs each project's test suite separately on every push.

Code is layered as routes, services and data access, so business rules stay out of request handlers and can be tested on their own.

AI tools are used to speed up scaffolding, boilerplate, seed data and test cases. I review every change, and I write or check the money handling and aggregation logic myself. The repository will include the prompts and agent instructions I used, plus a short log of places where AI output was wrong and how I caught it.

## Deliverables and done criteria

The submission is done when every item below is in the repository or linked from its README:

- [ ] This requirements document, committed before any code
- [ ] Working app: Express API, React UI, PostgreSQL database
- [ ] Seed script that creates 10,000 employees with salary history
- [ ] Unit and integration tests passing in CI
- [ ] Live deployment link
- [ ] Video demo walking through the HR manager's key questions
- [ ] A README for each project plus a short root README linking them, with local setup steps (Postgres via Docker Compose)
- [ ] Artifacts: architecture notes, trade-offs, performance note, AI prompts and AI review log
- [ ] Incremental commit history: requirements, scaffold and CI, schema, seed, employee API, salary history, insights, frontend, deployment, docs
- [ ] Repository link sent as a reply to the assessment email
