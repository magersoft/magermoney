create type public.balance_entry_origin as enum ('manual', 'transfer', 'inflow');

create table public.balance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric not null,
  recorded_at timestamptz not null,
  origin public.balance_entry_origin not null,
  transfer_id uuid references public.transfers(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  constraint balance_entries_transfer_origin check ((origin = 'transfer') = (transfer_id is not null))
);

-- "Latest entry" is (recorded_at desc, created_at desc): created_at breaks ties
-- between two entries declared for the same instant.
create index balance_entries_latest_idx on public.balance_entries (account_id, recorded_at desc, created_at desc);
create index balance_entries_transfer_idx on public.balance_entries (transfer_id) where transfer_id is not null;

alter table public.balance_entries enable row level security;
create policy "balance_entries: owner select" on public.balance_entries for select to authenticated using (user_id = auth.uid());
create policy "balance_entries: owner insert" on public.balance_entries for insert to authenticated with check (user_id = auth.uid());
create policy "balance_entries: owner update" on public.balance_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "balance_entries: owner delete" on public.balance_entries for delete to authenticated using (user_id = auth.uid());
