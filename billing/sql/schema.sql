-- Billing records for the GST invoice service.
-- Safe to run more than once. It does not delete salary data.
-- After this, run billing/sql/invoices-v2.sql for templates, payments and safe invoice numbers.

create table if not exists public.billing_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  organisation_id uuid references public.organisations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default '',
  address text not null default '',
  state text not null,
  phone text not null default '',
  gst_registered boolean not null default false,
  gstin text,
  invoice_prefix text not null default 'INV',
  next_number integer not null default 1 check (next_number > 0),
  default_price_mode text not null check (default_price_mode in ('exclusive', 'inclusive')),
  default_gst_rate numeric(5, 2) not null default 0 check (default_gst_rate >= 0 and default_gst_rate <= 100),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.billing_businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  price numeric(12, 2) not null check (price >= 0),
  hsn text not null default '',
  gst_rate numeric(5, 2) not null check (gst_rate >= 0 and gst_rate <= 100),
  price_mode text not null check (price_mode in ('exclusive', 'inclusive')),
  unit text not null default '',
  supply text not null check (supply in ('taxable', 'exempt', 'nil', 'non-gst')),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.billing_businesses (id) on delete cascade,
  number text not null,
  issued_on date not null,
  customer_name text not null default '',
  customer_gstin text not null default '',
  customer_state text not null default '',
  interstate boolean not null,
  payment text not null check (payment in ('cash', 'upi', 'card', 'unpaid')),
  status text not null check (status in ('issued', 'cancelled')),
  lines jsonb not null,
  taxable_value numeric(12, 2) not null,
  cgst numeric(12, 2) not null,
  sgst numeric(12, 2) not null,
  igst numeric(12, 2) not null,
  tax numeric(12, 2) not null,
  total numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (business_id, number)
);

alter table public.billing_businesses
  add column if not exists organisation_id uuid references public.organisations (id) on delete cascade;

create unique index if not exists billing_businesses_organisation_idx on public.billing_businesses (organisation_id);
create index if not exists billing_businesses_owner_idx on public.billing_businesses (owner_id);
create index if not exists billing_items_business_idx on public.billing_items (business_id);
create index if not exists billing_invoices_business_idx on public.billing_invoices (business_id, issued_on desc);

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

alter table public.billing_businesses enable row level security;
alter table public.billing_items enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_customers enable row level security;
