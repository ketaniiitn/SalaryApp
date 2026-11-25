-- Replaces the earlier payslips table.
-- The Express server uses the secret key, which bypasses row level security.
-- With no policies, the publishable key cannot read or write these tables.

drop table if exists public.advances;
drop table if exists public.attendance;
drop table if exists public.payslips;
drop table if exists public.employees;
drop table if exists public.organisations;

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  industry text not null default '',
  description text not null default '',
  country text not null default '',
  state text not null default '',
  city text not null default '',
  address text not null default '',
  postal_code text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  owner_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  role text not null check (char_length(role) between 1 and 80),
  working_days integer not null check (working_days between 1 and 31),
  -- Unused since pay-by-month.sql: pay comes from attendance. Kept so older scripts still run.
  days_worked integer not null default 0 check (days_worked between 0 and 31),
  -- "Days already worked" entered when the person was added; counted only in added_in_month.
  days_before_app integer not null default 0 check (days_before_app between 0 and 31),
  added_in_month text check (added_in_month is null or added_in_month ~ '^\d{4}-\d{2}$'),
  total_pay numeric(12, 2) not null check (total_pay > 0),
  salary_basis text not null check (salary_basis in ('month', 'day')),
  joined_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create table public.advances (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  given_on date not null,
  created_at timestamptz not null default now()
);

alter table public.organisations enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.advances enable row level security;
