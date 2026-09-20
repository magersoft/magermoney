# Magermoney — guide for agents

Personal multi-currency finance tracker. Read `CONTEXT.md` (vocabulary) before naming anything, and `docs/adr/` before changing architecture.

## Layout

- `apps/web` Vue 3 PWA. Modules in `src/modules/<name>/{domain,application,infrastructure,ui}` with a public `index.ts`, plus one optional second entry `offline.ts` — query keys and the offline mutation registration only, no UI — which the composition root imports so a static import from `app/` cannot drag every screen into the entry chunk. Routed screens are exported from the barrel as async components for the same reason. Two modules own no data and only compose siblings through their barrels: `dashboard` (the home read model, `buildDashboard` is the pure core) and `plan` (the Plan screen with the income / expenses / budgets segments). A data module never imports another data module's screens; put a composed screen in one of these or add a new screen module. The top bar (`src/shared/layout/`) is navigation on the left, the screen's name in the middle and exactly one screen action on the right: a screen declares both with `usePageTitle` and `usePageAction` (label, `ariaLabel`, handler, `disabled`, `pending`) from `page-bar.ts`, the bar never invents either, and what no screen claims stays empty — a bar left holding nothing is not rendered at phone width. The title is the phone's; a wide window puts the wordmark and the tab links in the middle instead, so a screen that sets a bar title keeps its own heading as `sr-only md:not-sr-only`. A test that asserts about a title or an action must mount the screen inside `AppShell`. Follow the `/vue-ddd-architecture` skill.
- `apps/api` Hono API on Vercel Functions (entry `src/vercel-entry.ts`, bundled by esbuild into `api/index.js` at deploy time, never committed). Modules in `src/modules/<name>/{application,infrastructure,http}`; `src/shared` for auth, db, errors, openapi. JWT verified via Supabase JWKS (ES256) with HS256 secret fallback. `src/shared/db/unit-of-work.ts` + `pg-unit-of-work.ts` provide `UnitOfWork<Repos>`: every multi-table write goes through `deps.uow(async (repos) => …)` so its statements share one transaction (`pgUnitOfWork` opens `sql.begin`; `memoryUnitOfWork` just hands over the same repositories for use-case tests). A credited Inflow writes its `origin = 'inflow'` Balance entry inside the same `deps.uow` that holds the Account lock (`modules/inflows/application/credit.ts`), the same rule Transfers follow.
- `packages/domain` pure model (Money, Currency, Rate…). No framework imports. 100 % test coverage.
- `packages/contracts` zod schemas for DTOs and routes → OpenAPI + client types. The web talks to the API through `apps/web/src/shared/api/client.ts` plus those zod schemas, not `hono/client`: importing the API's app type would break the package boundary.
- `packages/ui` the design system (shadcn-vue + Tailwind v4 + motion-v). Add components only via the shadcn-vue MCP / CLI. Components it generates import `@/…`; rewrite those to relative paths, or every consumer has to reproduce the alias. After changing `FIAT_FLAG` / `CRYPTO_KNOWN`, run `bun run icons:build` in `packages/ui` and commit `src/icons/subset.json`.
- `supabase/migrations` hand-written SQL. No ORM.

## Rules

- Money is decimal end to end (ADR 0001). Never `number` for amounts.
- Calendar dates are `IsoDate` strings; date arithmetic lives only in `packages/domain/src/calendar.ts`.
- Every user table has `user_id` + RLS; every use case filters by `userId`.
- Use cases return `Result` (neverthrow); HTTP mapping lives in `apps/api/src/shared/errors`.
- TDD: write the failing test first. Domain uses Vitest + fast-check.
- Commits: use the `/git-commit` skill (Conventional Commits, English).
- Never log amounts, emails or tokens. Never commit real data or `.env*`.

## Skills to use

- `/vue-ddd-architecture` — any structural change in `apps/web`.
- `/frontend-design` — BEFORE the first line of markup of any new screen or component.
- `/impeccable` — audit and polish any UI you touched, before handing off.
- `/animate` — any motion or transition. Presets live in `packages/ui/src/motion`.
- `/humanize-text:humanize-text` — all user-facing copy, including i18n strings in `apps/web/src/locales`.
- `/design-taste-frontend` — ONLY for auth pages and a future landing. Never for product screens.
- `/git-commit` — every commit.
- shadcn-vue MCP (`.mcp.json`) — adding components to `packages/ui`.

## Commands

- `bun install` · `bun run dev` · `bun run test` · `bun run lint` · `bun run typecheck` · `bun run build`
- Local DB: `supabase start` / `supabase db reset` (applies migrations + seed).
- Env: `vercel env pull .env.local` inside `apps/api` and `apps/web`.

## Scripts

- `apps/api/scripts/import-sheet.ts` — local-only CLI that imports the owner's spreadsheet exports into `accounts`/`balance_entries`/`rates` (phase 2) and `income_sources`/`inflows`/`expense_categories`/`expenses`/`budgets` (phase 3). Pure mappers live in `scripts/import/` (`block.ts` finds a table inside a sheet, `native-currency.ts` guesses which of the USD/EUR/RUB columns was typed); `run.ts` plans without the database (`planPhase3`) and writes in one transaction. Never reads real data from the repo (`imports/` is git-ignored; tests use synthetic CSVs only); run from `apps/api` as `bun run import -- --user <email> [...] --dry-run`.
