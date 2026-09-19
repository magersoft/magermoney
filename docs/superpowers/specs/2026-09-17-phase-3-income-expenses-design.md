# Magermoney — Phase 3: Income, inflows, expenses, budgets, dashboard

Date: 2026-09-17. Status: design approved in brainstorm, awaiting spec review.

Phase 3 answers "what comes in and what goes out": Income sources with a pay schedule, dated Inflows that can credit an Account, fixed Expenses, Budgets with a monthly limit, and the Dashboard that takes over the home screen. It builds on phase 2 (`docs/superpowers/specs/2026-09-11-phase-2-accounts-design.md`). Vocabulary: `CONTEXT.md`. Irreversible choices: `docs/adr/` (ADR 0001 decimal money, ADR 0002 declared balances, ADR 0003 client read models).

## 1. Decisions made in the brainstorm

1. **The import covers phase 3 data.** The CLI from phase 2 gains income sources, expenses and inflows. Budgets have no sheet of their own; a named expense row can be imported as a Budget (§6).
2. **The Dashboard has four blocks**: capital and available-until-payday, month plan, inflows of the month (actual vs expected), upcoming events for 30 days. Goals, assets and savings analytics arrive in phases 4 and 5.
3. **An Inflow credited to an Account in another currency declares both amounts**, exactly like a cross-currency Transfer: the Inflow amount in its own currency and the credited amount in the Account's currency. The realised rate is derived. No automatic conversion (ADR 0002).
4. **Four tabs**: Home · Accounts · Plan · Settings. Plan is one screen with segments Income / Expenses / Budgets. Rates moves under Settings and stays reachable from the display-currency switch. Phase 4 adds Goals as the fifth tab.
5. **`gross_amount` is monthly and is split evenly across pay days.** A source without pay days is irregular: it counts in the month plan with its expected amount (may be zero) and never appears in upcoming events.
6. **Every Inflow has an Income source.** One-off receipts go to a source such as "Other" with no pay days and a zero expected amount; the Inflow form can create a source on the fly.

Rulings made on the owner's behalf while reading the exported sheets (they change what the import produces, see §6):

7. The sheets show every amount in USD, EUR and RUB and do not say which one is native. The import picks the native currency by roundness and accepts explicit overrides.
8. The expenses sheet has no category, essential mark, period or billing day. The import derives category and period from the name, leaves `is_essential = false` and `billing_day = null`; the owner completes them in the UI.
9. The income sheet has no pay days and no primary mark; the import leaves both empty.
10. Inflows are imported without crediting Accounts: the imported balances already include them.
11. The "planned purchases" and "PC" blocks of the expenses sheet are ignored (decisions log item 13).

## 2. Domain (`packages/domain`)

New, pure, 100 % covered, fast-check where invariants exist. Dates in this section are calendar dates: the existing `IsoDate` (`YYYY-MM-DD`) from `rate.ts`, with "today" taken from `Clock.today()`. A small pure `calendar.ts` (days in month, add days, compare, days between) does the arithmetic; no time zones enter the domain.

### Income

- `IncomeSource`: `{ id, name, grossAmount: Money, taxRate: Decimal, commissionRate: Decimal, payDays: number[], isPrimary, activeFrom, activeTo?, defaultAccountId? }`. `taxRate` and `commissionRate` are in `[0, 1)`; `payDays` are unique integers `1..31`, sorted.
- `netMonthly(source)` = `gross × (1 − taxRate) × (1 − commissionRate)`, rounded to the currency scale. This matches the sheet (15 % tax then 10 % commission on the rest).
- `isActiveOn(entity, date)` = `activeFrom ≤ date` and (`activeTo` absent or `date ≤ activeTo`). Shared by sources, expenses and budgets.
- `payoutsBetween(source, from, to)` → `[{ date, amount: Money }]`. A pay day beyond the month's length falls on the month's last day. Each payout is `netMonthly ÷ payDays.length`; the last payout of a month absorbs the rounding remainder so a full month sums to `netMonthly` exactly. Dates outside the active period are dropped. Empty `payDays` → `[]`.
- `nextPayday(primarySource, today)` → the first payout date `≥ today`, or `null` when there is no primary source, it has no pay days, or it is inactive. `daysToPayday` = whole days between; payday today → `0`.
- `perDay(available: Money, days)` = `available ÷ max(days, 1)`.

