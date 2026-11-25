-- Pay is now worked out for each month from attendance and money given.
-- Safe to run more than once. It does not drop any table or delete any rows.
--
-- Before: employees.days_worked held a running count for "this month". It was overwritten by every
-- attendance save, never reset at the start of a month, and capped at working_days even for day wages.
-- After: days_worked is no longer used (it stays, at 0, so older scripts keep working).
-- days_before_app keeps the "days already worked" entered when a person is added, and
-- added_in_month says which month those days belong to.

alter table public.employees add column if not exists days_before_app integer not null default 0;
alter table public.employees add column if not exists added_in_month text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_days_before_app_check') then
    alter table public.employees
      add constraint employees_days_before_app_check check (days_before_app between 0 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_added_in_month_check') then
    alter table public.employees
      add constraint employees_added_in_month_check check (added_in_month is null or added_in_month ~ '^\d{4}-\d{2}$');
  end if;
end $$;

-- Keep the days entered for people added this month, minus the days already marked in the app.
-- For anyone added earlier, the old number was already replaced by an attendance count, so it is 0.
update public.employees e
set
  added_in_month = to_char(e.created_at at time zone 'Asia/Kolkata', 'YYYY-MM'),
  days_before_app = case
    when to_char(e.created_at at time zone 'Asia/Kolkata', 'YYYY-MM') = to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM')
      then greatest(
        e.days_worked - (
          select count(*)::int from public.attendance a
          where a.employee_id = e.id
            and to_char(a.work_date, 'YYYY-MM') = to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM')
        ),
        0
      )
    else 0
  end
where e.added_in_month is null;

-- days_worked is no longer written. Give it a default and stop it limiting day wages.
alter table public.employees alter column days_worked set default 0;
alter table public.employees drop constraint if exists employees_days_worked_within_month;
