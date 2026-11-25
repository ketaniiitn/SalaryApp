-- Invoice templates, bank details, customer phones, payment tracking,
-- and invoice numbers given out inside one database transaction.
-- Safe to run more than once. It adds columns and never deletes or rewrites bill amounts.
-- Run after billing/sql/schema.sql and billing/sql/customers.sql.

-- The business: branding, contact, bank, and how its invoices look.
alter table public.billing_businesses add column if not exists email text not null default '';
alter table public.billing_businesses add column if not exists logo text not null default '';
alter table public.billing_businesses add column if not exists bank_name text not null default '';
alter table public.billing_businesses add column if not exists bank_account text not null default '';
alter table public.billing_businesses add column if not exists bank_ifsc text not null default '';
alter table public.billing_businesses add column if not exists upi_id text not null default '';
alter table public.billing_businesses add column if not exists terms text not null default '';
alter table public.billing_businesses add column if not exists footer text not null default '';
alter table public.billing_businesses add column if not exists layout text not null default 'standard';
alter table public.billing_businesses add column if not exists show_hsn boolean not null default true;
alter table public.billing_businesses add column if not exists round_off boolean not null default true;

alter table public.billing_businesses drop constraint if exists billing_businesses_layout_check;
alter table public.billing_businesses add constraint billing_businesses_layout_check check (layout in ('standard', 'compact'));

-- Saved items can carry a description.
alter table public.billing_items add column if not exists description text not null default '';

-- Customers: phone, and business or individual.
alter table public.billing_customers add column if not exists phone text not null default '';
alter table public.billing_customers add column if not exists entity text not null default 'business';
alter table public.billing_customers drop constraint if exists billing_customers_entity_check;
alter table public.billing_customers add constraint billing_customers_entity_check check (entity in ('business', 'individual'));
create index if not exists billing_customers_phone_idx on public.billing_customers (business_id, phone);
create index if not exists billing_customers_gstin_idx on public.billing_customers (business_id, gstin);

-- Invoices: extra details, round off, the seller as printed, and payments.
alter table public.billing_invoices add column if not exists customer_phone text not null default '';
alter table public.billing_invoices add column if not exists due_on date;
alter table public.billing_invoices add column if not exists payment_terms text not null default '';
alter table public.billing_invoices add column if not exists po_number text not null default '';
alter table public.billing_invoices add column if not exists place_of_supply text not null default '';
alter table public.billing_invoices add column if not exists notes text not null default '';
alter table public.billing_invoices add column if not exists terms text not null default '';
alter table public.billing_invoices add column if not exists round_off numeric(12, 2) not null default 0;
alter table public.billing_invoices add column if not exists payable numeric(12, 2);
alter table public.billing_invoices add column if not exists seller jsonb;
alter table public.billing_invoices add column if not exists client_ref uuid;

-- Bills saved before this script were marked paid by their payment method. Keep that meaning once.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_invoices' and column_name = 'amount_paid'
  ) then
    alter table public.billing_invoices add column amount_paid numeric(12, 2) not null default 0;
    update public.billing_invoices set amount_paid = total where payment <> 'unpaid';
  end if;
end $$;

alter table public.billing_invoices drop constraint if exists billing_invoices_payment_check;
alter table public.billing_invoices add constraint billing_invoices_payment_check check (payment in ('cash', 'upi', 'card', 'bank', 'unpaid'));

create unique index if not exists billing_invoices_client_ref_idx on public.billing_invoices (business_id, client_ref) where client_ref is not null;

-- Gives out the next invoice number and saves the invoice in one transaction.
-- The business row is locked, so two phones saving at once get different numbers,
-- and a failed insert gives the number back.
create or replace function public.billing_create_invoice(p_owner_id uuid, p_business_id uuid, p_invoice jsonb)
returns public.billing_invoices
language plpgsql
set search_path = public
as $$
declare
  v_business public.billing_businesses;
  v_sequence integer;
  v_number text;
  v_row public.billing_invoices;
  v_ref uuid := nullif(p_invoice ->> 'client_ref', '')::uuid;
begin
  select * into v_business
  from public.billing_businesses
  where id = p_business_id and owner_id = p_owner_id
  for update;
  if not found then
    raise exception 'billing business not found' using errcode = 'P0002';
  end if;

  if v_ref is not null then
    select * into v_row from public.billing_invoices where business_id = p_business_id and client_ref = v_ref;
    if found then
      return v_row;
    end if;
  end if;

  v_sequence := v_business.next_number;
  loop
    v_number := v_business.invoice_prefix || '-' || case when length(v_sequence::text) >= 4 then v_sequence::text else lpad(v_sequence::text, 4, '0') end;
    exit when not exists (select 1 from public.billing_invoices where business_id = p_business_id and number = v_number);
    v_sequence := v_sequence + 1;
  end loop;

  insert into public.billing_invoices (
    id, business_id, number, issued_on, due_on,
    customer_id, customer_name, customer_kind, customer_gstin, customer_state, customer_address, customer_phone,
    place_of_supply, payment_terms, po_number, notes, terms,
    interstate, payment, amount_paid, status, lines,
    taxable_value, cgst, sgst, igst, tax, total, round_off, payable,
    seller, client_ref
  ) values (
    (p_invoice ->> 'id')::uuid, p_business_id, v_number, (p_invoice ->> 'issued_on')::date, nullif(p_invoice ->> 'due_on', '')::date,
    nullif(p_invoice ->> 'customer_id', '')::uuid, p_invoice ->> 'customer_name', p_invoice ->> 'customer_kind', p_invoice ->> 'customer_gstin',
    p_invoice ->> 'customer_state', p_invoice ->> 'customer_address', p_invoice ->> 'customer_phone',
    p_invoice ->> 'place_of_supply', p_invoice ->> 'payment_terms', p_invoice ->> 'po_number', p_invoice ->> 'notes', p_invoice ->> 'terms',
    (p_invoice ->> 'interstate')::boolean, p_invoice ->> 'payment', (p_invoice ->> 'amount_paid')::numeric, 'issued', p_invoice -> 'lines',
    (p_invoice ->> 'taxable_value')::numeric, (p_invoice ->> 'cgst')::numeric, (p_invoice ->> 'sgst')::numeric, (p_invoice ->> 'igst')::numeric,
    (p_invoice ->> 'tax')::numeric, (p_invoice ->> 'total')::numeric, (p_invoice ->> 'round_off')::numeric, (p_invoice ->> 'payable')::numeric,
    p_invoice -> 'seller', v_ref
  )
  returning * into v_row;

  update public.billing_businesses set next_number = v_sequence + 1 where id = p_business_id;
  return v_row;
end;
$$;

revoke all on function public.billing_create_invoice(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.billing_create_invoice(uuid, uuid, jsonb) to service_role;
