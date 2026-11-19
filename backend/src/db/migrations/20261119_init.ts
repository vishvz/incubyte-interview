import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    create table employees (
      id            serial primary key,
      employee_code text not null unique,
      first_name    text not null,
      last_name     text not null,
      email         text not null unique,
      job_title     text not null,
      department    text not null,
      level         text not null,
      country       char(2) not null,
      status        text not null default 'active' check (status in ('active', 'terminated')),
      hire_date     date not null,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now()
    );

    -- One row per pay change. Rows are never updated or deleted (append-only history).
    create table salaries (
      id             serial primary key,
      employee_id    integer not null references employees(id) on delete cascade,
      amount_minor   bigint not null check (amount_minor > 0),
      currency       char(3) not null,
      effective_date date not null,
      reason         text not null check (reason in ('hire', 'promotion', 'annual_review', 'adjustment')),
      note           text,
      created_at     timestamptz not null default now()
    );

    create table fx_rates (
      currency    char(3) primary key,
      rate_to_usd numeric(18, 8) not null check (rate_to_usd > 0),
      as_of       date not null
    );

    create table pay_bands (
      level     text not null,
      country   char(2) not null,
      currency  char(3) not null,
      min_minor bigint not null,
      mid_minor bigint not null,
      max_minor bigint not null,
      primary key (level, country),
      check (0 < min_minor and min_minor <= mid_minor and mid_minor <= max_minor)
    );

    -- Latest salary per employee; ties on date go to the row recorded last.
    create view current_salaries as
      select distinct on (employee_id) *
      from salaries
      order by employee_id, effective_date desc, id desc;

    create index employees_country_level_idx on employees (country, level);
    create index employees_department_idx on employees (department);
    create index employees_name_idx on employees (lower(last_name), lower(first_name));
    create index salaries_employee_date_idx on salaries (employee_id, effective_date desc, id desc);
    create index salaries_effective_date_idx on salaries (effective_date desc, id desc);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    drop view if exists current_salaries;
    drop table if exists pay_bands, fx_rates, salaries, employees;
  `);
}
