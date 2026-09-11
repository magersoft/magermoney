# Magermoney

Personal multi-currency finance tracker: a Vue 3 PWA, a Hono API on Vercel Functions and Supabase Postgres, in one bun + Turborepo monorepo.

- `AGENTS.md` — map of the repo and the rules the code follows
- `CONTEXT.md` — the domain vocabulary
- `docs/adr/` — decisions that are hard to reverse
- `docs/design/direction.md` — the visual direction

## Run locally

```
bun install
supabase start
bun run dev
```

Copy `.env.example` into `apps/api/.env.local` and `apps/web/.env.local`, filling the values from `supabase status -o env`.
