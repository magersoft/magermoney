# Magermoney — Phase 1: Foundation

Date: 2026-09-11. Status: approved in interview, awaiting spec review.

Magermoney is a multi-currency personal finance tracker replacing a Google Sheet the owner has kept since 2015. This spec covers the system architecture and the first delivery phase: a deployed, authenticated, multi-user PWA skeleton with a domain core, currency rates, and the CI/CD that every later phase rides on. Vocabulary is in `CONTEXT.md`; irreversible choices are in `docs/adr/`; the interview trail is in `docs/discovery/`.

## 1. Goals and non-goals

Phase 1 delivers:

- a monorepo with enforced layer boundaries and one command to test everything;
- `packages/domain` with `Currency`, `Money`, `Rate`, `RateTable`, `Clock`, fully unit-tested;
- Supabase project pair (staging, prod) with `profiles`, `currencies`, `rates` and RLS;
- a Hono API on Vercel Functions with Supabase JWT auth, OpenAPI, and a rates cron;
- a Vue 3 PWA with sign-in (Google, magic link), profile settings, and a Display currency switch proven end to end;
- CI on every PR, preview deploys, migrations applied on merge, production behind a manual approval;
- agent-facing repo docs: `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `docs/db/schema.dbml`.

Not in phase 1: any financial entity (Account, Goal, Expense, …), spreadsheet import, onboarding wizard, passkey lock, full EN copy, Storybook. Those belong to phases 2–6 (see `docs/discovery/decisions-log.md`, item 26).

## 2. Repository layout

```
magermoney/
  apps/web            Vue 3 + Vite PWA
  apps/api            Hono on Vercel Functions (Node 24)
  packages/domain     pure model, no dependencies
  packages/contracts  zod DTOs and route schemas → OpenAPI and client types
  packages/ui         the project's design system (shadcn-vue, Tailwind v4, motion-v)
  packages/config     shared eslint, tsconfig, tailwind preset
  supabase/migrations hand-written SQL
  supabase/seed       fake data for staging only
  docs/adr docs/discovery docs/db docs/superpowers
  AGENTS.md CLAUDE.md CONTEXT.md .mcp.json turbo.json .nvmrc
