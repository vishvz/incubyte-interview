# AI prompts

Notable prompts used while building this project, in order. Tool: Claude Code (Claude Opus).

## 1. Planning

> Here is my requirements document (`REQUIREMENTS.md`) and the public repo. Make your rules and plan files as needed. Use available skills for frontend design and architecture decisions.

Result: `CLAUDE.md` (agent rules) and `docs/plan.md` (milestone plan). I chose Knex, Mantine, local PostgreSQL for development, and pushing one commit per milestone to `main`. I removed diagram tooling from the plan as not needed.

## 2. Building milestones

> continue

After the plan was approved, each milestone ran as a test-first loop: write failing tests (hand-computed values for money and percentiles), implement, run the full suite and type check, commit, push.

## 3. Code review

After milestones 5 and 7, a separate reviewer agent got only the git range, the plan and the spec (not my session), with instructions to grade findings by severity and list what it set aside. Its findings and my fixes are in `review-log.md` (entries 2–10).

## 4. Frontend design

Design brief I gave myself, using the frontend-design and dataviz skills:

> A quiet tool for checking pay, built for an HR manager who lives in spreadsheets. Dense tables, tabular figures, one memorable element: a pay band range bar (band, P25–P75 box, median tick, employee marker) repeated wherever pay is compared. Validate chart colours for colour-blind separation; never show below/above band by colour alone.

The chart palette was checked with the dataviz validator. The first green failed the chroma check, so I moved to `#0e9472`.

## 5. UI polish

> we're not going to deploy. i think ui still needs some work. there are no icons or proper ui

Result: deployment dropped from the plan. The UI got an icon set, a proper app shell, an Overview landing page and shared components (page header, stat tile, person cell, reason badge, change delta, empty state). Each page was checked in the browser and with a Lighthouse accessibility audit.

## 6. Documentation

> milestone 10

Result: root, backend and frontend READMEs, plus `architecture.md`, `trade-offs.md` and `performance.md`. The performance numbers come from `EXPLAIN ANALYZE` and timed API calls on the seeded 10,000 employees, not estimates. Screenshots were taken from the running app.

## 7. Neon

> Set up this app on Neon. (Neon's setup instructions: install the CLI, `neon init`, `neon deploy`, wire the services, prove it works end to end.)

Result: the backend is linked to a Neon project. Following the Neon Postgres skill, the app keeps `pg` through Knex on the pooled `DATABASE_URL`, and migrations and the seed use the direct `DATABASE_URL_UNPOOLED`. Proven with a built server on Neon: login, reads, insights and a salary change written through the API and read back directly from Neon (and absent from the local database).
