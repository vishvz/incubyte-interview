# Frontend

React 19 app built with Vite and TypeScript. It uses Mantine for components, Tabler for icons, TanStack Query for server state and Recharts for the salary history chart.

## Setup

```bash
cp .env.example .env      # VITE_API_URL=http://localhost:4000
npm install
npm run dev               # http://localhost:5173
```

The backend must be running and seeded (see `../backend/README.md`).

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Type check and production build |

## Pages

| Page | Path | Question it answers |
| --- | --- | --- |
| Overview | `/overview` | Headcount, payroll, people outside band, latest changes at a glance |
| Employees | `/employees` | Find anyone: search, filters, sort and paging, all kept in the URL |
| Profile | `/employees/:id` | Current pay, where it sits in the band, full history, record a change |
| Add or edit | `/employees/new`, `/employees/:id/edit` | Create an employee with a starting salary, or edit details |
| Pay ranges | `/pay-ranges` | Median and spread by level in a country, or by department |
| Outside band | `/outside-band` | Who is paid below or above band, biggest gap first |
| Payroll | `/payroll` | Annual payroll per department in one currency |
| Recent changes | `/changes` | Latest salary changes with reason and percent change |

## Structure

```
src/
  api/client.ts       fetch wrapper: base URL, bearer token, errors with field issues, 401 handling
  api/types.ts        Response types (written here, not shared with the backend)
  currency.tsx        Display-currency context: convert and format amounts
  lib/money.ts        parseMajorToMinor, formatMinor, convertMinor (tested)
  lib/format.ts       Dates, reason labels, small helpers
  components/
    RangeBar.tsx      The pay band range bar
    ui.tsx            Page header, stat tile, person cell, reason badge, change delta, empty state
  pages/              One file per page
```

## Design

The app is built for an HR manager who lives in spreadsheets: dense tables, tabular figures, plain labels. The one memorable element is the **pay band range bar**: the band (light green), the middle half of salaries (green bar), the median (dark tick) and the employee (dot). It appears on the profile, pay ranges and outside band pages, so pay is always read against the band.

- Chart colours were checked with a palette validator for colour-blind separation and contrast. Below and above band are never shown by colour alone; text always says which.
- Lighthouse accessibility scores 100 on the profile, overview and outside band pages. Clickable rows also contain real links, sort headers expose `aria-sort`, and range bars have text labels.
- Amounts typed by the user are parsed as strings into integer cents, so `85,000.50` becomes exactly `8500050`.
