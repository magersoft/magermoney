---
status: accepted
---

# Own API layer on Hono in front of Supabase

The web app never talks to Postgres directly. A Hono service on Vercel Functions owns all use cases, validates with zod, and publishes OpenAPI; Supabase provides Postgres, Auth (JWT verified by the API) and RLS as a second line of defence. Chosen over direct supabase-js access to keep tactical DDD (aggregates, value objects, invariants) in one runtime, and over NestJS because of serverless cold start and bundle size.

## Consequences

- Supabase Realtime is not used; the client relies on TanStack Query invalidation.
- RLS policies must stay in sync with API ownership checks; both exist on purpose.
