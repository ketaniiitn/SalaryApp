-- Daily attendance. A row means that employee was present on that date.
-- Safe to run once. It does not drop organisations or employees.

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

alter table public.attendance enable row level security;
