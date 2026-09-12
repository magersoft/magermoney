create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid not null references public.accounts(id) on delete restrict,
  amount_sent numeric not null check (amount_sent > 0),
  amount_received numeric not null check (amount_received > 0),
  occurred_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id)
);

create index transfers_user_idx on public.transfers (user_id, occurred_at desc, id desc);
create index transfers_from_idx on public.transfers (from_account_id);
create index transfers_to_idx on public.transfers (to_account_id);
create trigger transfers_updated_at before update on public.transfers for each row execute procedure public.set_updated_at();

alter table public.transfers enable row level security;
create policy "transfers: owner select" on public.transfers for select to authenticated using (user_id = auth.uid());
create policy "transfers: owner insert" on public.transfers for insert to authenticated with check (user_id = auth.uid());
create policy "transfers: owner update" on public.transfers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transfers: owner delete" on public.transfers for delete to authenticated using (user_id = auth.uid());
