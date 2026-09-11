# SDD ledger — plan: docs/superpowers/plans/2026-09-11-phase-1-foundation.md

Spec: docs/superpowers/specs/2026-09-11-phase-1-foundation-design.md (reachable). Branch: feat/phase-1-foundation (in place, no worktree).

Ruling: work on branch feat/phase-1-foundation in the main checkout instead of a worktree — repo is brand new, nothing else in flight, user said "запускай" — cost if wrong: none beyond a branch switch.

## Pre-flight scan

| Pair / task           | Produces vs consumes                                                                                                      | Finding                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T2→T3,T4              | CurrencyRegistry.get→Result, Currency.symbol optional                                                                     | consistent                                                                                                                                                                                    |
| T2 step 5             | coverage 100% threshold vs unused error classes until T4                                                                  | plan says accept red until T4, do not lower thresholds — Ruling: implementer may set `thresholds` only after T4; T2/T3 run `vitest run` without `--coverage` gate; cost: none                 |
| T3→T4                 | Money.of/amount Decimal; RateTable uses money.amount.times                                                                | consistent                                                                                                                                                                                    |
| T4→T10,T11,T16        | Rate.value Decimal in domain vs RateRow.value string in api; web maps string→Decimal                                      | consistent, mapping explicit                                                                                                                                                                  |
| T5→T9,T10,T11,T15,T16 | UpdateProfileInputSchema refine; ProfileDto shape; RateDto no userId                                                      | consistent                                                                                                                                                                                    |
| T6→T9,T10             | profiles trigger; rates unique index with coalesce; PgRateRepository upsert uses same conflict target                     | consistent                                                                                                                                                                                    |
| T7→T8..T11            | AppDeps grows (clock,jwtSecret,cronSecret,exposeDocs,profiles,registry,rates,rateProviders); testDeps mirrors             | consistent, T7 testDeps casts `as AppDeps` until fields exist                                                                                                                                 |
| T7 rewrites           | vercel.ts rewrite `/(.*)`→`/api` with `api/index.ts` handler                                                              | consistent with hono/vercel                                                                                                                                                                   |
| T8→T9,T10,T11         | requireUser sets c.var.userId; jwt HS256 aud authenticated                                                                | consistent; Supabase default JWT is HS256 with `aud: authenticated`                                                                                                                           |
| T11 provider test     | `1/0.862069` toSignificantDigits(10) = 1.16 (1.159999…→1.160000000); `1/11802.79` = 0.0000847258 (10 sig: 0.00008472578…) | Ruling: expected value for UZS may be `0.00008472578` not `0.0000847258` — implementer verifies with decimal.js and fixes the test expectation to the computed exact 10-sig value; cost: none |
| T12→T13..T16          | @magermoney/ui exports; CurrencyIcon props code/kind/icon/size                                                            | consistent                                                                                                                                                                                    |
| T13→T14,T15,T16       | createApiClient(base,getToken); parse(res,schema) added in T15; useApi in T15                                             | consistent; T15 adds `use-api.ts`                                                                                                                                                             |
| T14→T17               | localStorage key `sb-<ref>-auth-token` for e2e session injection                                                          | fragile but supabase-js v2 convention; ruling: keep, e2e may fall back to page.route if key differs                                                                                           |
| T16→T17               | data-testid home-greeting, sample-amount, currency-switch                                                                 | T17 says add them; T16 implementer told to add now                                                                                                                                            |
| T1                    | eslint boundaries needs `eslint-plugin-vue` for .vue later; lint scripts per package                                      | consistent                                                                                                                                                                                    |
| T17 CI                | integration job uses `supabase status -o env` var names DB_URL, API_URL, ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET           | matches supabase CLI env output                                                                                                                                                               |

## Progress

