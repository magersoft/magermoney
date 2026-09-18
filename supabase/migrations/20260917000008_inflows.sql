create table public.inflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  income_source_id uuid not null references public.income_sources(id) on delete restrict,
  amount numeric not null check (amount > 0),
  currency text not null references public.currencies(code),
  received_on date not null,
  realised_rate_to_usd numeric check (realised_rate_to_usd > 0),
  -- Set together: the account the money landed on and how much arrived in that account's currency.
  account_id uuid references public.accounts(id) on delete restrict,
  credited_amount numeric check (credited_amount is null or credited_amount > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inflows_credit_pair check ((account_id is null) = (credited_amount is null))
);

create index inflows_user_idx on public.inflows (user_id, received_on desc, id desc);
create index inflows_source_idx on public.inflows (income_source_id);
create index inflows_account_idx on public.inflows (account_id) where account_id is not null;
create trigger inflows_updated_at before update on public.inflows for each row execute procedure public.set_updated_at();

alter table public.inflows enable row level security;
create policy "inflows: owner select" on public.inflows for select to authenticated using (user_id = auth.uid());
create policy "inflows: owner insert" on public.inflows for insert to authenticated with check (user_id = auth.uid());
create policy "inflows: owner update" on public.inflows for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "inflows: owner delete" on public.inflows for delete to authenticated using (user_id = auth.uid());
