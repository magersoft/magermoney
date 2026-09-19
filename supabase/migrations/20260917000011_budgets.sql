create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  icon text,
  monthly_limit numeric not null check (monthly_limit >= 0),
  currency text not null references public.currencies(code),
  active_from date not null,
  active_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_period check (active_to is null or active_to >= active_from)
);

create index budgets_user_idx on public.budgets (user_id, active_from);
create trigger budgets_updated_at before update on public.budgets for each row execute procedure public.set_updated_at();

alter table public.budgets enable row level security;
create policy "budgets: owner select" on public.budgets for select to authenticated using (user_id = auth.uid());
create policy "budgets: owner insert" on public.budgets for insert to authenticated with check (user_id = auth.uid());
create policy "budgets: owner update" on public.budgets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "budgets: owner delete" on public.budgets for delete to authenticated using (user_id = auth.uid());
