create type public.account_kind as enum ('bank_account', 'card', 'deposit', 'broker', 'crypto_wallet', 'cash');
create type public.card_type as enum ('debit', 'credit');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  bank text not null check (length(bank) between 1 and 80),
  country text not null check (country ~ '^[A-Z]{2}$'),
  currency text not null references public.currencies(code),
  kind public.account_kind not null,
  card_type public.card_type,
  is_spending boolean not null default false,
  card_last4 text check (card_last4 ~ '^\d{4}$'),
  card_network text,
  card_tier text,
  card_expires date,
  note text,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_card_fields_only_on_cards check (
    kind = 'card' or (card_type is null and card_last4 is null and card_network is null and card_tier is null and card_expires is null)
  )
);

create index accounts_user_idx on public.accounts (user_id, archived_at, sort_order);
create trigger accounts_updated_at before update on public.accounts for each row execute procedure public.set_updated_at();

alter table public.accounts enable row level security;
create policy "accounts: owner select" on public.accounts for select to authenticated using (user_id = auth.uid());
create policy "accounts: owner insert" on public.accounts for insert to authenticated with check (user_id = auth.uid());
create policy "accounts: owner update" on public.accounts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "accounts: owner delete" on public.accounts for delete to authenticated using (user_id = auth.uid());
