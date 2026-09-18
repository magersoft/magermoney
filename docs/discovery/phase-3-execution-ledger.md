# Phase 3 execution ledger

Source: SDD ledger for `docs/superpowers/plans/2026-09-17-phase-3-income-expenses.md` (spec `docs/superpowers/specs/2026-09-17-phase-3-income-expenses-design.md`). Rulings made during execution, in the order they were made, each with the cost accepted if the ruling turns out wrong; then every deferred minor, grouped by task; then plan errata found along the way. Mirrors `docs/discovery/phase-2-execution-ledger.md`.

## Rulings

- Work in the main checkout on `feat/phase-3-income-expenses`, no worktree — phases 1 and 2 ran the same way and local Supabase/env files live here. Cost if wrong: none beyond a stray uncommitted file.
- A fifth web module, `plan`, is added beyond the spec's list (`income`, `expenses`, `budgets`, `dashboard`): the Plan screen composes three data modules, and hosting it in any one of them would make that module import its siblings' screens. It owns no data, like `dashboard`. Cost if wrong: one small folder to fold back.
- An `activeTo` earlier than `activeFrom` is refused with 400 `active_period_invalid` on sources, expenses and budgets (the spec names only the database check). Cost if wrong: one more code the UI explains.
- The expense form's category field is a text input backed by a `<datalist>` and resolved by case-insensitive name: a known name sends `categoryId`, anything else sends `categoryName`. Spec §5 says "combobox with create-on-type"; this is that behaviour without a popover on a phone keyboard. Cost if wrong: swap in the shadcn Combobox behind the same `data-testid`.
- The dashboard takes "today" from the device (`todayIso()`, UTC date) like the rest of the web app, not from an injected `Clock`; `buildDashboard` takes `today` as a parameter so tests pin it. Cost if wrong: around midnight UTC the countdown can be a day off for a few hours, the same drift the rates table already has.
- `capital-total` stays the test id of the home screen's headline number, now on the dashboard's capital block, so the phase 2 smoke assertions hold unchanged. Cost: none.
- The inflows block draws its progress rule from `Decimal.toNumber()` ratios. This is drawing, not arithmetic (ADR 0001 is about amounts); no sum or comparison uses the float. Cost if wrong: none visible.
- Russian count forms for "N дней до зарплаты" come from `ruPlural` in `app/i18n.ts` (Task 19), three forms; "payday today" is a separate key. Cost if wrong: none.
- `BalanceEntryDto` gains `inflowId: string | null`; an `origin = 'inflow'` entry is labelled in the journal and cannot be edited or deleted there (409 `entry_not_manual`). Cost if wrong: none, the field is additive.
- Extra 400 codes beyond spec §4, so the UI can say what is wrong instead of a generic validation message: `active_period_invalid`, `negative_amount`, `rate_out_of_range`, `pay_days_invalid`, `non_positive_amount`, `rate_not_positive`, `credited_without_account`, `category_required`, `category_ambiguous`. Cost if wrong: unused message keys.
- An Inflow moved to another Income source by `PATCH` keeps its own currency; the source's currency is only the default at creation. Cost if wrong: a source can list an Inflow in a foreign currency, which the read models already convert.
- Editing a cross-currency credited Inflow's amount, currency or Account requires `creditedAmount` to be sent again (400 `credited_amount_required` otherwise); a same-currency edit re-credits by itself. Nothing is converted on the person's behalf (ADR 0002). Cost if wrong: one more field to retype in the sheet, which the web pre-fills.
- Editing a credited Inflow deletes its Balance entry and inserts a new one, so the entry's id changes; nothing else refers to that id. Cost if wrong: a cached journal row flickers on refetch.
- Changes of the primary Income source are serialised per user with a transaction-scoped advisory lock taken before `clearPrimary`, so two concurrent `PATCH`es both succeed and the later one wins, instead of one failing on the partial unique index with a 500. Cost if wrong: one extra lock round-trip per primary change.
- Task 19 ships stub `DashboardPage` and `PlanPage` screens (and stub `ExpenseFormPage` / `BudgetFormPage` barrels on `shared/layout/PendingPage.vue`) so every route resolves from the moment the shell changes; Tasks 23–26 replace them and the last of them deletes `PendingPage.vue`. Cost if wrong: a few commits in the middle of the branch show a bare heading on Home and Plan.
- Import: `--currency-of` and `--as-budget` match the name as the sheet spells it (whitespace collapsed), before "Подписка" or "(year…)" is stripped; an `--as-budget` name that matches no row stops the run. Cost if wrong: a retyped flag.
- Import: a source known only from inflows whose RUB and USD columns tie takes `--fallback-currency` and is marked `ambiguous`; unless that currency is RUB or USD the run stops and names the `--currency-of "<source>=RUB|USD"` flag to pass. Cost if wrong: one more flag on the first run.
- Import: inflow rows with a zero or missing amount, or a RUB row without its USD/RUB rate, stop the run and are listed; expense rows whose three amounts are all zero are skipped. Cost if wrong: a sheet row to fix before importing.
- Import: under `--force` a source that survives because one of its inflows was credited to an Account is reused by name, its gross amount, tax and commission are refreshed from the sheet, and a currency mismatch stops the run. Cost if wrong: a hand-edited gross amount is overwritten by the sheet's.
- Import: every mapping problem of all three sheets is collected and printed together; database-dependent refusals are still reported one at a time. Cost: none.
- Import: the totals line always names all six kinds, which changed three phase 2 assertions in `run.test.ts`. Cost: none.
- `BalanceEntryDto.inflowId` and its api dto placeholder (`inflowId: null` until the inflows column lands), plus the two web fixtures, were added in Task 6 at the controller's request instead of Task 10 as the plan places them; Task 10 completes the remaining fixtures. Cost if wrong: none beyond a redundant edit.
- The read-model parameter is named `table` (as `read-models.ts`) where spec §2 writes `rates` — kept `table`. Cost if wrong: a rename.
- `inflows.income_source_id`, `inflows.account_id` and `expenses.category_id` use `on delete no action` instead of the spec's `restrict` — Postgres checks a `restrict` FK immediately inside the nested statement that a `profiles` delete cascades through, so deleting a user failed once `income_sources`/`accounts`/`expense_categories` rows cascaded before their dependent `inflows`/`expenses` rows did; `no action` refuses a direct delete of the parent identically (the API's 409s are unaffected) but defers the check to the end of the statement, so the profile cascade completes. Cost if wrong: a stray FK violation surfaces at statement end instead of immediately, which is only observable in `EXPLAIN`, not behaviour.
- `balance_entries.inflow_id` got a partial UNIQUE index (not just an index) so one balance entry per credited inflow is enforced in the database, matching the ADR 0002 invariant. Cost if wrong: a legitimate case needing two entries per inflow would need the index dropped; none is known.

