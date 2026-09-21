-- Something owned that is worth money but is not money. Its worth is an opinion
-- with a date, so it is a journal and the current value is its last row — the
-- same rule balances follow (ADR 0002). A valuation outside its asset means
-- nothing, so it goes with it.
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  currency text not null references public.currencies(code),
  counts_in_total bool not null default false,
  acquired_on date,
  purchase_price numeric check (purchase_price > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.asset_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  value numeric not null check (value > 0),
  valued_on date not null,
  created_at timestamptz not null default now(),
  unique (asset_id, valued_on)
);

create index assets_user_idx on public.assets (user_id, archived_at);
create index asset_valuations_latest_idx on public.asset_valuations (asset_id, valued_on desc);
create trigger assets_updated_at before update on public.assets for each row execute procedure public.set_updated_at();

alter table public.assets enable row level security;
alter table public.asset_valuations enable row level security;

create policy "assets: owner select" on public.assets for select to authenticated using (user_id = auth.uid());
create policy "assets: owner insert" on public.assets for insert to authenticated with check (user_id = auth.uid());
create policy "assets: owner update" on public.assets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "assets: owner delete" on public.assets for delete to authenticated using (user_id = auth.uid());

create policy "asset_valuations: owner select" on public.asset_valuations for select to authenticated using (user_id = auth.uid());
create policy "asset_valuations: owner insert" on public.asset_valuations for insert to authenticated with check (user_id = auth.uid());
create policy "asset_valuations: owner update" on public.asset_valuations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "asset_valuations: owner delete" on public.asset_valuations for delete to authenticated using (user_id = auth.uid());
