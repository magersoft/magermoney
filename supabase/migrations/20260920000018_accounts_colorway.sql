-- The colour the owner painted an account's card in. Null is not "unset
-- pending a migration": it is the account keeping the colour of what it holds,
-- which is the colour every account had before the choice existed.
--
-- Text with a check rather than an enum: the list is append-only either way,
-- and a check is the constraint we can widen in one statement when a colour is
-- added. The names are the ones in packages/domain/src/account.ts; what each is
-- worth in light and dark belongs to the design system, never to the database.
alter table public.accounts add column colorway text
  check (colorway in ('slate', 'ocean', 'violet', 'rose', 'amber', 'lime', 'teal'));
