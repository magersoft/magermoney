-- The switch holds five currencies now, not three.
--
-- Three was the width of three codes side by side. The control stopped
-- spelling the codes out past two currencies — it shows each one's mark and
-- keeps the code on the selected segment only — so a segment costs a flag, and
-- five of those still sit in a 375px top bar beside the wordmark.
--
-- A loosening, so no profile needs fixing first: every row that satisfied the
-- old constraint satisfies this one.

alter table public.profiles
  drop constraint profiles_reporting_currencies_size,
  add constraint profiles_reporting_currencies_size
    check (array_length(reporting_currencies, 1) between 1 and 5);

comment on column public.profiles.reporting_currencies is
  'The currencies the display switch offers, in the order it shows them. One to five, and the default is always one of them.';
