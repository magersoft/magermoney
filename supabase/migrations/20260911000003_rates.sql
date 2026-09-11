create type public.rate_source as enum ('api', 'manual');

create table public.rates (
  id uuid primary key default gen_random_uuid(),
  base text not null references public.currencies(code),
  quote text not null default 'USD' check (quote = 'USD'),
  value numeric not null check (value > 0),
  date date not null,
  source public.rate_source not null,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint rates_manual_needs_user check ((source = 'manual') = (user_id is not null))
);

create unique index rates_unique_idx on public.rates (base, quote, date, source, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index rates_date_idx on public.rates (date desc);
create index rates_user_idx on public.rates (user_id) where user_id is not null;

alter table public.rates enable row level security;
create policy "rates: shared read" on public.rates for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "rates: owner insert manual" on public.rates for insert to authenticated with check (user_id = auth.uid() and source = 'manual');
create policy "rates: owner delete manual" on public.rates for delete to authenticated using (user_id = auth.uid() and source = 'manual');
