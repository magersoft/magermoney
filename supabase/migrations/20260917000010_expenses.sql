create type public.expense_period as enum ('monthly', 'yearly');

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index expense_categories_name_idx on public.expense_categories (user_id, lower(name));
create trigger expense_categories_updated_at before update on public.expense_categories for each row execute procedure public.set_updated_at();

alter table public.expense_categories enable row level security;
create policy "expense_categories: owner select" on public.expense_categories for select to authenticated using (user_id = auth.uid());
create policy "expense_categories: owner insert" on public.expense_categories for insert to authenticated with check (user_id = auth.uid());
create policy "expense_categories: owner update" on public.expense_categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expense_categories: owner delete" on public.expense_categories for delete to authenticated using (user_id = auth.uid());

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  name text not null check (length(name) between 1 and 120),
  amount numeric not null check (amount >= 0),
  currency text not null references public.currencies(code),
  period public.expense_period not null,
  billing_day int check (billing_day between 1 and 31),
  billing_month int check (billing_month between 1 and 12),
  is_essential boolean not null default false,
  active_from date not null,
  active_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_billing_month_yearly check (billing_month is null or period = 'yearly'),
  constraint expenses_period check (active_to is null or active_to >= active_from)
);

create index expenses_user_idx on public.expenses (user_id, category_id);
create trigger expenses_updated_at before update on public.expenses for each row execute procedure public.set_updated_at();

alter table public.expenses enable row level security;
create policy "expenses: owner select" on public.expenses for select to authenticated using (user_id = auth.uid());
create policy "expenses: owner insert" on public.expenses for insert to authenticated with check (user_id = auth.uid());
create policy "expenses: owner update" on public.expenses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses: owner delete" on public.expenses for delete to authenticated using (user_id = auth.uid());
