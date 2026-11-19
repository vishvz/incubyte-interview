# AI review log

Places where AI output was wrong or needed correction, how it was caught, and the fix.

| # | Milestone | What the AI produced | How it was caught | Fix |
| --- | --- | --- | --- | --- |
| 1 | Seed (M4) | A garbled date expression for later salary changes (`Math.round(...) * 0 + ...`). | Self-review while writing, before the tests ran. | Rewrote it as a simple day offset in the last third of each slot; the "dates ascending" test pins it. |
| 2 | Employee API (M2–M5) | Migrations recorded with their file extension (`20261119_init.ts`), so a built deploy (`.js`) would re-run them and fail with "relation already exists". No production migrate script. | Code-review subagent. | Custom knex `migrationSource` that records names without extension; `migrate:prod` and `seed:prod` scripts; renamed existing rows. |
| 3 | Employee API (M5) | "Not in the future" compared against the UTC date, so an HR manager in India could not enter today's date before 05:30 local time. | Code-review subagent. | Allow up to tomorrow (UTC); future-dated changes noted as a limitation. Test pins today, tomorrow and the day after. |
| 4 | Employee API (M5) | List count did not use the same joins as the rows, so employees without a salary or FX rate would create phantom pages. Name index unused (sort was not on `lower(...)`). | Code-review subagent. | Shared joins in the filtered query; sort on `lower(last_name), lower(first_name)`. |
| 5 | Employee API (M5) | Emails were case-sensitive (two employees `Ada@` and `ada@`). PATCH could change country, leaving the salary in the old currency against a new country's pay band. | Code-review subagent. | Lower-case emails in Zod; country is not editable. Tests for both. |
| 6 | Config (M5) | `AUTH_PASSWORD` accepted one character. | Code-review subagent. | Minimum 12 characters; throttling is a noted follow-up. |
| 7 | Insights (M7) | A test expected `within: 5` for the band-check counts; the fixture actually has 4 employees within their band. | The test failed against correct SQL; recounted the fixture by hand. | Fixed the expectation and wrote the per-employee breakdown in a comment. |
| 8 | Insights (M7) | Insight filters accepted any text, so `country=us` returned empty results that read as "nobody outside band". | Code-review subagent. | Reuse the country and level enums; bad values return 400. |
| 9 | Insights (M7) | Tests never mixed currencies inside a department, so the key "convert each salary before the percentile" rule was untested; band-check ordering untested. | Code-review subagent. | Added a mixed-currency department median test, a department-in-EUR test and an ordering test. |
| 10 | Salaries / insights (M6–M7) | Salary changes accepted for terminated employees; parallel queries on one transaction (pg deprecation warning); payroll total did not equal the sum of the rounded rows. | Code-review subagent. | 409 for terminated employees; sequential queries; total = sum of rounded rows. |
