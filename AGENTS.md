# Magermoney — guide for agents

Personal multi-currency finance tracker. Read `CONTEXT.md` (vocabulary) before naming anything, and `docs/adr/` before changing architecture.

## Layout

- `apps/web` Vue 3 PWA. Modules in `src/modules/<name>/{domain,application,infrastructure,ui}` with a single public `index.ts`. Follow the `/vue-ddd-architecture` skill.
- `apps/api` Hono API on Vercel Functions (entry `src/vercel-entry.ts`, bundled by esbuild into `api/index.js` at deploy time, never committed). Modules in `src/modules/<name>/{application,infrastructure,http}`; `src/shared` for auth, db, errors, openapi. JWT verified via Supabase JWKS (ES256) with HS256 secret fallback.
- `packages/domain` pure model (Money, Currency, Rate…). No framework imports. 100 % test coverage.
- `packages/contracts` zod schemas for DTOs and routes → OpenAPI + client types. The web talks to the API through `apps/web/src/shared/api/client.ts` plus those zod schemas, not `hono/client`: importing the API's app type would break the package boundary.
- `packages/ui` the design system (shadcn-vue + Tailwind v4 + motion-v). Add components only via the shadcn-vue MCP / CLI. Components it generates import `@/…`; rewrite those to relative paths, or every consumer has to reproduce the alias. After changing `FIAT_FLAG` / `CRYPTO_KNOWN`, run `bun run icons:build` in `packages/ui` and commit `src/icons/subset.json`.
- `supabase/migrations` hand-written SQL. No ORM.

## Rules

- Money is decimal end to end (ADR 0001). Never `number` for amounts.
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
