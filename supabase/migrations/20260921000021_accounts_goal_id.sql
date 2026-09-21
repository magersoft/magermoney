-- An Account funds at most one Goal, which is what a single-valued column says;
-- no constraint is needed to enforce it. Deleting a Goal releases its Accounts
-- rather than taking them with it — the money did not go anywhere.
alter table public.accounts
  add column goal_id uuid references public.goals(id) on delete set null;

create index accounts_goal_idx on public.accounts (goal_id) where goal_id is not null;
