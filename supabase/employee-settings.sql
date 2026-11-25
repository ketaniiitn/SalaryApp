-- Adds pay settings to an employees table that already exists.
-- Safe to run once. It does not drop organisations or employees.

alter table public.employees add column if not exists working_days integer;
alter table public.employees add column if not exists days_worked integer;
alter table public.employees add column if not exists total_pay numeric(12, 2);
alter table public.employees add column if not exists salary_basis text;
alter table public.employees add column if not exists joined_on date;

update public.employees
set working_days = 26
where working_days is null;

update public.employees
set days_worked = 0
where days_worked is null;

update public.employees
set total_pay = 1
where total_pay is null;

update public.employees
set salary_basis = 'month'
where salary_basis is null or salary_basis not in ('month', 'day');

update public.employees
set joined_on = (created_at at time zone 'utc')::date
where joined_on is null;

alter table public.employees alter column working_days set not null;
alter table public.employees alter column days_worked set not null;
alter table public.employees alter column total_pay set not null;
alter table public.employees alter column salary_basis set not null;
alter table public.employees alter column joined_on set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_working_days_check') then
    alter table public.employees
      add constraint employees_working_days_check check (working_days between 1 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_total_pay_check') then
    alter table public.employees
      add constraint employees_total_pay_check check (total_pay > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_days_worked_check') then
    alter table public.employees
      add constraint employees_days_worked_check check (days_worked between 0 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_salary_basis_check') then
    alter table public.employees
      add constraint employees_salary_basis_check check (salary_basis in ('month', 'day'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_days_worked_within_month') then
    alter table public.employees
      add constraint employees_days_worked_within_month check (days_worked <= working_days);
  end if;
end $$;
