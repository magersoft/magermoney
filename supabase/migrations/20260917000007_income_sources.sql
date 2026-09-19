create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  -- Monthly gross. Net is derived (gross × (1 − tax) × (1 − commission)), never stored.
  gross_amount numeric not null check (gross_amount >= 0),
  currency text not null references public.currencies(code),
  tax_rate numeric not null default 0 check (tax_rate >= 0 and tax_rate < 1),
  commission_rate numeric not null default 0 check (commission_rate >= 0 and commission_rate < 1),
  -- Days of the month; empty = an irregular source that never shows in upcoming events.
  pay_days int[] not null default '{}' check (
    pay_days <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]
  ),
  is_primary boolean not null default false,
  active_from date not null,
  active_to date,
  default_account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_sources_period check (active_to is null or active_to >= active_from)
);

create index income_sources_user_idx on public.income_sources (user_id, active_from);
-- "Days to payday" counts to one source only.
create unique index income_sources_one_primary_idx on public.income_sources (user_id) where is_primary;
create trigger income_sources_updated_at before update on public.income_sources for each row execute procedure public.set_updated_at();

alter table public.income_sources enable row level security;
create policy "income_sources: owner select" on public.income_sources for select to authenticated using (user_id = auth.uid());
create policy "income_sources: owner insert" on public.income_sources for insert to authenticated with check (user_id = auth.uid());
create policy "income_sources: owner update" on public.income_sources for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "income_sources: owner delete" on public.income_sources for delete to authenticated using (user_id = auth.uid());
