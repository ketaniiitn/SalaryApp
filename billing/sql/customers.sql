-- Customers, and the buyer details stored on each invoice.
-- Safe to run more than once. It does not delete bills.
-- Run this if billing/sql/schema.sql was applied before customers existed.

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.billing_businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('registered', 'unregistered')),
  gstin text not null default '',
  address text not null default '',
  state text not null default '',
  created_at timestamptz not null default now()
);

alter table public.billing_invoices add column if not exists customer_id uuid references public.billing_customers (id) on delete set null;
alter table public.billing_invoices add column if not exists customer_kind text not null default 'unregistered';
alter table public.billing_invoices add column if not exists customer_address text not null default '';

create index if not exists billing_customers_business_idx on public.billing_customers (business_id, name);

alter table public.billing_customers enable row level security;
