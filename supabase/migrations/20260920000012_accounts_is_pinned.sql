-- Which accounts the Home screen shows. Existing accounts start unpinned: the
-- strip asks to be filled rather than deciding for the user.
alter table public.accounts add column is_pinned boolean not null default false;