### Inflow

- `Inflow`: `{ id, incomeSourceId, amount: Money, receivedOn, realisedRateToUsd?: Decimal, accountId?, creditedAmount?: Money, note? }`.
- `deriveInflowCredit({ amount, accountCurrency, creditedAmount? })` → `{ credited: Money, realisedRate: Decimal | null }`. Same currency: `credited = amount`, a supplied `creditedAmount` that differs is `InflowError('credited_mismatch')`. Different currencies: `creditedAmount` is required (`InflowError('credited_amount_required')`), `realisedRate = credited / amount` to 10 significant digits.
- `applyInflow({ balance, credited })` → `balance + credited`. `credited` must be greater than zero.

### Expenses and budgets

- `Expense`: `{ id, categoryId, name, amount: Money, period: 'monthly' | 'yearly', billingDay?, billingMonth?, isEssential, activeFrom, activeTo? }`. `billingMonth` is allowed only for yearly expenses.
- `monthlyAmount(expense)` = `amount` for monthly, `amount ÷ 12` for yearly, rounded to the currency scale.
- `occurrencesBetween(expense, from, to)` → `[{ date, amount }]`: monthly on `billingDay` (clamped to the month's length), yearly on `billingMonth`/`billingDay`, full `amount` each time. No `billingDay` (or a yearly expense without `billingMonth`) → `[]`.
- `Budget`: `{ id, name, icon?, monthlyLimit: Money, activeFrom, activeTo? }`.

### Read models

All take a `RateTable` and the display currency and return `unconvertible` alongside the total, as in phase 2; nothing is dropped silently.

- `monthPlan({ sources, expenses, budgets, rates, display, today })` → `{ netIncome, plannedOutgo, essential, remainder, unconvertible }`. Only entities active today count. `plannedOutgo` = Σ `monthlyAmount(expense)` + Σ `monthlyLimit`; `essential` = Σ `monthlyAmount` of essential expenses; `remainder = netIncome − plannedOutgo` (may be negative).
- `upcomingEvents({ sources, expenses, today, days = 30 })` → `[{ date, kind: 'payout' | 'expense', refId, name, amount: Money }]` sorted by date, payouts before expenses on the same day. Amounts stay in their own currency; the UI converts for display.
- `inflowsVsPlan({ sources, inflows, month, rates, display })` → `{ rows: [{ sourceId, name, expected: Money, received: Money }], totalExpected, totalReceived, unconvertible }`. `expected` = `netMonthly` of sources active on any day of the month; `received` = Σ Inflows with `receivedOn` in the month, converted with today's table (historical conversion belongs to phase 5 analytics). Sources that are inactive but received money in the month still get a row.

### Properties (fast-check)

- For any source and any month fully inside its active period, Σ `payoutsBetween(first, last)` = `netMonthly`.
- `remainder + plannedOutgo = netIncome` in the display currency.
- Same-currency credit: `applyInflow(balance, credited) − balance = amount`.
- `occurrencesBetween` over any 12 consecutive full months yields exactly 12 occurrences for a monthly expense with a billing day and exactly 1 for a yearly one.

## 3. Database

Conventions from phases 1–2: uuid PK, `user_id` + owner-only RLS (`select/insert/update/delete to authenticated using (user_id = auth.uid())`), `created_at`/`updated_at`, unconstrained `numeric`.

**`20260917000007_income_sources.sql`** — `income_sources`: `name text not null`, `gross_amount numeric not null check (gross_amount >= 0)`, `currency text not null references currencies(code)`, `tax_rate numeric not null default 0 check (tax_rate >= 0 and tax_rate < 1)`, `commission_rate` same, `pay_days int[] not null default '{}'` with `check (pay_days <@ array[1,…,31])`, `is_primary bool not null default false`, `active_from date not null`, `active_to date check (active_to >= active_from)`, `default_account_id uuid references accounts(id) on delete set null`. Partial unique index `(user_id) where is_primary`.

**`20260917000008_inflows.sql`** — `inflows`: `income_source_id uuid not null references income_sources(id) on delete restrict`, `amount numeric not null check (amount > 0)`, `currency text not null references currencies(code)`, `received_on date not null`, `realised_rate_to_usd numeric check (realised_rate_to_usd > 0)`, `account_id uuid references accounts(id) on delete restrict`, `credited_amount numeric`, `note text`. `check ((account_id is null) = (credited_amount is null))`, `check (credited_amount is null or credited_amount > 0)`. Indexes `(user_id, received_on desc, id desc)`, `(income_source_id)`.

**`20260917000009_balance_entries_inflow.sql`** — `alter table balance_entries add column inflow_id uuid references inflows(id) on delete cascade`; `check ((origin = 'inflow') = (inflow_id is not null))`; partial index `(inflow_id) where inflow_id is not null`. The `inflow` enum value already exists.

**`20260917000010_expenses.sql`** — `create type expense_period as enum ('monthly','yearly')`; `expense_categories`: `name text not null`, `icon text`, `sort_order int not null default 0`, unique `(user_id, lower(name))`; `expenses`: `category_id uuid not null references expense_categories(id) on delete restrict`, `name`, `amount numeric not null check (amount >= 0)`, `currency`, `period expense_period not null`, `billing_day int check (billing_day between 1 and 31)`, `billing_month int check (billing_month between 1 and 12)`, `check (billing_month is null or period = 'yearly')`, `is_essential bool not null default false`, `active_from`, `active_to` as above. Index `(user_id, category_id)`.

**`20260917000011_budgets.sql`** — `budgets`: `name`, `icon`, `monthly_limit numeric not null check (monthly_limit >= 0)`, `currency`, `active_from`, `active_to`.

An Account referenced by an Inflow cannot be deleted (`on delete restrict`), mirroring Transfers; `DELETE /accounts/:id` gains 409 `account_has_inflows`. `docs/db/schema.dbml` is updated in the same PR (`credited_amount`, checks, `pay_days` default, the corrected `billing_day` note).

## 4. API (`apps/api`)

Modules `income-sources`, `inflows`, `expenses` (owns categories) and `budgets`, each `application / infrastructure / http` with in-memory and pg repositories, use cases returning `Result`, schemas in `packages/contracts` (`income-source.ts`, `inflow.ts`, `expense.ts`, `budget.ts`). Every use case takes `userId`; every SQL statement filters by it. Money is a decimal string, dates are `YYYY-MM-DD`.

### Income sources

| Route                        | Body                | Result                                             | Errors                                                                  |
| ---------------------------- | ------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /income-sources`        | —                   | `IncomeSourceDto[]` incl. ended, with `netMonthly` | —                                                                       |
| `POST /income-sources`       | `IncomeSourceInput` | 201                                                | 400 validation, `default_account_not_found`                             |
| `PATCH /income-sources/:id`  | partial             | `IncomeSourceDto`                                  | 404; 409 `source_has_inflows` when `currency` changes and Inflows exist |
| `DELETE /income-sources/:id` | —                   | 204                                                | 404; 409 `source_has_inflows`                                           |

`IncomeSourceInput`: `name`, `grossAmount`, `currency`, `taxRate`, `commissionRate`, `payDays`, `isPrimary`, `activeFrom`, `activeTo?`, `defaultAccountId?`. Setting `isPrimary = true` clears the flag on the user's other sources in the same transaction. Ending a source is a `PATCH` of `activeTo`; there is no separate route.

### Inflows

| Route                 | Body / query                                                                                                 | Result                                                                                    | Errors                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GET /inflows`        | `from?`, `to?`, `sourceId?`, `limit` (50, max 200), `before` (cursor `receivedOn\|id`)                       | `InflowDto[]` newest first, each with derived `realisedRate` when credited cross-currency | —                                                                                                                     |
| `POST /inflows`       | `{ incomeSourceId, amount, currency?, receivedOn?, realisedRateToUsd?, accountId?, creditedAmount?, note? }` | 201                                                                                       | 404 source or account; 400 `received_in_future`, `credited_amount_required`, `credited_mismatch`, `credit_not_latest` |
| `PATCH /inflows/:id`  | same, optional                                                                                               | `InflowDto`                                                                               | 404; 409 `inflow_not_latest`; the 400s above                                                                          |
| `DELETE /inflows/:id` | —                                                                                                            | 204                                                                                       | 404; 409 `inflow_not_latest`                                                                                          |

`currency` defaults to the source's currency. With `accountId`: in one transaction lock the Account row (`select … for update`, the phase 2 lock), read its latest Balance entry, compute `applyInflow`, insert the Inflow and one `origin = 'inflow'` entry with `recorded_at` = `receivedOn` at the server's current time of day when `receivedOn` is today, else end of that day UTC. The credit must become the Account's latest entry; a backdated credit that would not be the latest is rejected with 400 `credit_not_latest` (record the Inflow without an Account instead). `PATCH`/`DELETE` of a credited Inflow require its entry to still be the latest on the Account (409 `inflow_not_latest`), then revert and re-apply. An uncredited Inflow is edited and deleted freely; adding or removing the credit through `PATCH` follows the same latest-entry rule. `PATCH /balances/:id` and `DELETE /balances/:id` keep refusing non-manual entries (`entry_not_manual`).

### Expenses and categories

| Route                                                          | Result                     | Errors                                             |
| -------------------------------------------------------------- | -------------------------- | -------------------------------------------------- |
| `GET /expense-categories`, `POST`, `PATCH /:id`, `DELETE /:id` | `ExpenseCategoryDto`       | 409 `category_name_taken`, `category_has_expenses` |
| `GET /expenses`                                                | `ExpenseDto[]` incl. ended | —                                                  |
| `POST /expenses`, `PATCH /expenses/:id`                        | `ExpenseDto`               | 404 category; 400 `billing_month_requires_yearly`  |
| `DELETE /expenses/:id`                                         | 204                        | 404                                                |

`POST /expenses` accepts either `categoryId` or `categoryName`; an unknown name creates the category in the same transaction (the form's "create on the fly"). Expenses carry no history yet, so deletion is unconditional; ending is a `PATCH` of `activeTo`.

### Budgets

`GET /budgets`, `POST`, `PATCH /:id`, `DELETE /:id` (unconditional in phase 3; phase 5 adds 409 `budget_has_spends`).

## 5. Web (`apps/web`)

Follows `/vue-ddd-architecture`: modules `income` (sources and inflows), `expenses` (expenses, categories), `budgets`, `dashboard`, each `domain / application / infrastructure / ui` with one public `index.ts`. `dashboard` owns no data; it composes the other modules' public composables. UI work goes `/frontend-design` → markup → `/animate` → `/impeccable`, copy through `/humanize-text:humanize-text`, strings in `ru.json` and `en.json` (EN may stay draft until phase 6). Visual rules: `docs/design/direction.md` (amount lockup, ledger hairlines, colour only on deltas).

### Routes and shell

- `/` → `DashboardPage`; `/accounts` → the phase 2 `AccountsPage` (its detail, form and transfers routes are unchanged); `/plan` → `PlanPage` with `?tab=income|expenses|budgets`; `/plan/income/new`, `/plan/income/:id`, `/plan/income/:id/edit`, `/plan/expenses/new`, `/plan/expenses/:id/edit`, `/plan/budgets/new`, `/plan/budgets/:id/edit`; `/settings/rates` → `RatesPage` (`/rates` redirects).
- `TabBar`: Home · Accounts · Plan · Settings. `QuickActionSheet` gains "Record inflow" next to "Record balance" and "Transfer"; the FAB shows on Home and Accounts.
- Routed screens get a shared loading and error fallback (`defineAsyncComponent` with `loadingComponent`, `errorComponent` offering "Reload"), closing the phase 2 follow-up about blank screens after a deploy.

### Module `income`

- `application`: `useIncomeSources()`, `useCreateIncomeSource()`, `useUpdateIncomeSource()`, `useDeleteIncomeSource()`, `useInflows({ from, to, sourceId })`, `useCreateInflow()`, `useUpdateInflow()`, `useDeleteInflow()`. A credited Inflow invalidates the accounts list and that Account's balance history. `useCreateInflow` is parked offline and replayed like `useRecordBalance` (mutation defaults in the module's `offline.ts`, optimistic patch of the inflow list and the Account balance, rollback with a toast).
- `ui`: `IncomeSegment` (active sources with net per month in own and display currency, pay days, primary badge; "Ended" disclosure), `IncomeSourcePage` (details and its Inflows, newest first), `IncomeSourceFormPage` (gross, currency, tax %, commission %, live net preview, pay-day picker as a 1–31 grid, primary switch, active period, default Account), `InflowSheet` (source picker with "New source…", `MoneyInput`, date default today, optional Account defaulting to the source's; when the Account's currency differs, a "credited" field with the hint "по курсу дня ≈ …" and the derived realised rate; optional realised USD rate under "More").

### Modules `expenses` and `budgets`

- `ExpensesSegment`: expenses grouped by category under hairline headers with a monthly total per category, essential mark, yearly items shown as "X / год · ≈ Y / мес"; footer with planned total and essential total. `ExpenseFormPage`: name, amount, currency, period, billing day (and month for yearly), category combobox with create-on-type, essential switch, active period.
- `BudgetsSegment`: budgets with monthly limit in own and display currency and the total; `BudgetFormPage`. No spend tracking UI until phase 5.

### Module `dashboard`

`useDashboard()` composes `useCapitalSummary()`, `useIncomeSources()`, `useExpenses()`, `useBudgets()`, `useInflows(current month)`, rates and display currency into the four domain read models. `DashboardPage` blocks, top to bottom:

1. **Capital** — amount lockup "Всего денег", tap opens Accounts.
2. **Until payday** — "Доступно до зарплаты", "N дней", "X в день". Without a primary source or pay days: the available amount only, with a link to set the primary source.
3. **Month plan** — net income, planned outgo (essential as a sub-line), remainder; the remainder is the one coloured number (positive/negative semantics).
4. **Inflows this month** — one row per source: received of expected with a thin progress rule; "Record inflow" button; tap opens the source.
5. **Upcoming** — next 30 days grouped by date: payouts and expense charges, own currency large, display currency small. Expenses without a billing day are summarised in one line "ещё N без даты".

Each block has an empty state that leads to the matching Plan segment. Unconvertible amounts show the phase 2 hint.

### Shared

`packages/ui` gains `SegmentedControl`, `DayOfMonthPicker`, `PercentInput`, `ProgressRule`, `AsyncBoundary` fallbacks, plus the shadcn-vue primitives the forms need (Combobox, Switch, Calendar/Popover if absent).

## 6. Import (`apps/api/scripts/import-sheet.ts`)

New flags beside the phase 2 ones: `--income-sources <csv>`, `--expenses <csv>`, `--inflows <csv>`, `--currency-of "<name>=<CODE>"` (repeatable), `--fallback-currency <CODE>` (default `EUR`), `--as-budget "<name>"` (repeatable), `--only accounts,rates,income,expenses,inflows` (default: every kind whose file was passed). Parsing and mapping stay pure functions in `scripts/import/` (`income-mapper.ts`, `expenses-mapper.ts`, `inflows-mapper.ts`, `native-currency.ts`), unit-tested on synthetic CSVs; no real data enters the repo.

- **Native currency** (`native-currency.ts`): each row shows USD, EUR and RUB. An explicit `--currency-of` wins. Otherwise the currency whose amount has no fractional part is native when exactly one qualifies; when none or several qualify the row gets `--fallback-currency` and is marked `ambiguous` in the dry-run table. The stored amount is the chosen column's value.
- **Income sources**: the first block of the sheet, from the header row `Источник,…` to the first blank row; the "Месячный доход" total, the yearly and daily blocks and the hourly-rate calculator to the right are ignored. `name` = "Источник", `gross_amount` = native column, `tax_rate` = "Налоги" and `commission_rate` = "Коммисии" as fractions, `pay_days = {}`, `is_primary = false`, `active_from` = the source's earliest imported Inflow date, else the import day.
- **Inflows**: columns "Дата" (`DD.MM.YYYY`), "Откуда", "USD/RUB", "RUB", "USD"; the summary block to the right is ignored. The Inflow takes its source's currency: a RUB source stores the RUB column with `realised_rate_to_usd = 1 / (USD/RUB)` (10 significant digits); a USD source stores the USD column with a null rate; any other source currency fails the run with the row listed. A source named in "Откуда" but absent from the sources sheet is created with `gross_amount = 0`, no pay days, currency by the same roundness rule over its Inflows' RUB and USD columns, `active_from`/`active_to` = its first and last Inflow dates. Inflows are never credited to Accounts. Without `--income-sources`, sources must already exist by name.
- **Expenses**: only the first block (columns 1–4) from the header row `Позиция,…` to the row "Итого"; the blocks to the right (planned purchases, PC) and the "Минимум" row are ignored. Rows whose three amounts are all zero are skipped. `period` = `yearly` when the name contains `(year`, in which case the suffix is removed from the name and `amount` = the monthly value × 12 rounded to the currency scale (marked `approx` in the dry run); otherwise `monthly`. Category: name starting with "Подписка" → "Подписки" (the prefix is removed from the name); everything else → "Прочее". `is_essential = false`, `billing_day = null`, `active_from` = import day. A row named by `--as-budget` becomes a Budget (`monthly_limit` = amount) instead of an Expense.
- **Idempotency**: per kind. If the user already has rows of a kind, that kind stops the run unless `--force`; with `--force` the import deletes the user's uncredited Inflows, then sources without remaining Inflows, expenses, categories without remaining expenses and budgets, and re-imports. Everything runs in one transaction. Accounts and rates behave as in phase 2 and are untouched unless their files are passed.
- `--dry-run` prints one table per kind (sources: name, currency, gross, tax, commission, ambiguous; inflows: count per source, first and last date, totals; expenses: name, category, currency, amount, period, flags) and the totals line, then rolls back. A real run prints only totals.
- `README.md`: the import section gains the three new files and flags.

## 7. Testing

- **Domain**: TDD, 100 %, the properties from §2; table tests for pay day 31 in February, payday today, a source ending mid-month, yearly expense across a year boundary.
- **API**: use cases on in-memory repositories covering every 400/409 branch; routes via `app.request()`; pg integration: a credited Inflow racing a Transfer on the same Account (the lock gives a deterministic result), `inflow_not_latest` after a newer entry, single primary source under concurrent `PATCH`, RLS isolation on all five tables.
- **Import**: mapper tests on synthetic CSVs (round RUB source, round USD source, ambiguous row, override, yearly subscription, zero row, `--as-budget`, a source that exists only in inflows, stray right-hand blocks).
- **Web**: Vitest for `useDashboard` and `useCreateInflow` (optimistic patch and rollback, offline parking); component tests for `InflowSheet` (credited field appears when currencies differ), `DayOfMonthPicker`, `DashboardPage` empty states.
- **E2E**: one more smoke scenario (create source → record credited inflow → dashboard shows it and the Account balance grew), gated by `E2E_ENABLED`.

## 8. Delivery

Branch `feat/phase-3-income-expenses`, subagent-driven execution of the plan, PR to `main` merged by the owner, migrations applied by `db.yml` behind the `production` environment approval. After merge the owner runs the import (`--dry-run` first), then sets pay days, the primary source, essential marks and billing days in the UI. Commits via `/git-commit`. Rulings recorded in `docs/discovery/phase-3-execution-ledger.md`; `docs/discovery/decisions-log.md` gains a "Phase 3" section.

## 9. Definition of done

1. Migrations 0007–0011 applied in production; `docs/db/schema.dbml` and `CONTEXT.md` updated (Inflow credit wording, irregular source, Pay schedule split rule).
2. Home is the Dashboard with the four blocks in the display currency; Accounts, Plan and Settings tabs work; Rates opens from Settings.
3. The owner's sources, inflows since 2025, expenses and the groceries Budget are in production; "net income" on the dashboard matches the sheet's "Месячный доход" net cell up to the day's rates.
4. Recording an Inflow credited to an Account (same and cross currency) updates the balance from the phone; an offline Inflow replays on reconnect.
5. Days to payday and per-day amount appear once the primary source has pay days.
6. CI green; execution ledger committed.

## 10. Out of scope

Spends and month close, Snapshots, Goals, Assets, the yearly-history and savings-history imports, idempotency keys for replayed writes, offline parking for edits and deletes, historical-rate conversion of past Inflows.

## 11. Risks

- The roundness rule can pick the wrong native currency (a $2.00 subscription is also 169,00 ₽). The dry-run table marks every ambiguous row and `--currency-of` fixes it before the real run.
- A yearly expense is rebuilt from a rounded monthly figure, so the yearly amount may be off by cents; marked `approx`, corrected in the UI.
- Converting past Inflows with today's rates makes "received this month" drift slightly for non-display currencies; acceptable for a current-month view.
- A credited Inflow blocks deleting its Account and freezes once a newer entry exists, the same trade-off already accepted for Transfers.
