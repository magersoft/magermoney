-- The 'inflow' value of balance_entry_origin was reserved in phase 2.
alter table public.balance_entries
  add column inflow_id uuid references public.inflows(id) on delete cascade,
  add constraint balance_entries_inflow_origin check ((origin = 'inflow') = (inflow_id is not null));

create unique index balance_entries_inflow_idx on public.balance_entries (inflow_id) where inflow_id is not null;