## Deferred minors

(grouped by task as they arise)

### Task 5

- `monthlyAmount(e)` computed twice per essential expense in `plan-read-models.ts`.
- `days` unvalidated in `upcomingEvents`.
- The property test never draws an unconvertible currency.
- Expense `refId` not asserted in the upcomingEvents test.
- `inflowsVsPlan` row order is the caller's (doc line).

### Task 6

- `.default(null)` on the output DTO `BalanceEntryDtoSchema.inflowId` is a back-compat shim, worth a one-line comment.

## Plan errata

(defects found in the plan's code or expected values, with the correction)

- Task 8's file list did not mention `apps/api/test/integration/pg-balance-concurrency.test.ts`, which builds a `Repos` object literal by hand; extending `Repos` with `incomeSources` broke its typecheck. Fixed by adding `incomeSources: repos.incomeSources` to that literal.
- Same for Task 9: extending `Repos` with `inflows` broke that same hand-built literal in `pg-balance-concurrency.test.ts`. Fixed by adding `inflows: repos.inflows`.
- Same for Task 11: extending `Repos` with `expenseCategories` and `expenses` broke that same hand-built literal in `pg-balance-concurrency.test.ts`. Fixed by adding both to it.
- Same for Task 12: extending `Repos` with `budgets` broke that same hand-built literal in `pg-balance-concurrency.test.ts`. Fixed by adding `budgets: repos.budgets`.
- 400 `active_period_invalid`, `negative_amount`, `category_required`, `category_ambiguous` added to the expenses API beyond spec §4, so table checks never surface as 500; over HTTP the Task 6 contracts answer `VALIDATION` first for anything wrong within one payload, and these codes appear only when the merged row of a PATCH is wrong (or for callers that bypass zod).

## Not run

(anything the plan asked to run that could not be run here, and why)

## Known follow-ups after the final review

- Spends and month close, Snapshots, Goals, Assets, the yearly-history import: phases 4–5.
- Offline parking covers record-balance, create-transfer and create-inflow only; edits and deletes still wait for the network (carried from phase 2).
- Idempotency keys for replayed writes (carried from phase 2): a lost response can make a replayed inflow appear twice.
- "Received this month" converts past Inflows with today's rates; historical-rate conversion belongs to phase 5 analytics.
- The phase 2 `transfers` FKs (`from_account_id`, `to_account_id` on `public.accounts`) still use `on delete restrict`, unlike the three phase 3 FKs moved to `no action` for the profile-cascade fix above; revisit if a future migration nests a cascade through `transfers`.
