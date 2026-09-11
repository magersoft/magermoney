<div align="center">
  <img src="apps/web/public/icons/192.png" alt="Magermoney" width="96" height="96">
  <h1>Magermoney</h1>
  <p>Personal multi-currency finance tracker. Replaces a spreadsheet kept by hand since 2015.</p>
</div>

Magermoney answers one question: how much, in what currency, and is it more than last month. It tracks where the money is (bank accounts, deposits, brokers, crypto wallets, cash), what comes in, what is planned to go out, and how fast savings goals are being reached, across a dozen fiat and crypto currencies at once.

It is a Vue 3 PWA, a Hono API on Vercel Functions, and Supabase Postgres, in one bun + Turborepo monorepo.

## How it works

A few decisions shape everything else. Each one has a record in [`docs/adr/`](docs/adr/).

- **Balances are declared, not derived.** You record "account X now holds Y". There is no transaction ledger to keep up with; earlier entries stay as history. ([ADR 0002](docs/adr/0002-declared-balances-not-transactions.md))
- **Money is decimal end to end.** `numeric` in Postgres, decimal strings over the wire, a `Money` value object in the domain. Never a float, never a bare number. ([ADR 0001](docs/adr/0001-decimal-money.md))
- **Read models run in the browser.** The API returns raw entities; dashboard, analytics and history are pure functions from `packages/domain`. Switching the display currency recomputes instantly and works offline. ([ADR 0003](docs/adr/0003-client-side-read-models.md))
- **Month-end snapshots freeze balances and rates,** not totals, so any month can be re-read in any currency later. ([ADR 0005](docs/adr/0005-snapshot-stores-balances-and-rates.md))
- **The web app never talks to Postgres directly.** A Hono service owns every use case; Supabase provides Postgres, Auth and row-level security as a second line of defence. ([ADR 0004](docs/adr/0004-hono-api-over-supabase.md))

The vocabulary (Account, Balance entry, Transfer, Goal, Snapshot, Saved, Revaluation, …) lives in [`CONTEXT.md`](CONTEXT.md). Use those words in code and copy.

## Repository layout

| Path                  | What it is                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | Vue 3 PWA (Vite, TanStack Query). Modules in `src/modules/<name>/{domain,application,infrastructure,ui}`, one public `index.ts` each. |
| `apps/api`            | Hono API on Vercel Functions. Zod validation, OpenAPI at `/openapi.json` and Swagger UI at `/docs`. JWT verified via Supabase JWKS.   |
| `packages/domain`     | Pure model: `Money`, `Currency`, `Rate`, read models. No framework imports, 100 % test coverage (Vitest + fast-check).                |
| `packages/contracts`  | Zod schemas for DTOs and routes, shared by the API and the web client.                                                                |
| `packages/ui`         | Design system: shadcn-vue, Tailwind v4, motion-v, currency icon subset.                                                               |
| `packages/config`     | Shared TypeScript and tooling config.                                                                                                 |
| `supabase/migrations` | Hand-written SQL migrations with RLS. No ORM.                                                                                         |
| `docs/`               | ADRs, DB schema (`db/schema.dbml`), visual direction, discovery log.                                                                  |

Package boundaries are enforced by `eslint-plugin-boundaries` and `bun run lint:boundaries-check`.

## Getting started

### Prerequisites

- [bun](https://bun.sh) 1.3 and Node 24 (see `.nvmrc`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) 2.117 and Docker, for the local Postgres + Auth stack

### Run locally

```bash
bun install
supabase start
bun run dev
```

Then copy `.env.example` into `apps/api/.env.local` and `apps/web/.env.local`, filling the values printed by:

```bash
supabase status -o env
```

The web app runs on http://localhost:5173, the API on http://127.0.0.1:3000 with docs at `/docs`.

> [!NOTE]
> `supabase db reset` drops the local database, re-applies every migration and loads `supabase/seed.sql`. The seed contains fake exchange rates only. Never commit real data or `.env*` files.

### Scripts

| Command                                             | What it does                                     |
| --------------------------------------------------- | ------------------------------------------------ |
| `bun run dev`                                       | Web + API in watch mode via Turborepo            |
| `bun run test`                                      | Unit tests in every workspace                    |
| `bun run --filter @magermoney/api test:integration` | API + RLS tests against the local Supabase stack |
| `bun run --filter @magermoney/web test:e2e`         | Playwright end-to-end tests                      |
| `bun run lint` / `bun run typecheck`                | ESLint and `tsc` / `vue-tsc` across the monorepo |
| `bun run build`                                     | Production build of every workspace              |
| `bun run format`                                    | Prettier                                         |

Husky + lint-staged run Prettier and ESLint on commit.

## Configuration

All variables are listed with comments in [`.env.example`](.env.example). The ones that matter most:

| Variable                                                      | Where | Purpose                                                                                          |
| ------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                | api   | Postgres connection string                                                                       |
| `SUPABASE_URL` / `SUPABASE_JWT_SECRET`                        | api   | JWT verification. JWKS (ES256) from the URL, HS256 secret as fallback. At least one is required. |
| `CRON_SECRET`                                                 | api   | Bearer token Vercel Cron sends to scheduled endpoints (not a user token)                         |
| `CORS_ORIGINS`, `ALLOW_VERCEL_PREVIEWS`                       | api   | Allowed browser origins                                                                          |
| `FIAT_RATES_URL`, `CRYPTO_RATES_URL`                          | api   | Upstream exchange-rate providers                                                                 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` | web   | Auth and API endpoints for the browser                                                           |

For deployed environments, pull them from Vercel inside each app directory:

```bash
vercel env pull .env.local
```

## Deployment

Both apps deploy to Vercel as separate projects. The API entry is `apps/api/src/vercel-entry.ts`, bundled by esbuild into `api/index.js` at deploy time (never committed).

CI on every pull request runs lint, typecheck, unit tests and build, then integration tests against a throwaway Supabase stack. Changes under `supabase/migrations/` also get `supabase db lint` and a schema-drift check that re-applies every migration from scratch. End-to-end tests run against the Vercel preview when the `E2E_ENABLED` repository variable is set.

## Working on the code

- Read [`AGENTS.md`](AGENTS.md) first: it maps the repo and lists the rules the code follows.
- Every user table has `user_id` and RLS; every use case filters by `userId`.
- Use cases return `Result` (neverthrow); HTTP error mapping lives in `apps/api/src/shared/errors`.
- Write the failing test first.
- Never log amounts, emails or tokens.
- Commits follow Conventional Commits, in English.
