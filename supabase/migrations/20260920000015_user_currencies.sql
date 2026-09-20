-- Which currencies a person has connected.
--
-- The catalogue (ADR 0006) holds every currency there is, which is two hundred
-- more than anybody uses. This table is the short list: what shows up in the
-- account form, on the rates screen, and — as the union across everybody — what
-- the rates job is allowed to spend a provider's free tier on.

create table public.user_currencies (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null references public.currencies(code),
  connected_at timestamptz not null default now(),
  primary key (user_id, code)
);

-- The rates job asks "who has connected anything I can quote", which reads the
-- codes without the owner.
create index user_currencies_code_idx on public.user_currencies (code);

alter table public.user_currencies enable row level security;
create policy "user_currencies: owner select" on public.user_currencies
  for select to authenticated using (user_id = auth.uid());
create policy "user_currencies: owner insert" on public.user_currencies
  for insert to authenticated with check (user_id = auth.uid());
create policy "user_currencies: owner delete" on public.user_currencies
  for delete to authenticated using (user_id = auth.uid());

-- Everything an existing person already uses, so nothing they own becomes
-- unreachable the moment the app starts filtering by this table. The profile's
-- own two settings count as use: the reporting currencies are the switch in the
-- header, and the default is what every new form starts from.
insert into public.user_currencies (user_id, code)
select p.id, c.code
from public.profiles p
cross join lateral (
  select p.default_currency as code
  union select unnest(p.reporting_currencies)
  union select a.currency from public.accounts a where a.user_id = p.id
  union select b.currency from public.budgets b where b.user_id = p.id
  union select e.currency from public.expenses e where e.user_id = p.id
  union select i.currency from public.income_sources i where i.user_id = p.id
  union select f.currency from public.inflows f where f.user_id = p.id
  -- The base set, so a brand-new account is not left with one currency and no
  -- way to compare anything against it.
  union select unnest(array['USD', 'EUR', 'RUB'])
) c
where c.code is not null
on conflict do nothing;

-- A new account arrives with the same base set its profile defaults to, so the
-- first screen it ever shows is not empty.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_profile public.profiles;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null))
  returning * into new_profile;

  insert into public.user_currencies (user_id, code)
  select new_profile.id, code
  from (
    select new_profile.default_currency as code
    union select unnest(new_profile.reporting_currencies)
  ) c
  on conflict do nothing;

  return new;
end $$;
