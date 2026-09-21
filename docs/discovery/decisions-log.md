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
28. Currency presentation: code is the identifier; symbol and names come from Intl on the client for fiat, stored only as nullable overrides for crypto.
29. Currency icons: Iconify sets via unplugin-icons (`circle-flags` for fiat, `cryptocurrency-color` for crypto), `CurrencyIcon` in packages/ui with initials fallback; `currencies.icon` nullable override for misses (e.g. PEPE from @web3icons/core as local SVG).

## Open

- none; interview closed 2026-09-11, awaiting final confirmation of the summary.

## Phase 1 deployed (2026-09-11)

- Web: https://magermoney-web.vercel.app (Vercel project `magermoney-web`, root `apps/web`)
- API: https://magermoney-api.vercel.app (Vercel project `magermoney-api`, root `apps/api`, Build Output API via `scripts/build-vercel.ts`)
- Supabase production: ref `rwvtqlwnqhjkvexifmdv`, eu-central-1; migrations 0001–0003 applied; 19 currencies; rates fetched by the two daily crons (18 rows per day, USD has no row).
- GitHub: `main` protected (checks + integration required), environment `production` with the owner as reviewer; repo variables `E2E_ENABLED=false`, `STAGING_ENABLED` unset.
- Verified: `/health` 200, `/openapi.json` 404 in production, cron routes 401 without secret, `{"stored":8}` fiat and `{"stored":10}` crypto, CORS echoes only the web origin.

### Still to do by the owner

- Supabase dashboard → Authentication → URL configuration: Site URL `https://magermoney-web.vercel.app`, additional redirect URLs `https://magermoney-web.vercel.app/auth/callback` and `https://*.vercel.app/auth/callback`.
- Google provider: create an OAuth client in Google Cloud Console with redirect `https://rwvtqlwnqhjkvexifmdv.supabase.co/auth/v1/callback`, paste client id/secret into Supabase → Providers → Google.
- Sign in from the iPhone (Add to Home Screen), switch the display currency on the home screen.
- Staging Supabase project: pause/delete the unused `magersoft's Project` or upgrade the org, then create `magermoney-staging`, set `STAGING_*` secrets, `STAGING_ENABLED=true` and `E2E_ENABLED=true`.
- Phase 2 on Vercel Pro: crypto cron back to hourly.

## Phase 2 (2026-09-12)

Brainstorm decisions (spec §1, `docs/superpowers/specs/2026-09-11-phase-2-accounts-design.md`):

