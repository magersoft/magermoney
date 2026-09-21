-- A Goal is a target amount and the Accounts that fund it. What it holds is not
-- stored: it is the sum of those Accounts, which the client computes at today's
-- rates (ADR 0003). Only the two stamps below are state.
--
-- `achieved_at` is written once, by the server, when the funded amount first
-- reaches the target, and is never cleared by a rate moving back down — a goal
-- that blinks between reached and not reached is worse than one that is
-- generous. `archived_at` is the owner's own decision and releases the Accounts.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  icon text,
  target_amount numeric not null check (target_amount > 0),
  currency text not null references public.currencies(code),
  target_date date,
  achieved_at timestamptz,
  archived_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_idx on public.goals (user_id, archived_at, sort_order);
create trigger goals_updated_at before update on public.goals for each row execute procedure public.set_updated_at();

alter table public.goals enable row level security;
create policy "goals: owner select" on public.goals for select to authenticated using (user_id = auth.uid());
create policy "goals: owner insert" on public.goals for insert to authenticated with check (user_id = auth.uid());
create policy "goals: owner update" on public.goals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals: owner delete" on public.goals for delete to authenticated using (user_id = auth.uid());
