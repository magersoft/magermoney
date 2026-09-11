# Decisions log (interview, 2026-09-11)

Chronological, one line each. Rationale lives in the ADRs where it matters.

1. Platform: PWA on Vue 3. Capacitor wrapper possible later. Node 24, bun, turborepo.
2. Backend: Hono API on Vercel Functions + Supabase (Postgres, Auth). Domain logic in `packages/domain`, shared by API and web.
3. Computation: client computes read models (dashboard, analytics) from raw data via `packages/domain`; optimistic updates; server validates invariants on write. Monthly Snapshot is the one stored derived value.
4. Server modules with own tables: accounts, income-sources, expenses, goals, inflows, snapshots, rates. Read models only (no tables): dashboard, savings-analytics, yearly-history.
5. Balances: append-only journal of Balance entries; current balance = latest entry. Not transaction-based.
6. Transfer: first-class operation producing two Balance entries; cross-currency transfers declare both amounts, realised rate and fee are derived. Inflow can optionally credit an Account.

7. Goal funding: an Account belongs to at most one Goal; funded = sum of linked balances. Ledger Wallet goes wholly to the emergency fund. Share-based split deferred as a possible extension.
8. BMW 530e becomes an Asset (valuation history, optional in total capital), removed from Goals.
9. Monthly delta decomposed: Inflows + Revaluation − Outflows. "Saved" = Inflows − Outflows.
10. Snapshot lifecycle: cron creates a draft on month end, user confirms or retakes with comment.
11. Income source gets a pay schedule (days of month), a primary flag, and an active period (start/end) instead of delete/disable. Expenses get an active period too.
12. Account gets a "spending" flag; available-until-payday = sum of spending accounts.
13. Expense = fixed obligations only (period, category, essential flag, active period). Planned purchases / big purchases / PC tables dropped.
14. Budget = variable category with a monthly limit; Spend = one actual number per Budget per month, entered at month close. Outflows are explained by Spends, remainder = one-off purchases.
15. Rates: fiat daily (open.er-api.com class), crypto hourly (CoinGecko), append-only by date, USD base with cross rates, manual override per date; Inflow keeps its own realised rate.
16. Display currency switch on every screen; user configures the list of reporting currencies and the default in settings. Snapshot stores per-account balances + rates, not pre-summed totals, so any currency can be derived.
17. UI: shadcn-vue + Tailwind v4 + Reka UI, components copied into `packages/ui` as the project's own design system; motion-v for animation. CDS 4 considered and declined (alpha churn, B2B look, npm availability).
18. Client data layer: TanStack Query (Vue) with IndexedDB persistence and paused mutations for offline; Pinia for UI state only. Wrapped inside each module's infrastructure layer.
19. Auth: Supabase Auth, open registration (Google + magic link). Multi-user with strict isolation: user_id on every table, RLS, ownership checked in every use case. Rates are the only shared table.
20. Device lock: WebAuthn passkey / PIN on PWA open; "hide amounts" toggle. Card numbers masked only; phone/passport as free-form note on Account, not fields.
21. Onboarding wizard after first login (currencies → accounts → income source → optional goals/budgets). Owner's data arrives via spreadsheet import instead.
22. Hosting: GitHub public monorepo (portfolio), Vercel ×2 projects (web, api) with preview per PR, Supabase prod + staging, migrations via GitHub Actions, Vercel Cron for rates and snapshot drafts. CI: bun, lint, typecheck, domain unit tests, Playwright smoke on preview.
    Public repo consequence: no real data, no seed with owner's numbers, secrets only in Vercel/GitHub, spreadsheet import runs locally.
23. Import: accounts/sources/expenses/goals as current entities (first Balance entry dated import day); Поступления → Inflows; История накоплений → legacy Snapshots (totals only); История по годам → monthly Inflows from a "Legacy" source dated month end; yearly rates → manual Rates dated Jan 1. Yearly history is a read model over Inflows.
24. Name: Magermoney. UI in RU + EN via vue-i18n from day one, RU default. Code, docs, commits in English.
25. Money: decimal end to end (Postgres numeric, string in API, Money value object). ADR 0001. ADRs 0002–0005 record balances-as-journal, client read models, Hono-over-Supabase, snapshot contents.
26. Delivery phases: 1 foundation → 2 accounts+rates+transfers+import → 3 income/expenses/budgets/dashboard → 4 goals+assets → 5 snapshots/spend/analytics/history import → 6 onboarding, EN, motion, passkey lock, e2e. Each phase ends deployed.
27. Charts: shadcn-vue chart components on Unovis (`@unovis/vue`), copied into `packages/ui`; same CSS-variable theming as the rest. ECharts not used.

## Open

- none; interview closed 2026-09-11, awaiting final confirmation of the summary.

