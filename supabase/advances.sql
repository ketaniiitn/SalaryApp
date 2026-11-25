-- Money the owner gave an employee. Each row is one amount on one day.
-- Safe to run once. It does not drop organisations, employees, or attendance.

create table if not exists public.advances (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  given_on date not null,
  created_at timestamptz not null default now()
);

alter table public.advances enable row level security;
