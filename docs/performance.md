# Performance note

Measured on 2026-11-19 on a Windows laptop with PostgreSQL 18, using the seeded data: 10,000 employees and 23,077 salary rows. Run `ANALYZE` before measuring.

## Query plans (`EXPLAIN ANALYZE`)

| Query | Execution time | Plan notes |
| --- | --- | --- |
| Directory, first page sorted by name | 51 ms | Builds `current_salaries` for all 10,000 employees (index scan on `salaries_employee_date_idx`, ~10 ms), joins, then a top-N heapsort for 25 rows |
| Directory, search "priya", sorted by salary | 35 ms | Same base; the `ILIKE` filter keeps 252 rows before the top-N sort |
| Profile salary history | 0.02 ms | Index scan on `salaries_employee_date_idx` |
| Distribution by country and level (US) | 19 ms | Hash joins, then `GroupAggregate` with `percentile_cont` over 3,858 rows |
| Distribution by department | 38 ms | Converts and sorts 9,582 active salaries, 8 groups |
| Payroll by department | 30 ms | Same shape as the department distribution, with `sum` |
| Recent changes (20) | 0.4 ms | Index scan on `salaries_effective_date_idx`, plus a lateral index lookup for each previous salary |
| Band check (rows + count + summary) | 47 ms wall time | Three queries over the same join |

## API response times

Best of 5 requests to the running dev server (tsx), measured with curl after a warm-up. Includes auth, validation and JSON.

| Endpoint | Time |
| --- | --- |
| `GET /api/employees?pageSize=25` | 55 ms |
| `GET /api/employees?q=priya&sort=salary&order=desc` | 69 ms |
| `GET /api/employees/4635` | 4 ms |
| `GET /api/insights/distribution?by=country_level&country=US` | 16 ms |
| `GET /api/insights/distribution?by=department` | 31 ms |
| `GET /api/insights/band-check?position=below` | 45 ms |
| `GET /api/insights/payroll?currency=EUR` | 29 ms |
| `GET /api/salary-changes/recent?limit=20` | 3 ms |

Other numbers:

- Seeding 10,000 employees takes 1.1 to 1.2 s (batches of 1,000, one transaction).
- The backend test suite (77 tests, 10 files) takes about 6 s. The frontend tests take under 1 s.
- The browser never loads the full dataset: the largest response is one 25-row page.

## Reading the numbers

Everything is well under 100 ms, which feels instant for one HR user. No caching layer was added.

The one cost that grows with data is **deriving the current salary**: every directory and insight query computes the latest salary row for every employee (`DISTINCT ON` over all salary rows). It is about 10 ms here and grows linearly with salary rows. If ACME grew to around 100,000 employees, or many years of history, the upgrade path in order of effort is:

1. Add a `current_salary_id` column on `employees`, updated in the same transaction as each salary insert. List queries then join one row per employee, and the name index (`lower(last_name), lower(first_name)`) can drive the sort.
2. Add a `pg_trgm` GIN index for name and email search.
3. Cache the insight endpoints for a few minutes, invalidated when a salary is recorded.

None of these are needed at 10,000 employees, so none were built.

## How to reproduce

```bash
cd backend
npm run seed
psql "$DATABASE_URL" -c "ANALYZE"
# then EXPLAIN ANALYZE the SQL from src/db/*.ts, e.g. the department distribution:
psql "$DATABASE_URL" -c "EXPLAIN ANALYZE SELECT e.department, count(*), percentile_cont(array[0.25,0.5,0.75]) WITHIN GROUP (ORDER BY s.amount_minor * fx.rate_to_usd) FROM employees e JOIN current_salaries s ON s.employee_id = e.id JOIN fx_rates fx ON fx.currency = s.currency WHERE e.status = 'active' GROUP BY e.department"
```