Task 1: minor (deferred): root tsconfig.base.json duplicates packages/config/tsconfig.base.json byte-for-byte (plan-mandated); could `extends` instead
Task 1: complete (commits 6cd10f1..9d07c45, review clean)
Ruling: Tasks 2–4 (packages/domain: Currency, Money, Rate/RateTable/Clock) dispatched as one batch to one implementer with one review — same package, complete code in briefs, sequential edits to index.ts; cost if wrong: one larger review diff
Task 2-4: fix round 1/5 (1 addressed, 0 open — zero/Infinity rate guard test; commits 9a5bc28..09a22ba)
Task 2-4: minor (deferred): FixedClock stores the constructor Date by reference (plan-mandated shape)
Task 2: complete (commits 9d07c45..56feaf3, review clean)
Task 3: complete (commits 56feaf3..717efbf, review clean)
Task 4: complete (commits 717efbf..09a22ba, review clean after fix round 1)
Ruling: Tasks 5 (contracts) and 6 (Supabase migrations) dispatched as one batch — independent of each other, both fully specified, both small; cost if wrong: one larger review
Task 5-6: ⚠️ resolved by controller: contracts tsconfig.json identical to domain; vitest.config.ts equals domain minus coverage block (checked with diff)
Task 5-6: minor (deferred): double space in profiles policy DDL (cosmetic)
Task 5: complete (commits 09a22ba..7ce56c5, review clean)
Task 6: complete (commits 7ce56c5..c3804e4, review clean)
Ruling: Tasks 7–8 (api skeleton + auth/db client) dispatched as one batch — same package, T8 edits T7 files, both fully specified; cost if wrong: one larger review
Task 7-8: minor (deferred): CORS reflects any origin with credentials (plan-mandated; bearer-only auth today, revisit before cookies)
Task 7-8: minor (deferred): api lint script excludes api/ and vercel.ts
Task 7: complete (commits c3804e4..46acba3, review clean)
Task 8: complete (commits 46acba3..aae4186, review clean)
Ruling: Tasks 9–11 (profiles module, rates read, rate providers/job/manual) dispatched as one batch — same package, sequential edits to app.ts/testDeps, fully specified; cost if wrong: one larger review
Task 9-11: ⚠️ resolved by controller: migration unique index uses the same coalesce(zero-uuid) expression as PgRateRepository.upsertMany; RatesQuerySchema.date is optional (checked)
Task 9-11: Ruling: plan-mandated misuse of UnknownCurrencyError for "default not in reporting list" — spec says errors are typed by meaning; fix now with a ValidationError (code VALIDATION, 400) in shared/errors/http.ts, used by updateProfile; cost if wrong: a trivially reversible error class
Task 9-11: minor (deferred): status casts in routes narrower than the error union (type-only); job route OpenAPI security says bearer though it is the cron secret; dead sort in pg-rate-repository integration test; cron secret compare not constant-time
Task 9-11: fix round 1/5 (1 addressed, 0 open — ValidationError for default-not-in-list; commits 143bf36..c82556b)
Task 9: complete (commits aae4186..90b93b7, review clean after fix round 1)
Task 10: complete (commits 90b93b7..1b94024, review clean)
Task 11: complete (commits 1b94024..c82556b, review clean)
Task 12: Ruling: plan-mandated full addCollection of both icon sets (~1.1 MB) conflicts with the PWA/phone-first spec — fix now by registering a subset built from resolve-icon's own lists (offline rendering unchanged); cost if wrong: an extra build-time helper
Task 12: Ruling: add explicit @source directives in the ui stylesheet (Tailwind v4 source detection excludes node_modules for workspace consumers) — cost if wrong: two harmless lines
Task 12: minor (deferred): --input dual-purpose fill in dark mode; skeleton 5% tint faint; no bg-accent utility for brand accent; coarse-pointer selector matches all buttons; reduced-motion comment contradiction; withMotionPreference not reactive; unused deps unplugin-icons/@iconify-json/lucide; shadcn-vue in dependencies; Sonner --gray2 hsl(var(--popover)) dead with oklch
Task 12: fix round 1/5 (5 addressed, 0 open — radius tiers, icon a11y, icon subsets, @source, reduced motion; commits bc7c571..61cb21a)
Task 12: minor (deferred): explicit `icon` override / `country` fallback naming an icon outside the registered subset will not render offline (consequence of subset ruling); direction.md says sheets 20px but SheetContent has no radius
Task 12: complete (commits c82556b..61cb21a, review clean after fix round 1)
Ruling: Task 13 (web skeleton) dispatched alone on a capable model — multi-file integration (Vite, PWA, router, i18n, query persistence, theme, shell); cost if wrong: none
Task 13: Ruling: plan-mandated bare persistQueryClient (restore race, no buster) — fix now via VueQueryPlugin clientPersister (mount gated on restore) + buster from app version; cost if wrong: small wiring change
Task 13: Ruling: 1.43 MB bundle from runtime icon subsetting in packages/ui — fix now with a build-time subset (script generates a committed JSON subset; index.ts imports it); cost if wrong: one script + regenerate step documented in AGENTS.md
Task 13: Ruling: `@/` alias shared between ui and web is a trap — remove it: rewrite packages/ui internal `@/` imports to relative paths and delete vite.alias.ts + tsconfig fallback; cost if wrong: regenerated shadcn components need the same rewrite (document in AGENTS.md)
Task 13: minor (deferred): formatMoney symbol:null doc mismatch; theme flash on load (inline script); theme toggle 36px target; main lacks tabindex=-1; NBSP vs space between paths; no precision-boundary test; greeting shows app name; no tests for useTheme persistence / createApiClient; intra-app boundaries not lint-enforced
Task 13: fix round 1/5 (4 addressed, 0 open — SW RegExp matcher, clientPersister+buster, build-time icon subset, @/ alias removed; commits 2b0c156..3795983)
Task 13: complete (commits 61cb21a..3795983, review clean after fix round 1)
Ruling: Tasks 14–16 (auth, profile, rates web modules) dispatched as one batch on a capable model — same app, sequential (16 depends on 15's useProfile/useCurrencies, 15 on 14's api client), each with frontend-design/impeccable per screen; cost if wrong: one larger review
Ruling: local (and current cloud) Supabase issues ES256 JWTs via JWKS (verified: 127.0.0.1:54321/auth/v1/.well-known/jwks.json returns an EC P-256 key); spec §5 assumed HS256 secret. Correction: API verifies via remote JWKS (ES256/RS256) from SUPABASE_URL first, HS256 secret as fallback for legacy projects. Dispatched as Task 11b (api) in parallel with the 14–16 review (read-only, no file overlap); cost if wrong: one extra verification branch
Task 14-16: review: 5 Important + 2 spec gaps (convertToDisplay export missing; useCurrencies placed in rates → profile↔rates cycle). Fix round 1 queued until Task 11b commits (same branch, avoid interleaved commits).
Task 14-16: Ruling: break the profile↔rates cycle by introducing a `modules/currencies` reference-data module (useCurrencies, toCurrency, toRate, registry) that both import via its index.ts — deviates from brief 15 which put useCurrencies in profile; cost if wrong: one small module move
Task 14-16: Ruling: plan-mandated createDisplayCurrency shape ignores late-loading profile — fix: re-pick when profile transitions undefined→loaded unless the user chose explicitly this session; cost: small logic change + one test
Task 14-16: minor (deferred): useDisplayCurrency singleton bound to first component's query scope; MoneyText.test order-dependent; main.ts init() has no catch (blank page on storage error); SettingsPage double PATCH on change+blur and '' vs null; MoneyText loading vs no-rate both '—', UnknownCurrency mis-explained; API_KEY double cast; fieldset disabled during save drops focus; greetingName/withoutCurrency untested
Task 11b: complete (commits 1b92474..5c91ce8, review clean). Note: reviewer said no .env.example exists — it does at repo root (contains SUPABASE_URL already); no gap.
Task 11b: minor (deferred): dead `void kid` in auth test; VerifySupabaseJwtOptions could be a stricter union
Task 14-16: fix round 1/5 (5 addressed, 1 open — CurrencySwitch min-h-9 utility layer beats base-layer coarse-pointer rule; commits 5c91ce8..602af4f)
Task 14-16: minor (deferred): createConvertToDisplay not-loaded branch hardcodes 'USD' quote in RateMissingError; set() persists unvalidated code before profile arrives (self-corrects)
Task 14-16: fix round 2/5 (1 addressed, 0 open — pointer-coarse:min-h-11; commits 602af4f..c98ec2d)
Task 14: complete (commits 3795983..c28d041, review clean after 2 fix rounds)
Task 15: complete (commits c28d041..3abc557, review clean after 2 fix rounds)
Task 16: complete (commits 3abc557..c98ec2d, review clean after 2 fix rounds)
Ruling: Task 17 (husky, CI workflows, Playwright smoke) dispatched alone; setup-pre-commit skill is run by the implementer via Skill tool; e2e verified locally against the running stack
Task 17: implementer surfaced a load-bearing pre-existing bug: `auth.signIn.emailPlaceholder` contains a bare `@` → vue-i18n linked-message compile error crashes SignInPage. Ruling: fix now as Task 16b (escape as `{'@'}` in both locales + a test that every locale message compiles) in parallel with the Task 17 review (read-only); cost if wrong: none
Task 17: minor (deferred): hand-maintained list of 4 vue/* layout rules instead of eslint-config-prettier; playwright reuseExistingServer hardcoded true; no retries/reporter tuning
Task 16b: complete (commits 9cd672d..03711d6, review clean)
Task 17: fix round 1/5 (1 addressed, 0 open — e2e user cleanup + stale sweep; commits 03711d6..bd97d86)
Task 17: complete (commits c98ec2d..bd97d86 incl. 16b, review clean after fix round 1)
Ruling: run the final whole-branch review BEFORE Task 18 (operational deploy) so production receives reviewed code; Task 18 executes after the final fix wave
Final review: 2 Critical (cron GET vs POST; SW/query cache not cleared on sign-out), 7 Important (inert eslint boundaries; local config.toml redirect urls; hourly cron illegal on Hobby; JWT secret hard-required; CORS any-origin; e2e fails on empty staging rates; db diff missing), minors incl. crypto 3-letter codes formatted as fiat.
Ruling: single fix wave covers C1, C2, I3–I9, plus FIX-BEFORE-MERGE minors (main tabindex, main.ts catch, M11 crypto formatting, M12 gate openapi.json in prod, M21 spec count 19, AGENTS.md note on createApiClient vs hono/client). Crypto cron becomes daily (Hobby) — recorded as a phase-2 upgrade item. CORS deferral reversed (reviewer contested; agreed). Cost if wrong: one larger re-review.
Final fix wave: all 16 addressed (commits bd97d86..ea77602). Re-review: 1 Important deploy-config item (CORS_ORIGINS + ALLOW_VERCEL_PREVIEWS must be set on Vercel api project; plan env list outdated) → carried into Task 18 as a required step. Ruling: minors (127.0.0.1 in default CORS_ORIGINS, plan line "19 rows" → 18 rate rows, double clearClientCaches on sign-out, display-currency cleanup only if module imported, exposeDocs default true) — first two fixed inside Task 18's docs/config commit, rest FOLLOW-UP.
Ruling: Task 18 executes now (operational). Steps with side effects outside the repo (public GitHub repo creation + push, Supabase project creation, Vercel projects, PR merge to main) were explicitly authorised in the interview (decisions 22, "логины сделал, запускай"). Google OAuth client and GitHub Environment reviewer require the user; Task 18 will stop and report exactly what remains.
Task 18 pre-flight facts: gh logged in (magersoft), repo magersoft/magermoney does not exist yet; vercel logged in (magersoft); supabase CLI at ~/.hermes/node/bin, org ecijksbqhogoagallazh, one existing project "magersoft's Project" (uzkvrxdgkactwchsylqb, eu-west-1) — free tier allows 2 active projects.
Ruling: create only `magermoney-prod` now (fits the free tier next to the existing project); staging Supabase deferred to the user's decision (pause/delete the old project, or upgrade). Preview deployments get NO database until then; the e2e job is gated on repo variable E2E_ENABLED=true so PR CI stays green. Cost if wrong: one repo variable flip and a later `db.yml` staging job run.
Task 18: NOT run — the auto-mode classifier denied dispatching the deploy agent (it would create a public repo, push, create cloud projects, read CLI tokens). Handed to the user with exact steps. Workspace kept until Task 18 completes.
Task 18: Ruling: api project ssoProtection disabled (previews reachable for smoke/e2e; API is bearer-protected anyway). Vercel deploy switched to Build Output API (scripts/build-vercel.ts) after two failed zero-config attempts (untraced TS workspace sources; api/ discovered before build). Cost if wrong: a script to maintain instead of zero-config.
Task 18: complete — repo public, main protected, Supabase prod + migrations, Vercel ×2 with env, PR #1 merged (a5e5ed3), PR #2 (esbuild bundle) and PR #3 (Build Output API + getRequestListener, crons only in vercel.ts) merged after production NOT_FOUND/ERR_MODULE_NOT_FOUND; DoD verified except browser sign-in (owner). PR #4 = owner's README + deployment record.
Task 18: minor (deferred): CI integration job flaked once on port 54322 in use (runner); consider a random db port or retry.
