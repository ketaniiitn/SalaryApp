-- Adds the admin who owns each organisation.
-- Safe to run when organisations already exist. It does not delete rows.
-- Existing organisations stay unowned until owner_id is set.

alter table public.organisations
  add column if not exists owner_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organisations_owner_id_fkey'
  ) then
    alter table public.organisations
      add constraint organisations_owner_id_fkey
      foreign key (owner_id) references auth.users (id) on delete cascade;
  end if;
end $$;

create index if not exists organisations_owner_id_idx on public.organisations (owner_id);