```

Dependency rules, enforced by eslint boundaries and package `exports`:

- `domain` depends on nothing in the repo.
- `contracts` depends on `domain` (currency codes, Money serialisation).
- `api` and `web` depend on `domain` and `contracts`.
- `ui` depends on Vue and Tailwind only; it never imports `domain`.

Toolchain: bun (package manager and script runner), Node 24 (`.nvmrc`, `engines`), Turborepo tasks `build dev lint typecheck test`. Conventional commits via the `/git-commit` skill, Husky + lint-staged via `setup-pre-commit`.

## 3. Domain core (`packages/domain`)

- **Currency** — `{ code, kind: 'fiat' | 'crypto', scale, symbol? }`. A registry object, not an enum; unknown code → `UnknownCurrencyError`. Symbol and display name are presentation concerns: the domain only carries an optional override, formatting lives in `apps/web` via Intl.
- **Money** — value object over `decimal.js`, `{ amount, currency }`. `add`, `subtract`, `multiply(n)`, `compare`, `round()` (to the currency scale), `isZero`, `toString()` / `Money.parse()`. Mixed currencies → `CurrencyMismatchError`. Immutable.
- **Rate** — `{ base, quote: 'USD', value, date, source: 'api' | 'manual' }`.
- **RateTable** — rates for one date; `convert(money, to)` goes through USD; a missing leg → `RateMissingError`. Never returns 0 or NaN.
- **Clock** — `{ now(): Date }` interface with a `SystemClock` and a `FixedClock` for tests.

Errors are typed classes; use-case boundaries return `Result<T, E>` (neverthrow). Tests: Vitest with TDD, 100 % coverage, fast-check properties for Money and conversion.

## 4. Database (phase 1 tables)

Conventions for every future table: `uuid` PK via `gen_random_uuid()`, `user_id uuid not null references profiles(id)` with an index, `created_at`/`updated_at timestamptz`, money and rates as unconstrained `numeric`, no soft delete (active periods where the domain needs them), RLS on every user table.

- **profiles** — `id` (= `auth.users.id`), `display_name`, `locale ('ru'|'en')`, `default_currency`, `reporting_currencies text[]`, `onboarding_completed_at`, timestamps. Trigger on `auth.users` insert creates the row. RLS: owner only.
- **currencies** — `code` PK, `kind`, `scale`, and nullable overrides `symbol`, `name_ru`, `name_en`, `icon`. Null means the web app derives symbol and name from `Intl.NumberFormat` / `Intl.DisplayNames` by code; overrides exist only for crypto (BTC, ETH, USDT and the like), which Intl does not know. `icon` is an Iconify id used only when auto-selection misses. Seeded by migration with the owner's 18 currencies. Readable by all authenticated users; written by the service role only.
- **rates** — `id`, `base`, `quote` (always `USD`), `value numeric`, `date`, `source ('api'|'manual')`, `user_id null` (null = shared, set = a user's manual override), timestamps. Unique `(base, quote, date, source, coalesce(user_id, ''))`. RLS: shared rows readable by all; manual rows owner only.

Access from the API through `postgres.js` with hand-written SQL; no ORM. The full schema for all phases is documented in `docs/db/schema.dbml` for review and kept current as phases land.

## 5. API (`apps/api`)

Module per bounded context, four layers (`domain` optional, `application`, `infrastructure`, `http`), plus `shared/` (auth middleware verifying the Supabase JWT and placing `userId` in context; `postgres.js` pool and transaction helper; domain-error → HTTP mapping; OpenAPI assembly with Swagger UI outside production) and `jobs/` (cron handlers).

Rules: every use case takes `userId` and filters by it; routes only parse, call, map. Cron routes require `CRON_SECRET`. Rate providers sit behind a `RateProvider` interface (fiat daily, crypto hourly). Logs via pino, never containing amounts or personal data.

Phase 1 endpoints: `GET/PATCH /me`, `GET /currencies`, `GET /rates?date=`, `PUT /rates/manual`, `POST /jobs/rates`, `GET /health`.

## 6. Web (`apps/web`)

Structure follows the `vue-ddd-architecture` skill: `app/` (bootstrap, router, i18n, TanStack Query, PWA, auth guard), `modules/{auth, profile, rates}` each with `domain / application / infrastructure / ui` and a single public `index.ts`, `shared/` (layout shell, Money formatting per locale), `locales/{ru,en}.json`.

Infrastructure layer wraps a `hono/client` typed by `contracts` inside TanStack Query with IndexedDB persistence; UI and application layers never see the query library. Pinia holds UI state only.

Phase 1 screens: sign-in, a placeholder home with a greeting and the Display currency switch converting a sample amount, profile settings (display name, locale, reporting currencies, default currency). PWA via `vite-plugin-pwa` (precache shell, network-first API). System theme with manual toggle. `packages/ui` starts with Button, Input, Select, Card, Sheet, Toast, Skeleton installed through the shadcn-vue MCP, theme tokens, one motion preset, and a `CurrencyIcon` component: `circle-flags` for fiat (by the currency's country), `cryptocurrency-color` by ticker for crypto, initials in a circle as fallback, all via `unplugin-icons` so icons are inlined and work offline.

## 7. Environments and CI/CD

- **local** — Supabase CLI (Docker Postgres), `turbo dev`; env from `vercel env pull`.
- **staging** — Vercel preview per PR + Supabase staging.
- **production** — `main` → Vercel production + Supabase prod.

Workflows: `ci.yml` (bun cache, `turbo lint typecheck test build`, Playwright smoke against the preview URL); `db.yml` (PR: `supabase db diff` + lint against staging; merge: `db push` to staging, then to prod behind the `production` GitHub Environment approval). Two Vercel projects from one repo with `turbo-ignore`; cron declared in the api's `vercel.ts`. `main` protected: PR + green CI + linear history.

## 8. Agent guidance in the repo

- `AGENTS.md` — layer rules, commands, where vocabulary (`CONTEXT.md`) and decisions (`docs/adr/`) live, and a **Skills** section: `/vue-ddd-architecture` for web structure; `/frontend-design` before any new UI surface; `/impeccable` for UI audit and polish; `/animate` for any motion; `/humanize-text:humanize-text` for all user-facing copy and i18n strings; `/design-taste-frontend` only for auth pages and a future landing, never product screens; `/git-commit` for every commit. Skills run before the first line of markup, not after.
- `CLAUDE.md` — one line: `@AGENTS.md`.
- `.mcp.json` — shadcn-vue MCP; design-system components enter `packages/ui` only through it.

## 9. Testing

Domain: Vitest, TDD, 100 %, fast-check. API: use cases with in-memory repositories, routes via `app.request()`, repository integration tests against local Supabase in a separate CI job. Web: Vitest + Vue Test Utils for composables and module components. E2E: one Playwright smoke (sign in via magic link using Supabase's test inbox, see home, switch currency, see conversion).

## 10. Definition of done

1. `bun install && turbo test` green locally and in CI.
2. A PR produces web and api previews; smoke passes.
3. Merge to `main` deploys production; migrations applied; `GET /health` 200.
4. Google and magic-link sign-in work on the production domain; the owner's user exists.
5. The rates cron has run; `rates` holds today's rows for all 18 currencies.
6. The Display currency switch converts the sample amount on home.
7. `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `CONTEXT.md`, ADRs 0001–0005, `docs/db/schema.dbml` are in the repo.

## 11. Risks

- Fiat provider coverage for UZS, KGS, GEL, EGP must be verified before wiring; fallback provider chosen at that task.
- Vercel Hobby forbids commercial use; the project is personal. Revisit if it ever charges users.
- shadcn-vue chart components (Unovis) arrive in phase 2 with the first dashboard; not needed here.
