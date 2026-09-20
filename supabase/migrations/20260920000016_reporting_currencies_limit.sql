-- The currencies the display switch offers: at least one, at most three.
--
-- Three is where the control stops fitting. On a 375px phone the switch shares
-- the top bar with the wordmark and the theme button, and a fourth segment
-- pushes one of them off; it is also the point past which "tap the one you
-- want" turns into reading a list. Now that a person can connect two hundred
-- currencies (TASK-025), the limit has to be a rule rather than a habit.

-- Existing profiles first: three is a tightening, and a row that already holds
-- more would make the constraint unaddable. The default currency is kept
-- whatever happens — it is what every form starts from.
update public.profiles set reporting_currencies = (
  select array_agg(code order by ord)
  from (
    select code, row_number() over () as ord
    from unnest(reporting_currencies) as code
    order by (code = default_currency) desc
    limit 3
  ) kept
)
where array_length(reporting_currencies, 1) > 3;

alter table public.profiles
  add constraint profiles_reporting_currencies_size
    check (array_length(reporting_currencies, 1) between 1 and 3),
  -- The API has always refused a default outside the list; this is the same
  -- rule where it cannot be bypassed.
  add constraint profiles_default_currency_is_reported
    check (default_currency = any(reporting_currencies));

comment on column public.profiles.reporting_currencies is
  'The currencies the display switch offers, in the order it shows them. One to three, and the default is always one of them.';