1. Crypto is an Account per coin (`kind = crypto_wallet`, `bank` = exchange, `currency` = the coin); the UI groups Accounts by provider (`bank`). "Holding" is removed from `CONTEXT.md`.
2. Card conditions live in `note`; only fields that affect logic or the list are structured (`kind`, `card_type`, `card_network`, `card_tier`, `card_last4`, `card_expires`).
3. Only the latest Balance entry per Account is editable; Transfer-origin entries are edited only as part of the Transfer, and only while both entries are the latest on their Accounts.
4. Import is a local CLI over CSV (`imports/`, git-ignored); no Google API, no in-app screen; `--dry-run` prints what would be created.
5. Accounts are the home screen (total capital, available-until-payday, grouped Account list, bottom tab bar, floating "+"); the phase 3 dashboard takes over home later.
6. Current balance is computed server-side (`GET /accounts` returns each Account's latest Balance entry); totals and conversions are pure client functions in `packages/domain` — no materialised balance column.

Execution rulings that changed owner-visible behaviour:

- The account form is a routed page (`/accounts/new`, `/accounts/:id/edit`), not a sheet as originally sketched.
- `PATCH /accounts/order` is registered before `/accounts/:id` so the literal route wins.
- Both transfer amounts (`amountSent`, `amountReceived`) must be greater than zero; a 100%-fee transfer needs a manual balance entry instead.
- A transfer must stay the newest movement on both of its Accounts: a backdated create or update that is not the latest returns 409 `transfer_not_latest`.
- Editing a balance entry cannot move its `recordedAt` before the previous entry's — the edited entry must remain the latest; rejected with 400 `recorded_before_previous`.
- A same-currency edit of `amountSent` alone keeps the stored fee (received is recomputed as `newSent − oldFee`) instead of silently zeroing it.
- Import names are made unique with `" · <tier | Card | Account>"`, then a numeric suffix (` 2`, ` 3`, …) if still equal; the duplicate key is name + currency, not bank + currency.
- Imported balance entries carry the note "Imported from spreadsheet".
- The import prints its preview table only with `--dry-run`; a real run prints counts only.
- A balance or transfer is stamped with the server's current time unless the date field was edited.

## Phase 3 (2026-09-17)

Brainstorm decisions (spec §1, `docs/superpowers/specs/2026-09-17-phase-3-income-expenses-design.md`):

1. The import covers phase 3 data: income sources, expenses and inflows join the phase 2 CLI. Budgets have no sheet; a named expense row can be imported as a Budget.
2. The Dashboard has four blocks besides capital: available until payday, month plan, inflows of the month against the plan, upcoming events for 30 days. Goals, assets and savings analytics arrive in phases 4 and 5.
3. An Inflow credited to an Account in another currency declares both amounts, like a cross-currency Transfer; the realised rate is derived and nothing is converted automatically (ADR 0002).
4. Four tabs: Home · Accounts · Plan · Settings. Plan is one screen with segments Income / Expenses / Budgets. Rates moves under Settings. Phase 4 adds Goals as the fifth tab.
5. `gross_amount` is monthly and is split evenly across pay days. A source without pay days is irregular: it counts in the month plan and never appears in upcoming events.
6. Every Inflow has an Income source; one-off receipts go to a source such as "Other", which the Inflow form can create on the fly.

Import rulings made while reading the exported sheets:

7. The sheets show every amount in USD, EUR and RUB without saying which is native. The import picks the currency whose amount has no fractional part when exactly one qualifies, otherwise `--fallback-currency` (default EUR) with the row marked `ambiguous`; `--currency-of "<name>=<CODE>"` overrides.
8. The expenses sheet has no category, essential mark, period or billing day. Category and period are derived from the name ("Подписка …" → "Подписки", `(year…` → yearly with amount × 12, marked `approx`); `is_essential = false` and `billing_day = null` until set in the UI.
9. The income sheet has no pay days and no primary mark; the import leaves both empty, so "days to payday" appears only after the owner sets them.
10. Inflows are imported without crediting Accounts: the imported balances already include them. A source named only in the inflows sheet is created ended, with a zero expected amount.
11. The "planned purchases" and "PC" blocks of the expenses sheet are ignored (item 13).

Execution rulings that changed owner-visible behaviour (the full list, with the cost accepted for each, is in `docs/discovery/phase-3-execution-ledger.md`):

- An active period whose end is before its start is refused with 400 `active_period_invalid` on income sources, expenses and budgets.
- The API answers a named 400 code instead of a generic validation message: `negative_amount`, `rate_out_of_range`, `pay_days_invalid`, `non_positive_amount`, `rate_not_positive`, `credited_without_account`, `category_required`, `category_ambiguous`.
- A balance entry made by an Inflow carries `inflowId`, is labelled in the journal, and is refused there for editing or deleting with 409 `entry_not_manual`: it changes only through its Inflow.
- Editing a cross-currency credited Inflow's amount, currency or Account requires the credited amount to be declared again (400 `credited_amount_required`); nothing is converted on the owner's behalf.
- Editing a credited Inflow replaces its balance entry, so the entry's id changes; nothing else refers to that id.
- An Inflow moved to another Income source keeps its own currency; the source's currency is only the default at creation. In the app, moving a receipt is delete-and-recreate — the source picker is locked while editing.
- Two concurrent changes of the primary Income source both succeed and the later one wins, instead of one failing with a 500.
- Days to payday is counted from the device's date (UTC), like the rest of the app; payday today reads as zero.
- The dashboard names the sources today's rates cannot price, and says how much is waiting without a date even when nothing dated is listed.
- The quick action for recording an Inflow appears with zero accounts, because an Inflow needs none; balance and transfer stay hidden until an Account exists. A source created from that sheet starts on the Inflow's date, and is not parked offline — only the Inflow itself is.
- A credited amount is cleared whenever the chosen Account or the source's currency changes, and Save waits for it to be typed again.
- An Expense or Budget whose active period has not started yet is listed as current and counted in the month total, rather than falling between the two lists.
- Each Plan segment keeps its "add" button in the non-empty state, not only in the empty one.
- The expense form's category field is a text input backed by a `<datalist>`: a known name sends the category id, anything else creates the category by name.
- Import: a forced inflows import is refused while any Inflow is still credited to an Account. Forcing the expenses kind deletes every expense, every budget, and then every category left without an expense — including categories created in the app, with their sort order.
- Import: rows that cannot be read stop the run and are listed together — every mapping problem of all three sheets at once.

## Phase 4 (2026-09-21)

Brainstorm decisions (spec §1, `docs/superpowers/specs/2026-09-21-phase-4-goals-assets-design.md`):

1. Phase 4 is Goals, `accounts.goal_id` and Assets. Snapshots stay in phase 5, as `schema.dbml` already had them; only TASK-029's own acceptance criterion said otherwise.
2. A Goal answers "when will I reach it at the current rate?", so it carries a target amount and the screen carries a forecast.
3. The rate is measured rather than declared: average monthly growth of the linked Accounts over the last 6 whole months of `balance_entries`. Fewer than 2 whole months of history, or a non-positive rate, means no forecast — and the screen says so instead of printing an infinity.
4. Assets are the second segment of the fifth tab, the way Budgets are a segment of Plan. The tab is still called "Goals".
5. An Asset joins the total capital through its own `counts_in_total` flag, decided when it is created. Home keeps one capital figure; there is no with/without switch.
6. A Goal's life is active → achieved → archived. `achieved_at` is stamped once by the server and never cleared by a falling rate; only archiving is manual, and it releases the Goal's Accounts in the same transaction.
7. An Account is linked from the Goal's screen, choosing among Accounts no Goal holds. The write is `PATCH /accounts/{id}` with `goalId`, so the `goals` module never writes another module's table.
8. An Asset's current value is the last row of its valuation journal, never a column beside it (ADR 0002).
9. `goals.monthly_share` and `goals.income_source_id` are dropped from the `schema.dbml` sketch: they encoded the share-based split that phase 3 decision #7 had already deferred.
