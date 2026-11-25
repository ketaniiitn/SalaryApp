-- Adds the workplace profile onto organisations that already exist.
-- Safe to run more than once. It does not delete rows.
-- Do not re-run supabase/schema.sql if you already have workplaces.

alter table public.organisations add column if not exists industry text not null default '';
alter table public.organisations add column if not exists description text not null default '';
alter table public.organisations add column if not exists country text not null default '';
alter table public.organisations add column if not exists state text not null default '';
alter table public.organisations add column if not exists city text not null default '';
alter table public.organisations add column if not exists address text not null default '';
alter table public.organisations add column if not exists postal_code text not null default '';
alter table public.organisations add column if not exists contact_name text not null default '';
alter table public.organisations add column if not exists phone text not null default '';
alter table public.organisations add column if not exists email text not null default '';
