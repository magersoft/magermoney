-- When a rate row was last written, as opposed to the day it is a rate for.
-- `date` is a calendar day, so it cannot answer "did we already ask the
-- provider in the last few minutes?" — which is what the user-facing refresh
-- endpoint throttles on.
alter table public.rates add column refreshed_at timestamptz not null default now();

create index rates_api_refreshed_idx on public.rates (refreshed_at desc) where source = 'api';
