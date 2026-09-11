# Supabase (local dev)

Local Postgres + Auth for Magermoney, managed with the Supabase CLI. No ORM — migrations are hand-written SQL.

## Commands

```bash
supabase start   # boot local stack (Docker required)
supabase db reset  # drop, recreate, apply migrations/*.sql, then seed.sql
supabase stop     # tear down containers
supabase status   # print API URL, anon key, service_role key, DB URL
```

## Layout

- `migrations/` — ordered SQL migrations, applied in filename order:
  - `20260911000001_profiles.sql` — `locale` enum, `profiles` table, RLS, `handle_new_user` trigger (creates a profile row on signup), `updated_at` trigger.
  - `20260911000002_currencies.sql` — `currency_kind` enum, `currencies` table (read-only reference data, RLS for authenticated read), seeds the 19 supported currencies, adds the `profiles.default_currency` FK.
  - `20260911000003_rates.sql` — `rate_source` enum, `rates` table (`api` rows are shared, `manual` rows are owned per-user), unique index, RLS.
- `seed.sql` — fake exchange rates for local/staging only. Never real data.
- `test/rls.test.ts` — RLS integration test (Vitest + `@supabase/supabase-js`), run from `apps/api` as part of `test:integration` (wired up in a later task).

## RLS summary

- `profiles`: owner can read/update their own row only.
- `currencies`: any authenticated user can read; no writes exposed.
- `rates`: authenticated users can read shared `api` rows and their own `manual` rows; they can insert/delete only their own `manual` rows.
