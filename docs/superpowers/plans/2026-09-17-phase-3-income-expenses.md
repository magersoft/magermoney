# Magermoney Phase 3: Income, Inflows, Expenses, Budgets, Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Income sources with a pay schedule, dated Inflows that can credit an Account, fixed Expenses with categories and Budgets live in the app; the home screen becomes a Dashboard (capital, until payday, month plan, inflows of the month, upcoming events); the local CLI imports the owner's income, inflow and expense sheets.

**Architecture:** Pure calendar arithmetic, pay-schedule, inflow-credit and plan read models in `packages/domain`; zod DTOs in `packages/contracts`; four new Hono modules (`income-sources`, `inflows`, `expenses` incl. categories, `budgets`) on the existing unit-of-work, with a credited Inflow writing an `origin = 'inflow'` Balance entry under the phase 2 account lock; four new web modules (`income`, `expenses`, `budgets`, `dashboard`) plus a thin `plan` screen module on TanStack Query, with `create inflow` parked offline like `record balance`; three new pure mappers under `apps/api/scripts/import/`.

**Tech Stack:** bun 1.3, Node 24, Turborepo 2, TypeScript 5, Vue 3.5, Vite 7, vue-router 5, vue-i18n 11, @tanstack/vue-query 5, Tailwind 4, shadcn-vue 2 / reka-ui 2, motion-v 2, Hono 4 + @hono/zod-openapi 1, zod 4, decimal.js 10, neverthrow 8, postgres 3, Vitest 5, fast-check 4, Playwright 1.63, Supabase CLI 2.117.

**Spec:** `docs/superpowers/specs/2026-09-17-phase-3-income-expenses-design.md`. Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/0001`–`0005`, `docs/discovery/decisions-log.md`. Full schema: `docs/db/schema.dbml`. Phase 2 plan (patterns to copy): `docs/superpowers/plans/2026-09-11-phase-2-accounts.md`. Agent guide: `AGENTS.md`.

## Global Constraints

- Node `24`; bun is the package manager and script runner. Run `bun install` after editing any `package.json`.
- Money and rates are `numeric` in Postgres, decimal strings (`DecimalString`) in JSON, `Money`/`Decimal` in code. Never `number` for amounts, tax or commission rates. (ADR 0001)
- Calendar dates are `IsoDate` (`YYYY-MM-DD`) strings end to end (`date` columns, `IsoDateSchema` in JSON); "today" comes from `Clock.today()`. No `Date` arithmetic in the domain outside `calendar.ts`.
- Every user table has `user_id`, RLS enabled (`user_id = auth.uid()`), and every use case and every SQL statement filters by `userId`. (spec §3, §4)
- Balances are declared, never summed. A credited Inflow writes one `origin = 'inflow'` Balance entry (`new = latest + credited`) inside the unit of work that holds the Account lock; it can be created only as the Account's latest entry (400 `credit_not_latest`) and edited or deleted only while it still is (409 `inflow_not_latest`). (ADR 0002, spec §4)
- Cross-currency credit declares both amounts; nothing is converted automatically on write. (spec §1.3)
- Read models (`monthPlan`, `upcomingEvents`, `inflowsVsPlan`, `daysToPayday`) are pure functions in `packages/domain` run on the client; every aggregate returns `unconvertible` next to its total. (ADR 0003)
- `gross_amount` is monthly; a payout is `netMonthly ÷ payDays.length`, the month's last payout absorbs the rounding remainder; `netMonthly = gross × (1 − taxRate) × (1 − commissionRate)` rounded to the currency scale. (spec §1.5, §2)
- Nothing with history is deleted: sources, expenses and budgets end through `activeTo`. `DELETE` exists and is refused with 409 when rows reference the entity (`source_has_inflows`, `category_has_expenses`, `account_has_inflows`).
- Dependency direction: `domain` ← `contracts` ← `api`, `web`; `ui` imports only Vue/Tailwind. Enforced by `eslint-plugin-boundaries`; a web module is imported only through its `index.ts` (`@/modules/<name>`) or, from `app/` only, its `offline.ts`.
- No ORM. Hand-written SQL in `supabase/migrations`; postgres.js in the API with `transform: postgres.camel` and `numeric` as string.
- Domain errors are typed classes; use cases return `Result<T, E>` from neverthrow; HTTP mapping lives only in `apps/api/src/shared/errors/http.ts`. Multi-table writes go through `deps.uow(async (repos) => …)`.
- Logs never contain amounts, emails, or tokens. No real spreadsheet data in the repo: import tests use the synthetic CSVs in this plan only; `imports/` stays git-ignored and is never read by a test.
- Commits via the `/git-commit` skill (Conventional Commits, English). Every commit ends with the trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`.
- UI copy through i18n keys in `apps/web/src/locales/ru.json` and `en.json` (both files always carry the same keys; `@` inside a message is written `{'@'}`); run `/humanize-text:humanize-text` on new copy. RU is the default; EN may be a plain draft.
- Any new screen or component: `/frontend-design` before markup, `/impeccable` after; motion only via presets in `packages/ui/src/motion` and `/animate`; shadcn-vue primitives enter `packages/ui` only through the shadcn-vue CLI/MCP, and their `@/` imports are rewritten to relative paths. Touch targets `min-h-11` under `pointer-coarse:`. Visual rules: `docs/design/direction.md` — amount lockup, hairline rows, a balance is ink and only changes (the month-plan remainder, progress) take colour.
- Web modules follow `/vue-ddd-architecture`: `modules/<name>/{domain,application,infrastructure,ui}` with one public `index.ts`; routed screens are exported as async components; components never import TanStack Query directly.
- Tests: TDD (failing test first). `packages/domain` keeps 100 % coverage. API use cases are tested on in-memory repositories via `createApp(testDeps(...))` and `app.request()`; pg repositories only in `test/integration/**`.
- Run commands from the repo root as `bun run --filter @magermoney/<pkg> <script>` or inside the package directory. Full check before every commit: `bun run lint && bun run typecheck && bun run test` (turbo).
- Work happens on branch `feat/phase-3-income-expenses`. Never push to or merge into `main`; the owner merges the PR.
- Every ruling made on the owner's behalf during execution is appended to `docs/discovery/phase-3-execution-ledger.md` in the same commit as the code it concerns.

---

## File map

```
packages/domain/src/{calendar.ts, active-period.ts, income-source.ts, inflow.ts, expense.ts, budget.ts, plan-read-models.ts, errors.ts (+InflowError), index.ts}
packages/domain/test/{calendar.test.ts, active-period.test.ts, income-source.test.ts, income-source.property.test.ts, inflow.test.ts, expense.test.ts, expense.property.test.ts, plan-read-models.test.ts, plan-read-models.property.test.ts}
packages/contracts/src/{income-source.ts, inflow.ts, expense.ts, budget.ts, index.ts}
packages/contracts/test/phase3.test.ts
supabase/migrations/{20260917000007_income_sources.sql, 20260917000008_inflows.sql, 20260917000009_balance_entries_inflow.sql, 20260917000010_expenses.sql, 20260917000011_budgets.sql}
docs/db/schema.dbml
apps/api/src/modules/income-sources/{application/{income-source-repository.ts, dto.ts, list-income-sources.ts, create-income-source.ts, update-income-source.ts, delete-income-source.ts}, infrastructure/{memory-income-source-repository.ts, pg-income-source-repository.ts}, http/routes.ts}
apps/api/src/modules/inflows/{application/{inflow-repository.ts, dto.ts, list-inflows.ts, create-inflow.ts, update-inflow.ts, delete-inflow.ts, credit.ts}, infrastructure/{memory-inflow-repository.ts, pg-inflow-repository.ts}, http/routes.ts}
apps/api/src/modules/expenses/{application/{expense-repository.ts, category-repository.ts, dto.ts, categories.ts, list-expenses.ts, save-expense.ts, delete-expense.ts}, infrastructure/{memory-*.ts, pg-*.ts}, http/routes.ts}
apps/api/src/modules/budgets/{application/{budget-repository.ts, dto.ts, budgets.ts}, infrastructure/{memory-budget-repository.ts, pg-budget-repository.ts}, http/routes.ts}
apps/api/src/modules/accounts/{application/{balance-repository.ts (+inflowId, findByInflow, deleteByInflow), account-repository.ts (delete → +'has_inflows'), delete-account.ts}, infrastructure/*}
apps/api/src/{app.ts (Repos +5, routes +4), shared/db/pg-unit-of-work.ts, shared/errors/http.ts (+InflowError)}
apps/api/test/{income-sources.test.ts, inflows.test.ts, inflows-credit.test.ts, expenses.test.ts, budgets.test.ts, helpers/deps.ts}
apps/api/test/integration/{pg-inflow-credit-concurrency.test.ts, pg-income-source-primary.test.ts, pg-phase3-rls.test.ts, pg-phase3-repositories.test.ts}
apps/api/scripts/import/{native-currency.ts, income-mapper.ts, inflows-mapper.ts, expenses-mapper.ts, run.ts, numbers.ts}
apps/api/test/import/{native-currency.test.ts, income-mapper.test.ts, inflows-mapper.test.ts, expenses-mapper.test.ts, run.test.ts}
packages/ui/src/components/{segmented-control/, day-of-month-picker/, percent-input/, progress-rule/, async-fallback/} + the shadcn `switch` primitive
apps/web/src/modules/income/{domain/mappers.ts, infrastructure/{income-sources-api.ts, inflows-api.ts}, application/{use-income-sources.ts, use-income-source-mutations.ts, use-inflows.ts, use-inflow-mutations.ts, mutation-defaults.ts}, ui/{IncomeSegment.vue, IncomeSourcePage.vue, IncomeSourceFormPage.vue, InflowSheet.vue, InflowRow.vue}, index.ts, offline.ts}
apps/web/src/modules/expenses/{domain/mappers.ts, infrastructure/expenses-api.ts, application/{use-expenses.ts, use-expense-mutations.ts, use-expense-categories.ts}, ui/{ExpensesSegment.vue, ExpenseFormPage.vue}, index.ts}
apps/web/src/modules/budgets/{domain/mappers.ts, infrastructure/budgets-api.ts, application/{use-budgets.ts, use-budget-mutations.ts}, ui/{BudgetsSegment.vue, BudgetFormPage.vue}, index.ts}
apps/web/src/modules/plan/{ui/PlanPage.vue, index.ts}
apps/web/src/modules/dashboard/{application/use-dashboard.ts, ui/{DashboardPage.vue, CapitalBlock.vue, UntilPaydayBlock.vue, MonthPlanBlock.vue, MonthInflowsBlock.vue, UpcomingBlock.vue}, index.ts}
apps/web/src/{app/router.ts, app/QuickActions.vue, app/main.ts (register inflow mutation), shared/layout/AppShell.vue, shared/layout/route-fallback.ts, shared/api/error-messages.ts, locales/{ru,en}.json}
apps/web/e2e/ (one more smoke scenario)
CONTEXT.md, README.md, AGENTS.md, docs/discovery/{decisions-log.md, phase-3-execution-ledger.md}
```

## Task index

| #   | Task                                                                                | Depends on    |
| --- | ----------------------------------------------------------------------------------- | ------------- |
| 1   | Domain: calendar and active period                                                  | —             |
| 2   | Domain: income source, pay schedule, payday                                         | 1             |
| 3   | Domain: inflow credit                                                               | —             |
| 4   | Domain: expense and budget                                                          | 1             |
| 5   | Domain: plan read models                                                            | 2, 3, 4       |
| 6   | Contracts: phase 3 DTOs                                                             | —             |
| 7   | Database: migrations 0007–0011 and schema.dbml                                      | —             |
| 8   | API: income sources                                                                 | 2, 6, 7       |
| 9   | API: inflows without credit                                                         | 6, 7, 8       |
| 10  | API: credited inflows                                                               | 3, 9          |
| 11  | API: expenses and categories                                                        | 6, 7          |
| 12  | API: budgets                                                                        | 6, 7          |
| 13  | API: pg integration tests                                                           | 8–12          |
| 14  | Import: native currency and the income mapper                                       | —             |
| 15  | Import: inflows mapper                                                              | 14            |
| 16  | Import: expenses mapper                                                             | 14            |
| 17  | Import: runner, flags, idempotency, docs                                            | 7, 14–16      |
| 18  | UI kit: segmented control, day picker, percent input, progress rule, async fallback | —             |
| 19  | Web shell: routes, four tabs, rates under settings, route fallbacks                 | 18            |
| 20  | Web `income`: data layer                                                            | 6, 19         |
| 21  | Web `income`: segment, source page, source form                                     | 18, 20        |
| 22  | Web `income`: inflow sheet, offline parking, quick action                           | 20, 21        |
| 23  | Web `expenses`                                                                      | 18, 19        |
| 24  | Web `budgets`                                                                       | 18, 19        |
| 25  | Web `plan`: the Plan screen                                                         | 21, 23, 24    |
| 26  | Web `dashboard`                                                                     | 5, 20, 23, 24 |
| 27  | E2E scenario, docs, ledger, final verification, PR                                  | all           |

Tasks 1–6, 7, 14–16 and 18 have no dependencies on each other; within a track run tasks in numeric order. Task 19 ships placeholder pages (`DashboardPage`, `PlanPage`, expense and budget forms) that Tasks 23–26 replace.

## Shared interfaces (every task's **Interfaces** block refers to these exact names)

### `packages/domain` (Tasks 1–5)

```ts
// calendar.ts — IsoDate strings compare correctly with < and >.
export interface YearMonth { year: number; month: number } // month 1..12
export function parseIso(d: IsoDate): { year: number; month: number; day: number };
export function toIso(year: number, month: number, day: number): IsoDate;
export function daysInMonth(year: number, month: number): number;
export function clampDay(year: number, month: number, day: number): IsoDate; // day 31 in Feb → last day
export function addDays(d: IsoDate, n: number): IsoDate;
export function daysBetween(from: IsoDate, to: IsoDate): number; // to − from, whole days
export function firstOfMonth(d: IsoDate): IsoDate;
export function lastOfMonth(d: IsoDate): IsoDate;
export function monthsTouching(from: IsoDate, to: IsoDate): YearMonth[]; // inclusive, [] when from > to

// active-period.ts
export interface ActivePeriod { activeFrom: IsoDate; activeTo: IsoDate | null }
export function isActiveOn(p: ActivePeriod, date: IsoDate): boolean;
export function isActiveWithin(p: ActivePeriod, from: IsoDate, to: IsoDate): boolean; // any overlap

// income-source.ts
export interface IncomeSource extends ActivePeriod {
  id: string; name: string; grossAmount: Money; taxRate: Decimal; commissionRate: Decimal;
  payDays: number[]; isPrimary: boolean; defaultAccountId: string | null;
}
export interface Payout { date: IsoDate; amount: Money }
export function netMonthly(s: Pick<IncomeSource, 'grossAmount' | 'taxRate' | 'commissionRate'>): Money;
export function payoutsBetween(s: IncomeSource, from: IsoDate, to: IsoDate): Payout[];
export function nextPayday(sources: readonly IncomeSource[], today: IsoDate): IsoDate | null; // primary source only
export function daysToPayday(sources: readonly IncomeSource[], today: IsoDate): number | null;
export function perDay(available: Money, days: number): Money; // ÷ max(days, 1), rounded

// inflow.ts
export interface Inflow {
  id: string; incomeSourceId: string; amount: Money; receivedOn: IsoDate;
  realisedRateToUsd: Decimal | null; accountId: string | null; creditedAmount: Money | null; note: string | null;
}
export type InflowErrorReason = 'non_positive_amount' | 'credited_amount_required' | 'credited_mismatch';
export class InflowError extends DomainError { readonly code = 'INFLOW_INVALID'; constructor(readonly reason: InflowErrorReason) }
export function deriveInflowCredit(input: { amount: Money; accountCurrency: Currency; creditedAmount?: Money | undefined }):
  Result<{ credited: Money; realisedRate: Decimal | null }, InflowError>;
export function applyInflow(input: { balance: Money; credited: Money }): Result<Money, InflowError | CurrencyMismatchError>;

// expense.ts / budget.ts
export const EXPENSE_PERIODS = ['monthly', 'yearly'] as const;
export type ExpensePeriod = (typeof EXPENSE_PERIODS)[number];
export interface Expense extends ActivePeriod {
  id: string; categoryId: string; name: string; amount: Money; period: ExpensePeriod;
  billingDay: number | null; billingMonth: number | null; isEssential: boolean;
}
export interface Occurrence { date: IsoDate; amount: Money }
export function monthlyAmount(e: Pick<Expense, 'amount' | 'period'>): Money;
export function occurrencesBetween(e: Expense, from: IsoDate, to: IsoDate): Occurrence[];
export interface Budget extends ActivePeriod { id: string; name: string; icon: string | null; monthlyLimit: Money }

// plan-read-models.ts
export interface PlanItemRef { kind: 'source' | 'expense' | 'budget' | 'inflow'; id: string; name: string }
export interface MonthPlan { netIncome: Money; plannedOutgo: Money; essential: Money; remainder: Money; unconvertible: PlanItemRef[] }
export function monthPlan(input: { sources: readonly IncomeSource[]; expenses: readonly Expense[]; budgets: readonly Budget[];
  table: RateTable; display: Currency; today: IsoDate }): MonthPlan;
export interface UpcomingEvent { date: IsoDate; kind: 'payout' | 'expense'; refId: string; name: string; amount: Money }
export function upcomingEvents(input: { sources: readonly IncomeSource[]; expenses: readonly Expense[]; today: IsoDate; days?: number }): UpcomingEvent[];
export interface InflowsVsPlanRow { sourceId: string; name: string; expected: Money; received: Money } // both in display currency
export interface InflowsVsPlan { rows: InflowsVsPlanRow[]; totalExpected: Money; totalReceived: Money; unconvertible: PlanItemRef[] }
export function inflowsVsPlan(input: { sources: readonly IncomeSource[]; inflows: readonly Inflow[]; month: YearMonth;
  table: RateTable; display: Currency }): InflowsVsPlan;
```

### `packages/contracts` (Task 6)

```ts
// income-source.ts
IncomeSourceDtoSchema / IncomeSourceDto = { id, name, grossAmount: DecimalString, currency, taxRate: DecimalString, commissionRate: DecimalString,
  payDays: number[], isPrimary: boolean, activeFrom: IsoDate, activeTo: IsoDate | null, defaultAccountId: uuid | null, netMonthly: DecimalString }
IncomeSourceInputSchema / IncomeSourceInput          // taxRate, commissionRate default '0'; payDays default []; isPrimary default false; activeFrom optional (the API fills clock.today()) — same for ExpenseInput and BudgetInput
UpdateIncomeSourceInputSchema / UpdateIncomeSourceInput // partial
// inflow.ts
InflowDtoSchema / InflowDto = { id, incomeSourceId, amount, currency, receivedOn: IsoDate, realisedRateToUsd: DecimalString | null,
  accountId: uuid | null, creditedAmount: DecimalString | null, realisedRate: DecimalString | null, note: string | null }
CreateInflowInputSchema / CreateInflowInput = { incomeSourceId, amount, currency?, receivedOn?, realisedRateToUsd?, accountId?, creditedAmount?, note? }
UpdateInflowInputSchema / UpdateInflowInput          // partial; accountId: null removes the credit
InflowsQuerySchema / InflowsQuery = { from?: IsoDate, to?: IsoDate, sourceId?: uuid, limit (default 50, max 200), before? ("receivedOn|id") }
// expense.ts
ExpenseCategoryDtoSchema / ExpenseCategoryDto = { id, name, icon: string | null, sortOrder: number }
ExpenseCategoryInputSchema, UpdateExpenseCategoryInputSchema
ExpenseDtoSchema / ExpenseDto = { id, categoryId, name, amount, currency, period, billingDay: number | null, billingMonth: number | null,
  isEssential, activeFrom, activeTo: IsoDate | null }
ExpenseInputSchema / ExpenseInput                    // exactly one of categoryId | categoryName
UpdateExpenseInputSchema / UpdateExpenseInput
// budget.ts
BudgetDtoSchema / BudgetDto = { id, name, icon: string | null, monthlyLimit, currency, activeFrom, activeTo: IsoDate | null }
BudgetInputSchema / BudgetInput, UpdateBudgetInputSchema / UpdateBudgetInput
```

### `apps/api` (Tasks 8–12)

```ts
// app.ts
export interface Repos { accounts; balances; transfers;
  incomeSources: IncomeSourceRepository; inflows: InflowRepository;
  expenseCategories: ExpenseCategoryRepository; expenses: ExpenseRepository; budgets: BudgetRepository }
// route factories, each `(deps: AppDeps) => OpenAPIHono<AppEnv>`, mounted with app.route('/', …):
incomeSourceRoutes, inflowRoutes, expenseRoutes, budgetRoutes
// balance-repository.ts additions
BalanceEntryRow.inflowId: string | null
BalanceRepository.findByInflow(userId, inflowId): Promise<BalanceEntryRow | null>
BalanceRepository.deleteByInflow(userId, inflowId): Promise<number>
BalanceEntryDto.inflowId: string | null        // contracts: z.uuid().nullable().default(null)
// income-source-repository.ts
IncomeSourceRepository.lockAll(userId): Promise<void>   // pg advisory xact lock; first statement of create/update when input.isPrimary === true
// account-repository.ts
AccountRepository.delete(...): Promise<'deleted' | 'not_found' | 'has_transfers' | 'has_inflows'>
```

Row types mirror the DTOs plus `userId` (`IncomeSourceRow`, `InflowRow`, `ExpenseCategoryRow`, `ExpenseRow`, `BudgetRow`), amounts and rates as strings, dates as `YYYY-MM-DD` strings. API error codes are the lowercase codes of spec §4, carried by `ValidationError(message, code)` (400) and `ConflictError(code, message)` (409); an `InflowError` maps to 400 with `code = e.reason`. The Task 6 schemas answer 400 `VALIDATION` first for anything wrong inside one payload; the use cases' own lowercase range codes (`active_period_invalid`, `billing_month_requires_yearly`, `credited_without_account`, …) surface over HTTP only when the merged row of a PATCH is wrong, and tests assert them only there.

### `apps/web` (Tasks 19–26)

```ts
// @/modules/income
useIncomeSources(): { sources: ComputedRef<IncomeSource[]>; dtos: ComputedRef<IncomeSourceDto[]>; isLoading; isError }
useIncomeSource(id: MaybeRefOrGetter<string>)
useCreateIncomeSource(), useUpdateIncomeSource(), useDeleteIncomeSource()      // { create|update|remove, isPending }
useInflows(params: MaybeRefOrGetter<{ from?: string; to?: string; sourceId?: string }>): { inflows: ComputedRef<Inflow[]>; dtos; isLoading }
useCreateInflow(): { create(input: CreateInflowInput): Promise<'sent' | 'parked'>; isPending }
useUpdateInflow(): { update(id, input, accountIds: string[]) }; useDeleteInflow(): { remove(id, accountIds: string[]) } // ids of the touched Accounts, refetched
toIncomeSource(dto, registry): IncomeSource; toInflow(dto, registry, accountCurrency?): Inflow // creditedAmount stays null without the Account's currency
IncomeSegment, InflowSheet (sync components); IncomeSourcePage, IncomeSourceFormPage (async)
// @/modules/income/offline
INCOME_SOURCES_KEY, inflowsKey(params), CREATE_INFLOW_KEY, registerIncomeMutations(qc, api, ownerId), type CreateInflowVars
// @/modules/expenses
useExpenses(): { expenses: ComputedRef<Expense[]>; dtos; isLoading }; useExpenseCategories(); useCreateExpense(); useUpdateExpense(); useDeleteExpense()
ExpensesSegment (sync); ExpenseFormPage (async)
// @/modules/budgets
useBudgets(): { budgets: ComputedRef<Budget[]>; dtos; isLoading }; useCreateBudget(); useUpdateBudget(); useDeleteBudget()
BudgetsSegment (sync); BudgetFormPage (async)
// @/modules/plan
PlanPage (async)            // route /plan?tab=income|expenses|budgets
// @/modules/dashboard
useDashboard(); DashboardPage (async)
```

Route names: `home` (`/`), `accounts` (`/accounts`), `plan`, `income-source-new`, `income-source`, `income-source-edit`, `expense-new`, `expense-edit`, `budget-new`, `budget-edit`, `rates` (`/settings/rates`, with `/rates` redirecting). The existing `account*` and `transfers` routes keep their names and paths.

---

### Task 1: Domain — calendar and active period

**Files:**

- Create: `packages/domain/src/calendar.ts`, `packages/domain/src/active-period.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/calendar.test.ts`, `packages/domain/test/active-period.test.ts`

**Interfaces:**

- Consumes: `IsoDate` from `packages/domain/src/rate.ts` (`type IsoDate = string`, `YYYY-MM-DD`).
- Produces: `YearMonth`, `parseIso`, `toIso`, `daysInMonth`, `clampDay`, `addDays`, `daysBetween`, `firstOfMonth`, `lastOfMonth`, `monthsTouching`; `ActivePeriod`, `isActiveOn`, `isActiveWithin` — signatures exactly as in the header's "Shared interfaces".

Design notes: all arithmetic goes through `Date.UTC`, never through local-time `Date` constructors, so results do not depend on the machine's time zone (the test suite must also pass under `TZ=America/Los_Angeles`). IsoDate strings are compared with plain `<` / `>`. `activeTo` is inclusive: it is the last day the entity still counts.

- [ ] **Step 1: Write the failing tests**

`packages/domain/test/calendar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addDays,
  clampDay,
  daysBetween,
  daysInMonth,
  firstOfMonth,
  lastOfMonth,
  monthsTouching,
  parseIso,
  toIso,
} from '../src/index.js';

describe('calendar', () => {
  it('parses and formats an ISO date', () => {
    expect(parseIso('2026-09-17')).toEqual({ year: 2026, month: 9, day: 17 });
    expect(toIso(2026, 9, 7)).toBe('2026-09-07');
    expect(toIso(987, 1, 1)).toBe('0987-01-01');
  });
  it('knows the length of every month, leap years included', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
  it('clamps a day beyond the month onto its last day', () => {
    expect(clampDay(2026, 2, 31)).toBe('2026-02-28');
    expect(clampDay(2028, 2, 30)).toBe('2028-02-29');
    expect(clampDay(2026, 9, 10)).toBe('2026-09-10');
  });
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-17', 0)).toBe('2026-09-17');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-17', 62)).toBe('2026-11-18');
  });
  it('counts whole days between two dates, across a DST change too', () => {
    expect(daysBetween('2026-09-17', '2026-09-17')).toBe(0);
    expect(daysBetween('2026-09-17', '2026-09-25')).toBe(8);
    expect(daysBetween('2026-09-25', '2026-09-17')).toBe(-8);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
  it('finds the first and the last day of a month', () => {
    expect(firstOfMonth('2026-02-17')).toBe('2026-02-01');
    expect(lastOfMonth('2026-02-17')).toBe('2026-02-28');
    expect(lastOfMonth('2026-12-01')).toBe('2026-12-31');
  });
  it('lists every month an inclusive range touches', () => {
    expect(monthsTouching('2026-09-17', '2026-09-30')).toEqual([{ year: 2026, month: 9 }]);
    expect(monthsTouching('2026-11-30', '2027-02-01')).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
    expect(monthsTouching('2026-09-18', '2026-09-17')).toEqual([]);
  });
});
```

`packages/domain/test/active-period.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isActiveOn, isActiveWithin } from '../src/index.js';

const open = { activeFrom: '2026-03-10', activeTo: null };
const closed = { activeFrom: '2026-03-10', activeTo: '2026-06-20' };

describe('isActiveOn', () => {
  it('starts on activeFrom and never ends while activeTo is null', () => {
    expect(isActiveOn(open, '2026-03-09')).toBe(false);
    expect(isActiveOn(open, '2026-03-10')).toBe(true);
    expect(isActiveOn(open, '2031-01-01')).toBe(true);
  });
  it('includes activeTo itself and nothing after it', () => {
    expect(isActiveOn(closed, '2026-06-20')).toBe(true);
    expect(isActiveOn(closed, '2026-06-21')).toBe(false);
  });
});

describe('isActiveWithin', () => {
  it('is true when the period overlaps the range on at least one day', () => {
    expect(isActiveWithin(closed, '2026-03-01', '2026-03-10')).toBe(true);
    expect(isActiveWithin(closed, '2026-06-20', '2026-06-30')).toBe(true);
    expect(isActiveWithin(open, '2030-01-01', '2030-01-31')).toBe(true);
  });
  it('is false when the range ends before the period or starts after it', () => {
    expect(isActiveWithin(closed, '2026-02-01', '2026-03-09')).toBe(false);
    expect(isActiveWithin(closed, '2026-06-21', '2026-07-31')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run --filter @magermoney/domain test`
Expected: FAIL — `addDays` (and the other imports) are not exported from `../src/index.js`.

- [ ] **Step 3: Write the implementation**

`packages/domain/src/calendar.ts`:

```ts
import type { IsoDate } from './rate.js';

/**
 * Calendar arithmetic on `YYYY-MM-DD` strings. Everything goes through
 * `Date.UTC`, so the answer never depends on the machine's time zone, and two
 * IsoDates compare correctly with `<` and `>` as plain strings.
 */
export interface YearMonth {
  year: number;
  /** 1..12 */
  month: number;
}

const DAY_MS = 86_400_000;
const pad = (n: number, width: number) => String(n).padStart(width, '0');

export function parseIso(d: IsoDate): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = d.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function toIso(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

const toUtc = (d: IsoDate): number => {
  const { year, month, day } = parseIso(d);
  return Date.UTC(year, month - 1, day);
};

/** Day 0 of the next month is the last day of this one. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A day beyond the month's length falls on the month's last day: the 31st in February is the 28th or 29th. */
export function clampDay(year: number, month: number, day: number): IsoDate {
  return toIso(year, month, Math.min(day, daysInMonth(year, month)));
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return new Date(toUtc(d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** `to − from` in whole days; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function firstOfMonth(d: IsoDate): IsoDate {
  const { year, month } = parseIso(d);
  return toIso(year, month, 1);
}

export function lastOfMonth(d: IsoDate): IsoDate {
  const { year, month } = parseIso(d);
  return toIso(year, month, daysInMonth(year, month));
}

/** Every month the inclusive range touches, in order; empty when `from` is after `to`. */
export function monthsTouching(from: IsoDate, to: IsoDate): YearMonth[] {
  if (from > to) return [];
  const end = parseIso(to);
  let { year, month } = parseIso(from);
  const months: YearMonth[] = [];
  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
```

`packages/domain/src/active-period.ts`:

```ts
import type { IsoDate } from './rate.js';

/**
 * The dates between which an Income source, Expense or Budget counts. Nothing
 * is deleted when it ends; `activeTo` is the last day it still counts.
 */
export interface ActivePeriod {
  activeFrom: IsoDate;
  activeTo: IsoDate | null;
}

export function isActiveOn(p: ActivePeriod, date: IsoDate): boolean {
  return p.activeFrom <= date && (p.activeTo === null || date <= p.activeTo);
}

/** True when the period overlaps the inclusive range on at least one day. */
export function isActiveWithin(p: ActivePeriod, from: IsoDate, to: IsoDate): boolean {
  return p.activeFrom <= to && (p.activeTo === null || from <= p.activeTo);
}
```

In `packages/domain/src/index.ts` add, right after `export * from './clock.js';`:

```ts
export * from './calendar.js';
export * from './active-period.js';
```

- [ ] **Step 4: Run the tests, also in another time zone**

Run: `bun run --filter @magermoney/domain test` and `cd packages/domain && TZ=America/Los_Angeles bunx vitest run test/calendar.test.ts`
Expected: PASS both times, coverage 100 %.

- [ ] **Step 5: Commit**

Commit with the `/git-commit` skill; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

```bash
git add packages/domain/src/calendar.ts packages/domain/src/active-period.ts packages/domain/src/index.ts packages/domain/test/calendar.test.ts packages/domain/test/active-period.test.ts
git commit -m "feat(domain): add calendar arithmetic and active periods"
```

---

### Task 2: Domain — income source, pay schedule, payday

**Files:**

- Create: `packages/domain/src/income-source.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/income-source.test.ts`, `packages/domain/test/income-source.property.test.ts`

**Interfaces:**

- Consumes (Task 1): `ActivePeriod`, `isActiveOn`, `addDays`, `clampDay`, `daysBetween`, `monthsTouching`; existing `Money` (`Money.of`, `.multiply`, `.round`, `.amount: Decimal`, `.currency.scale`), `Decimal`.
- Produces: `IncomeSource`, `Payout`, `PAYDAY_LOOKAHEAD_DAYS = 62`, `netMonthly(s)`, `payoutsBetween(s, from, to)`, `nextPayday(sources, today)`, `daysToPayday(sources, today)`, `perDay(available, days)`.

Design notes (settled here, later tasks rely on them):

- `netMonthly = gross × (1 − taxRate) × (1 − commissionRate)`, rounded half-up to the currency scale.
- Each month pays `netMonthly` in `payDays.length` parts. Every part except the last is `netMonthly ÷ n` **rounded down** to the currency scale; the last pay day of the month (the largest day number) gets `netMonthly − part × (n − 1)`, so a full month sums to `netMonthly` exactly and no part is ever negative.
- A pay day beyond the month's length is clamped to its last day. Two pay days that clamp onto the same date (30 and 31 in February) stay two payouts.
- `payDays` is sorted inside the function; callers need not sort.
- Payouts dated outside `[from, to]` or outside the active period are dropped — they are not redistributed, so a month in which the source starts or ends sums to less than `netMonthly`.
- `nextPayday` uses the source flagged `isPrimary` only, looks `PAYDAY_LOOKAHEAD_DAYS` (62) days ahead — two full months always contain the next pay day — and therefore respects the active period: a source that has ended has no next payday. Payday today counts (`daysToPayday = 0`).
- `perDay` divides by `max(days, 1)` and rounds to the currency scale.

- [ ] **Step 1: Write the failing tests**

`packages/domain/test/income-source.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  daysToPayday,
  netMonthly,
  nextPayday,
  payoutsBetween,
  perDay,
  type IncomeSource,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const c = (code: string) => reg.get(code)._unsafeUnwrap();

const source = (over: Partial<IncomeSource> = {}): IncomeSource => ({
  id: 's1',
  name: 'Salary',
  grossAmount: Money.of('412345', c('RUB')),
  taxRate: new Decimal('0.15'),
  commissionRate: new Decimal('0.10'),
  payDays: [10, 25],
  isPrimary: true,
  defaultAccountId: null,
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const dates = (s: IncomeSource, from: string, to: string) =>
  payoutsBetween(s, from, to).map((p) => `${p.date} ${p.amount.toString()}`);

describe('netMonthly', () => {
  it('takes tax first and commission from the rest, rounded to the currency scale', () => {
    // 412345 × 0.85 × 0.90 = 315443.925 → 315443.93
    expect(netMonthly(source()).toString()).toBe('315443.93');
  });
  it('equals gross when both rates are zero', () => {
    const s = source({
      grossAmount: Money.of('4200', c('USD')),
      taxRate: new Decimal(0),
      commissionRate: new Decimal(0),
    });
    expect(netMonthly(s).toString()).toBe('4200');
  });
});

describe('payoutsBetween', () => {
  it('splits the month evenly and lets the last payout absorb the rounding remainder', () => {
    const s = source({
      grossAmount: Money.of('100', c('USD')),
      payDays: [5, 15, 25],
    });
    // net 76.50 → 25.50 each
    expect(dates(s, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-05 25.5',
      '2026-09-15 25.5',
      '2026-09-25 25.5',
    ]);
    const odd = source({
      grossAmount: Money.of('100', c('USD')),
      taxRate: new Decimal(0),
      commissionRate: new Decimal(0),
      payDays: [25, 5, 15],
    });
    // 33.33 + 33.33 + 33.34, and unsorted pay days are put in order
    expect(dates(odd, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-05 33.33',
      '2026-09-15 33.33',
      '2026-09-25 33.34',
    ]);
  });
  it('moves pay day 31 to the last day of February', () => {
    const s = source({ payDays: [31] });
    expect(payoutsBetween(s, '2026-02-01', '2026-03-31').map((p) => p.date)).toEqual([
      '2026-02-28',
      '2026-03-31',
    ]);
  });
  it('keeps two payouts when two pay days clamp onto the same date', () => {
    const s = source({ payDays: [30, 31] });
    expect(payoutsBetween(s, '2026-02-01', '2026-02-28').map((p) => p.date)).toEqual([
      '2026-02-28',
      '2026-02-28',
    ]);
  });
  it('keeps only dates inside the range', () => {
    expect(payoutsBetween(source(), '2026-09-11', '2026-10-10').map((p) => p.date)).toEqual([
      '2026-09-25',
      '2026-10-10',
    ]);
  });
  it('drops payouts outside the active period: a source ending mid-month pays only its first half', () => {
    const s = source({ activeFrom: '2026-09-11', activeTo: '2026-10-15' });
    expect(payoutsBetween(s, '2026-09-01', '2026-10-31').map((p) => p.date)).toEqual([
      '2026-09-25',
      '2026-10-10',
    ]);
  });
  it('is empty for an irregular source', () => {
    expect(payoutsBetween(source({ payDays: [] }), '2026-09-01', '2026-09-30')).toEqual([]);
  });
});

describe('nextPayday and daysToPayday', () => {
  const other = source({ id: 's2', isPrimary: false, payDays: [1] });
  it('counts to the primary source only', () => {
    expect(nextPayday([other, source()], '2026-09-17')).toBe('2026-09-25');
    expect(daysToPayday([other, source()], '2026-09-17')).toBe(8);
  });
  it('is zero when payday is today', () => {
    expect(daysToPayday([source()], '2026-09-25')).toBe(0);
  });
  it('rolls into the next month', () => {
    expect(nextPayday([source()], '2026-09-26')).toBe('2026-10-10');
  });
  it('is null without a primary source, without pay days, or once the source has ended', () => {
    expect(nextPayday([other], '2026-09-17')).toBeNull();
    expect(daysToPayday([], '2026-09-17')).toBeNull();
    expect(nextPayday([source({ payDays: [] })], '2026-09-17')).toBeNull();
    expect(nextPayday([source({ activeTo: '2026-09-20' })], '2026-09-21')).toBeNull();
  });
});

describe('perDay', () => {
  it('divides what is available by the days left and rounds', () => {
    expect(perDay(Money.of('1000', c('EUR')), 8).toString()).toBe('125');
    expect(perDay(Money.of('100', c('EUR')), 3).toString()).toBe('33.33');
  });
  it('treats payday today as one day', () => {
    expect(perDay(Money.of('100', c('EUR')), 0).toString()).toBe('100');
  });
});
```

`packages/domain/test/income-source.property.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  firstOfMonth,
  lastOfMonth,
  netMonthly,
  payoutsBetween,
  toIso,
  type IncomeSource,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const USD = reg.get('USD')._unsafeUnwrap();
const cents = fc
  .integer({ min: 0, max: 10_000_000_00 })
  .map((n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`);
const rate = fc.integer({ min: 0, max: 99 }).map((n) => new Decimal(n).div(100));

describe('pay schedule properties', () => {
  it('the payouts of any full month inside the active period sum to netMonthly', () => {
    fc.assert(
      fc.property(
        cents,
        rate,
        rate,
        fc.uniqueArray(fc.integer({ min: 1, max: 31 }), {
          minLength: 1,
          maxLength: 6,
        }),
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (gross, taxRate, commissionRate, payDays, year, month) => {
          const s: IncomeSource = {
            id: 's',
            name: 'S',
            grossAmount: Money.of(gross, USD),
            taxRate,
            commissionRate,
            payDays,
            isPrimary: true,
            defaultAccountId: null,
            activeFrom: '2000-01-01',
            activeTo: null,
          };
          const first = firstOfMonth(toIso(year, month, 1));
          const payouts = payoutsBetween(s, first, lastOfMonth(first));
          const sum = payouts.reduce((t, p) => t.add(p.amount)._unsafeUnwrap(), Money.zero(USD));
          expect(payouts).toHaveLength(payDays.length);
          expect(payouts.every((p) => !p.amount.isNegative())).toBe(true);
          expect(sum.toString()).toBe(netMonthly(s).toString());
        },
      ),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run --filter @magermoney/domain test`
Expected: FAIL — `netMonthly`, `payoutsBetween`, `nextPayday`, `daysToPayday`, `perDay` are not exported.

- [ ] **Step 3: Write the implementation**

`packages/domain/src/income-source.ts`:

```ts
import Decimal from 'decimal.js';
import { isActiveOn, type ActivePeriod } from './active-period.js';
import { addDays, clampDay, daysBetween, monthsTouching } from './calendar.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';

/** A recurring origin of income. `grossAmount` is what it pays per month before tax and commission. */
export interface IncomeSource extends ActivePeriod {
  id: string;
  name: string;
  grossAmount: Money;
  /** 0 ≤ rate < 1 */
  taxRate: Decimal;
  /** 0 ≤ rate < 1, taken from what is left after tax. */
  commissionRate: Decimal;
  /** Days of the month, 1..31. Empty = irregular: planned per month, never on the calendar. */
  payDays: number[];
  isPrimary: boolean;
  defaultAccountId: string | null;
}

export interface Payout {
  date: IsoDate;
  amount: Money;
}

/** How far ahead `nextPayday` looks: two full months always contain the next pay day of a monthly schedule. */
export const PAYDAY_LOOKAHEAD_DAYS = 62;

/** gross × (1 − tax) × (1 − commission), rounded to the currency scale. Derived, never stored. */
export function netMonthly(
  s: Pick<IncomeSource, 'grossAmount' | 'taxRate' | 'commissionRate'>,
): Money {
  return s.grossAmount
    .multiply(new Decimal(1).minus(s.taxRate))
    .multiply(new Decimal(1).minus(s.commissionRate))
    .round();
}

/**
 * The expected payouts dated inside `[from, to]`. Each month pays `netMonthly`
 * in equal parts rounded down, one per pay day; the month's last part absorbs the
 * remainder, so a full month always sums to `netMonthly` exactly. A pay day
 * beyond the month's length falls on its last day, and two pay days that land
 * on the same date stay two payouts. Dates outside the active period are dropped.
 */
export function payoutsBetween(s: IncomeSource, from: IsoDate, to: IsoDate): Payout[] {
  if (s.payDays.length === 0) return [];
  const days = [...s.payDays].sort((a, b) => a - b);
  const net = netMonthly(s);
  const part = Money.of(
    net.amount.div(days.length).toDecimalPlaces(net.currency.scale, Decimal.ROUND_DOWN),
    net.currency,
  );
  const lastPart = Money.of(net.amount.minus(part.amount.times(days.length - 1)), net.currency);
  const payouts: Payout[] = [];
  for (const { year, month } of monthsTouching(from, to)) {
    days.forEach((day, i) => {
      const date = clampDay(year, month, day);
      if (date < from || date > to || !isActiveOn(s, date)) return;
      payouts.push({ date, amount: i === days.length - 1 ? lastPart : part });
    });
  }
  return payouts;
}

/** The primary source's first payout dated today or later; null without a primary source, pay days or an active period ahead. */
export function nextPayday(sources: readonly IncomeSource[], today: IsoDate): IsoDate | null {
  const primary = sources.find((s) => s.isPrimary);
  if (!primary) return null;
  const [next] = payoutsBetween(primary, today, addDays(today, PAYDAY_LOOKAHEAD_DAYS));
  return next ? next.date : null;
}

/** Whole days until the primary source pays next; 0 when payday is today. */
export function daysToPayday(sources: readonly IncomeSource[], today: IsoDate): number | null {
  const next = nextPayday(sources, today);
  return next === null ? null : daysBetween(today, next);
}

/** What may be spent per day until payday. Payday today still counts as one day, so nothing divides by zero. */
export function perDay(available: Money, days: number): Money {
  return Money.of(available.amount.div(Math.max(days, 1)), available.currency).round();
}
```

In `packages/domain/src/index.ts` add after `export * from './active-period.js';`:

```ts
export * from './income-source.js';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run --filter @magermoney/domain test`
Expected: PASS, coverage 100 %.

- [ ] **Step 5: Commit**

Commit with the `/git-commit` skill; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

```bash
git add packages/domain/src/income-source.ts packages/domain/src/index.ts packages/domain/test/income-source.test.ts packages/domain/test/income-source.property.test.ts
git commit -m "feat(domain): add income sources with a pay schedule"
```

---

### Task 3: Domain — inflow credit

**Files:**

- Create: `packages/domain/src/inflow.ts`
- Modify: `packages/domain/src/errors.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/test/inflow.test.ts`

**Interfaces:**

- Consumes: existing `Money`, `Currency`, `DomainError`, `CurrencyMismatchError`, `RATE_SIGNIFICANT_DIGITS` (= 10, from `transfer.ts`), `IsoDate`.
- Produces: `Inflow`, `InflowCredit` (`{ credited: Money; realisedRate: Decimal | null }`), `InflowErrorReason`, `InflowError` (`code = 'INFLOW_INVALID'`, `.reason`), `deriveInflowCredit(input)`, `applyInflow(input)`.

Design notes:

- Same currency: `credited = amount`; a supplied `creditedAmount` must be numerically equal (`100` = `100.00`), otherwise `credited_mismatch`.
- Different currencies: `creditedAmount` is required (`credited_amount_required`) and `realisedRate = credited ÷ amount` to 10 significant digits, the same precision as a Transfer's realised rate.
- A `creditedAmount` that is not in the Account's currency is `credited_mismatch`; a zero or negative amount on either side is `non_positive_amount`.
- `applyInflow` has no floor: a credit may shrink a credit-card debt. This file also carries the spec's third property (same-currency credit raises the balance by exactly the inflow amount).

- [ ] **Step 1: Write the failing test**

`packages/domain/test/inflow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CurrencyMismatchError,
  CurrencyRegistry,
  InflowError,
  Money,
  applyInflow,
  deriveInflowCredit,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const reason = (r: { isErr(): boolean; _unsafeUnwrapErr(): unknown }) =>
  (r._unsafeUnwrapErr() as InflowError).reason;

describe('deriveInflowCredit', () => {
  it('credits the inflow amount itself when the account holds the same currency', () => {
    const r = deriveInflowCredit({
      amount: Money.of('4200', USD),
      accountCurrency: USD,
    })._unsafeUnwrap();
    expect(r.credited.toString()).toBe('4200');
    expect(r.realisedRate).toBeNull();
  });
  it('accepts an equal credited amount in the same currency and refuses a different one', () => {
    expect(
      deriveInflowCredit({
        amount: Money.of('100', USD),
        accountCurrency: USD,
        creditedAmount: Money.of('100.00', USD),
      }).isOk(),
    ).toBe(true);
    expect(
      reason(
        deriveInflowCredit({
          amount: Money.of('100', USD),
          accountCurrency: USD,
          creditedAmount: Money.of('99', USD),
        }),
      ),
    ).toBe('credited_mismatch');
  });
  it('needs both amounts when the account holds another currency and derives the realised rate', () => {
    expect(
      reason(
        deriveInflowCredit({
          amount: Money.of('4200', USD),
          accountCurrency: EUR,
        }),
      ),
    ).toBe('credited_amount_required');
    const r = deriveInflowCredit({
      amount: Money.of('4200', USD),
      accountCurrency: EUR,
      creditedAmount: Money.of('3864', EUR),
    })._unsafeUnwrap();
    expect(r.credited.toString()).toBe('3864');
    expect(r.realisedRate?.toFixed()).toBe('0.92');
  });
  it('refuses a credited amount that is not in the account currency', () => {
    const r = deriveInflowCredit({
      amount: Money.of('4200', USD),
      accountCurrency: EUR,
      creditedAmount: Money.of('4200', USD),
    });
    expect(r._unsafeUnwrapErr()).toBeInstanceOf(InflowError);
    expect(r._unsafeUnwrapErr().code).toBe('INFLOW_INVALID');
    expect(reason(r)).toBe('credited_mismatch');
  });
  it('refuses zero and negative amounts on either side', () => {
    expect(
      reason(
        deriveInflowCredit({
          amount: Money.of('0', USD),
          accountCurrency: USD,
        }),
      ),
    ).toBe('non_positive_amount');
    expect(
      reason(
        deriveInflowCredit({
          amount: Money.of('10', USD),
          accountCurrency: EUR,
          creditedAmount: Money.of('-1', EUR),
        }),
      ),
    ).toBe('non_positive_amount');
  });
});

describe('applyInflow', () => {
  it('adds the credited amount to the latest balance', () => {
    const after = applyInflow({
      balance: Money.of('120.50', EUR),
      credited: Money.of('30', EUR),
    });
    expect(after._unsafeUnwrap().toString()).toBe('150.5');
  });
  it('lets a credit card debt shrink', () => {
    const after = applyInflow({
      balance: Money.of('-200', EUR),
      credited: Money.of('50', EUR),
    });
    expect(after._unsafeUnwrap().toString()).toBe('-150');
  });
  it('refuses a non-positive credit and a credit in another currency', () => {
    expect(
      reason(
        applyInflow({
          balance: Money.of('1', EUR),
          credited: Money.of('0', EUR),
        }),
      ),
    ).toBe('non_positive_amount');
    expect(
      applyInflow({
        balance: Money.of('1', EUR),
        credited: Money.of('1', USD),
      })._unsafeUnwrapErr(),
    ).toBeInstanceOf(CurrencyMismatchError);
  });
  it('property: a same-currency credit raises the balance by exactly the inflow amount', () => {
    const cents = fc
      .integer({ min: 1, max: 10_000_000_00 })
      .map((n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`);
    fc.assert(
      fc.property(cents, cents, (bal, amt) => {
        const balance = Money.of(bal, USD);
        const amount = Money.of(amt, USD);
        const { credited } = deriveInflowCredit({
          amount,
          accountCurrency: USD,
        })._unsafeUnwrap();
        const after = applyInflow({ balance, credited })._unsafeUnwrap();
        expect(after.subtract(balance)._unsafeUnwrap().toString()).toBe(amount.toString());
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run --filter @magermoney/domain test`
Expected: FAIL — `InflowError`, `deriveInflowCredit`, `applyInflow` are not exported.

- [ ] **Step 3: Write the implementation**

Append to `packages/domain/src/errors.ts`:

```ts
export type InflowErrorReason =
  'non_positive_amount' | 'credited_amount_required' | 'credited_mismatch';
export class InflowError extends DomainError {
  readonly code = 'INFLOW_INVALID';
  constructor(readonly reason: InflowErrorReason) {
    super(`Inflow invalid: ${reason}`);
  }
}
```

`packages/domain/src/inflow.ts`:

```ts
import type Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import type { Currency } from './currency.js';
import { InflowError, type CurrencyMismatchError } from './errors.js';
import type { Money } from './money.js';
import type { IsoDate } from './rate.js';
import { RATE_SIGNIFICANT_DIGITS } from './transfer.js';

/** An actual dated receipt of money from an Income source, optionally credited to an Account. */
export interface Inflow {
  id: string;
  incomeSourceId: string;
  amount: Money;
  receivedOn: IsoDate;
  /** The USD rate actually obtained that day; null = look it up in the rates table. */
  realisedRateToUsd: Decimal | null;
  accountId: string | null;
  /** What landed on the Account, in the Account's currency. Set exactly when `accountId` is. */
  creditedAmount: Money | null;
  note: string | null;
}

export interface InflowCredit {
  credited: Money;
  /** credited / amount when currencies differ; null for a same-currency credit. */
  realisedRate: Decimal | null;
}

/**
 * What an Inflow adds to the Account it is credited to. Same currency: the
 * Inflow amount itself. Another currency: both amounts are declared, like a
 * cross-currency Transfer, and the realised rate is derived — nothing is
 * converted automatically (ADR 0002).
 */
export function deriveInflowCredit(input: {
  amount: Money;
  accountCurrency: Currency;
  creditedAmount?: Money | undefined;
}): Result<InflowCredit, InflowError> {
  const { amount, accountCurrency, creditedAmount } = input;
  if (!amount.amount.gt(0)) return err(new InflowError('non_positive_amount'));
  if (creditedAmount && creditedAmount.currency.code !== accountCurrency.code)
    return err(new InflowError('credited_mismatch'));
  if (amount.currency.code === accountCurrency.code) {
    if (creditedAmount && !creditedAmount.amount.eq(amount.amount))
      return err(new InflowError('credited_mismatch'));
    return ok({ credited: amount, realisedRate: null });
  }
  if (!creditedAmount) return err(new InflowError('credited_amount_required'));
  if (!creditedAmount.amount.gt(0)) return err(new InflowError('non_positive_amount'));
  const realisedRate = creditedAmount.amount
    .div(amount.amount)
    .toSignificantDigits(RATE_SIGNIFICANT_DIGITS);
  return ok({ credited: creditedAmount, realisedRate });
}

/** The Account's new declared balance: the latest one plus what was credited. */
export function applyInflow(input: {
  balance: Money;
  credited: Money;
}): Result<Money, InflowError | CurrencyMismatchError> {
  if (!input.credited.amount.gt(0)) return err(new InflowError('non_positive_amount'));
  return input.balance.add(input.credited);
}
```

In `packages/domain/src/index.ts` add after `export * from './income-source.js';`:

```ts
export * from './inflow.js';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run --filter @magermoney/domain test`
Expected: PASS, coverage 100 %.

- [ ] **Step 5: Commit**

Commit with the `/git-commit` skill; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

```bash
git add packages/domain/src/inflow.ts packages/domain/src/errors.ts packages/domain/src/index.ts packages/domain/test/inflow.test.ts
git commit -m "feat(domain): derive what an inflow credits to an account"
```

---

### Task 4: Domain — expense and budget

**Files:**

- Create: `packages/domain/src/expense.ts`, `packages/domain/src/budget.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/expense.test.ts`, `packages/domain/test/expense.property.test.ts`

**Interfaces:**

- Consumes (Task 1): `ActivePeriod`, `isActiveOn`, `clampDay`, `monthsTouching`; existing `Money`.
- Produces: `EXPENSE_PERIODS`, `ExpensePeriod`, `Expense`, `Occurrence`, `monthlyAmount(e)`, `occurrencesBetween(e, from, to)`, `Budget`.

Design notes: `amount` is per period (per month, or per year). `monthlyAmount` of a yearly expense is `amount ÷ 12` rounded to the currency scale. An occurrence always carries the full `amount`. No `billingDay`, or a yearly expense without `billingMonth`, yields no occurrences (the dashboard summarises those as "N without a date"). `budget.ts` is a type only, so it adds nothing to coverage.

- [ ] **Step 1: Write the failing tests**

`packages/domain/test/expense.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  EXPENSE_PERIODS,
  Money,
  monthlyAmount,
  occurrencesBetween,
  type Expense,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const EUR = reg.get('EUR')._unsafeUnwrap();

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  categoryId: 'c1',
  name: 'Rent',
  amount: Money.of('900', EUR),
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const on = (e: Expense, from: string, to: string) =>
  occurrencesBetween(e, from, to).map((o) => o.date);

describe('monthlyAmount', () => {
  it('lists the two periods', () => {
    expect(EXPENSE_PERIODS).toEqual(['monthly', 'yearly']);
  });
  it('is the amount itself for a monthly expense', () => {
    expect(monthlyAmount(expense()).toString()).toBe('900');
  });
  it('spreads a yearly expense over twelve months, rounded to the currency scale', () => {
    expect(
      monthlyAmount(expense({ period: 'yearly', amount: Money.of('100', EUR) })).toString(),
    ).toBe('8.33');
  });
});

describe('occurrencesBetween', () => {
  it('charges a monthly expense every month on its billing day, for the full amount', () => {
    const r = occurrencesBetween(expense(), '2026-09-01', '2026-11-04');
    expect(r.map((o) => o.date)).toEqual(['2026-09-05', '2026-10-05']);
    expect(r[0]?.amount.toString()).toBe('900');
  });
  it('clamps billing day 31 to the end of a shorter month', () => {
    expect(on(expense({ billingDay: 31 }), '2026-02-01', '2026-02-28')).toEqual(['2026-02-28']);
  });
  it('charges a yearly expense once, also across a year boundary', () => {
    const yearly = expense({
      period: 'yearly',
      billingDay: 15,
      billingMonth: 1,
    });
    expect(on(yearly, '2026-09-17', '2027-09-16')).toEqual(['2027-01-15']);
    expect(on(yearly, '2026-01-16', '2026-12-31')).toEqual([]);
    expect(occurrencesBetween(yearly, '2027-01-01', '2027-01-31')[0]?.amount.toString()).toBe(
      '900',
    );
  });
  it('has nothing to show without a billing day, or a yearly expense without a billing month', () => {
    expect(on(expense({ billingDay: null }), '2026-09-01', '2026-09-30')).toEqual([]);
    expect(
      on(expense({ period: 'yearly', billingMonth: null }), '2026-01-01', '2026-12-31'),
    ).toEqual([]);
  });
  it('drops charges outside the active period', () => {
    const ended = expense({ activeFrom: '2026-09-06', activeTo: '2026-10-31' });
    expect(on(ended, '2026-09-01', '2026-12-31')).toEqual(['2026-10-05']);
  });
});
```

`packages/domain/test/expense.property.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CurrencyRegistry,
  Money,
  addDays,
  occurrencesBetween,
  toIso,
  type Expense,
} from '../src/index.js';

const EUR = CurrencyRegistry.default().get('EUR')._unsafeUnwrap();

describe('billing calendar properties', () => {
  it('twelve consecutive full months hold 12 charges of a monthly expense and 1 of a yearly one', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        fc.integer({ min: 1, max: 12 }),
        (year, month, billingDay, billingMonth) => {
          const from = toIso(year, month, 1);
          const to = addDays(toIso(year + 1, month, 1), -1);
          const base: Expense = {
            id: 'e',
            categoryId: 'c',
            name: 'E',
            amount: Money.of('10', EUR),
            period: 'monthly',
            billingDay,
            billingMonth: null,
            isEssential: false,
            activeFrom: '2000-01-01',
            activeTo: null,
          };
          expect(occurrencesBetween(base, from, to)).toHaveLength(12);
          expect(
            occurrencesBetween({ ...base, period: 'yearly', billingMonth }, from, to),
          ).toHaveLength(1);
        },
      ),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run --filter @magermoney/domain test`
Expected: FAIL — `EXPENSE_PERIODS`, `monthlyAmount`, `occurrencesBetween` are not exported.

- [ ] **Step 3: Write the implementation**

`packages/domain/src/expense.ts`:

```ts
import { isActiveOn, type ActivePeriod } from './active-period.js';
import { clampDay, monthsTouching } from './calendar.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';

export const EXPENSE_PERIODS = ['monthly', 'yearly'] as const;
export type ExpensePeriod = (typeof EXPENSE_PERIODS)[number];

/** A fixed recurring obligation. `amount` is what is charged each period: per month, or per year. */
export interface Expense extends ActivePeriod {
  id: string;
  categoryId: string;
  name: string;
  amount: Money;
  period: ExpensePeriod;
  /** Day of the month it is charged on; null = the date is not known, so it never shows on the calendar. */
  billingDay: number | null;
  /** 1..12, yearly expenses only. */
  billingMonth: number | null;
  isEssential: boolean;
}

export interface Occurrence {
  date: IsoDate;
  amount: Money;
}

/** What the expense costs per month: a yearly one is spread over twelve months, rounded to the currency scale. */
export function monthlyAmount(e: Pick<Expense, 'amount' | 'period'>): Money {
  return e.period === 'monthly'
    ? e.amount
    : Money.of(e.amount.amount.div(12), e.amount.currency).round();
}

/**
 * The charges dated inside `[from, to]`, each for the full `amount`. Monthly:
 * every month on `billingDay`; yearly: once a year on `billingMonth`/`billingDay`.
 * A billing day beyond the month's length falls on its last day. Without a
 * billing day (or, for a yearly expense, a billing month) there is nothing to
 * put on the calendar. Dates outside the active period are dropped.
 */
export function occurrencesBetween(e: Expense, from: IsoDate, to: IsoDate): Occurrence[] {
  const { billingDay, billingMonth } = e;
  if (billingDay === null) return [];
  if (e.period === 'yearly' && billingMonth === null) return [];
  const occurrences: Occurrence[] = [];
  for (const { year, month } of monthsTouching(from, to)) {
    if (e.period === 'yearly' && month !== billingMonth) continue;
    const date = clampDay(year, month, billingDay);
    if (date < from || date > to || !isActiveOn(e, date)) continue;
    occurrences.push({ date, amount: e.amount });
  }
  return occurrences;
}
```

`packages/domain/src/budget.ts`:

```ts
import type { ActivePeriod } from './active-period.js';
import type { Money } from './money.js';

/** A variable spending category with a monthly limit. What was actually spent arrives with Spends in phase 5. */
export interface Budget extends ActivePeriod {
  id: string;
  name: string;
  icon: string | null;
  monthlyLimit: Money;
}
```

In `packages/domain/src/index.ts` add after `export * from './inflow.js';`:

```ts
export * from './expense.js';
export * from './budget.js';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run --filter @magermoney/domain test`
Expected: PASS, coverage 100 %.

- [ ] **Step 5: Commit**

Commit with the `/git-commit` skill; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

```bash
git add packages/domain/src/expense.ts packages/domain/src/budget.ts packages/domain/src/index.ts packages/domain/test/expense.test.ts packages/domain/test/expense.property.test.ts
git commit -m "feat(domain): add expenses with a billing calendar and budgets"
```

---

### Task 5: Domain — plan read models

**Files:**

- Create: `packages/domain/src/plan-read-models.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/plan-read-models.test.ts`, `packages/domain/test/plan-read-models.property.test.ts`

**Interfaces:**

- Consumes: Task 1 (`isActiveOn`, `isActiveWithin`, `addDays`, `lastOfMonth`, `toIso`, `YearMonth`), Task 2 (`IncomeSource`, `netMonthly`, `payoutsBetween`), Task 3 (`Inflow`), Task 4 (`Expense`, `monthlyAmount`, `occurrencesBetween`, `Budget`); existing `RateTable.convert(money, code): Result<Money, …>`, `Currency`, `Money`.
- Produces: `PlanItemRef`, `MonthPlan`, `monthPlan(input)`, `UpcomingEvent`, `upcomingEvents(input)`, `InflowsVsPlanRow`, `InflowsVsPlan`, `inflowsVsPlan(input)` — exactly as in the header.

Design notes:

- `monthPlan` counts only entities active **today** (`isActiveOn(x, today)`). `plannedOutgo` = Σ `monthlyAmount(expense)` + Σ `monthlyLimit`; `essential` is the essential part of the expenses; `remainder = netIncome − plannedOutgo` and may be negative. Amounts are converted but not rounded — the UI rounds for display.
- Anything whose currency has no rate is left out of the totals and listed in `unconvertible` once (an essential expense is tallied twice but listed once).
- `upcomingEvents` covers `days` calendar days **including today**: `[today, today + days − 1]`. Order: date, then payouts before expenses, then name. Amounts stay in their own currency.
- `inflowsVsPlan`: a source gets a row when it is active on any day of the month **or** received money in it, so an ended source that still paid is shown with `expected = 0`. `expected` is the full `netMonthly` of a source active on any day of the month (not prorated). `received` = Σ the Inflows' own `amount` (never `creditedAmount`) converted with the given table. Inflows whose source is not in `sources` are ignored, so callers pass every source, ended ones included. An unconvertible Inflow is listed as `{ kind: 'inflow', id: <inflow id>, name: <source name> }`.

- [ ] **Step 1: Write the failing tests**

`packages/domain/test/plan-read-models.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  inflowsVsPlan,
  monthPlan,
  upcomingEvents,
  type Budget,
  type Expense,
  type IncomeSource,
  type Inflow,
  type Rate,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const c = (code: string) => reg.get(code)._unsafeUnwrap();
const rate = (base: string, value: string): Rate => ({
  base,
  quote: 'USD',
  value: new Decimal(value),
  date: '2026-09-17',
  source: 'api',
});
// 1 EUR = 1.25 USD, 1 RUB = 0.0125 USD; BTC has no rate.
const table = new RateTable('2026-09-17', [rate('EUR', '1.25'), rate('RUB', '0.0125')], reg);
const today = '2026-09-17';

const source = (over: Partial<IncomeSource> = {}): IncomeSource => ({
  id: 's1',
  name: 'Agency',
  grossAmount: Money.of('5000', c('USD')),
  taxRate: new Decimal(0),
  commissionRate: new Decimal(0),
  payDays: [4],
  isPrimary: true,
  defaultAccountId: null,
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  categoryId: 'c1',
  name: 'Rent',
  amount: Money.of('1600', c('EUR')),
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const budget = (over: Partial<Budget> = {}): Budget => ({
  id: 'b1',
  name: 'Groceries',
  icon: null,
  monthlyLimit: Money.of('800', c('EUR')),
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const inflow = (over: Partial<Inflow> = {}): Inflow => ({
  id: 'i1',
  incomeSourceId: 's1',
  amount: Money.of('5000', c('USD')),
  receivedOn: '2026-09-04',
  realisedRateToUsd: null,
  accountId: null,
  creditedAmount: null,
  note: null,
  ...over,
});

describe('monthPlan', () => {
  it('puts net income, planned outgo, the essential part and the remainder in the display currency', () => {
    const salary = source({
      id: 's2',
      name: 'Salary',
      grossAmount: Money.of('400000', c('RUB')),
      taxRate: new Decimal('0.15'),
      commissionRate: new Decimal('0.10'),
      isPrimary: false,
    });
    const plan = monthPlan({
      sources: [source(), salary],
      expenses: [
        expense(),
        expense({
          id: 'e2',
          name: 'Flight tracker',
          amount: Money.of('48', c('USD')),
          period: 'yearly',
          isEssential: false,
        }),
      ],
      budgets: [budget()],
      table,
      display: c('USD'),
      today,
    });
    // 5000 + 306000 RUB × 0.0125 = 8825
    expect(plan.netIncome.toString()).toBe('8825');
    // 1600 EUR × 1.25 + 48 ÷ 12 + 800 EUR × 1.25 = 2000 + 4 + 1000
    expect(plan.plannedOutgo.toString()).toBe('3004');
    expect(plan.essential.toString()).toBe('2000');
    expect(plan.remainder.toString()).toBe('5821');
    expect(plan.unconvertible).toEqual([]);
  });
  it('counts only what is active today and lets the remainder go negative', () => {
    const plan = monthPlan({
      sources: [source({ activeTo: '2026-09-16' })],
      expenses: [expense(), expense({ id: 'e2', activeFrom: '2026-10-01' })],
      budgets: [budget({ activeTo: '2026-08-31' })],
      table,
      display: c('EUR'),
      today,
    });
    expect(plan.netIncome.toString()).toBe('0');
    expect(plan.plannedOutgo.toString()).toBe('1600');
    expect(plan.remainder.toString()).toBe('-1600');
  });
  it('lists what it cannot convert once, even when it counts twice', () => {
    const plan = monthPlan({
      sources: [
        source({
          id: 'sb',
          name: 'Mining',
          grossAmount: Money.of('1', c('BTC')),
        }),
      ],
      expenses: [expense({ id: 'eb', name: 'Node', amount: Money.of('0.01', c('BTC')) })],
      budgets: [
        budget({
          id: 'bb',
          name: 'Sats',
          monthlyLimit: Money.of('0.02', c('BTC')),
        }),
      ],
      table,
      display: c('USD'),
      today,
    });
    expect(plan.netIncome.isZero()).toBe(true);
    expect(plan.plannedOutgo.isZero()).toBe(true);
    expect(plan.unconvertible).toEqual([
      { kind: 'source', id: 'sb', name: 'Mining' },
      { kind: 'expense', id: 'eb', name: 'Node' },
      { kind: 'budget', id: 'bb', name: 'Sats' },
    ]);
  });
});

describe('upcomingEvents', () => {
  it('lists payouts and charges for thirty days from today, payouts first on a shared day', () => {
    const events = upcomingEvents({
      sources: [source({ payDays: [5, 20] }), source({ id: 's3', name: 'Dividends', payDays: [] })],
      expenses: [
        expense(),
        expense({
          id: 'e2',
          name: 'Pool',
          billingDay: 20,
          amount: Money.of('28', c('EUR')),
        }),
        expense({
          id: 'e3',
          name: 'Cloud',
          billingDay: 20,
          amount: Money.of('16', c('EUR')),
        }),
        expense({ id: 'e4', name: 'No date', billingDay: null }),
      ],
      today,
    });
    expect(events.map((e) => `${e.date} ${e.kind} ${e.name} ${e.amount.toString()}`)).toEqual([
      '2026-09-20 payout Agency 2500',
      '2026-09-20 expense Cloud 16',
      '2026-09-20 expense Pool 28',
      '2026-10-05 payout Agency 2500',
      '2026-10-05 expense Rent 1600',
    ]);
    expect(events[0]?.refId).toBe('s1');
  });
  it('counts today as the first day and stops after `days` days', () => {
    const events = upcomingEvents({
      sources: [source({ payDays: [17, 18] })],
      expenses: [],
      today,
      days: 1,
    });
    expect(events.map((e) => e.date)).toEqual(['2026-09-17']);
    // Thirty days from 17 Sep end on 16 Oct: the 17 Oct payout is out.
    const month = upcomingEvents({
      sources: [source({ payDays: [17] })],
      expenses: [],
      today,
    });
    expect(month.map((e) => e.date)).toEqual(['2026-09-17']);
  });
});

describe('inflowsVsPlan', () => {
  const september = { year: 2026, month: 9 };
  it('sets what came against what was expected, per source, in the display currency', () => {
    const salary = source({
      id: 's2',
      name: 'Salary',
      grossAmount: Money.of('400000', c('RUB')),
      isPrimary: false,
    });
    const r = inflowsVsPlan({
      sources: [source(), salary],
      inflows: [
        inflow(),
        inflow({
          id: 'i2',
          incomeSourceId: 's2',
          amount: Money.of('200000', c('RUB')),
          receivedOn: '2026-09-10',
        }),
        inflow({ id: 'i3', receivedOn: '2026-08-31' }),
        inflow({ id: 'i4', receivedOn: '2026-10-01' }),
        inflow({ id: 'i5', incomeSourceId: 'gone' }),
      ],
      month: september,
      table,
      display: c('USD'),
    });
    expect(
      r.rows.map((x) => `${x.name} ${x.received.toString()}/${x.expected.toString()}`),
    ).toEqual(['Agency 5000/5000', 'Salary 2500/5000']);
    expect(r.rows[0]?.sourceId).toBe('s1');
    expect(r.totalExpected.toString()).toBe('10000');
    expect(r.totalReceived.toString()).toBe('7500');
    expect(r.unconvertible).toEqual([]);
  });
  it('keeps an ended source that still received money and hides an ended one that did not', () => {
    const gig = source({
      id: 'sb',
      name: 'Gig',
      activeFrom: '2025-06-01',
      activeTo: '2025-06-30',
    });
    const quiet = source({
      id: 'sq',
      name: 'Quiet',
      activeFrom: '2025-01-01',
      activeTo: '2025-12-31',
    });
    const starting = source({
      id: 'sn',
      name: 'New',
      activeFrom: '2026-09-30',
    });
    const r = inflowsVsPlan({
      sources: [gig, quiet, starting],
      inflows: [inflow({ incomeSourceId: 'sb', amount: Money.of('100', c('EUR')) })],
      month: september,
      table,
      display: c('USD'),
    });
    expect(
      r.rows.map((x) => `${x.name} ${x.received.toString()}/${x.expected.toString()}`),
    ).toEqual(['Gig 125/0', 'New 0/5000']);
  });
  it('lists sources and inflows it cannot convert instead of dropping them silently', () => {
    const mining = source({
      id: 'sm',
      name: 'Mining',
      grossAmount: Money.of('1', c('BTC')),
    });
    const r = inflowsVsPlan({
      sources: [mining],
      inflows: [
        inflow({
          id: 'ib',
          incomeSourceId: 'sm',
          amount: Money.of('0.5', c('BTC')),
        }),
      ],
      month: september,
      table,
      display: c('USD'),
    });
    expect(r.rows).toEqual([
      {
        sourceId: 'sm',
        name: 'Mining',
        expected: Money.zero(c('USD')),
        received: Money.zero(c('USD')),
      },
    ]);
    expect(r.unconvertible).toEqual([
      { kind: 'source', id: 'sm', name: 'Mining' },
      { kind: 'inflow', id: 'ib', name: 'Mining' },
    ]);
  });
});
```

`packages/domain/test/plan-read-models.property.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  monthPlan,
  type Budget,
  type Expense,
  type IncomeSource,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const table = new RateTable(
  '2026-09-17',
  [
    {
      base: 'EUR',
      quote: 'USD',
      value: new Decimal('1.1737'),
      date: '2026-09-17',
      source: 'api',
    },
    {
      base: 'RUB',
      quote: 'USD',
      value: new Decimal('0.011855'),
      date: '2026-09-17',
      source: 'api',
    },
  ],
  reg,
);
const currency = fc.constantFrom('USD', 'EUR', 'RUB').map((code) => reg.get(code)._unsafeUnwrap());
const money = fc
  .tuple(fc.integer({ min: 0, max: 10_000_000_00 }), currency)
  .map(([n, cur]) => Money.of(new Decimal(n).div(100), cur));
const period = { activeFrom: '2000-01-01', activeTo: null };

describe('month plan properties', () => {
  it('remainder + plannedOutgo = netIncome in the display currency', () => {
    fc.assert(
      fc.property(
        fc.array(money, { maxLength: 5 }),
        fc.array(fc.tuple(money, fc.boolean(), fc.boolean()), { maxLength: 8 }),
        fc.array(money, { maxLength: 4 }),
        currency,
        (gross, costs, limits, display) => {
          const sources: IncomeSource[] = gross.map((grossAmount, i) => ({
            ...period,
            id: `s${i}`,
            name: `S${i}`,
            grossAmount,
            taxRate: new Decimal('0.13'),
            commissionRate: new Decimal('0.05'),
            payDays: [],
            isPrimary: false,
            defaultAccountId: null,
          }));
          const expenses: Expense[] = costs.map(([amount, yearly, isEssential], i) => ({
            ...period,
            id: `e${i}`,
            categoryId: 'c',
            name: `E${i}`,
            amount,
            period: yearly ? 'yearly' : 'monthly',
            billingDay: null,
            billingMonth: null,
            isEssential,
          }));
          const budgets: Budget[] = limits.map((monthlyLimit, i) => ({
            ...period,
            id: `b${i}`,
            name: `B${i}`,
            icon: null,
            monthlyLimit,
          }));
          const plan = monthPlan({
            sources,
            expenses,
            budgets,
            table,
            display,
            today: '2026-09-17',
          });
          const back = plan.remainder.add(plan.plannedOutgo)._unsafeUnwrap();
          expect(back.round().toString()).toBe(plan.netIncome.round().toString());
          expect(plan.essential.compare(plan.plannedOutgo)._unsafeUnwrap()).toBeLessThanOrEqual(0);
        },
      ),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run --filter @magermoney/domain test`
Expected: FAIL — `monthPlan`, `upcomingEvents`, `inflowsVsPlan` are not exported.

- [ ] **Step 3: Write the implementation**

`packages/domain/src/plan-read-models.ts`:

```ts
import { isActiveOn, isActiveWithin } from './active-period.js';
import type { Budget } from './budget.js';
import { addDays, lastOfMonth, toIso, type YearMonth } from './calendar.js';
import type { Currency } from './currency.js';
import { monthlyAmount, occurrencesBetween, type Expense } from './expense.js';
import type { Inflow } from './inflow.js';
import { netMonthly, payoutsBetween, type IncomeSource } from './income-source.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';
import type { RateTable } from './rate-table.js';

/** Points at the thing whose currency has no rate, so the screen can name it instead of dropping it. */
export interface PlanItemRef {
  kind: 'source' | 'expense' | 'budget' | 'inflow';
  id: string;
  name: string;
}

/** Adds up converted amounts and remembers what could not be converted. */
class Tally {
  total: Money;
  constructor(
    private readonly table: RateTable,
    private readonly display: Currency,
    private readonly unconvertible: PlanItemRef[],
  ) {
    this.total = Money.zero(display);
  }
  /** The converted amount, or null when there is no rate (the ref is then listed once). */
  add(money: Money, ref: PlanItemRef): Money | null {
    const converted = this.table.convert(money, this.display.code);
    if (converted.isErr()) {
      if (!this.unconvertible.some((u) => u.kind === ref.kind && u.id === ref.id))
        this.unconvertible.push(ref);
      return null;
    }
    this.total = this.total.add(converted.value)._unsafeUnwrap();
    return converted.value;
  }
}

export interface MonthPlan {
  netIncome: Money;
  plannedOutgo: Money;
  essential: Money;
  /** netIncome − plannedOutgo; negative when the plan spends more than it earns. */
  remainder: Money;
  unconvertible: PlanItemRef[];
}

/** The month as planned today: only what is active today counts. All amounts in the display currency. */
export function monthPlan(input: {
  sources: readonly IncomeSource[];
  expenses: readonly Expense[];
  budgets: readonly Budget[];
  table: RateTable;
  display: Currency;
  today: IsoDate;
}): MonthPlan {
  const { table, display, today } = input;
  const unconvertible: PlanItemRef[] = [];
  const income = new Tally(table, display, unconvertible);
  const outgo = new Tally(table, display, unconvertible);
  const essential = new Tally(table, display, unconvertible);
  for (const s of input.sources)
    if (isActiveOn(s, today)) income.add(netMonthly(s), { kind: 'source', id: s.id, name: s.name });
  for (const e of input.expenses) {
    if (!isActiveOn(e, today)) continue;
    const ref: PlanItemRef = { kind: 'expense', id: e.id, name: e.name };
    outgo.add(monthlyAmount(e), ref);
    if (e.isEssential) essential.add(monthlyAmount(e), ref);
  }
  for (const b of input.budgets)
    if (isActiveOn(b, today)) outgo.add(b.monthlyLimit, { kind: 'budget', id: b.id, name: b.name });
  return {
    netIncome: income.total,
    plannedOutgo: outgo.total,
    essential: essential.total,
    remainder: income.total.subtract(outgo.total)._unsafeUnwrap(),
    unconvertible,
  };
}

export interface UpcomingEvent {
  date: IsoDate;
  kind: 'payout' | 'expense';
  refId: string;
  name: string;
  /** In its own currency; the screen converts for display. */
  amount: Money;
}

/**
 * Expected payouts and expense charges for `days` calendar days starting
 * today (today included). Sorted by date, payouts before expenses on the same
 * day, then by name.
 */
export function upcomingEvents(input: {
  sources: readonly IncomeSource[];
  expenses: readonly Expense[];
  today: IsoDate;
  days?: number;
}): UpcomingEvent[] {
  const { today, days = 30 } = input;
  const to = addDays(today, days - 1);
  const events: UpcomingEvent[] = [];
  for (const s of input.sources)
    for (const p of payoutsBetween(s, today, to))
      events.push({
        date: p.date,
        kind: 'payout',
        refId: s.id,
        name: s.name,
        amount: p.amount,
      });
  for (const e of input.expenses)
    for (const o of occurrencesBetween(e, today, to))
      events.push({
        date: o.date,
        kind: 'expense',
        refId: e.id,
        name: e.name,
        amount: o.amount,
      });
  const kindOrder = { payout: 0, expense: 1 } as const;
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      kindOrder[a.kind] - kindOrder[b.kind] ||
      a.name.localeCompare(b.name),
  );
}

export interface InflowsVsPlanRow {
  sourceId: string;
  name: string;
  /** Both in the display currency. */
  expected: Money;
  received: Money;
}
export interface InflowsVsPlan {
  rows: InflowsVsPlanRow[];
  totalExpected: Money;
  totalReceived: Money;
  unconvertible: PlanItemRef[];
}

/**
 * What each source was expected to bring in a month against what actually
 * came. A source gets a row when it is active on any day of the month or
 * received money in it — an ended source that still paid is not hidden.
 * `received` sums the Inflows' own amounts converted with the given table
 * (today's rates; historical conversion is phase 5 analytics). Inflows whose
 * source is not in `sources` are ignored, so callers pass every source, ended
 * ones included.
 */
export function inflowsVsPlan(input: {
  sources: readonly IncomeSource[];
  inflows: readonly Inflow[];
  month: YearMonth;
  table: RateTable;
  display: Currency;
}): InflowsVsPlan {
  const { table, display, month } = input;
  const first = toIso(month.year, month.month, 1);
  const last = lastOfMonth(first);
  const unconvertible: PlanItemRef[] = [];
  const totalExpected = new Tally(table, display, unconvertible);
  const totalReceived = new Tally(table, display, unconvertible);
  const inMonth = input.inflows.filter((i) => i.receivedOn >= first && i.receivedOn <= last);
  const rows: InflowsVsPlanRow[] = [];
  for (const s of input.sources) {
    const mine = inMonth.filter((i) => i.incomeSourceId === s.id);
    const active = isActiveWithin(s, first, last);
    if (!active && mine.length === 0) continue;
    const expected = active
      ? totalExpected.add(netMonthly(s), {
          kind: 'source',
          id: s.id,
          name: s.name,
        })
      : null;
    let received = Money.zero(display);
    for (const i of mine) {
      const converted = totalReceived.add(i.amount, {
        kind: 'inflow',
        id: i.id,
        name: s.name,
      });
      if (converted) received = received.add(converted)._unsafeUnwrap();
    }
    rows.push({
      sourceId: s.id,
      name: s.name,
      expected: expected ?? Money.zero(display),
      received,
    });
  }
  return {
    rows,
    totalExpected: totalExpected.total,
    totalReceived: totalReceived.total,
    unconvertible,
  };
}
```

In `packages/domain/src/index.ts` add after `export * from './read-models.js';`:

```ts
export * from './plan-read-models.js';
```

The finished `packages/domain/src/index.ts`:

```ts
export * from './errors.js';
export * from './currency.js';
export * from './money.js';
export { default as Decimal } from 'decimal.js';
export * from './rate.js';
export * from './rate-table.js';
export * from './clock.js';
export * from './calendar.js';
export * from './active-period.js';
export * from './income-source.js';
export * from './inflow.js';
export * from './expense.js';
export * from './budget.js';
export * from './account.js';
export * from './transfer.js';
export * from './read-models.js';
export * from './plan-read-models.js';
```

- [ ] **Step 4: Run the full check**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: all green; `packages/domain` coverage stays at 100 % on lines, functions, branches and statements (the threshold fails the run otherwise).

- [ ] **Step 5: Commit**

Commit with the `/git-commit` skill; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

```bash
git add packages/domain/src/plan-read-models.ts packages/domain/src/index.ts packages/domain/test/plan-read-models.test.ts packages/domain/test/plan-read-models.property.test.ts
git commit -m "feat(domain): add month plan, upcoming events and inflows-vs-plan read models"
```

---

### Task 6: Contracts — phase 3 DTOs

**Files:**

- Create: `packages/contracts/src/income-source.ts`, `packages/contracts/src/inflow.ts`, `packages/contracts/src/expense.ts`, `packages/contracts/src/budget.ts`
- Modify: `packages/contracts/src/common.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/phase3.test.ts`

**Interfaces:**

- Consumes: `EXPENSE_PERIODS` from `@magermoney/domain` (Task 4); existing `DecimalString`, `IsoDateSchema`, `CurrencyCodeSchema` from `common.ts`. `IdParamSchema` (in `account.ts`) is reused by the API routes as is.
- Produces: every schema and type listed under "`packages/contracts` (Task 6)" in the header, plus the helpers `NonNegativeDecimalString`, `PositiveDecimalString`, `FractionString` (in `common.ts`), `PayDaysSchema`, `ExpensePeriodSchema`, `endsAfterItStarts`, `ACTIVE_PERIOD_MESSAGE`.

Design notes:

- Defaults (`taxRate`, `commissionRate` = `'0'`, `payDays` = `[]`, `isPrimary`, `isEssential` = `false`) live only on the create schemas; the update schemas are built from default-free field maps so `.partial()` injects nothing (the phase 2 `isSpending` lesson).
- Rates are decimal strings in `[0, 1)`, checked by regex — no float parsing.
- `activeFrom` is optional on the three create schemas (source, expense, budget); the use case fills `clock.today()`. It stays a plain optional, not a zod default: a schema cannot know today's date.
- These schemas answer 400 `VALIDATION` through the app's `defaultHook` before any use case runs. The use cases in Tasks 8–12 repeat the range checks with their own lowercase codes for callers that bypass zod (the import, merged PATCH rows); an API test may assert such a code only when its payload passes these schemas.
- `InflowsQuerySchema` has its own cursor (`YYYY-MM-DD|uuid`): `CursorQuerySchema` expects a timestamp and `receivedOn` is a date. `limit` follows the same 1–200, default 50 rule.
- Cross-field rules on an update hold when the other field is absent from the payload (`billingMonth` without `period`, `activeTo` without `activeFrom`); the use case re-checks them against the stored row (Tasks 8, 11, 12).
- `UpdateInflowInput.accountId: null` removes the credit; `creditedAmount` together with `accountId: null` is refused.

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/phase3.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BudgetInputSchema,
  CreateInflowInputSchema,
  ExpenseCategoryInputSchema,
  ExpenseInputSchema,
  FractionString,
  IncomeSourceInputSchema,
  InflowsQuerySchema,
  NonNegativeDecimalString,
  PositiveDecimalString,
  UpdateBudgetInputSchema,
  UpdateExpenseCategoryInputSchema,
  UpdateExpenseInputSchema,
  UpdateIncomeSourceInputSchema,
  UpdateInflowInputSchema,
} from '../src/index.js';

const ID = '3f2b8c1e-5a4d-4e6f-8a9b-0c1d2e3f4a5b';
const OTHER_ID = '7a1c9e2d-3b4f-4a5c-9d8e-1f2a3b4c5d6e';

describe('decimal refinements', () => {
  it('NonNegativeDecimalString allows zero and refuses a minus', () => {
    expect(NonNegativeDecimalString.safeParse('0').success).toBe(true);
    expect(NonNegativeDecimalString.safeParse('12.50').success).toBe(true);
    expect(NonNegativeDecimalString.safeParse('-0.01').success).toBe(false);
  });
  it('PositiveDecimalString refuses zero in any spelling', () => {
    expect(PositiveDecimalString.safeParse('0.01').success).toBe(true);
    expect(PositiveDecimalString.safeParse('0').success).toBe(false);
    expect(PositiveDecimalString.safeParse('0.00').success).toBe(false);
    expect(PositiveDecimalString.safeParse('-5').success).toBe(false);
  });
  it('FractionString is at least 0 and less than 1', () => {
    expect(FractionString.safeParse('0').success).toBe(true);
    expect(FractionString.safeParse('0.15').success).toBe(true);
    expect(FractionString.safeParse('1').success).toBe(false);
    expect(FractionString.safeParse('1.5').success).toBe(false);
    expect(FractionString.safeParse('-0.1').success).toBe(false);
  });
});

describe('income source contracts', () => {
  const base = {
    name: 'Acme Salary',
    grossAmount: '4200',
    currency: 'USD',
    activeFrom: '2025-01-01',
  };
  it('fills the defaults of a minimal source', () => {
    expect(IncomeSourceInputSchema.parse(base)).toEqual({
      ...base,
      taxRate: '0',
      commissionRate: '0',
      payDays: [],
      isPrimary: false,
    });
  });
  it('leaves activeFrom to the use case when it is missing', () => {
    const noStart = { name: base.name, grossAmount: base.grossAmount, currency: base.currency };
    expect(IncomeSourceInputSchema.parse(noStart).activeFrom).toBeUndefined();
  });
  it('accepts a full source', () => {
    const r = IncomeSourceInputSchema.safeParse({
      ...base,
      taxRate: '0.15',
      commissionRate: '0.10',
      payDays: [10, 25],
      isPrimary: true,
      activeTo: '2026-12-31',
      defaultAccountId: ID,
    });
    expect(r.success).toBe(true);
  });
  it('refuses repeated or impossible pay days, a rate of 1, a negative gross and an end before the start', () => {
    expect(IncomeSourceInputSchema.safeParse({ ...base, payDays: [10, 10] }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, payDays: [0] }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, payDays: [32] }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, payDays: [1.5] }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, taxRate: '1' }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, grossAmount: '-1' }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, activeTo: '2024-12-31' }).success).toBe(
      false,
    );
  });
  it('a partial update injects no defaults and may end the source', () => {
    expect(UpdateIncomeSourceInputSchema.parse({ activeTo: '2026-09-30' })).toEqual({
      activeTo: '2026-09-30',
    });
    expect(UpdateIncomeSourceInputSchema.parse({ activeTo: null })).toEqual({
      activeTo: null,
    });
    expect(
      UpdateIncomeSourceInputSchema.safeParse({
        activeFrom: '2026-10-01',
        activeTo: '2026-09-30',
      }).success,
    ).toBe(false);
  });
});

describe('inflow contracts', () => {
  const base = { incomeSourceId: ID, amount: '4200' };
  it('accepts a bare inflow and a credited one', () => {
    expect(CreateInflowInputSchema.parse(base)).toEqual(base);
    expect(
      CreateInflowInputSchema.safeParse({
        ...base,
        currency: 'USD',
        receivedOn: '2026-09-04',
        realisedRateToUsd: '0.0125',
        accountId: OTHER_ID,
        creditedAmount: '3864.20',
        note: 'September',
      }).success,
    ).toBe(true);
  });
  it('refuses a zero amount, a credited amount without an account and a timestamp for a date', () => {
    expect(CreateInflowInputSchema.safeParse({ ...base, amount: '0' }).success).toBe(false);
    expect(CreateInflowInputSchema.safeParse({ ...base, creditedAmount: '10' }).success).toBe(
      false,
    );
    expect(
      CreateInflowInputSchema.safeParse({
        ...base,
        receivedOn: '2026-09-04T10:00:00Z',
      }).success,
    ).toBe(false);
  });
  it('an update may drop the credit with accountId null, but not while naming a credited amount', () => {
    expect(UpdateInflowInputSchema.parse({ accountId: null })).toEqual({
      accountId: null,
    });
    expect(UpdateInflowInputSchema.parse({ creditedAmount: '12.5' })).toEqual({
      creditedAmount: '12.5',
    });
    expect(
      UpdateInflowInputSchema.safeParse({
        accountId: null,
        creditedAmount: '12.5',
      }).success,
    ).toBe(false);
  });
  it('coerces the list limit and takes a date cursor', () => {
    expect(InflowsQuerySchema.parse({}).limit).toBe(50);
    expect(
      InflowsQuerySchema.parse({
        limit: '20',
        from: '2026-09-01',
        to: '2026-09-30',
        sourceId: ID,
      }),
    ).toEqual({
      limit: 20,
      from: '2026-09-01',
      to: '2026-09-30',
      sourceId: ID,
    });
    expect(InflowsQuerySchema.safeParse({ before: `2026-09-04|${ID}` }).success).toBe(true);
    expect(InflowsQuerySchema.safeParse({ before: `2026-09-04T00:00:00Z|${ID}` }).success).toBe(
      false,
    );
    expect(InflowsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('expense contracts', () => {
  const base = {
    name: 'Rent',
    amount: '900',
    currency: 'EUR',
    period: 'monthly',
    activeFrom: '2025-01-01',
  };
  it('needs exactly one of categoryId and categoryName', () => {
    expect(ExpenseInputSchema.safeParse({ ...base, categoryId: ID }).success).toBe(true);
    expect(ExpenseInputSchema.safeParse({ ...base, categoryName: 'Housing' }).success).toBe(true);
    expect(ExpenseInputSchema.safeParse(base).success).toBe(false);
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        categoryName: 'Housing',
      }).success,
    ).toBe(false);
  });
  it('defaults isEssential to false', () => {
    expect(ExpenseInputSchema.parse({ ...base, categoryId: ID }).isEssential).toBe(false);
  });
  it('allows a billing month only on a yearly expense', () => {
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        billingDay: 5,
        billingMonth: 3,
      }).success,
    ).toBe(false);
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        period: 'yearly',
        billingDay: 15,
        billingMonth: 1,
      }).success,
    ).toBe(true);
    expect(ExpenseInputSchema.safeParse({ ...base, categoryId: ID, billingDay: 32 }).success).toBe(
      false,
    );
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        period: 'yearly',
        billingMonth: 13,
      }).success,
    ).toBe(false);
  });
  it('refuses a negative amount, an unknown period and an end before the start', () => {
    expect(ExpenseInputSchema.safeParse({ ...base, categoryId: ID, amount: '-1' }).success).toBe(
      false,
    );
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        period: 'weekly',
      }).success,
    ).toBe(false);
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        activeTo: '2024-01-01',
      }).success,
    ).toBe(false);
  });
  it('a partial update injects no defaults and leaves the merged checks to the use case', () => {
    expect(UpdateExpenseInputSchema.parse({ isEssential: true })).toEqual({
      isEssential: true,
    });
    expect(UpdateExpenseInputSchema.safeParse({ billingMonth: 3 }).success).toBe(true);
    expect(UpdateExpenseInputSchema.safeParse({ period: 'monthly', billingMonth: 3 }).success).toBe(
      false,
    );
    expect(
      UpdateExpenseInputSchema.safeParse({
        categoryId: ID,
        categoryName: 'Housing',
      }).success,
    ).toBe(false);
  });
  it('validates categories', () => {
    expect(ExpenseCategoryInputSchema.parse({ name: '  Housing ' })).toEqual({
      name: 'Housing',
    });
    expect(ExpenseCategoryInputSchema.safeParse({ name: '' }).success).toBe(false);
    expect(UpdateExpenseCategoryInputSchema.parse({ sortOrder: 2 })).toEqual({
      sortOrder: 2,
    });
  });
});

describe('budget contracts', () => {
  const base = {
    name: 'Groceries',
    monthlyLimit: '600',
    currency: 'EUR',
    activeFrom: '2026-09-01',
  };
  it('accepts a budget and refuses a negative limit', () => {
    expect(BudgetInputSchema.safeParse({ ...base, icon: 'lucide:shopping-basket' }).success).toBe(
      true,
    );
    expect(BudgetInputSchema.safeParse({ ...base, monthlyLimit: '-1' }).success).toBe(false);
    expect(BudgetInputSchema.safeParse({ ...base, activeTo: '2026-08-31' }).success).toBe(false);
  });
  it('a partial update injects no defaults', () => {
    expect(UpdateBudgetInputSchema.parse({ monthlyLimit: '750' })).toEqual({
      monthlyLimit: '750',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run --filter @magermoney/contracts test`
Expected: FAIL — `IncomeSourceInputSchema` and the other phase 3 schemas are not exported.

- [ ] **Step 3: Write the implementation**

Append to `packages/contracts/src/common.ts`:

```ts
/** Amounts that may be zero but never negative: a gross amount, an expense, a budget limit. */
export const NonNegativeDecimalString = DecimalString.refine((v) => !v.startsWith('-'), {
  message: 'must not be negative',
});
/** Amounts that must be greater than zero: an inflow, a realised rate. */
export const PositiveDecimalString = DecimalString.refine((v) => /^(?!-)(?=.*[1-9])/.test(v), {
  message: 'must be greater than zero',
});
/** A share such as a tax or commission rate: 0 ≤ value < 1, as a decimal string. */
export const FractionString = DecimalString.refine((v) => /^0(\.\d+)?$/.test(v), {
  message: 'must be at least 0 and less than 1',
}).openapi({ example: '0.15' });
```

`packages/contracts/src/income-source.ts`:

```ts
import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  FractionString,
  IsoDateSchema,
  NonNegativeDecimalString,
} from './common.js';

export const PayDaysSchema = z
  .array(z.number().int().min(1).max(31))
  .max(31)
  .refine((days) => new Set(days).size === days.length, {
    message: 'pay days must be unique',
  })
  .openapi({ example: [10, 25] });

export const IncomeSourceDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    grossAmount: DecimalString,
    currency: CurrencyCodeSchema,
    taxRate: DecimalString,
    commissionRate: DecimalString,
    payDays: z.array(z.number().int()),
    isPrimary: z.boolean(),
    activeFrom: IsoDateSchema,
    activeTo: IsoDateSchema.nullable(),
    defaultAccountId: z.uuid().nullable(),
    /** gross × (1 − tax) × (1 − commission), rounded to the currency scale. Derived on read. */
    netMonthly: DecimalString,
  })
  .openapi('IncomeSource');
export type IncomeSourceDto = z.infer<typeof IncomeSourceDtoSchema>;

// No defaults in here: `.partial()` would inject them into an update.
const incomeSourceFields = {
  name: z.string().trim().min(1).max(80),
  grossAmount: NonNegativeDecimalString,
  currency: CurrencyCodeSchema,
  taxRate: FractionString,
  commissionRate: FractionString,
  payDays: PayDaysSchema,
  isPrimary: z.boolean(),
  /** Defaults to today in the use case. */
  activeFrom: IsoDateSchema.optional(),
  activeTo: IsoDateSchema.nullable().optional(),
  defaultAccountId: z.uuid().nullable().optional(),
};

/** Holds when either end is missing; the use case checks again against the stored row. */
export const endsAfterItStarts = (v: {
  activeFrom?: string | undefined;
  activeTo?: string | null | undefined;
}) => !v.activeFrom || !v.activeTo || v.activeTo >= v.activeFrom;
export const ACTIVE_PERIOD_MESSAGE = {
  message: 'activeTo must not be before activeFrom',
  path: ['activeTo'],
};

export const IncomeSourceInputSchema = z
  .object({
    ...incomeSourceFields,
    taxRate: FractionString.default('0'),
    commissionRate: FractionString.default('0'),
    payDays: PayDaysSchema.default([]),
    isPrimary: z.boolean().default(false),
  })
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('IncomeSourceInput');
export type IncomeSourceInput = z.infer<typeof IncomeSourceInputSchema>;

export const UpdateIncomeSourceInputSchema = z
  .object(incomeSourceFields)
  .partial()
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('UpdateIncomeSourceInput');
export type UpdateIncomeSourceInput = z.infer<typeof UpdateIncomeSourceInputSchema>;
```

`packages/contracts/src/inflow.ts`:

```ts
import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  PositiveDecimalString,
} from './common.js';

export const InflowDtoSchema = z
  .object({
    id: z.uuid(),
    incomeSourceId: z.uuid(),
    amount: DecimalString,
    currency: CurrencyCodeSchema,
    receivedOn: IsoDateSchema,
    realisedRateToUsd: DecimalString.nullable(),
    accountId: z.uuid().nullable(),
    /** What landed on the Account, in the Account's currency; null when the Inflow is not credited. */
    creditedAmount: DecimalString.nullable(),
    /** creditedAmount / amount when the Account holds another currency, else null. */
    realisedRate: DecimalString.nullable(),
    note: z.string().nullable(),
  })
  .openapi('Inflow');
export type InflowDto = z.infer<typeof InflowDtoSchema>;

const inflowFields = {
  incomeSourceId: z.uuid(),
  amount: PositiveDecimalString,
  /** Defaults to the source's currency. */
  currency: CurrencyCodeSchema.optional(),
  /** Defaults to today. */
  receivedOn: IsoDateSchema.optional(),
  realisedRateToUsd: PositiveDecimalString.nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
};

const creditNeedsAccount = (v: {
  accountId?: string | null | undefined;
  creditedAmount?: string | null | undefined;
}) => v.creditedAmount == null || v.accountId !== null;
const CREDIT_MESSAGE = {
  message: 'creditedAmount requires accountId',
  path: ['creditedAmount'],
};

export const CreateInflowInputSchema = z
  .object({
    ...inflowFields,
    accountId: z.uuid().optional(),
    creditedAmount: PositiveDecimalString.optional(),
  })
  .refine((v) => v.creditedAmount === undefined || v.accountId !== undefined, CREDIT_MESSAGE)
  .openapi('CreateInflowInput');
export type CreateInflowInput = z.infer<typeof CreateInflowInputSchema>;

/** `accountId: null` removes the credit; leaving it out keeps the Account as it is. */
export const UpdateInflowInputSchema = z
  .object({
    ...inflowFields,
    accountId: z.uuid().nullable(),
    creditedAmount: PositiveDecimalString.nullable(),
  })
  .partial()
  .refine(creditNeedsAccount, CREDIT_MESSAGE)
  .openapi('UpdateInflowInput');
export type UpdateInflowInput = z.infer<typeof UpdateInflowInputSchema>;

/** Cursor = `${receivedOn}|${id}` of the last row seen; rows strictly older come next. */
export const InflowsQuerySchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  sourceId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}\|[0-9a-f-]{36}$/)
    .optional(),
});
export type InflowsQuery = z.infer<typeof InflowsQuerySchema>;
```

`packages/contracts/src/expense.ts`:

```ts
import { z } from '@hono/zod-openapi';
import { EXPENSE_PERIODS } from '@magermoney/domain';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  NonNegativeDecimalString,
} from './common.js';
import { ACTIVE_PERIOD_MESSAGE, endsAfterItStarts } from './income-source.js';

export const ExpensePeriodSchema = z.enum(EXPENSE_PERIODS);

export const ExpenseCategoryDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    icon: z.string().nullable(),
    sortOrder: z.number().int(),
  })
  .openapi('ExpenseCategory');
export type ExpenseCategoryDto = z.infer<typeof ExpenseCategoryDtoSchema>;

const categoryFields = {
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(80).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
};
export const ExpenseCategoryInputSchema = z.object(categoryFields).openapi('ExpenseCategoryInput');
export type ExpenseCategoryInput = z.infer<typeof ExpenseCategoryInputSchema>;
export const UpdateExpenseCategoryInputSchema = z
  .object(categoryFields)
  .partial()
  .openapi('UpdateExpenseCategoryInput');
export type UpdateExpenseCategoryInput = z.infer<typeof UpdateExpenseCategoryInputSchema>;

export const ExpenseDtoSchema = z
  .object({
    id: z.uuid(),
    categoryId: z.uuid(),
    name: z.string(),
    amount: DecimalString,
    currency: CurrencyCodeSchema,
    period: ExpensePeriodSchema,
    billingDay: z.number().int().nullable(),
    billingMonth: z.number().int().nullable(),
    isEssential: z.boolean(),
    activeFrom: IsoDateSchema,
    activeTo: IsoDateSchema.nullable(),
  })
  .openapi('Expense');
export type ExpenseDto = z.infer<typeof ExpenseDtoSchema>;

const expenseFields = {
  /** An existing category… */
  categoryId: z.uuid().optional(),
  /** …or a name: an unknown one is created together with the expense. */
  categoryName: z.string().trim().min(1).max(60).optional(),
  name: z.string().trim().min(1).max(80),
  amount: NonNegativeDecimalString,
  currency: CurrencyCodeSchema,
  period: ExpensePeriodSchema,
  billingDay: z.number().int().min(1).max(31).nullable().optional(),
  billingMonth: z.number().int().min(1).max(12).nullable().optional(),
  isEssential: z.boolean(),
  /** Defaults to today in the use case. */
  activeFrom: IsoDateSchema.optional(),
  activeTo: IsoDateSchema.nullable().optional(),
};

/** Holds when the period is not in the payload; the use case checks again against the stored row. */
const billingMonthOnlyYearly = (v: {
  period?: string | undefined;
  billingMonth?: number | null | undefined;
}) => v.billingMonth == null || v.period === undefined || v.period === 'yearly';
const BILLING_MONTH_MESSAGE = {
  message: 'billingMonth requires period=yearly',
  path: ['billingMonth'],
};
const notBothCategories = (v: {
  categoryId?: string | undefined;
  categoryName?: string | undefined;
}) => v.categoryId === undefined || v.categoryName === undefined;
const CATEGORY_MESSAGE = {
  message: 'give exactly one of categoryId and categoryName',
  path: ['categoryId'],
};

export const ExpenseInputSchema = z
  .object({ ...expenseFields, isEssential: z.boolean().default(false) })
  .refine(
    (v) => notBothCategories(v) && (v.categoryId !== undefined || v.categoryName !== undefined),
    CATEGORY_MESSAGE,
  )
  .refine(billingMonthOnlyYearly, BILLING_MONTH_MESSAGE)
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('ExpenseInput');
export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;

export const UpdateExpenseInputSchema = z
  .object(expenseFields)
  .partial()
  .refine(notBothCategories, CATEGORY_MESSAGE)
  .refine(billingMonthOnlyYearly, BILLING_MONTH_MESSAGE)
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('UpdateExpenseInput');
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInputSchema>;
```

`packages/contracts/src/budget.ts`:

```ts
import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  NonNegativeDecimalString,
} from './common.js';
import { ACTIVE_PERIOD_MESSAGE, endsAfterItStarts } from './income-source.js';

export const BudgetDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    icon: z.string().nullable(),
    monthlyLimit: DecimalString,
    currency: CurrencyCodeSchema,
    activeFrom: IsoDateSchema,
    activeTo: IsoDateSchema.nullable(),
  })
  .openapi('Budget');
export type BudgetDto = z.infer<typeof BudgetDtoSchema>;

const budgetFields = {
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(80).nullable().optional(),
  monthlyLimit: NonNegativeDecimalString,
  currency: CurrencyCodeSchema,
  /** Defaults to today in the use case. */
  activeFrom: IsoDateSchema.optional(),
  activeTo: IsoDateSchema.nullable().optional(),
};

export const BudgetInputSchema = z
  .object(budgetFields)
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('BudgetInput');
export type BudgetInput = z.infer<typeof BudgetInputSchema>;

export const UpdateBudgetInputSchema = z
  .object(budgetFields)
  .partial()
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('UpdateBudgetInput');
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetInputSchema>;
```

Append to `packages/contracts/src/index.ts`:

```ts
export * from './income-source.js';
export * from './inflow.js';
export * from './expense.js';
export * from './budget.js';
```

- [ ] **Step 4: Run the full check**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: all green.

- [ ] **Step 5: Commit**

Commit with the `/git-commit` skill; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

```bash
git add packages/contracts/src packages/contracts/test/phase3.test.ts
git commit -m "feat(contracts): add income, inflow, expense and budget schemas"
```

### Task 7: Database — migrations 0007–0011 and schema.dbml

**Files:**

- Create: `supabase/migrations/20260917000007_income_sources.sql`, `supabase/migrations/20260917000008_inflows.sql`, `supabase/migrations/20260917000009_balance_entries_inflow.sql`, `supabase/migrations/20260917000010_expenses.sql`, `supabase/migrations/20260917000011_budgets.sql`
- Modify: `docs/db/schema.dbml`
- Test: `apps/api/test/integration/pg-phase3-schema.test.ts` (runs in the API integration job; RLS isolation is covered later by Task 13)

**Interfaces:**

- Consumes: phase 1–2 tables `profiles`, `currencies`, `accounts`, `balance_entries`; the trigger function `public.set_updated_at()`; the enum value `balance_entry_origin.inflow` (already exists).
- Produces: tables `income_sources`, `inflows`, `expense_categories`, `expenses`, `budgets`; enum `expense_period`; column `balance_entries.inflow_id` with `check ((origin = 'inflow') = (inflow_id is not null))`; partial unique index "one primary source per user"; `inflows.account_id … on delete restrict` (an Account with credited Inflows cannot be deleted); `income_sources.default_account_id … on delete set null`.

- [ ] **Step 1: Write the failing schema test**

Create `apps/api/test/integration/pg-phase3-schema.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';

const sql = createDb(process.env.DATABASE_URL!);
let uid: string;
let accountId: string;
let sourceId: string;

const source = (over: Record<string, unknown> = {}) => ({
  user_id: uid,
  name: 'Salary',
  gross_amount: '1000',
  currency: 'USD',
  active_from: '2026-01-01',
  ...over,
});
const rejects = (p: Promise<unknown>) => expect(p).rejects.toThrow();

describe('phase 3 schema', () => {
  beforeAll(async () => {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.auth.admin.createUser({
      email: `p3-schema-${Date.now()}@test.local`,
      email_confirm: true,
    });
    uid = data.user!.id;
    const [acc] = await sql<{ id: string }[]>`
      insert into accounts (user_id, name, bank, country, currency, kind)
      values (${uid}, 'Main', 'Bank', 'RU', 'USD', 'bank_account') returning id`;
    accountId = acc!.id;
    const [src] = await sql<{ id: string }[]>`
      insert into income_sources ${sql(source({ pay_days: '{10,25}', is_primary: true }))} returning id`;
    sourceId = src!.id;
  });

  it('income_sources: defaults, pay day range, rate range, period order, one primary', async () => {
    const [row] = await sql<{ payDays: number[]; taxRate: string; isPrimary: boolean }[]>`
      insert into income_sources ${sql(source({ name: 'Side' }))} returning pay_days, tax_rate, is_primary`;
    expect(row).toMatchObject({ payDays: [], taxRate: '0', isPrimary: false });
    await rejects(sql`insert into income_sources ${sql(source({ pay_days: '{0}' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ pay_days: '{32}' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ tax_rate: '1' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ commission_rate: '-0.1' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ gross_amount: '-1' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ active_to: '2025-12-31' }))}`);
    await rejects(
      sql`insert into income_sources ${sql(source({ name: 'Second primary', is_primary: true }))}`,
    );
  });

  it('inflows: positive amount, account and credited amount come together', async () => {
    const inflow = (over: Record<string, unknown> = {}) => ({
      user_id: uid,
      income_source_id: sourceId,
      amount: '100',
      currency: 'USD',
      received_on: '2026-09-10',
      ...over,
    });
    await sql`insert into inflows ${sql(inflow())}`;
    await rejects(sql`insert into inflows ${sql(inflow({ amount: '0' }))}`);
    await rejects(sql`insert into inflows ${sql(inflow({ account_id: accountId }))}`);
    await rejects(sql`insert into inflows ${sql(inflow({ credited_amount: '100' }))}`);
    await rejects(
      sql`insert into inflows ${sql(inflow({ account_id: accountId, credited_amount: '0' }))}`,
    );
    await rejects(sql`insert into inflows ${sql(inflow({ realised_rate_to_usd: '0' }))}`);
    await rejects(sql`delete from income_sources where id = ${sourceId}`);
  });

  it('balance_entries: an inflow entry names its inflow, cascades with it, and pins the account', async () => {
    const [inflow] = await sql<{ id: string }[]>`
      insert into inflows (user_id, income_source_id, amount, currency, received_on, account_id, credited_amount)
      values (${uid}, ${sourceId}, '50', 'USD', '2026-09-11', ${accountId}, '50') returning id`;
    const entry = (over: Record<string, unknown>) => ({
      user_id: uid,
      account_id: accountId,
      amount: '50',
      recorded_at: '2026-09-11T10:00:00.000Z',
      ...over,
    });
    await rejects(sql`insert into balance_entries ${sql(entry({ origin: 'inflow' }))}`);
    await rejects(
      sql`insert into balance_entries ${sql(entry({ origin: 'manual', inflow_id: inflow!.id }))}`,
    );
    await sql`insert into balance_entries ${sql(entry({ origin: 'inflow', inflow_id: inflow!.id }))}`;
    await rejects(sql`delete from accounts where id = ${accountId}`);
    await sql`delete from inflows where id = ${inflow!.id}`;
    const left = await sql`select id from balance_entries where inflow_id = ${inflow!.id}`;
    expect(left).toHaveLength(0);
  });

  it('expenses: category names are unique per user ignoring case; billing month only on yearly', async () => {
    const [cat] = await sql<{ id: string }[]>`
      insert into expense_categories (user_id, name) values (${uid}, 'Housing') returning id`;
    await rejects(sql`insert into expense_categories (user_id, name) values (${uid}, 'housing')`);
    const expense = (over: Record<string, unknown> = {}) => ({
      user_id: uid,
      category_id: cat!.id,
      name: 'Rent',
      amount: '900',
      currency: 'EUR',
      period: 'monthly',
      active_from: '2026-01-01',
      ...over,
    });
    await sql`insert into expenses ${sql(expense({ billing_day: 5 }))}`;
    await sql`insert into expenses ${sql(expense({ name: 'Insurance', period: 'yearly', billing_day: 1, billing_month: 3 }))}`;
    await rejects(sql`insert into expenses ${sql(expense({ billing_month: 3 }))}`);
    await rejects(sql`insert into expenses ${sql(expense({ billing_day: 32 }))}`);
    await rejects(sql`insert into expenses ${sql(expense({ amount: '-1' }))}`);
    await rejects(sql`insert into expenses ${sql(expense({ active_to: '2025-01-01' }))}`);
    await rejects(sql`delete from expense_categories where id = ${cat!.id}`);
  });

  it('budgets: a limit is never negative', async () => {
    const budget = (over: Record<string, unknown> = {}) => ({
      user_id: uid,
      name: 'Groceries',
      monthly_limit: '1000',
      currency: 'EUR',
      active_from: '2026-01-01',
      ...over,
    });
    await sql`insert into budgets ${sql(budget())}`;
    await rejects(sql`insert into budgets ${sql(budget({ monthly_limit: '-1' }))}`);
    await rejects(sql`insert into budgets ${sql(budget({ active_to: '2025-01-01' }))}`);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (local Supabase must be running: `supabase start`): `cd apps/api && eval "$(supabase status -o env)" && DATABASE_URL="$DB_URL" SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_JWT_SECRET="$JWT_SECRET" CRON_SECRET=ci-cron bun run test:integration`
Expected: FAIL — relation `income_sources` does not exist.

- [ ] **Step 3: Write the migrations**

`supabase/migrations/20260917000007_income_sources.sql`:

```sql
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  -- Monthly gross. Net is derived (gross × (1 − tax) × (1 − commission)), never stored.
  gross_amount numeric not null check (gross_amount >= 0),
  currency text not null references public.currencies(code),
  tax_rate numeric not null default 0 check (tax_rate >= 0 and tax_rate < 1),
  commission_rate numeric not null default 0 check (commission_rate >= 0 and commission_rate < 1),
  -- Days of the month; empty = an irregular source that never shows in upcoming events.
  pay_days int[] not null default '{}' check (
    pay_days <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]
  ),
  is_primary boolean not null default false,
  active_from date not null,
  active_to date,
  default_account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_sources_period check (active_to is null or active_to >= active_from)
);

create index income_sources_user_idx on public.income_sources (user_id, active_from);
-- "Days to payday" counts to one source only.
create unique index income_sources_one_primary_idx on public.income_sources (user_id) where is_primary;
create trigger income_sources_updated_at before update on public.income_sources for each row execute procedure public.set_updated_at();

alter table public.income_sources enable row level security;
create policy "income_sources: owner select" on public.income_sources for select to authenticated using (user_id = auth.uid());
create policy "income_sources: owner insert" on public.income_sources for insert to authenticated with check (user_id = auth.uid());
create policy "income_sources: owner update" on public.income_sources for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "income_sources: owner delete" on public.income_sources for delete to authenticated using (user_id = auth.uid());
```

`supabase/migrations/20260917000008_inflows.sql`:

```sql
create table public.inflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  income_source_id uuid not null references public.income_sources(id) on delete restrict,
  amount numeric not null check (amount > 0),
  currency text not null references public.currencies(code),
  received_on date not null,
  realised_rate_to_usd numeric check (realised_rate_to_usd > 0),
  -- Set together: the account the money landed on and how much arrived in that account's currency.
  account_id uuid references public.accounts(id) on delete restrict,
  credited_amount numeric check (credited_amount is null or credited_amount > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inflows_credit_pair check ((account_id is null) = (credited_amount is null))
);

create index inflows_user_idx on public.inflows (user_id, received_on desc, id desc);
create index inflows_source_idx on public.inflows (income_source_id);
create index inflows_account_idx on public.inflows (account_id) where account_id is not null;
create trigger inflows_updated_at before update on public.inflows for each row execute procedure public.set_updated_at();

alter table public.inflows enable row level security;
create policy "inflows: owner select" on public.inflows for select to authenticated using (user_id = auth.uid());
create policy "inflows: owner insert" on public.inflows for insert to authenticated with check (user_id = auth.uid());
create policy "inflows: owner update" on public.inflows for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "inflows: owner delete" on public.inflows for delete to authenticated using (user_id = auth.uid());
```

`supabase/migrations/20260917000009_balance_entries_inflow.sql`:

```sql
-- The 'inflow' value of balance_entry_origin was reserved in phase 2.
alter table public.balance_entries
  add column inflow_id uuid references public.inflows(id) on delete cascade,
  add constraint balance_entries_inflow_origin check ((origin = 'inflow') = (inflow_id is not null));

create index balance_entries_inflow_idx on public.balance_entries (inflow_id) where inflow_id is not null;
```

`supabase/migrations/20260917000010_expenses.sql`:

```sql
create type public.expense_period as enum ('monthly', 'yearly');

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index expense_categories_name_idx on public.expense_categories (user_id, lower(name));
create trigger expense_categories_updated_at before update on public.expense_categories for each row execute procedure public.set_updated_at();

alter table public.expense_categories enable row level security;
create policy "expense_categories: owner select" on public.expense_categories for select to authenticated using (user_id = auth.uid());
create policy "expense_categories: owner insert" on public.expense_categories for insert to authenticated with check (user_id = auth.uid());
create policy "expense_categories: owner update" on public.expense_categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expense_categories: owner delete" on public.expense_categories for delete to authenticated using (user_id = auth.uid());

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  name text not null check (length(name) between 1 and 120),
  amount numeric not null check (amount >= 0),
  currency text not null references public.currencies(code),
  period public.expense_period not null,
  billing_day int check (billing_day between 1 and 31),
  billing_month int check (billing_month between 1 and 12),
  is_essential boolean not null default false,
  active_from date not null,
  active_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_billing_month_yearly check (billing_month is null or period = 'yearly'),
  constraint expenses_period check (active_to is null or active_to >= active_from)
);

create index expenses_user_idx on public.expenses (user_id, category_id);
create trigger expenses_updated_at before update on public.expenses for each row execute procedure public.set_updated_at();

alter table public.expenses enable row level security;
create policy "expenses: owner select" on public.expenses for select to authenticated using (user_id = auth.uid());
create policy "expenses: owner insert" on public.expenses for insert to authenticated with check (user_id = auth.uid());
create policy "expenses: owner update" on public.expenses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses: owner delete" on public.expenses for delete to authenticated using (user_id = auth.uid());
```

`supabase/migrations/20260917000011_budgets.sql`:

```sql
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  icon text,
  monthly_limit numeric not null check (monthly_limit >= 0),
  currency text not null references public.currencies(code),
  active_from date not null,
  active_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_period check (active_to is null or active_to >= active_from)
);

create index budgets_user_idx on public.budgets (user_id, active_from);
create trigger budgets_updated_at before update on public.budgets for each row execute procedure public.set_updated_at();

alter table public.budgets enable row level security;
create policy "budgets: owner select" on public.budgets for select to authenticated using (user_id = auth.uid());
create policy "budgets: owner insert" on public.budgets for insert to authenticated with check (user_id = auth.uid());
create policy "budgets: owner update" on public.budgets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "budgets: owner delete" on public.budgets for delete to authenticated using (user_id = auth.uid());
```

- [ ] **Step 4: Apply and run the integration tests**

Run: `supabase db reset` (from the repo root), then the integration command from Step 2.
Expected: PASS — the five new cases and every phase 1–2 integration test.

- [ ] **Step 5: Update the schema doc**

In `docs/db/schema.dbml`:

- `Table balance_entries`: change the `inflow_id` note to `'phase 3. set exactly when origin = inflow; cascades with the inflow'` and add the index line `(inflow_id) [note: 'partial, where inflow_id is not null']`.
- `Table income_sources`: `gross_amount` note `'monthly; check >= 0'`; `tax_rate` and `commission_rate` notes `'0 <= x < 1'`; `pay_days int[] [not null, default: '{}', note: 'days of month 1..31, e.g. {10,25}; empty = irregular source']`; `is_primary` note `'partial unique index: one primary per user'`; `active_to` note `'check: >= active_from'`; `default_account_id` note `'where inflows usually land; on delete set null'`; add `Indexes { (user_id, active_from) }`.
- `Table inflows`: table note `'phase 3 (history import in phase 5). Actual dated receipts. check: account_id and credited_amount are set together.'`; `income_source_id` note `'on delete restrict'`; `amount` note `'check > 0'`; `account_id` note `'set when credited to an account; on delete restrict'`; add after it `credited_amount numeric [note: 'what landed on the account, in the account currency; realised rate = credited / amount']`; replace the index with `(user_id, received_on, id) [note: 'order by received_on desc, id desc']` and add `(income_source_id)` and `(account_id) [note: 'partial, where account_id is not null']`.
- `Table expense_categories`: add `Indexes { (user_id, name) [unique, note: 'on lower(name)'] }`.
- `Table expenses`: `category_id` note `'on delete restrict'`; `amount` note `'check >= 0'`; `billing_day` note `'day of month 1..31, clamped to the month length; null = no fixed date'`; `billing_month` note `'1..12, yearly only (check)'`; add `Indexes { (user_id, category_id) }`.
- `Table budgets`: `monthly_limit` note `'check >= 0'`; add `Indexes { (user_id, active_from) }`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations apps/api/test/integration/pg-phase3-schema.test.ts docs/db/schema.dbml
git commit -m "feat(db): add income sources, inflows, expenses and budgets"
```

Use the `/git-commit` skill; the message ends with the two trailers from Global Constraints.

---

### Task 8: API — income sources

**Files:**

- Create: `apps/api/src/modules/income-sources/application/income-source-repository.ts`, `…/application/dto.ts`, `…/application/create-income-source.ts`, `…/application/list-income-sources.ts`, `…/application/update-income-source.ts`, `…/application/delete-income-source.ts`, `…/infrastructure/memory-income-source-repository.ts`, `…/infrastructure/pg-income-source-repository.ts`, `…/http/routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/shared/db/pg-unit-of-work.ts`, `apps/api/test/helpers/deps.ts`
- Test: `apps/api/test/income-sources.test.ts`

**Interfaces:**

- Consumes: `netMonthly(s: Pick<IncomeSource, 'grossAmount' | 'taxRate' | 'commissionRate'>): Money`, `Money`, `Decimal`, `CurrencyRegistry`, `Clock`, `UnknownCurrencyError` from `@magermoney/domain` (Task 2); `IncomeSourceDtoSchema`, `IncomeSourceInputSchema`, `UpdateIncomeSourceInputSchema`, `IdParamSchema` and their types from `@magermoney/contracts` (Task 6); table `income_sources` (Task 7); `UnitOfWork<Repos>`, `requireUser`, `ERRORS`, `fail` (phase 2).
- Produces:
  - `IncomeSourceRow = { id, userId, name, grossAmount: string, currency, taxRate: string, commissionRate: string, payDays: number[], isPrimary: boolean, activeFrom: string, activeTo: string | null, defaultAccountId: string | null }`, `NewIncomeSource = Omit<IncomeSourceRow, 'id' | 'userId'>`.
  - `IncomeSourceRepository { list(userId); findById(userId, id); insert(userId, data: NewIncomeSource); update(userId, id, data: NewIncomeSource): Promise<IncomeSourceRow | null>; lockAll(userId): Promise<void>; clearPrimary(userId): Promise<void>; countInflows(userId, id): Promise<number>; delete(userId, id): Promise<'deleted' | 'not_found' | 'has_inflows'> }` — `update` takes the full merged row, not a patch.
  - `MemoryIncomeSourceRepository` with the public hook `inflowCountOf: (sourceId: string) => number` (defaults to `() => 0`; Task 9's `MemoryInflowRepository` sets it).
  - `Repos.incomeSources`, `incomeSourceRoutes(deps: AppDeps)`, `IncomeSourceDeps`, `toIncomeSourceDto(row, registry): IncomeSourceDto`.
  - Routes `GET/POST /income-sources`, `PATCH/DELETE /income-sources/{id}`; error codes `default_account_not_found`, `negative_amount`, `rate_out_of_range`, `pay_days_invalid`, `active_period_invalid` (400), `UNKNOWN_CURRENCY` (400), `source_has_inflows` (409).
  - Reachability: the Task 6 contracts answer 400 `VALIDATION` (the app's `defaultHook`) for a negative gross, a rate outside `[0, 1)`, bad pay days or an inverted period inside ONE payload, so over HTTP `negative_amount`, `rate_out_of_range` and `pay_days_invalid` are defence in depth (the import and the merged row of a PATCH bypass zod) and only `active_period_invalid` is reachable — by a PATCH whose merged row is inverted. Tests assert a lowercase code only where the payload passes the contract. Ledger line for this task: "400 `negative_amount`, `rate_out_of_range`, `pay_days_invalid`, `active_period_invalid` added to the income-sources API beyond spec §4; over HTTP only `active_period_invalid` is reachable (merged PATCH), the rest guard callers that bypass the contracts".

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/income-sources.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { memoryRepos, testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const salary = {
  name: 'Salary',
  grossAmount: '1000',
  currency: 'USD',
  taxRate: '0.15',
  commissionRate: '0.1',
  payDays: [25, 10],
  isPrimary: true,
  activeFrom: '2026-01-01',
};

function setup() {
  const repos = memoryRepos();
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW), repos }));
  return { app, repos };
}
const create = async (app: ReturnType<typeof createApp>, body: object) =>
  authed(app, 'POST', '/income-sources', body);

describe('income sources', () => {
  it('creates a source, sorts its pay days, derives the monthly net and lists it', async () => {
    const { app } = setup();
    const res = await create(app, salary);
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto).toMatchObject({
      name: 'Salary',
      grossAmount: '1000',
      currency: 'USD',
      payDays: [10, 25],
      isPrimary: true,
      activeFrom: '2026-01-01',
      activeTo: null,
      defaultAccountId: null,
      netMonthly: '765',
    });
    expect(dto.userId).toBeUndefined();
    const list = await (await authed(app, 'GET', '/income-sources')).json();
    expect(list).toHaveLength(1);
    expect(await (await authed(app, 'GET', '/income-sources', undefined, OTHER)).json()).toEqual(
      [],
    );
  });

  it('keeps a single primary source and lists it first', async () => {
    const { app } = setup();
    const first = await (await create(app, { ...salary, name: 'B first' })).json();
    const second = await (await create(app, { ...salary, name: 'A second' })).json();
    let list = await (await authed(app, 'GET', '/income-sources')).json();
    expect(list.map((s: { name: string; isPrimary: boolean }) => [s.name, s.isPrimary])).toEqual([
      ['A second', true],
      ['B first', false],
    ]);
    const back = await authed(app, 'PATCH', `/income-sources/${first.id}`, { isPrimary: true });
    expect(back.status).toBe(200);
    list = await (await authed(app, 'GET', '/income-sources')).json();
    expect(
      list.filter((s: { isPrimary: boolean }) => s.isPrimary).map((s: { id: string }) => s.id),
    ).toEqual([first.id]);
    expect(second.isPrimary).toBe(true);
  });

  it('refuses an unknown currency, a foreign default account and a period that ends before it starts', async () => {
    const { app } = setup();
    const unknown = await create(app, { ...salary, currency: 'XYZ' });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).code).toBe('UNKNOWN_CURRENCY');
    const foreign = await create(app, {
      ...salary,
      defaultAccountId: '99999999-9999-4999-8999-999999999999',
    });
    expect(foreign.status).toBe(400);
    expect((await foreign.json()).code).toBe('default_account_not_found');
    expect((await create(app, { ...salary, activeTo: '2025-12-31' })).status).toBe(400);
    expect((await create(app, { ...salary, taxRate: '1' })).status).toBe(400);
    expect((await create(app, { ...salary, payDays: [32] })).status).toBe(400);
    expect((await create(app, { ...salary, grossAmount: '-1' })).status).toBe(400);
  });

  it('starts a source today when no start date is sent', async () => {
    const { app } = setup();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activeFrom: _from, ...noStart } = salary;
    const dto = await (await create(app, noStart)).json();
    expect(dto.activeFrom).toBe('2026-09-11');
  });

  it('accepts the caller’s own account as the default account', async () => {
    const { app } = setup();
    const acc = await (
      await authed(app, 'POST', '/accounts', {
        name: 'Main',
        bank: 'Bank',
        country: 'RU',
        currency: 'USD',
        kind: 'bank_account',
        isSpending: true,
      })
    ).json();
    const dto = await (await create(app, { ...salary, defaultAccountId: acc.id })).json();
    expect(dto.defaultAccountId).toBe(acc.id);
    const cleared = await (
      await authed(app, 'PATCH', `/income-sources/${dto.id}`, { defaultAccountId: null })
    ).json();
    expect(cleared.defaultAccountId).toBeNull();
  });

  it('ends a source through activeTo and keeps the rest of the row', async () => {
    const { app } = setup();
    const dto = await (await create(app, salary)).json();
    const ended = await authed(app, 'PATCH', `/income-sources/${dto.id}`, {
      activeTo: '2026-09-30',
    });
    expect(ended.status).toBe(200);
    expect(await ended.json()).toMatchObject({
      activeTo: '2026-09-30',
      payDays: [10, 25],
      grossAmount: '1000',
    });
    // Only the merged row is inverted, so the contract lets it through and the use case answers.
    const bad = await authed(app, 'PATCH', `/income-sources/${dto.id}`, { activeTo: '2025-01-01' });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('active_period_invalid');
  });

  it('refuses to change the currency or delete a source that has inflows', async () => {
    const { app, repos } = setup();
    const dto = await (await create(app, salary)).json();
    repos.incomeSources.inflowCountOf = (id) => (id === dto.id ? 2 : 0);
    const currency = await authed(app, 'PATCH', `/income-sources/${dto.id}`, { currency: 'EUR' });
    expect(currency.status).toBe(409);
    expect((await currency.json()).code).toBe('source_has_inflows');
    expect(
      (await authed(app, 'PATCH', `/income-sources/${dto.id}`, { name: 'Renamed' })).status,
    ).toBe(200);
    const del = await authed(app, 'DELETE', `/income-sources/${dto.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe('source_has_inflows');
  });

  it('deletes a source without inflows and answers 404 for strangers and unknown ids', async () => {
    const { app } = setup();
    const dto = await (await create(app, salary)).json();
    expect(
      (await authed(app, 'PATCH', `/income-sources/${dto.id}`, { name: 'X' }, OTHER)).status,
    ).toBe(404);
    expect(
      (await authed(app, 'DELETE', `/income-sources/${dto.id}`, undefined, OTHER)).status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', `/income-sources/${dto.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/income-sources/${dto.id}`)).status).toBe(404);
    expect((await authed(app, 'PATCH', `/income-sources/${dto.id}`, { name: 'X' })).status).toBe(
      404,
    );
  });

  it('requires a session', async () => {
    const { app } = setup();
    expect((await app.request('/income-sources')).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && bun run test test/income-sources.test.ts`
Expected: FAIL — `repos.incomeSources` is undefined / `POST /income-sources` answers 404.

- [ ] **Step 3: Repository contract and DTO mapping**

`apps/api/src/modules/income-sources/application/income-source-repository.ts`:

```ts
export interface IncomeSourceRow {
  id: string;
  userId: string;
  name: string;
  /** Monthly gross, decimal string. */
  grossAmount: string;
  currency: string;
  /** Fractions in [0, 1), decimal strings. */
  taxRate: string;
  commissionRate: string;
  /** Days of the month, unique and ascending; empty = irregular source. */
  payDays: number[];
  isPrimary: boolean;
  activeFrom: string; // YYYY-MM-DD
  activeTo: string | null; // YYYY-MM-DD
  defaultAccountId: string | null;
}
export type NewIncomeSource = Omit<IncomeSourceRow, 'id' | 'userId'>;

export interface IncomeSourceRepository {
  /** Primary source first, then by name. */
  list(userId: string): Promise<IncomeSourceRow[]>;
  findById(userId: string, id: string): Promise<IncomeSourceRow | null>;
  insert(userId: string, data: NewIncomeSource): Promise<IncomeSourceRow>;
  /** Full-row update: the use case merges the patch, the repository writes every column. */
  update(userId: string, id: string, data: NewIncomeSource): Promise<IncomeSourceRow | null>;
  /**
   * Serialises every writer that moves the user's primary flag until the unit of work ends.
   * pg takes a transaction-scoped advisory lock (row locks cannot help a user with no rows yet,
   * and under READ COMMITTED a second `clearPrimary` does not see the row the first one just made
   * primary, so without this the loser trips the partial unique index and answers 500).
   */
  lockAll(userId: string): Promise<void>;
  /** Clears the primary flag on every source of the user; called before another one takes it. */
  clearPrimary(userId: string): Promise<void>;
  countInflows(userId: string, id: string): Promise<number>;
  delete(userId: string, id: string): Promise<'deleted' | 'not_found' | 'has_inflows'>;
}
```

`apps/api/src/modules/income-sources/application/dto.ts`:

```ts
import { Decimal, Money, netMonthly, type CurrencyRegistry } from '@magermoney/domain';
import type { IncomeSourceDto } from '@magermoney/contracts';
import type { IncomeSourceRow } from './income-source-repository.js';

/** Net is derived on the way out and never stored. */
export function toIncomeSourceDto(
  row: IncomeSourceRow,
  registry: CurrencyRegistry,
): IncomeSourceDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId: _u, ...rest } = row;
  const currency = registry
    .get(row.currency)
    .unwrapOr({ code: row.currency, kind: 'fiat' as const, scale: 2 });
  const net = netMonthly({
    grossAmount: Money.of(row.grossAmount, currency),
    taxRate: new Decimal(row.taxRate),
    commissionRate: new Decimal(row.commissionRate),
  });
  return { ...rest, netMonthly: net.toString() };
}
```

- [ ] **Step 4: In-memory repository**

`apps/api/src/modules/income-sources/infrastructure/memory-income-source-repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type {
  IncomeSourceRepository,
  IncomeSourceRow,
  NewIncomeSource,
} from '../application/income-source-repository.js';

const primaryThenName = (a: IncomeSourceRow, b: IncomeSourceRow) =>
  Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name);

export class MemoryIncomeSourceRepository implements IncomeSourceRepository {
  public rows: IncomeSourceRow[] = [];
  /** How many inflows name a source; MemoryInflowRepository plugs itself in here. */
  public inflowCountOf: (sourceId: string) => number = () => 0;

  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    return [...this.mine(userId)].sort(primaryThenName);
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewIncomeSource) {
    const row: IncomeSourceRow = { ...data, payDays: [...data.payDays], id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, data: NewIncomeSource) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, data, { payDays: [...data.payDays] });
    return row;
  }
  async lockAll() {
    // One process, one thread: nothing to serialise.
  }
  async clearPrimary(userId: string) {
    for (const r of this.mine(userId)) r.isPrimary = false;
  }
  async countInflows(userId: string, id: string) {
    return (await this.findById(userId, id)) ? this.inflowCountOf(id) : 0;
  }
  async delete(userId: string, id: string) {
    const row = await this.findById(userId, id);
    if (!row) return 'not_found' as const;
    if (this.inflowCountOf(id) > 0) return 'has_inflows' as const;
    this.rows = this.rows.filter((r) => r !== row);
    return 'deleted' as const;
  }
}
```

- [ ] **Step 5: Use cases**

`apps/api/src/modules/income-sources/application/create-income-source.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import {
  Decimal,
  UnknownCurrencyError,
  type Clock,
  type CurrencyRegistry,
} from '@magermoney/domain';
import type { IncomeSourceDto, IncomeSourceInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import { toIncomeSourceDto } from './dto.js';
import type { NewIncomeSource } from './income-source-repository.js';

export interface IncomeSourceDeps {
  /** The primary flag moves between rows, so create and update run inside one transaction. */
  uow: UnitOfWork<Repos>;
  repos: Repos;
  registry: CurrencyRegistry;
  clock: Clock;
}
export type IncomeSourceFailure =
  NotFoundError | ValidationError | ConflictError | UnknownCurrencyError;

const isFraction = (raw: string) => {
  const v = new Decimal(raw);
  return v.gte(0) && v.lt(1);
};

/**
 * The rules the database also enforces, answered as 400s with a code instead
 * of a constraint violation. Pay days come back unique and ascending.
 */
export function validateSource(
  data: NewIncomeSource,
  registry: CurrencyRegistry,
): Result<NewIncomeSource, ValidationError | UnknownCurrencyError> {
  if (!registry.has(data.currency)) return err(new UnknownCurrencyError(data.currency));
  if (new Decimal(data.grossAmount).isNegative())
    return err(new ValidationError('The gross amount cannot be negative', 'negative_amount'));
  if (!isFraction(data.taxRate) || !isFraction(data.commissionRate))
    return err(
      new ValidationError('Tax and commission are fractions from 0 up to 1', 'rate_out_of_range'),
    );
  if (data.payDays.some((d) => !Number.isInteger(d) || d < 1 || d > 31))
    return err(new ValidationError('Pay days are days of the month, 1 to 31', 'pay_days_invalid'));
  if (data.activeTo !== null && data.activeTo < data.activeFrom)
    return err(
      new ValidationError('The active period cannot end before it starts', 'active_period_invalid'),
    );
  return ok({ ...data, payDays: [...new Set(data.payDays)].sort((a, b) => a - b) });
}

export async function assertDefaultAccount(
  repos: Pick<Repos, 'accounts'>,
  userId: string,
  accountId: string | null,
): Promise<Result<void, ValidationError>> {
  if (accountId !== null && !(await repos.accounts.findById(userId, accountId)))
    return err(
      new ValidationError('The default account was not found', 'default_account_not_found'),
    );
  return ok(undefined);
}

const toNew = (input: IncomeSourceInput, today: string): NewIncomeSource => ({
  name: input.name,
  grossAmount: input.grossAmount,
  currency: input.currency,
  taxRate: input.taxRate ?? '0',
  commissionRate: input.commissionRate ?? '0',
  payDays: input.payDays ?? [],
  isPrimary: input.isPrimary ?? false,
  // Optional in the contract: a source added without a start date starts today.
  activeFrom: input.activeFrom ?? today,
  activeTo: input.activeTo ?? null,
  defaultAccountId: input.defaultAccountId ?? null,
});

export const createIncomeSource =
  (deps: IncomeSourceDeps) =>
  (
    userId: string,
    input: IncomeSourceInput,
  ): Promise<Result<IncomeSourceDto, IncomeSourceFailure>> =>
    deps.uow(async (repos) => {
      // First statement of the transaction: two writers claiming the primary flag queue up here.
      if (input.isPrimary === true) await repos.incomeSources.lockAll(userId);
      const data = validateSource(toNew(input, deps.clock.today()), deps.registry);
      if (data.isErr()) return err(data.error);
      const account = await assertDefaultAccount(repos, userId, data.value.defaultAccountId);
      if (account.isErr()) return err(account.error);
      if (data.value.isPrimary) await repos.incomeSources.clearPrimary(userId);
      const row = await repos.incomeSources.insert(userId, data.value);
      return ok(toIncomeSourceDto(row, deps.registry));
    });
```

`apps/api/src/modules/income-sources/application/list-income-sources.ts`:

```ts
import type { IncomeSourceDto } from '@magermoney/contracts';
import type { IncomeSourceDeps } from './create-income-source.js';
import { toIncomeSourceDto } from './dto.js';

/** Ended sources are included: history keeps referring to them. */
export const listIncomeSources =
  (deps: IncomeSourceDeps) =>
  async (userId: string): Promise<IncomeSourceDto[]> =>
    (await deps.repos.incomeSources.list(userId)).map((r) => toIncomeSourceDto(r, deps.registry));
```

`apps/api/src/modules/income-sources/application/update-income-source.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { IncomeSourceDto, UpdateIncomeSourceInput } from '@magermoney/contracts';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import {
  assertDefaultAccount,
  validateSource,
  type IncomeSourceDeps,
  type IncomeSourceFailure,
} from './create-income-source.js';
import { toIncomeSourceDto } from './dto.js';
import type { NewIncomeSource } from './income-source-repository.js';

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

export const updateIncomeSource =
  (deps: IncomeSourceDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateIncomeSourceInput,
  ): Promise<Result<IncomeSourceDto, IncomeSourceFailure>> =>
    deps.uow(async (repos) => {
      // Before the read, so `current.isPrimary` is what the previous claimant committed.
      if (input.isPrimary === true) await repos.incomeSources.lockAll(userId);
      const current = await repos.incomeSources.findById(userId, id);
      if (!current) return err(new NotFoundError('income source'));
      const merged: NewIncomeSource = {
        name: pick(input.name, current.name),
        grossAmount: pick(input.grossAmount, current.grossAmount),
        currency: pick(input.currency, current.currency),
        taxRate: pick(input.taxRate, current.taxRate),
        commissionRate: pick(input.commissionRate, current.commissionRate),
        payDays: pick(input.payDays, current.payDays),
        isPrimary: pick(input.isPrimary, current.isPrimary),
        activeFrom: pick(input.activeFrom, current.activeFrom),
        activeTo: pick(input.activeTo, current.activeTo),
        defaultAccountId: pick(input.defaultAccountId, current.defaultAccountId),
      };
      const data = validateSource(merged, deps.registry);
      if (data.isErr()) return err(data.error);
      // Inflows default to their source's currency and are compared against its net.
      if (
        data.value.currency !== current.currency &&
        (await repos.incomeSources.countInflows(userId, id)) > 0
      )
        return err(
          new ConflictError(
            'source_has_inflows',
            'The currency cannot change once inflows exist; end this source and add a new one',
          ),
        );
      if (data.value.defaultAccountId !== current.defaultAccountId) {
        const account = await assertDefaultAccount(repos, userId, data.value.defaultAccountId);
        if (account.isErr()) return err(account.error);
      }
      if (data.value.isPrimary && !current.isPrimary)
        await repos.incomeSources.clearPrimary(userId);
      const row = await repos.incomeSources.update(userId, id, data.value);
      return row
        ? ok(toIncomeSourceDto(row, deps.registry))
        : err(new NotFoundError('income source'));
    });
```

`apps/api/src/modules/income-sources/application/delete-income-source.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { IncomeSourceDeps } from './create-income-source.js';

export const deleteIncomeSource =
  (deps: IncomeSourceDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    // Counting and deleting share one transaction (the pg repository locks the row first),
    // so an inflow racing the delete answers 409 instead of tripping the foreign key.
    deps.uow(async (repos) => {
      const outcome = await repos.incomeSources.delete(userId, id);
      if (outcome === 'not_found') return err(new NotFoundError('income source'));
      if (outcome === 'has_inflows')
        return err(
          new ConflictError(
            'source_has_inflows',
            'End the source instead (set activeTo): it has inflows',
          ),
        );
      return ok(undefined);
    });
```

- [ ] **Step 6: Postgres repository**

`apps/api/src/modules/income-sources/infrastructure/pg-income-source-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import type {
  IncomeSourceRepository,
  IncomeSourceRow,
  NewIncomeSource,
} from '../application/income-source-repository.js';

/** `date` columns are read as text so no timezone can shift the day; numerics as text (ADR 0001). */
const COLS = `id, user_id, name, gross_amount::text as gross_amount, currency,
  tax_rate::text as tax_rate, commission_rate::text as commission_rate, pay_days, is_primary,
  to_char(active_from, 'YYYY-MM-DD') as active_from, to_char(active_to, 'YYYY-MM-DD') as active_to,
  default_account_id`;

/** An int[] literal: the driver cannot infer the element type of an empty array. */
const intArray = (xs: readonly number[]) => `{${xs.join(',')}}`;

export class PgIncomeSourceRepository implements IncomeSourceRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    return this.sql<IncomeSourceRow[]>`
      select ${this.sql.unsafe(COLS)} from income_sources
      where user_id = ${userId} order by is_primary desc, name`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<IncomeSourceRow[]>`
      select ${this.sql.unsafe(COLS)} from income_sources where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, d: NewIncomeSource) {
    const [row] = await this.sql<IncomeSourceRow[]>`
      insert into income_sources
        (user_id, name, gross_amount, currency, tax_rate, commission_rate, pay_days, is_primary,
         active_from, active_to, default_account_id)
      values
        (${userId}, ${d.name}, ${d.grossAmount}, ${d.currency}, ${d.taxRate}, ${d.commissionRate},
         ${intArray(d.payDays)}::int[], ${d.isPrimary}, ${d.activeFrom}, ${d.activeTo}, ${d.defaultAccountId})
      returning ${this.sql.unsafe(COLS)}`;
    return row!;
  }
  async update(userId: string, id: string, d: NewIncomeSource) {
    const [row] = await this.sql<IncomeSourceRow[]>`
      update income_sources set
        name = ${d.name}, gross_amount = ${d.grossAmount}, currency = ${d.currency},
        tax_rate = ${d.taxRate}, commission_rate = ${d.commissionRate},
        pay_days = ${intArray(d.payDays)}::int[], is_primary = ${d.isPrimary},
        active_from = ${d.activeFrom}, active_to = ${d.activeTo},
        default_account_id = ${d.defaultAccountId}
      where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? null;
  }
  async lockAll(userId: string) {
    await this.sql`select pg_advisory_xact_lock(hashtext(${'income_sources:' + userId}))`;
  }
  async clearPrimary(userId: string) {
    await this
      .sql`update income_sources set is_primary = false where user_id = ${userId} and is_primary`;
  }
  async countInflows(userId: string, id: string) {
    const [row] = await this.sql<{ n: number }[]>`
      select count(*)::int as n from inflows where user_id = ${userId} and income_source_id = ${id}`;
    return row!.n;
  }
  async delete(userId: string, id: string) {
    // `for update` conflicts with the key-share lock an inserting inflow takes through its foreign key.
    const [locked] = await this.sql<{ id: string }[]>`
      select id from income_sources where user_id = ${userId} and id = ${id} for update`;
    if (!locked) return 'not_found' as const;
    if ((await this.countInflows(userId, id)) > 0) return 'has_inflows' as const;
    await this.sql`delete from income_sources where user_id = ${userId} and id = ${id}`;
    return 'deleted' as const;
  }
}
```

- [ ] **Step 7: Routes**

`apps/api/src/modules/income-sources/http/routes.ts`:

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  IdParamSchema,
  IncomeSourceDtoSchema,
  IncomeSourceInputSchema,
  UpdateIncomeSourceInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import { createIncomeSource, type IncomeSourceDeps } from '../application/create-income-source.js';
import { deleteIncomeSource } from '../application/delete-income-source.js';
import { listIncomeSources } from '../application/list-income-sources.js';
import { updateIncomeSource } from '../application/update-income-source.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export function incomeSourceRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: IncomeSourceDeps = {
    uow: deps.uow,
    repos: deps.repos,
    registry: deps.registry,
    clock: deps.clock,
  };
  r.use('/income-sources', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/income-sources/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/income-sources',
      security: [{ bearer: [] }],
      responses: {
        200: json(
          z.array(IncomeSourceDtoSchema),
          'Every source, ended ones included, with its monthly net',
        ),
        ...ERRORS,
      },
    }),
    async (c) => c.json(await listIncomeSources(uc)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/income-sources',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: IncomeSourceInputSchema } } } },
      responses: { 201: json(IncomeSourceDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createIncomeSource(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/income-sources/{id}',
      security: [{ bearer: [] }],
      request: {
        params: IdParamSchema,
        body: { content: { 'application/json': { schema: UpdateIncomeSourceInputSchema } } },
      },
      responses: { 200: json(IncomeSourceDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (
        await updateIncomeSource(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))
      ).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/income-sources/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteIncomeSource(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
```

- [ ] **Step 8: Wire the module**

`apps/api/src/app.ts` — add the imports, extend `Repos`, mount the routes after `transferRoutes`:

```ts
import { incomeSourceRoutes } from './modules/income-sources/http/routes.js';
import type { IncomeSourceRepository } from './modules/income-sources/application/income-source-repository.js';

export interface Repos {
  accounts: AccountRepository;
  balances: BalanceRepository;
  transfers: TransferRepository;
  incomeSources: IncomeSourceRepository;
}

// inside createApp, after app.route('/', transferRoutes(deps));
app.route('/', incomeSourceRoutes(deps));
```

`apps/api/src/shared/db/pg-unit-of-work.ts` — add the repository to `pgRepos`:

```ts
import { PgIncomeSourceRepository } from '../../modules/income-sources/infrastructure/pg-income-source-repository.js';

export const pgRepos = (sql: Sql): Repos => ({
  accounts: new PgAccountRepository(sql),
  balances: new PgBalanceRepository(sql),
  transfers: new PgTransferRepository(sql),
  incomeSources: new PgIncomeSourceRepository(sql),
});
```

`apps/api/test/helpers/deps.ts` — `memoryRepos` hands out the new repository:

```ts
import { MemoryIncomeSourceRepository } from '../../src/modules/income-sources/infrastructure/memory-income-source-repository.js';

export function memoryRepos() {
  const balances = new MemoryBalanceRepository();
  const accounts = new MemoryAccountRepository(balances);
  const transfers = new MemoryTransferRepository(accounts);
  const incomeSources = new MemoryIncomeSourceRepository();
  return { accounts, balances, transfers, incomeSources };
}
```

If another task has already added its repositories to these three places, keep them and add only the `incomeSources` lines.

- [ ] **Step 9: Run the tests**

Run: `cd apps/api && bun run test test/income-sources.test.ts && bun run typecheck && bun run lint`
Expected: PASS (9 tests), no type or lint errors.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/income-sources apps/api/src/app.ts apps/api/src/shared/db/pg-unit-of-work.ts apps/api/test/helpers/deps.ts apps/api/test/income-sources.test.ts
git commit -m "feat(api): add income sources with a single primary source"
```

Use the `/git-commit` skill; the message ends with the two trailers from Global Constraints.

---

### Task 9: API — inflows without credit

**Files:**

- Create: `apps/api/src/modules/inflows/application/inflow-repository.ts`, `…/application/dto.ts`, `…/application/create-inflow.ts`, `…/application/list-inflows.ts`, `…/application/update-inflow.ts`, `…/application/delete-inflow.ts`, `…/infrastructure/memory-inflow-repository.ts`, `…/infrastructure/pg-inflow-repository.ts`, `…/http/routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/shared/db/pg-unit-of-work.ts`, `apps/api/test/helpers/deps.ts`, `apps/api/src/modules/accounts/infrastructure/memory-account-repository.ts` (the `inflowCountOf` hook only)
- Test: `apps/api/test/inflows.test.ts`

**Interfaces:**

- Consumes: `Repos.incomeSources`, `MemoryIncomeSourceRepository.inflowCountOf` (Task 8); `InflowDtoSchema`, `CreateInflowInputSchema`, `UpdateInflowInputSchema`, `InflowsQuerySchema`, `IdParamSchema` and their types (Task 6); table `inflows` (Task 7); `Decimal`, `CurrencyRegistry`, `Clock`, `UnknownCurrencyError` from `@magermoney/domain`.
- Produces:
  - `InflowRow = { id, userId, incomeSourceId, amount: string, currency, receivedOn: string, realisedRateToUsd: string | null, accountId: string | null, creditedAmount: string | null, note: string | null }`, `NewInflow = Omit<InflowRow, 'id' | 'userId'>`, `InflowFilter = { from?, to?, sourceId?, limit: number, before? }`.
  - `InflowRepository { list(userId, filter: InflowFilter); findById(userId, id); insert(userId, data: NewInflow); update(userId, id, data: NewInflow): Promise<InflowRow | null>; delete(userId, id): Promise<boolean> }` — newest first by `(receivedOn desc, id desc)`, cursor `"<receivedOn>|<id>"`; `update` takes the full merged row.
  - `MemoryInflowRepository(sources?: MemoryIncomeSourceRepository, accounts?: MemoryAccountRepository)` — plugs `inflowCountOf` into both.
  - `MemoryAccountRepository.inflowCountOf: (accountId: string) => number` (defaults to `() => 0`; consulted by `delete` from Task 10 on).
  - `InflowDeps`, `InflowFailure`, `InflowFields`, `resolveInflow(deps, repos, userId, fields)`, `toInflowDto(row: InflowRow, realisedRate?: string | null): InflowDto`.
  - `Repos.inflows`, `inflowRoutes(deps: AppDeps)`; routes `GET/POST /inflows`, `PATCH/DELETE /inflows/{id}`; error codes `received_in_future`, `non_positive_amount`, `rate_not_positive`, `credit_unavailable` (400, removed by Task 10), `UNKNOWN_CURRENCY` (400), 404 for a source or inflow that is not the caller's.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/inflows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const RANDOM = '99999999-9999-4999-8999-999999999999';

async function setup() {
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
  const mkSource = async (name: string, currency: string) =>
    (
      await authed(app, 'POST', '/income-sources', {
        name,
        grossAmount: '1000',
        currency,
        activeFrom: '2026-01-01',
      })
    ).json();
  const salary = await mkSource('Salary', 'USD');
  const deposit = await mkSource('Deposit', 'RUB');
  return { app, salary, deposit };
}
const post = (app: ReturnType<typeof createApp>, body: object, uid?: string) =>
  authed(app, 'POST', '/inflows', body, uid);

describe('inflows', () => {
  it('records an inflow in the currency of its source, dated today, without a credit', async () => {
    const { app, salary } = await setup();
    const res = await post(app, { incomeSourceId: salary.id, amount: '4200' });
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto).toMatchObject({
      incomeSourceId: salary.id,
      amount: '4200',
      currency: 'USD',
      receivedOn: '2026-09-11',
      realisedRateToUsd: null,
      accountId: null,
      creditedAmount: null,
      realisedRate: null,
      note: null,
    });
    expect(dto.userId).toBeUndefined();
  });

  it('keeps an explicit currency, date, realised rate and note', async () => {
    const { app, deposit } = await setup();
    const dto = await (
      await post(app, {
        incomeSourceId: deposit.id,
        amount: '18250.40',
        currency: 'RUB',
        receivedOn: '2026-08-31',
        realisedRateToUsd: '0.0125',
        note: 'interest',
      })
    ).json();
    expect(dto).toMatchObject({
      currency: 'RUB',
      receivedOn: '2026-08-31',
      realisedRateToUsd: '0.0125',
      note: 'interest',
    });
  });

  it('refuses the future, a non-positive amount or rate, unknown currencies and foreign sources', async () => {
    const { app, salary } = await setup();
    const future = await post(app, {
      incomeSourceId: salary.id,
      amount: '1',
      receivedOn: '2026-09-12',
    });
    expect(future.status).toBe(400);
    expect((await future.json()).code).toBe('received_in_future');
    expect((await post(app, { incomeSourceId: salary.id, amount: '0' })).status).toBe(400);
    expect((await post(app, { incomeSourceId: salary.id, amount: '-5' })).status).toBe(400);
    expect(
      (await post(app, { incomeSourceId: salary.id, amount: '1', realisedRateToUsd: '0' })).status,
    ).toBe(400);
    const unknown = await post(app, { incomeSourceId: salary.id, amount: '1', currency: 'XYZ' });
    expect((await unknown.json()).code).toBe('UNKNOWN_CURRENCY');
    expect((await post(app, { incomeSourceId: RANDOM, amount: '1' })).status).toBe(404);
    expect((await post(app, { incomeSourceId: salary.id, amount: '1' }, OTHER)).status).toBe(404);
  });

  it('lists newest first, filters by dates and source, and pages with a cursor', async () => {
    const { app, salary, deposit } = await setup();
    for (const [source, amount, receivedOn] of [
      [salary, '1', '2026-07-04'],
      [deposit, '2', '2026-07-31'],
      [salary, '3', '2026-08-04'],
      [salary, '4', '2026-09-04'],
    ] as const)
      await post(app, { incomeSourceId: source.id, amount, receivedOn });
    const amounts = async (query: string) =>
      ((await (await authed(app, 'GET', `/inflows${query}`)).json()) as { amount: string }[]).map(
        (i) => i.amount,
      );
    expect(await amounts('')).toEqual(['4', '3', '2', '1']);
    expect(await amounts('?from=2026-07-31&to=2026-08-31')).toEqual(['3', '2']);
    expect(await amounts(`?sourceId=${deposit.id}`)).toEqual(['2']);
    const firstPage = await (await authed(app, 'GET', '/inflows?limit=2')).json();
    expect(firstPage).toHaveLength(2);
    const last = firstPage[1];
    const cursor = encodeURIComponent(`${last.receivedOn}|${last.id}`);
    expect(await amounts(`?limit=2&before=${cursor}`)).toEqual(['2', '1']);
    expect(await (await authed(app, 'GET', '/inflows', undefined, OTHER)).json()).toEqual([]);
  });

  it('edits an inflow field by field and moves it to another source', async () => {
    const { app, salary, deposit } = await setup();
    const dto = await (
      await post(app, { incomeSourceId: salary.id, amount: '100', note: 'a' })
    ).json();
    const edited = await authed(app, 'PATCH', `/inflows/${dto.id}`, {
      amount: '120',
      receivedOn: '2026-09-10',
      note: null,
    });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({
      amount: '120',
      receivedOn: '2026-09-10',
      note: null,
      currency: 'USD',
      incomeSourceId: salary.id,
    });
    const moved = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { incomeSourceId: deposit.id })
    ).json();
    expect(moved).toMatchObject({ incomeSourceId: deposit.id, currency: 'USD', amount: '120' });
    expect(
      (await authed(app, 'PATCH', `/inflows/${dto.id}`, { incomeSourceId: RANDOM })).status,
    ).toBe(404);
    const future = await authed(app, 'PATCH', `/inflows/${dto.id}`, { receivedOn: '2027-01-01' });
    expect((await future.json()).code).toBe('received_in_future');
  });

  it('deletes an inflow and answers 404 for strangers and unknown ids', async () => {
    const { app, salary } = await setup();
    const dto = await (await post(app, { incomeSourceId: salary.id, amount: '100' })).json();
    expect((await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '1' }, OTHER)).status).toBe(
      404,
    );
    expect((await authed(app, 'DELETE', `/inflows/${dto.id}`, undefined, OTHER)).status).toBe(404);
    expect((await authed(app, 'DELETE', `/inflows/${dto.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/inflows/${dto.id}`)).status).toBe(404);
    expect((await authed(app, 'PATCH', `/inflows/${RANDOM}`, { amount: '1' })).status).toBe(404);
  });

  it('pins its source: a source with inflows cannot be deleted or change currency', async () => {
    const { app, salary } = await setup();
    const dto = await (await post(app, { incomeSourceId: salary.id, amount: '100' })).json();
    const del = await authed(app, 'DELETE', `/income-sources/${salary.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe('source_has_inflows');
    const cur = await authed(app, 'PATCH', `/income-sources/${salary.id}`, { currency: 'EUR' });
    expect((await cur.json()).code).toBe('source_has_inflows');
    await authed(app, 'DELETE', `/inflows/${dto.id}`);
    expect((await authed(app, 'DELETE', `/income-sources/${salary.id}`)).status).toBe(204);
  });

  it('requires a session', async () => {
    const { app } = await setup();
    expect((await app.request('/inflows')).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && bun run test test/inflows.test.ts`
Expected: FAIL — `POST /inflows` answers 404 (`Route not found`).

- [ ] **Step 3: Repository contract and DTO mapping**

`apps/api/src/modules/inflows/application/inflow-repository.ts`:

```ts
export interface InflowRow {
  id: string;
  userId: string;
  incomeSourceId: string;
  amount: string;
  currency: string;
  receivedOn: string; // YYYY-MM-DD
  /** The USD rate actually obtained that day; null = use the rates table. */
  realisedRateToUsd: string | null;
  /** Set together: where the money landed and how much arrived, in the account's currency. */
  accountId: string | null;
  creditedAmount: string | null;
  note: string | null;
}
export type NewInflow = Omit<InflowRow, 'id' | 'userId'>;

export interface InflowFilter {
  from?: string | undefined;
  to?: string | undefined;
  sourceId?: string | undefined;
  limit: number;
  /** `${receivedOn}|${id}` of the last row seen; rows strictly older come next. */
  before?: string | undefined;
}

export interface InflowRepository {
  list(userId: string, filter: InflowFilter): Promise<InflowRow[]>;
  findById(userId: string, id: string): Promise<InflowRow | null>;
  insert(userId: string, data: NewInflow): Promise<InflowRow>;
  /** Full-row update: the use case merges the patch, the repository writes every column. */
  update(userId: string, id: string, data: NewInflow): Promise<InflowRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

export const parseInflowCursor = (before: string): { receivedOn: string; id: string } => {
  const [receivedOn, id] = before.split('|') as [string, string];
  return { receivedOn, id };
};

/** Newest first: receivedOn desc, then id desc so the order is total. */
export const newestInflowFirst = (a: InflowRow, b: InflowRow): number =>
  b.receivedOn.localeCompare(a.receivedOn) || b.id.localeCompare(a.id);
```

`apps/api/src/modules/inflows/application/dto.ts`:

```ts
import type { InflowDto } from '@magermoney/contracts';
import type { InflowRow } from './inflow-repository.js';

/** `realisedRate` (credited / amount) exists only for a cross-currency credit; the caller derives it. */
export function toInflowDto(row: InflowRow, realisedRate: string | null = null): InflowDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId: _u, ...rest } = row;
  return { ...rest, realisedRate };
}
```

- [ ] **Step 4: In-memory repository and the two count hooks**

`apps/api/src/modules/inflows/infrastructure/memory-inflow-repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { MemoryAccountRepository } from '../../accounts/infrastructure/memory-account-repository.js';
import type { MemoryIncomeSourceRepository } from '../../income-sources/infrastructure/memory-income-source-repository.js';
import {
  newestInflowFirst,
  parseInflowCursor,
  type InflowFilter,
  type InflowRepository,
  type InflowRow,
  type NewInflow,
} from '../application/inflow-repository.js';

export class MemoryInflowRepository implements InflowRepository {
  public rows: InflowRow[] = [];
  /** Stands in for the two `on delete restrict` foreign keys: sources and accounts ask how many inflows name them. */
  constructor(sources?: MemoryIncomeSourceRepository, accounts?: MemoryAccountRepository) {
    if (sources)
      sources.inflowCountOf = (id) => this.rows.filter((r) => r.incomeSourceId === id).length;
    if (accounts)
      accounts.inflowCountOf = (id) => this.rows.filter((r) => r.accountId === id).length;
  }
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string, f: InflowFilter) {
    let rows = this.mine(userId)
      .filter((r) => f.from === undefined || r.receivedOn >= f.from)
      .filter((r) => f.to === undefined || r.receivedOn <= f.to)
      .filter((r) => f.sourceId === undefined || r.incomeSourceId === f.sourceId)
      .sort(newestInflowFirst);
    if (f.before) {
      const c = parseInflowCursor(f.before);
      const idx = rows.findIndex((r) => r.receivedOn === c.receivedOn && r.id === c.id);
      rows = idx >= 0 ? rows.slice(idx + 1) : rows.filter((r) => r.receivedOn < c.receivedOn);
    }
    return rows.slice(0, f.limit);
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewInflow) {
    const row: InflowRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, data: NewInflow) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, data);
    return row;
  }
  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    return this.rows.length < before;
  }
}
```

`apps/api/src/modules/accounts/infrastructure/memory-account-repository.ts` — add the hook next to `transferCounts` (the `delete` method starts consulting it in Task 10):

```ts
  /** Transfer counts per account, set by MemoryTransferRepository. */
  public transferCounts = new Map<string, number>();
  /** How many inflows were credited to an account; MemoryInflowRepository plugs itself in here. */
  public inflowCountOf: (accountId: string) => number = () => 0;
```

- [ ] **Step 5: Use cases**

`apps/api/src/modules/inflows/application/create-inflow.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import {
  Decimal,
  type Clock,
  type Currency,
  type CurrencyRegistry,
  type UnknownCurrencyError,
} from '@magermoney/domain';
import type { CreateInflowInput, InflowDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import { toInflowDto } from './dto.js';
import type { NewInflow } from './inflow-repository.js';

export interface InflowDeps {
  uow: UnitOfWork<Repos>;
  repos: Repos;
  registry: CurrencyRegistry;
  clock: Clock;
}
export type InflowFailure = NotFoundError | ValidationError | ConflictError | UnknownCurrencyError;

/** What an inflow is before anyone asks where it landed. */
export interface InflowFields {
  incomeSourceId: string;
  amount: string;
  /** Undefined = the currency of the source. */
  currency?: string | undefined;
  /** Undefined = today. */
  receivedOn?: string | undefined;
  realisedRateToUsd: string | null;
  note: string | null;
}
export type ResolvedInflow = Omit<NewInflow, 'accountId' | 'creditedAmount'>;

/** The checks create and update share: the source is the caller's, the currency exists, the amount and rate are positive, the date is not in the future. */
export async function resolveInflow(
  deps: Pick<InflowDeps, 'registry' | 'clock'>,
  repos: Pick<Repos, 'incomeSources'>,
  userId: string,
  fields: InflowFields,
): Promise<
  Result<
    { data: ResolvedInflow; currency: Currency },
    NotFoundError | ValidationError | UnknownCurrencyError
  >
> {
  const source = await repos.incomeSources.findById(userId, fields.incomeSourceId);
  if (!source) return err(new NotFoundError('income source'));
  const currency = deps.registry.get(fields.currency ?? source.currency);
  if (currency.isErr()) return err(currency.error);
  if (!new Decimal(fields.amount).gt(0))
    return err(new ValidationError('An inflow is more than zero', 'non_positive_amount'));
  if (fields.realisedRateToUsd !== null && !new Decimal(fields.realisedRateToUsd).gt(0))
    return err(new ValidationError('A rate is more than zero', 'rate_not_positive'));
  const today = deps.clock.today();
  const receivedOn = fields.receivedOn ?? today;
  if (receivedOn > today)
    return err(
      new ValidationError('An inflow cannot be dated in the future', 'received_in_future'),
    );
  return ok({
    currency: currency.value,
    data: {
      incomeSourceId: source.id,
      amount: fields.amount,
      currency: currency.value.code,
      receivedOn,
      realisedRateToUsd: fields.realisedRateToUsd,
      note: fields.note,
    },
  });
}

export const createInflow =
  (deps: InflowDeps) =>
  (userId: string, input: CreateInflowInput): Promise<Result<InflowDto, InflowFailure>> =>
    deps.uow(async (repos) => {
      if (input.accountId)
        return err(
          new ValidationError('Crediting an account is not available yet', 'credit_unavailable'),
        );
      const resolved = await resolveInflow(deps, repos, userId, {
        incomeSourceId: input.incomeSourceId,
        amount: input.amount,
        currency: input.currency,
        receivedOn: input.receivedOn,
        realisedRateToUsd: input.realisedRateToUsd ?? null,
        note: input.note ?? null,
      });
      if (resolved.isErr()) return err(resolved.error);
      const row = await repos.inflows.insert(userId, {
        ...resolved.value.data,
        accountId: null,
        creditedAmount: null,
      });
      return ok(toInflowDto(row));
    });
```

`apps/api/src/modules/inflows/application/list-inflows.ts`:

```ts
import type { InflowDto, InflowsQuery } from '@magermoney/contracts';
import type { InflowDeps } from './create-inflow.js';
import { toInflowDto } from './dto.js';

export const listInflows =
  (deps: InflowDeps) =>
  async (userId: string, query: InflowsQuery): Promise<InflowDto[]> =>
    (await deps.repos.inflows.list(userId, query)).map((r) => toInflowDto(r));
```

`apps/api/src/modules/inflows/application/update-inflow.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { InflowDto, UpdateInflowInput } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import { resolveInflow, type InflowDeps, type InflowFailure } from './create-inflow.js';
import { toInflowDto } from './dto.js';

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

export const updateInflow =
  (deps: InflowDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateInflowInput,
  ): Promise<Result<InflowDto, InflowFailure>> =>
    deps.uow(async (repos) => {
      const current = await repos.inflows.findById(userId, id);
      if (!current) return err(new NotFoundError('inflow'));
      const resolved = await resolveInflow(deps, repos, userId, {
        incomeSourceId: pick(input.incomeSourceId, current.incomeSourceId),
        amount: pick(input.amount, current.amount),
        // An inflow keeps its own currency when it moves to another source.
        currency: pick(input.currency, current.currency),
        receivedOn: pick(input.receivedOn, current.receivedOn),
        realisedRateToUsd: pick(input.realisedRateToUsd, current.realisedRateToUsd),
        note: pick(input.note, current.note),
      });
      if (resolved.isErr()) return err(resolved.error);
      const row = await repos.inflows.update(userId, id, {
        ...resolved.value.data,
        accountId: current.accountId,
        creditedAmount: current.creditedAmount,
      });
      return row ? ok(toInflowDto(row)) : err(new NotFoundError('inflow'));
    });
```

`apps/api/src/modules/inflows/application/delete-inflow.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { InflowDeps } from './create-inflow.js';

export const deleteInflow =
  (deps: InflowDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    deps.uow(async (repos) =>
      (await repos.inflows.delete(userId, id)) ? ok(undefined) : err(new NotFoundError('inflow')),
    );
```

- [ ] **Step 6: Postgres repository**

`apps/api/src/modules/inflows/infrastructure/pg-inflow-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import {
  parseInflowCursor,
  type InflowFilter,
  type InflowRepository,
  type InflowRow,
  type NewInflow,
} from '../application/inflow-repository.js';

/** `received_on` is a `date`: read it as text so no timezone can shift the day. */
const COLS = `id, user_id, income_source_id, amount::text as amount, currency,
  to_char(received_on, 'YYYY-MM-DD') as received_on, realised_rate_to_usd::text as realised_rate_to_usd,
  account_id, credited_amount::text as credited_amount, note`;

export class PgInflowRepository implements InflowRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string, f: InflowFilter) {
    const c = f.before ? parseInflowCursor(f.before) : null;
    return this.sql<InflowRow[]>`
      select ${this.sql.unsafe(COLS)} from inflows
      where user_id = ${userId}
      ${f.from ? this.sql`and received_on >= ${f.from}::date` : this.sql``}
      ${f.to ? this.sql`and received_on <= ${f.to}::date` : this.sql``}
      ${f.sourceId ? this.sql`and income_source_id = ${f.sourceId}` : this.sql``}
      ${c ? this.sql`and (received_on, id) < (${c.receivedOn}::date, ${c.id}::uuid)` : this.sql``}
      order by received_on desc, id desc
      limit ${f.limit}`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<InflowRow[]>`
      select ${this.sql.unsafe(COLS)} from inflows where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, d: NewInflow) {
    const [row] = await this.sql<InflowRow[]>`
      insert into inflows
        (user_id, income_source_id, amount, currency, received_on, realised_rate_to_usd,
         account_id, credited_amount, note)
      values
        (${userId}, ${d.incomeSourceId}, ${d.amount}, ${d.currency}, ${d.receivedOn}, ${d.realisedRateToUsd},
         ${d.accountId}, ${d.creditedAmount}, ${d.note})
      returning ${this.sql.unsafe(COLS)}`;
    return row!;
  }
  async update(userId: string, id: string, d: NewInflow) {
    const [row] = await this.sql<InflowRow[]>`
      update inflows set
        income_source_id = ${d.incomeSourceId}, amount = ${d.amount}, currency = ${d.currency},
        received_on = ${d.receivedOn}, realised_rate_to_usd = ${d.realisedRateToUsd},
        account_id = ${d.accountId}, credited_amount = ${d.creditedAmount}, note = ${d.note}
      where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? null;
  }
  async delete(userId: string, id: string) {
    return (await this.sql`delete from inflows where user_id = ${userId} and id = ${id}`).count > 0;
  }
}
```

- [ ] **Step 7: Routes**

`apps/api/src/modules/inflows/http/routes.ts`:

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  CreateInflowInputSchema,
  IdParamSchema,
  InflowDtoSchema,
  InflowsQuerySchema,
  UpdateInflowInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import { createInflow, type InflowDeps } from '../application/create-inflow.js';
import { deleteInflow } from '../application/delete-inflow.js';
import { listInflows } from '../application/list-inflows.js';
import { updateInflow } from '../application/update-inflow.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export function inflowRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: InflowDeps = {
    uow: deps.uow,
    repos: deps.repos,
    registry: deps.registry,
    clock: deps.clock,
  };
  r.use('/inflows', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/inflows/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/inflows',
      security: [{ bearer: [] }],
      request: { query: InflowsQuerySchema },
      responses: { 200: json(z.array(InflowDtoSchema), 'Newest first'), ...ERRORS },
    }),
    async (c) => c.json(await listInflows(uc)(c.var.userId, c.req.valid('query')), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/inflows',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: CreateInflowInputSchema } } } },
      responses: { 201: json(InflowDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createInflow(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/inflows/{id}',
      security: [{ bearer: [] }],
      request: {
        params: IdParamSchema,
        body: { content: { 'application/json': { schema: UpdateInflowInputSchema } } },
      },
      responses: { 200: json(InflowDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateInflow(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/inflows/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteInflow(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
```

- [ ] **Step 8: Wire the module**

`apps/api/src/app.ts`:

```ts
import { inflowRoutes } from './modules/inflows/http/routes.js';
import type { InflowRepository } from './modules/inflows/application/inflow-repository.js';

export interface Repos {
  accounts: AccountRepository;
  balances: BalanceRepository;
  transfers: TransferRepository;
  incomeSources: IncomeSourceRepository;
  inflows: InflowRepository;
}

// inside createApp, after app.route('/', incomeSourceRoutes(deps));
app.route('/', inflowRoutes(deps));
```

`apps/api/src/shared/db/pg-unit-of-work.ts` — add to `pgRepos`:

```ts
import { PgInflowRepository } from '../../modules/inflows/infrastructure/pg-inflow-repository.js';

  inflows: new PgInflowRepository(sql),
```

`apps/api/test/helpers/deps.ts` — the inflow repository is built last so it can plug into sources and accounts:

```ts
import { MemoryInflowRepository } from '../../src/modules/inflows/infrastructure/memory-inflow-repository.js';

export function memoryRepos() {
  const balances = new MemoryBalanceRepository();
  const accounts = new MemoryAccountRepository(balances);
  const transfers = new MemoryTransferRepository(accounts);
  const incomeSources = new MemoryIncomeSourceRepository();
  const inflows = new MemoryInflowRepository(incomeSources, accounts);
  return { accounts, balances, transfers, incomeSources, inflows };
}
```

If another task has already added its repositories to these three places, keep them and add only the `inflows` lines.

- [ ] **Step 9: Run the tests**

Run: `cd apps/api && bun run test test/inflows.test.ts test/income-sources.test.ts && bun run typecheck && bun run lint`
Expected: PASS (8 + 9 tests), no type or lint errors. The Task 8 case that overrides `repos.incomeSources.inflowCountOf` still passes: the override replaces the hook the inflow repository installed.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/inflows apps/api/src/modules/accounts/infrastructure/memory-account-repository.ts apps/api/src/app.ts apps/api/src/shared/db/pg-unit-of-work.ts apps/api/test/helpers/deps.ts apps/api/test/inflows.test.ts
git commit -m "feat(api): record, list, edit and delete inflows"
```

Use the `/git-commit` skill; the message ends with the two trailers from Global Constraints.

---

### Task 10: API — credited inflows

**Files:**

- Create: `apps/api/src/modules/inflows/application/credit.ts`
- Modify: `apps/api/src/modules/inflows/application/create-inflow.ts`, `…/update-inflow.ts`, `…/delete-inflow.ts`, `…/list-inflows.ts`; `apps/api/src/modules/accounts/application/balance-repository.ts`, `…/account-repository.ts`, `…/delete-account.ts`, `…/edit-balance.ts` (message only); `apps/api/src/modules/accounts/infrastructure/memory-balance-repository.ts`, `…/pg-balance-repository.ts`, `…/memory-account-repository.ts`, `…/pg-account-repository.ts`; `apps/api/src/shared/errors/http.ts`; `packages/contracts/src/balance-entry.ts`
- Test: `apps/api/test/inflows-credit.test.ts`, `apps/api/test/errors.test.ts`
- Modify (typed `BalanceEntryDto` fixtures, `inflowId: null`): `apps/web/test/BalanceTimeline.test.ts`, `apps/web/test/RecordBalanceSheet.test.ts`, `apps/web/test/use-record-balance.test.ts`, `apps/web/test/offline-mutations.test.ts`

**Interfaces:**

- Consumes (Task 3, `@magermoney/domain`): `deriveInflowCredit(input: { amount: Money; accountCurrency: Currency; creditedAmount?: Money | undefined }): Result<{ credited: Money; realisedRate: Decimal | null }, InflowError>`, `applyInflow(input: { balance: Money; credited: Money }): Result<Money, InflowError | CurrencyMismatchError>`, `class InflowError { code = 'INFLOW_INVALID'; reason: 'non_positive_amount' | 'credited_amount_required' | 'credited_mismatch' }`. From Task 9: `InflowDeps`, `resolveInflow`, `toInflowDto(row, realisedRate?)`, `InflowRow`, `MemoryAccountRepository.inflowCountOf`. From phase 2: `AccountRepository.lock`, `BalanceRepository`, `AccountRow.balance` / `balanceRecordedAt`.
- Produces:
  - `BalanceEntryRow.inflowId: string | null`; `NewBalanceEntry = Omit<BalanceEntryRow, 'id' | 'userId' | 'createdAt' | 'inflowId'> & { inflowId?: string | null }` (existing insert sites stay as they are); `BalanceRepository.findByInflow(userId, inflowId): Promise<BalanceEntryRow | null>`; `BalanceRepository.deleteByInflow(userId, inflowId): Promise<number>`.
  - `BalanceEntryDtoSchema` gains `inflowId: z.uuid().nullable().default(null)` (type `string | null`; older payloads without the field still parse).
  - `AccountRepository.delete(...): Promise<'deleted' | 'not_found' | 'has_transfers' | 'has_inflows'>`; `DELETE /accounts/{id}` → 409 `account_has_inflows`.
  - `credit.ts`: `CreditTarget`, `CreditPlan`, `creditRecordedAt(receivedOn, clock)`, `freshTarget(registry, account)`, `revertedTarget(registry, repos, userId, account, inflow)`, `planCredit(input)`, `writeCredit(repos, userId, inflowId, plan)`, `assertInflowLatest(repos, userId, inflow)`, `realisedRateOf(row, registry, accountCurrency)`.
  - `toHttpError(InflowError)` → 400 with `code = e.reason`.
  - Error codes: `credited_amount_required`, `credited_mismatch`, `credited_without_account`, `credit_not_latest` (400); `inflow_not_latest`, `account_has_inflows` (409); `entry_not_manual` (409) for `PATCH/DELETE /balances/{id}` on an inflow entry. `credit_unavailable` is gone.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/inflows-credit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const base = { bank: 'Bank', country: 'RU', kind: 'bank_account', isSpending: true };

async function setup() {
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
  const mkAccount = async (name: string, currency: string, amount: string) =>
    (
      await authed(app, 'POST', '/accounts', {
        ...base,
        name,
        currency,
        openingBalance: { amount, recordedAt: '2026-09-01T00:00:00.000Z' },
      })
    ).json();
  const usd = await mkAccount('USD acc', 'USD', '1000');
  const eur = await mkAccount('EUR acc', 'EUR', '100');
  const salary = await (
    await authed(app, 'POST', '/income-sources', {
      name: 'Salary',
      grossAmount: '5000',
      currency: 'USD',
      activeFrom: '2026-01-01',
    })
  ).json();
  return { app, usd, eur, salary };
}
type App = ReturnType<typeof createApp>;
const balances = async (app: App) =>
  Object.fromEntries(
    (
      (await (await authed(app, 'GET', '/accounts')).json()) as { id: string; balance: string }[]
    ).map((a) => [a.id, a.balance]),
  );
const journal = async (app: App, accountId: string) =>
  (await (await authed(app, 'GET', `/accounts/${accountId}/balances`)).json()) as {
    id: string;
    origin: string;
    inflowId: string | null;
    amount: string;
    recordedAt: string;
  }[];
const post = (app: App, body: object, uid?: string) => authed(app, 'POST', '/inflows', body, uid);

describe('credited inflows', () => {
  it('same currency: the account grows by the amount through one inflow entry dated now', async () => {
    const { app, usd, salary } = await setup();
    const res = await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id });
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto).toMatchObject({ accountId: usd.id, creditedAmount: '500', realisedRate: null });
    expect((await balances(app))[usd.id]).toBe('1500');
    const [entry] = await journal(app, usd.id);
    expect(entry).toMatchObject({
      origin: 'inflow',
      inflowId: dto.id,
      amount: '1500',
      recordedAt: NOW.toISOString(),
    });
  });

  it('cross currency: both amounts are declared and the realised rate is derived', async () => {
    const { app, eur, salary } = await setup();
    const missing = await post(app, {
      incomeSourceId: salary.id,
      amount: '100',
      accountId: eur.id,
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('credited_amount_required');
    const dto = await (
      await post(app, {
        incomeSourceId: salary.id,
        amount: '100',
        accountId: eur.id,
        creditedAmount: '86.14',
      })
    ).json();
    expect(dto).toMatchObject({ creditedAmount: '86.14', realisedRate: '0.8614', currency: 'USD' });
    expect((await balances(app))[eur.id]).toBe('186.14');
    const [listed] = await (await authed(app, 'GET', '/inflows')).json();
    expect(listed.realisedRate).toBe('0.8614');
  });

  it('refuses a credited amount that contradicts the amount, or one without an account', async () => {
    const { app, usd, salary } = await setup();
    const mismatch = await post(app, {
      incomeSourceId: salary.id,
      amount: '500',
      accountId: usd.id,
      creditedAmount: '499',
    });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).code).toBe('credited_mismatch');
    // On create the contract refuses this shape before the use case sees it…
    const orphan = await post(app, {
      incomeSourceId: salary.id,
      amount: '500',
      creditedAmount: '500',
    });
    expect(orphan.status).toBe(400);
    expect((await orphan.json()).code).toBe('VALIDATION');
    expect((await balances(app))[usd.id]).toBe('1000');
    expect(await (await authed(app, 'GET', '/inflows')).json()).toEqual([]);
    // …while a patch can only be judged against the stored row, so the use case answers.
    const bare = await (await post(app, { incomeSourceId: salary.id, amount: '500' })).json();
    const late = await authed(app, 'PATCH', `/inflows/${bare.id}`, { creditedAmount: '500' });
    expect(late.status).toBe(400);
    expect((await late.json()).code).toBe('credited_without_account');
    expect((await balances(app))[usd.id]).toBe('1000');
  });

  it('dates a past credit at the end of its day and refuses one behind a newer balance', async () => {
    const { app, usd, salary } = await setup();
    const past = await post(app, {
      incomeSourceId: salary.id,
      amount: '10',
      accountId: usd.id,
      receivedOn: '2026-09-05',
    });
    expect(past.status).toBe(201);
    expect((await journal(app, usd.id))[0]!.recordedAt).toBe('2026-09-05T23:59:59.999Z');
    const behind = await post(app, {
      incomeSourceId: salary.id,
      amount: '10',
      accountId: usd.id,
      receivedOn: '2026-09-04',
    });
    expect(behind.status).toBe(400);
    expect((await behind.json()).code).toBe('credit_not_latest');
    expect((await balances(app))[usd.id]).toBe('1010');
  });

  it('answers 404 for an account that is not the caller’s', async () => {
    const { app, salary } = await setup();
    const res = await post(app, {
      incomeSourceId: salary.id,
      amount: '1',
      accountId: '99999999-9999-4999-8999-999999999999',
    });
    expect(res.status).toBe(404);
    expect((await post(app, { incomeSourceId: salary.id, amount: '1' }, OTHER)).status).toBe(404);
  });

  it('re-applies the credit when the amount changes while the entry is the latest', async () => {
    const { app, usd, salary } = await setup();
    const dto = await (
      await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id })
    ).json();
    const edited = await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '600' });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({
      amount: '600',
      creditedAmount: '600',
      accountId: usd.id,
    });
    expect((await balances(app))[usd.id]).toBe('1600');
    const entries = await journal(app, usd.id);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ origin: 'inflow', inflowId: dto.id, amount: '1600' });
  });

  it('cross currency: a new amount needs a new credited amount; a note-only edit keeps the old one', async () => {
    const { app, eur, salary } = await setup();
    const dto = await (
      await post(app, {
        incomeSourceId: salary.id,
        amount: '100',
        accountId: eur.id,
        creditedAmount: '86.14',
      })
    ).json();
    const noted = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { note: 'bonus' })
    ).json();
    expect(noted).toMatchObject({ note: 'bonus', creditedAmount: '86.14', realisedRate: '0.8614' });
    expect((await balances(app))[eur.id]).toBe('186.14');
    const missing = await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '200' });
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('credited_amount_required');
    expect((await balances(app))[eur.id]).toBe('186.14');
    const both = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '200', creditedAmount: '170' })
    ).json();
    expect(both).toMatchObject({ creditedAmount: '170', realisedRate: '0.85' });
    expect((await balances(app))[eur.id]).toBe('270');
  });

  it('adds a credit to an inflow, moves it to another account and removes it', async () => {
    const { app, usd, eur, salary } = await setup();
    const dto = await (await post(app, { incomeSourceId: salary.id, amount: '100' })).json();
    const added = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { accountId: usd.id })
    ).json();
    expect(added).toMatchObject({ accountId: usd.id, creditedAmount: '100' });
    expect((await balances(app))[usd.id]).toBe('1100');
    const moved = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { accountId: eur.id, creditedAmount: '86' })
    ).json();
    expect(moved).toMatchObject({ accountId: eur.id, creditedAmount: '86' });
    let b = await balances(app);
    expect(b[usd.id]).toBe('1000');
    expect(b[eur.id]).toBe('186');
    const removed = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { accountId: null })
    ).json();
    expect(removed).toMatchObject({ accountId: null, creditedAmount: null, realisedRate: null });
    b = await balances(app);
    expect(b[eur.id]).toBe('100');
    expect(await journal(app, eur.id)).toHaveLength(1);
  });

  it('freezes once a newer balance exists, and pins the account', async () => {
    const { app, usd, salary } = await setup();
    const dto = await (
      await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id })
    ).json();
    await authed(app, 'POST', `/accounts/${usd.id}/balances`, { amount: '1400' });
    const stale = await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '600' });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('inflow_not_latest');
    const del = await authed(app, 'DELETE', `/inflows/${dto.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe('inflow_not_latest');
    const account = await authed(app, 'DELETE', `/accounts/${usd.id}`);
    expect(account.status).toBe(409);
    expect((await account.json()).code).toBe('account_has_inflows');
    expect((await balances(app))[usd.id]).toBe('1400');
  });

  it('deleting a credited inflow while it is the latest gives the balance back', async () => {
    const { app, usd, salary } = await setup();
    const dto = await (
      await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id })
    ).json();
    expect((await authed(app, 'DELETE', `/inflows/${dto.id}`)).status).toBe(204);
    expect((await balances(app))[usd.id]).toBe('1000');
    expect(await journal(app, usd.id)).toHaveLength(1);
    expect((await authed(app, 'DELETE', `/accounts/${usd.id}`)).status).toBe(204);
  });

  it('the journal refuses to edit or delete an inflow entry directly', async () => {
    const { app, usd, salary } = await setup();
    await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id });
    const [entry] = await journal(app, usd.id);
    const edit = await authed(app, 'PATCH', `/balances/${entry!.id}`, { amount: '1' });
    expect(edit.status).toBe(409);
    expect((await edit.json()).code).toBe('entry_not_manual');
    const del = await authed(app, 'DELETE', `/balances/${entry!.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe('entry_not_manual');
  });

  it('a transfer still works on an account whose latest entry is an inflow', async () => {
    const { app, usd, salary } = await setup();
    await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id });
    const other = await (
      await authed(app, 'POST', '/accounts', { ...base, name: 'USD 2', currency: 'USD' })
    ).json();
    const t = await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: other.id,
      amountSent: '200',
    });
    expect(t.status).toBe(201);
    expect((await balances(app))[usd.id]).toBe('1300');
  });
});
```

Append to `apps/api/test/errors.test.ts` (add `InflowError` to the `@magermoney/domain` import):

```ts
it('maps an inflow error to 400 with its reason as the code', () => {
  expect(toHttpError(new InflowError('credited_amount_required'))).toMatchObject({
    status: 400,
    body: { code: 'credited_amount_required' },
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && bun run test test/inflows-credit.test.ts test/errors.test.ts`
Expected: FAIL — the first credit answers 400 `credit_unavailable`; `toHttpError(new InflowError(…))` answers 400 with code `INFLOW_INVALID` instead of the reason.

- [ ] **Step 3: The journal learns about inflow entries**

`packages/contracts/src/balance-entry.ts` — add one field to `BalanceEntryDtoSchema`, after `transferId`:

```ts
    transferId: z.uuid().nullable(),
    /**
     * Set exactly when origin = 'inflow'. Defaults to null on the way in, so a payload written
     * before phase 3 (a cached response, an older API during a rolling deploy) still parses.
     */
    inflowId: z.uuid().nullable().default(null),
```

The web parses every balance response with this schema and its tests and fixtures build `BalanceEntryDto` values, so the new field ripples outside `apps/api`. The default keeps untyped JSON fixtures parsing; typed literals still need the field. Add `inflowId: null` right after `transferId: null` in each of these (found with `grep -rn "transferId: null" apps/web/src apps/web/test apps/api/test`):

- `apps/web/test/BalanceTimeline.test.ts` (the `entry(...)` factory)
- `apps/web/test/RecordBalanceSheet.test.ts` (the `entry` constant and the two mocked POST/PATCH bodies)
- `apps/web/test/use-record-balance.test.ts` (the mocked POST body)
- `apps/web/test/offline-mutations.test.ts` (the `entry` constant)
- `apps/api/test/balances.test.ts`, `apps/api/test/memory-repositories.test.ts`, `apps/api/test/integration/pg-account-repository.test.ts` build `NewBalanceEntry` values, which keep compiling without the field — leave them.

Then run the full `bun run typecheck && bun run test` from the repo root at the end of this step (not only `apps/api`): `vue-tsc` covers `apps/web/test`, and a missed typed literal shows up there as `Property 'inflowId' is missing`.

`apps/api/src/modules/accounts/application/balance-repository.ts` — replace the row, the `New…` type and the interface (cursor helpers below them stay):

```ts
export type BalanceOrigin = 'manual' | 'transfer' | 'inflow';

export interface BalanceEntryRow {
  id: string;
  userId: string;
  accountId: string;
  amount: string;
  recordedAt: string; // ISO
  origin: BalanceOrigin;
  transferId: string | null;
  /** Set exactly when origin = 'inflow'. */
  inflowId: string | null;
  note: string | null;
  createdAt: string; // ISO
}
/** `inflowId` is optional on the way in, so manual and transfer writers need not mention it. */
export type NewBalanceEntry = Omit<BalanceEntryRow, 'id' | 'userId' | 'createdAt' | 'inflowId'> & {
  inflowId?: string | null;
};
export type BalanceEntryPatch = Partial<Pick<BalanceEntryRow, 'amount' | 'recordedAt' | 'note'>>;

export interface BalanceRepository {
  listByAccount(
    userId: string,
    accountId: string,
    limit: number,
    before?: string,
  ): Promise<BalanceEntryRow[]>;
  latest(userId: string, accountId: string): Promise<BalanceEntryRow | null>;
  findById(userId: string, id: string): Promise<BalanceEntryRow | null>;
  findByTransfer(userId: string, transferId: string): Promise<BalanceEntryRow[]>;
  /** A credited inflow has exactly one entry. */
  findByInflow(userId: string, inflowId: string): Promise<BalanceEntryRow | null>;
  insert(userId: string, data: NewBalanceEntry): Promise<BalanceEntryRow>;
  update(userId: string, id: string, patch: BalanceEntryPatch): Promise<BalanceEntryRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
  deleteByTransfer(userId: string, transferId: string): Promise<number>;
  deleteByInflow(userId: string, inflowId: string): Promise<number>;
}
```

`apps/api/src/modules/accounts/infrastructure/memory-balance-repository.ts` — `insert` fills the default, and two methods are added:

```ts
  async findByInflow(userId: string, inflowId: string) {
    return this.mine(userId).find((r) => r.inflowId === inflowId) ?? null;
  }
  async insert(userId: string, data: NewBalanceEntry) {
    const row: BalanceEntryRow = {
      ...data,
      inflowId: data.inflowId ?? null,
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    };
    // Ties on createdAt are broken by insertion order in pg too; keep it deterministic here.
    const last = this.rows.at(-1);
    if (last && last.createdAt >= row.createdAt)
      row.createdAt = new Date(new Date(last.createdAt).getTime() + 1).toISOString();
    this.rows.push(row);
    return row;
  }
  async deleteByInflow(userId: string, inflowId: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.inflowId === inflowId));
    return before - this.rows.length;
  }
```

`apps/api/src/modules/accounts/infrastructure/pg-balance-repository.ts` — the column list, `insert`, and two methods:

```ts
const COLS =
  'id, user_id, account_id, amount::text as amount, recorded_at, origin, transfer_id, inflow_id, note, created_at';
```

```ts
  async findByInflow(userId: string, inflowId: string) {
    const [row] = await this.sql<
      Raw[]
    >`select ${this.sql.unsafe(COLS)} from balance_entries where user_id = ${userId} and inflow_id = ${inflowId}`;
    return row ? fromRaw(row) : null;
  }
  async insert(userId: string, data: NewBalanceEntry) {
    const [row] = await this.sql<Raw[]>`
      insert into balance_entries (user_id, account_id, amount, recorded_at, origin, transfer_id, inflow_id, note)
      values (${userId}, ${data.accountId}, ${data.amount}, ${data.recordedAt}, ${data.origin}, ${data.transferId}, ${data.inflowId ?? null}, ${data.note})
      returning ${this.sql.unsafe(COLS)}`;
    return fromRaw(row!);
  }
  async deleteByInflow(userId: string, inflowId: string) {
    return (
      await this
        .sql`delete from balance_entries where user_id = ${userId} and inflow_id = ${inflowId}`
    ).count;
  }
```

`apps/api/src/modules/accounts/application/edit-balance.ts` — only the message of `entry_not_manual` changes (the code and the check stay; `delete-balance.ts` already goes through `assertEditable`):

```ts
if (entry.origin !== 'manual')
  return err(new ConflictError('entry_not_manual', 'Change the transfer or the inflow instead'));
```

Run `cd apps/api && bun run typecheck`. Expected: clean. If a test fixture or script builds a full `BalanceEntryRow` literal (not a `NewBalanceEntry`), add `inflowId: null` to it; the phase 2 code only builds `NewBalanceEntry` values, which need no change.

- [ ] **Step 4: An account with credited inflows cannot be deleted**

`apps/api/src/modules/accounts/application/account-repository.ts` — widen `delete`:

```ts
  delete(
    userId: string,
    id: string,
  ): Promise<'deleted' | 'not_found' | 'has_transfers' | 'has_inflows'>;
```

`apps/api/src/modules/accounts/infrastructure/memory-account-repository.ts` — `delete` consults the hook added in Task 9:

```ts
  async delete(userId: string, id: string) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return 'not_found' as const;
    if ((this.transferCounts.get(id) ?? 0) > 0) return 'has_transfers' as const;
    if (this.inflowCountOf(id) > 0) return 'has_inflows' as const;
    this.rows = this.rows.filter((r) => r !== row);
    this.balances.dropAccount(id);
    return 'deleted' as const;
  }
```

`apps/api/src/modules/accounts/infrastructure/pg-account-repository.ts` — `delete` counts inflows after transfers:

```ts
  async delete(userId: string, id: string) {
    const [t] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from transfers where user_id = ${userId} and (from_account_id = ${id} or to_account_id = ${id})`;
    if (t!.n > 0) return 'has_transfers' as const;
    const [i] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from inflows where user_id = ${userId} and account_id = ${id}`;
    if (i!.n > 0) return 'has_inflows' as const;
    const res = await this.sql`delete from accounts where user_id = ${userId} and id = ${id}`;
    return res.count > 0 ? ('deleted' as const) : ('not_found' as const);
  }
```

`apps/api/src/modules/accounts/application/delete-account.ts` — one more branch after `has_transfers`:

```ts
if (outcome === 'has_inflows')
  return err(
    new ConflictError(
      'account_has_inflows',
      'Archive the account instead: inflows were credited to it',
    ),
  );
```

- [ ] **Step 5: Map `InflowError`**

`apps/api/src/shared/errors/http.ts` — import `InflowError` from `@magermoney/domain` and add, before the `RateMissingError` branch:

```ts
// The reason is what the form needs to react to, so it travels as the code.
if (e instanceof InflowError) return { status: 400, body: { code: e.reason, message: e.message } };
```

- [ ] **Step 6: The credit arithmetic and its guards**

Create `apps/api/src/modules/inflows/application/credit.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import {
  applyInflow,
  deriveInflowCredit,
  Money,
  type Clock,
  type Currency,
  type CurrencyMismatchError,
  type CurrencyRegistry,
  type Decimal,
  type InflowError,
  type UnknownCurrencyError,
} from '@magermoney/domain';
import type { Repos } from '../../../app.js';
import { ConflictError, ValidationError } from '../../../shared/errors/http.js';
import type { AccountRow } from '../../accounts/application/account-repository.js';
import type { BalanceEntryRow } from '../../accounts/application/balance-repository.js';
import type { InflowRow } from './inflow-repository.js';

/** The account a credit is about to land on, as it stands without that credit. */
export interface CreditTarget {
  account: AccountRow;
  currency: Currency;
  /** The balance the credit is added to. */
  base: Money;
  /** When the entry underneath was recorded; the credit must not be older than it. */
  previousRecordedAt: string | null;
}
/** Everything decided before the first write: nothing below a plan can fail. */
export interface CreditPlan {
  accountId: string;
  credited: Money;
  after: Money;
  recordedAt: string;
  realisedRate: Decimal | null;
}

const balanceOf = (a: AccountRow, cur: Currency): Money =>
  a.balance === null ? Money.zero(cur) : Money.of(a.balance, cur);

/** Today's inflow is stamped now; a past one at the end of its day, so it sorts after that day's entries. */
export const creditRecordedAt = (receivedOn: string, clock: Clock): string =>
  receivedOn === clock.today() ? clock.now().toISOString() : `${receivedOn}T23:59:59.999Z`;

/** An account that does not carry this inflow yet. The row must come from `accounts.lock`. */
export function freshTarget(
  registry: CurrencyRegistry,
  account: AccountRow,
): Result<CreditTarget, UnknownCurrencyError> {
  return registry.get(account.currency).map((currency) => ({
    account,
    currency,
    base: balanceOf(account, currency),
    previousRecordedAt: account.balanceRecordedAt,
  }));
}

/**
 * The account that already carries this inflow as its latest entry, seen as if
 * the entry were gone: the balance minus what was credited, and the entry below it.
 */
export async function revertedTarget(
  registry: CurrencyRegistry,
  repos: Pick<Repos, 'balances'>,
  userId: string,
  account: AccountRow,
  inflow: InflowRow,
): Promise<Result<CreditTarget, UnknownCurrencyError | CurrencyMismatchError>> {
  const currency = registry.get(account.currency);
  if (currency.isErr()) return err(currency.error);
  const [, previous] = await repos.balances.listByAccount(userId, account.id, 2);
  return balanceOf(account, currency.value)
    .subtract(Money.of(inflow.creditedAmount ?? '0', currency.value))
    .map((base) => ({
      account,
      currency: currency.value,
      base,
      previousRecordedAt: previous?.recordedAt ?? null,
    }));
}

export function planCredit(input: {
  target: CreditTarget;
  amount: Money;
  /** In the account's currency. Undefined = same as the amount, which only a same-currency credit allows. */
  creditedAmount?: string | undefined;
  receivedOn: string;
  clock: Clock;
}): Result<CreditPlan, InflowError | ValidationError | CurrencyMismatchError> {
  const { target, amount, creditedAmount, receivedOn, clock } = input;
  const recordedAt = creditRecordedAt(receivedOn, clock);
  if (target.previousRecordedAt !== null && target.previousRecordedAt > recordedAt)
    return err(
      new ValidationError(
        'Newer balances exist on the account; record the inflow without an account instead',
        'credit_not_latest',
      ),
    );
  return deriveInflowCredit({
    amount,
    accountCurrency: target.currency,
    creditedAmount:
      creditedAmount === undefined ? undefined : Money.of(creditedAmount, target.currency),
  }).andThen((derived) =>
    applyInflow({ balance: target.base, credited: derived.credited }).map((after) => ({
      accountId: target.account.id,
      credited: derived.credited,
      after,
      recordedAt,
      realisedRate: derived.realisedRate,
    })),
  );
}

export const writeCredit = (
  repos: Pick<Repos, 'balances'>,
  userId: string,
  inflowId: string,
  plan: CreditPlan,
): Promise<BalanceEntryRow> =>
  repos.balances.insert(userId, {
    accountId: plan.accountId,
    amount: plan.after.toString(),
    recordedAt: plan.recordedAt,
    origin: 'inflow',
    transferId: null,
    inflowId,
    note: null,
  });

/** A credited inflow can change only while its entry is the newest on the account; later history rests on it. */
export async function assertInflowLatest(
  repos: Pick<Repos, 'balances'>,
  userId: string,
  inflow: InflowRow,
): Promise<Result<BalanceEntryRow, ConflictError>> {
  const entry = await repos.balances.findByInflow(userId, inflow.id);
  const latest = inflow.accountId ? await repos.balances.latest(userId, inflow.accountId) : null;
  if (!entry || latest?.id !== entry.id)
    return err(
      new ConflictError(
        'inflow_not_latest',
        'Newer balances exist on the account; this inflow can no longer change',
      ),
    );
  return ok(entry);
}

/** credited / amount for a cross-currency credit, else null. */
export function realisedRateOf(
  row: InflowRow,
  registry: CurrencyRegistry,
  accountCurrency: string | null,
): string | null {
  if (row.creditedAmount === null || accountCurrency === null || accountCurrency === row.currency)
    return null;
  const own = registry.get(row.currency);
  const target = registry.get(accountCurrency);
  if (own.isErr() || target.isErr()) return null;
  return deriveInflowCredit({
    amount: Money.of(row.amount, own.value),
    accountCurrency: target.value,
    creditedAmount: Money.of(row.creditedAmount, target.value),
  })
    .map((d) => d.realisedRate?.toFixed() ?? null)
    .unwrapOr(null);
}
```

- [ ] **Step 7: Rewrite the four use cases**

`apps/api/src/modules/inflows/application/create-inflow.ts` — replace the whole file (`InflowDeps`, `InflowFields`, `ResolvedInflow` and `resolveInflow` are as in Task 9; `InflowFailure` widens, `creditedWithoutAccount` is new, `createInflow` is rewritten and the `credit_unavailable` guard is gone):

```ts
import { err, ok, type Result } from 'neverthrow';
import {
  Decimal,
  Money,
  type Clock,
  type Currency,
  type CurrencyMismatchError,
  type CurrencyRegistry,
  type InflowError,
  type UnknownCurrencyError,
} from '@magermoney/domain';
import type { CreateInflowInput, InflowDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import {
  freshTarget,
  planCredit,
  writeCredit,
  type CreditPlan,
  type CreditTarget,
} from './credit.js';
import { toInflowDto } from './dto.js';
import type { NewInflow } from './inflow-repository.js';

export type InflowFailure =
  | NotFoundError
  | ValidationError
  | ConflictError
  | UnknownCurrencyError
  | InflowError
  | CurrencyMismatchError;

export const creditedWithoutAccount = () =>
  new ValidationError(
    'A credited amount needs the account it landed on',
    'credited_without_account',
  );

export interface InflowDeps {
  uow: UnitOfWork<Repos>;
  repos: Repos;
  registry: CurrencyRegistry;
  clock: Clock;
}

/** What an inflow is before anyone asks where it landed. */
export interface InflowFields {
  incomeSourceId: string;
  amount: string;
  /** Undefined = the currency of the source. */
  currency?: string | undefined;
  /** Undefined = today. */
  receivedOn?: string | undefined;
  realisedRateToUsd: string | null;
  note: string | null;
}
export type ResolvedInflow = Omit<NewInflow, 'accountId' | 'creditedAmount'>;

/** The checks create and update share: the source is the caller's, the currency exists, the amount and rate are positive, the date is not in the future. */
export async function resolveInflow(
  deps: Pick<InflowDeps, 'registry' | 'clock'>,
  repos: Pick<Repos, 'incomeSources'>,
  userId: string,
  fields: InflowFields,
): Promise<
  Result<
    { data: ResolvedInflow; currency: Currency },
    NotFoundError | ValidationError | UnknownCurrencyError
  >
> {
  const source = await repos.incomeSources.findById(userId, fields.incomeSourceId);
  if (!source) return err(new NotFoundError('income source'));
  const currency = deps.registry.get(fields.currency ?? source.currency);
  if (currency.isErr()) return err(currency.error);
  if (!new Decimal(fields.amount).gt(0))
    return err(new ValidationError('An inflow is more than zero', 'non_positive_amount'));
  if (fields.realisedRateToUsd !== null && !new Decimal(fields.realisedRateToUsd).gt(0))
    return err(new ValidationError('A rate is more than zero', 'rate_not_positive'));
  const today = deps.clock.today();
  const receivedOn = fields.receivedOn ?? today;
  if (receivedOn > today)
    return err(
      new ValidationError('An inflow cannot be dated in the future', 'received_in_future'),
    );
  return ok({
    currency: currency.value,
    data: {
      incomeSourceId: source.id,
      amount: fields.amount,
      currency: currency.value.code,
      receivedOn,
      realisedRateToUsd: fields.realisedRateToUsd,
      note: fields.note,
    },
  });
}

export const createInflow =
  (deps: InflowDeps) =>
  (userId: string, input: CreateInflowInput): Promise<Result<InflowDto, InflowFailure>> =>
    // Every check runs before the first write: an `err` returned from a unit of work does not roll it back.
    deps.uow(async (repos) => {
      let target: CreditTarget | null = null;
      if (input.accountId) {
        const [account] = await repos.accounts.lock(userId, [input.accountId]);
        if (!account) return err(new NotFoundError('account'));
        const fresh = freshTarget(deps.registry, account);
        if (fresh.isErr()) return err(fresh.error);
        target = fresh.value;
      } else if (input.creditedAmount != null) return err(creditedWithoutAccount());
      const resolved = await resolveInflow(deps, repos, userId, {
        incomeSourceId: input.incomeSourceId,
        amount: input.amount,
        currency: input.currency,
        receivedOn: input.receivedOn,
        realisedRateToUsd: input.realisedRateToUsd ?? null,
        note: input.note ?? null,
      });
      if (resolved.isErr()) return err(resolved.error);
      const { data, currency } = resolved.value;
      let plan: CreditPlan | null = null;
      if (target) {
        const planned = planCredit({
          target,
          amount: Money.of(data.amount, currency),
          creditedAmount: input.creditedAmount ?? undefined,
          receivedOn: data.receivedOn,
          clock: deps.clock,
        });
        if (planned.isErr()) return err(planned.error);
        plan = planned.value;
      }
      const row = await repos.inflows.insert(userId, {
        ...data,
        accountId: plan?.accountId ?? null,
        creditedAmount: plan?.credited.toString() ?? null,
      });
      if (plan) await writeCredit(repos, userId, row.id, plan);
      return ok(toInflowDto(row, plan?.realisedRate?.toFixed() ?? null));
    });
```

(The file keeps its `Decimal`, `Clock`, `Currency`, `CurrencyRegistry`, `UnitOfWork`, `Repos` and `NewInflow` imports because `resolveInflow` and the interfaces above it use them. Remove the `credit_unavailable` guard.)

`apps/api/src/modules/inflows/application/update-inflow.ts` — replace the whole file:

```ts
import { err, ok, type Result } from 'neverthrow';
import { Decimal, Money } from '@magermoney/domain';
import type { InflowDto, UpdateInflowInput } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import {
  creditedWithoutAccount,
  resolveInflow,
  type InflowDeps,
  type InflowFailure,
} from './create-inflow.js';
import {
  assertInflowLatest,
  freshTarget,
  planCredit,
  revertedTarget,
  writeCredit,
  type CreditPlan,
} from './credit.js';
import { toInflowDto } from './dto.js';

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

export const updateInflow =
  (deps: InflowDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateInflowInput,
  ): Promise<Result<InflowDto, InflowFailure>> =>
    // Every check runs before the first write: an `err` returned from a unit of work does not roll it back.
    deps.uow(async (repos) => {
      // Learn the accounts before locking; the row read after the lock is what everything below uses.
      const existing = await repos.inflows.findById(userId, id);
      if (!existing) return err(new NotFoundError('inflow'));
      const targetId = input.accountId === undefined ? existing.accountId : input.accountId;
      const ids = [
        ...new Set([existing.accountId, targetId].filter((x): x is string => x !== null)),
      ];
      const locked = ids.length > 0 ? await repos.accounts.lock(userId, ids) : [];
      const current = await repos.inflows.findById(userId, id);
      if (!current || current.accountId !== existing.accountId)
        return err(new NotFoundError('inflow'));

      if (targetId === null && input.creditedAmount != null) return err(creditedWithoutAccount());
      const resolved = await resolveInflow(deps, repos, userId, {
        incomeSourceId: pick(input.incomeSourceId, current.incomeSourceId),
        amount: pick(input.amount, current.amount),
        // An inflow keeps its own currency when it moves to another source.
        currency: pick(input.currency, current.currency),
        receivedOn: pick(input.receivedOn, current.receivedOn),
        realisedRateToUsd: pick(input.realisedRateToUsd, current.realisedRateToUsd),
        note: pick(input.note, current.note),
      });
      if (resolved.isErr()) return err(resolved.error);
      const { data, currency } = resolved.value;

      if (current.accountId !== null) {
        const latest = await assertInflowLatest(repos, userId, current);
        if (latest.isErr()) return err(latest.error);
      }

      let plan: CreditPlan | null = null;
      if (targetId !== null) {
        const account = locked.find((a) => a.id === targetId);
        if (!account) return err(new NotFoundError('account'));
        const sameAccount = targetId === current.accountId;
        const target = sameAccount
          ? await revertedTarget(deps.registry, repos, userId, account, current)
          : freshTarget(deps.registry, account);
        if (target.isErr()) return err(target.error);
        // The stored credited amount still describes this inflow only if neither the money nor the account changed.
        const moneyUnchanged =
          sameAccount &&
          data.currency === current.currency &&
          new Decimal(data.amount).eq(current.amount);
        const planned = planCredit({
          target: target.value,
          amount: Money.of(data.amount, currency),
          creditedAmount:
            input.creditedAmount ??
            (moneyUnchanged ? (current.creditedAmount ?? undefined) : undefined),
          receivedOn: data.receivedOn,
          clock: deps.clock,
        });
        if (planned.isErr()) return err(planned.error);
        plan = planned.value;
      }

      // Revert, rewrite, re-apply.
      if (current.accountId !== null) await repos.balances.deleteByInflow(userId, id);
      const row = await repos.inflows.update(userId, id, {
        ...data,
        accountId: plan?.accountId ?? null,
        creditedAmount: plan?.credited.toString() ?? null,
      });
      if (!row) return err(new NotFoundError('inflow'));
      if (plan) await writeCredit(repos, userId, id, plan);
      return ok(toInflowDto(row, plan?.realisedRate?.toFixed() ?? null));
    });
```

`apps/api/src/modules/inflows/application/delete-inflow.ts` — replace the whole file:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { InflowDeps } from './create-inflow.js';
import { assertInflowLatest } from './credit.js';

export const deleteInflow =
  (deps: InflowDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    deps.uow(async (repos) => {
      const existing = await repos.inflows.findById(userId, id);
      if (!existing) return err(new NotFoundError('inflow'));
      if (existing.accountId !== null) {
        await repos.accounts.lock(userId, [existing.accountId]);
        // Re-read once the lock is held: whatever was written in between is visible now.
        const current = await repos.inflows.findById(userId, id);
        if (!current) return err(new NotFoundError('inflow'));
        if (current.accountId !== null) {
          const latest = await assertInflowLatest(repos, userId, current);
          if (latest.isErr()) return err(latest.error);
          // The account's previous entry becomes its balance again.
          await repos.balances.deleteByInflow(userId, id);
        }
      }
      return (await repos.inflows.delete(userId, id))
        ? ok(undefined)
        : err(new NotFoundError('inflow'));
    });
```

`apps/api/src/modules/inflows/application/list-inflows.ts` — replace the whole file:

```ts
import type { InflowDto, InflowsQuery } from '@magermoney/contracts';
import type { InflowDeps } from './create-inflow.js';
import { realisedRateOf } from './credit.js';
import { toInflowDto } from './dto.js';

export const listInflows =
  (deps: InflowDeps) =>
  async (userId: string, query: InflowsQuery): Promise<InflowDto[]> => {
    const [rows, accounts] = await Promise.all([
      deps.repos.inflows.list(userId, query),
      deps.repos.accounts.list(userId),
    ]);
    const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
    return rows.map((r) =>
      toInflowDto(
        r,
        realisedRateOf(
          r,
          deps.registry,
          r.accountId ? (currencyOf.get(r.accountId) ?? null) : null,
        ),
      ),
    );
  };
```

- [ ] **Step 8: Run the tests**

Run: `cd apps/api && bun run test && bun run typecheck && bun run lint`, then from the repo root `bun run --filter @magermoney/contracts test && bun run typecheck`.
Expected: PASS — 12 new credit cases, the new `errors.test.ts` case, and every earlier API test (the `balances.test.ts` `toMatchObject` assertions tolerate the extra `inflowId: null`). The web typechecks: it reads `BalanceEntryDto` but builds none.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/inflows apps/api/src/modules/accounts apps/api/src/shared/errors/http.ts apps/api/test/inflows-credit.test.ts apps/api/test/errors.test.ts packages/contracts/src/balance-entry.ts \
  apps/web/test/BalanceTimeline.test.ts apps/web/test/RecordBalanceSheet.test.ts apps/web/test/use-record-balance.test.ts apps/web/test/offline-mutations.test.ts
git commit -m "feat(api): credit an inflow to an account through the balance journal"
```

Use the `/git-commit` skill; the message ends with the two trailers from Global Constraints.

---

### Task 11: API — expenses and categories

**Files:**

- Create: `apps/api/src/modules/expenses/application/category-repository.ts`
- Create: `apps/api/src/modules/expenses/application/expense-repository.ts`
- Create: `apps/api/src/modules/expenses/application/dto.ts`
- Create: `apps/api/src/modules/expenses/application/categories.ts`
- Create: `apps/api/src/modules/expenses/application/list-expenses.ts`
- Create: `apps/api/src/modules/expenses/application/save-expense.ts`
- Create: `apps/api/src/modules/expenses/application/delete-expense.ts`
- Create: `apps/api/src/modules/expenses/infrastructure/memory-expense-category-repository.ts`
- Create: `apps/api/src/modules/expenses/infrastructure/memory-expense-repository.ts`
- Create: `apps/api/src/modules/expenses/infrastructure/pg-expense-category-repository.ts`
- Create: `apps/api/src/modules/expenses/infrastructure/pg-expense-repository.ts`
- Create: `apps/api/src/modules/expenses/http/routes.ts`
- Modify (additive): `apps/api/src/app.ts`, `apps/api/src/shared/db/pg-unit-of-work.ts`, `apps/api/test/helpers/deps.ts`
- Test: `apps/api/test/expenses.test.ts`

**Interfaces:**

- Consumes (Task 6, `@magermoney/contracts`): `ExpenseCategoryDtoSchema`/`ExpenseCategoryDto`, `ExpenseCategoryInputSchema`/`ExpenseCategoryInput` (`{ name, icon?, sortOrder? }`), `UpdateExpenseCategoryInputSchema`/`UpdateExpenseCategoryInput`, `ExpenseDtoSchema`/`ExpenseDto`, `ExpenseInputSchema`/`ExpenseInput` (`{ categoryId? | categoryName?, name, amount, currency, period, billingDay?, billingMonth?, isEssential?, activeFrom?, activeTo? }`), `UpdateExpenseInputSchema`/`UpdateExpenseInput`, `IdParamSchema`. Existing: `ERRORS`, `fail` from `modules/accounts/http/routes.ts`; `ValidationError`, `ConflictError`, `NotFoundError` from `shared/errors/http.ts`; `UnitOfWork`, `Repos`, `AppDeps`, `AppEnv`.
- Produces: `ExpenseCategoryRow`, `ExpenseCategoryRepository`, `ExpenseRow`, `ExpenseRepository`, `Repos.expenseCategories`, `Repos.expenses`, `expenseRoutes(deps: AppDeps)`, `ExpenseDeps`, use cases `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `listExpenses`, `createExpense`, `updateExpense`, `deleteExpense`.
- Error codes: 409 `category_name_taken`, 409 `category_has_expenses`, 400 `billing_month_requires_yearly`, 400 `category_required` (neither ref given on create), 400 `category_ambiguous` (both refs given), 400 `negative_amount`, 400 `active_period_invalid` (**an addition to the spec**: `activeTo < activeFrom` would otherwise surface as a 500 from the table check; record it in `docs/discovery/phase-3-execution-ledger.md`), 404 `NOT_FOUND` for an unknown category or expense, 400 `UNKNOWN_CURRENCY`.

The use cases validate the category reference and the amount sign themselves even if the zod schemas of Task 6 already refine them: the schema answers with the generic `VALIDATION` code, the use case with the specific one, and the use case is what `PATCH` relies on after merging with the stored row.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/expenses.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const mk = () => createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
const rent = {
  categoryName: 'Housing',
  name: 'Rent',
  amount: '900.00',
  currency: 'EUR',
  period: 'monthly',
  billingDay: 5,
  isEssential: true,
  activeFrom: '2026-01-01',
};

describe('expense categories', () => {
  it('creates, lists in sort order, renames and hides them from other users', async () => {
    const app = mk();
    const a = await authed(app, 'POST', '/expense-categories', {
      name: 'Subscriptions',
      sortOrder: 2,
    });
    expect(a.status).toBe(201);
    const b = await authed(app, 'POST', '/expense-categories', {
      name: 'Housing',
      icon: 'lucide:home',
      sortOrder: 1,
    });
    expect(await b.json()).toMatchObject({ name: 'Housing', icon: 'lucide:home', sortOrder: 1 });
    const list = await (await authed(app, 'GET', '/expense-categories')).json();
    expect(list.map((c: { name: string }) => c.name)).toEqual(['Housing', 'Subscriptions']);
    expect(
      await (await authed(app, 'GET', '/expense-categories', undefined, OTHER)).json(),
    ).toEqual([]);
    const id = (await a.json()).id;
    const renamed = await authed(app, 'PATCH', `/expense-categories/${id}`, { name: 'Subs' });
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).name).toBe('Subs');
    expect(
      (await authed(app, 'PATCH', `/expense-categories/${id}`, { name: 'X' }, OTHER)).status,
    ).toBe(404);
  });

  it('refuses a duplicate name case-insensitively on create and on rename', async () => {
    const app = mk();
    await authed(app, 'POST', '/expense-categories', { name: 'Housing' });
    const dup = await authed(app, 'POST', '/expense-categories', { name: ' housing ' });
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe('category_name_taken');
    const other = await (await authed(app, 'POST', '/expense-categories', { name: 'Car' })).json();
    const rename = await authed(app, 'PATCH', `/expense-categories/${other.id}`, {
      name: 'HOUSING',
    });
    expect(rename.status).toBe(409);
    expect((await rename.json()).code).toBe('category_name_taken');
    // Renaming a category to its own name in another case is not a conflict.
    expect(
      (await authed(app, 'PATCH', `/expense-categories/${other.id}`, { name: 'CAR' })).status,
    ).toBe(200);
  });

  it('deletes an empty category and refuses one that still has expenses', async () => {
    const app = mk();
    const empty = await (
      await authed(app, 'POST', '/expense-categories', { name: 'Empty' })
    ).json();
    expect((await authed(app, 'DELETE', `/expense-categories/${empty.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/expense-categories/${empty.id}`)).status).toBe(404);
    const expense = await (await authed(app, 'POST', '/expenses', rent)).json();
    const res = await authed(app, 'DELETE', `/expense-categories/${expense.categoryId}`);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('category_has_expenses');
  });
});

describe('expenses', () => {
  it('creates the category on the fly, then reuses it case-insensitively', async () => {
    const app = mk();
    const first = await authed(app, 'POST', '/expenses', rent);
    expect(first.status).toBe(201);
    const dto = await first.json();
    expect(dto).toMatchObject({
      name: 'Rent',
      amount: '900.00',
      currency: 'EUR',
      period: 'monthly',
      billingDay: 5,
      billingMonth: null,
      isEssential: true,
      activeFrom: '2026-01-01',
      activeTo: null,
    });
    const second = await (
      await authed(app, 'POST', '/expenses', {
        ...rent,
        name: 'Utilities',
        categoryName: 'HOUSING',
      })
    ).json();
    expect(second.categoryId).toBe(dto.categoryId);
    expect(await (await authed(app, 'GET', '/expense-categories')).json()).toHaveLength(1);
  });

  it('accepts a categoryId, defaults the optional fields and dates the start today', async () => {
    const app = mk();
    const cat = await (
      await authed(app, 'POST', '/expense-categories', { name: 'Telecom' })
    ).json();
    const res = await authed(app, 'POST', '/expenses', {
      categoryId: cat.id,
      name: 'Internet',
      amount: '29.90',
      currency: 'EUR',
      period: 'monthly',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      categoryId: cat.id,
      billingDay: null,
      billingMonth: null,
      isEssential: false,
      activeFrom: '2026-09-17',
      activeTo: null,
    });
  });

  it('rejects a missing, an ambiguous and an unknown category', async () => {
    const app = mk();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { categoryName: _n, ...bare } = rent;
    const missing = await authed(app, 'POST', '/expenses', bare);
    expect(missing.status).toBe(400);
    const cat = await (
      await authed(app, 'POST', '/expense-categories', { name: 'Housing' })
    ).json();
    const both = await authed(app, 'POST', '/expenses', { ...rent, categoryId: cat.id });
    expect(both.status).toBe(400);
    const unknown = await authed(app, 'POST', '/expenses', {
      ...bare,
      categoryId: '33333333-3333-4333-8333-333333333333',
    });
    expect(unknown.status).toBe(404);
    // Another user's category is as good as unknown.
    const foreign = await authed(app, 'POST', '/expenses', { ...bare, categoryId: cat.id }, OTHER);
    expect(foreign.status).toBe(404);
  });

  it('rejects an unknown currency, a negative amount and an inverted active period', async () => {
    const app = mk();
    const cur = await authed(app, 'POST', '/expenses', { ...rent, currency: 'XYZ' });
    expect(cur.status).toBe(400);
    expect((await cur.json()).code).toBe('UNKNOWN_CURRENCY');
    const neg = await authed(app, 'POST', '/expenses', { ...rent, amount: '-1' });
    expect(neg.status).toBe(400);
    // The contract refuses an inverted period in one payload; `active_period_invalid` is the use case's
    // answer when only the merged row is inverted (see the patch test below).
    const period = await authed(app, 'POST', '/expenses', { ...rent, activeTo: '2025-12-31' });
    expect(period.status).toBe(400);
    expect((await period.json()).code).toBe('VALIDATION');
    // Nothing was created along the way, not even the category.
    expect(await (await authed(app, 'GET', '/expenses')).json()).toEqual([]);
  });

  it('allows billingMonth only on a yearly expense, on create and after a patch', async () => {
    const app = mk();
    // Both fields in one payload: the contract answers before the use case.
    const bad = await authed(app, 'POST', '/expenses', { ...rent, billingMonth: 3 });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('VALIDATION');
    const yearly = await authed(app, 'POST', '/expenses', {
      ...rent,
      name: 'IDE licence',
      period: 'yearly',
      billingDay: 14,
      billingMonth: 3,
    });
    expect(yearly.status).toBe(201);
    const id = (await yearly.json()).id;
    const flip = await authed(app, 'PATCH', `/expenses/${id}`, { period: 'monthly' });
    expect(flip.status).toBe(400);
    expect((await flip.json()).code).toBe('billing_month_requires_yearly');
    const ok = await authed(app, 'PATCH', `/expenses/${id}`, {
      period: 'monthly',
      billingMonth: null,
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      period: 'monthly',
      billingMonth: null,
      billingDay: 14,
    });
  });

  it('patches fields, moves to another category by name, ends through activeTo and stays listed', async () => {
    const app = mk();
    const created = await (await authed(app, 'POST', '/expenses', rent)).json();
    const moved = await authed(app, 'PATCH', `/expenses/${created.id}`, {
      categoryName: 'Home',
      amount: '1600',
      isEssential: false,
    });
    expect(moved.status).toBe(200);
    const dto = await moved.json();
    expect(dto).toMatchObject({ amount: '1600', isEssential: false, name: 'Rent' });
    expect(dto.categoryId).not.toBe(created.categoryId);
    const ended = await authed(app, 'PATCH', `/expenses/${created.id}`, { activeTo: '2026-08-31' });
    expect((await ended.json()).activeTo).toBe('2026-08-31');
    const inverted = await authed(app, 'PATCH', `/expenses/${created.id}`, {
      activeFrom: '2026-09-01',
    });
    expect(inverted.status).toBe(400);
    expect((await inverted.json()).code).toBe('active_period_invalid');
    const list = await (await authed(app, 'GET', '/expenses')).json();
    expect(list).toHaveLength(1);
    expect(list[0].activeTo).toBe('2026-08-31');
    expect(await (await authed(app, 'GET', '/expenses', undefined, OTHER)).json()).toEqual([]);
  });

  it('deletes unconditionally and answers 404 for a missing or foreign expense', async () => {
    const app = mk();
    const created = await (await authed(app, 'POST', '/expenses', rent)).json();
    expect(
      (await authed(app, 'PATCH', `/expenses/${created.id}`, { name: 'X' }, OTHER)).status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', `/expenses/${created.id}`, undefined, OTHER)).status).toBe(
      404,
    );
    expect((await authed(app, 'DELETE', `/expenses/${created.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/expenses/${created.id}`)).status).toBe(404);
  });

  it('requires a signed-in user', async () => {
    const app = mk();
    expect((await app.request('/expenses')).status).toBe(401);
    expect((await app.request('/expense-categories')).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run --filter @magermoney/api test -- test/expenses.test.ts`
Expected: FAIL — every request answers 404 `Route not found` (the routes do not exist yet), so the first assertion `expected 404 to be 201` fails.

- [ ] **Step 3: Write the repository interfaces**

Create `apps/api/src/modules/expenses/application/category-repository.ts`:

```ts
export interface ExpenseCategoryRow {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  sortOrder: number;
}
export type NewExpenseCategory = Omit<ExpenseCategoryRow, 'id' | 'userId'>;
export type ExpenseCategoryPatch = Partial<NewExpenseCategory>;

export interface ExpenseCategoryRepository {
  /** Ordered by sortOrder, then name. */
  list(userId: string): Promise<ExpenseCategoryRow[]>;
  findById(userId: string, id: string): Promise<ExpenseCategoryRow | null>;
  /** Case-insensitive, the name is compared trimmed. */
  findByName(userId: string, name: string): Promise<ExpenseCategoryRow | null>;
  /** `'name_taken'` when the user already has a category with this name in any case. */
  insert(userId: string, data: NewExpenseCategory): Promise<ExpenseCategoryRow | 'name_taken'>;
  update(
    userId: string,
    id: string,
    patch: ExpenseCategoryPatch,
  ): Promise<ExpenseCategoryRow | 'name_taken' | null>;
  delete(userId: string, id: string): Promise<'deleted' | 'not_found' | 'has_expenses'>;
}
```

Create `apps/api/src/modules/expenses/application/expense-repository.ts`:

```ts
import type { ExpensePeriod } from '@magermoney/domain';

export interface ExpenseRow {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  amount: string;
  currency: string;
  period: ExpensePeriod;
  billingDay: number | null;
  billingMonth: number | null;
  isEssential: boolean;
  activeFrom: string; // YYYY-MM-DD
  activeTo: string | null; // YYYY-MM-DD
}
export type NewExpense = Omit<ExpenseRow, 'id' | 'userId'>;
export type ExpensePatch = Partial<NewExpense>;

export interface ExpenseRepository {
  /** Includes ended expenses; ordered by name, then id. */
  list(userId: string): Promise<ExpenseRow[]>;
  findById(userId: string, id: string): Promise<ExpenseRow | null>;
  insert(userId: string, data: NewExpense): Promise<ExpenseRow>;
  update(userId: string, id: string, patch: ExpensePatch): Promise<ExpenseRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
  countByCategory(userId: string, categoryId: string): Promise<number>;
}
```

If Task 4 has not landed yet and `ExpensePeriod` is missing from `@magermoney/domain`, stop and finish Task 4 first; do not redeclare the type here.

Create `apps/api/src/modules/expenses/application/dto.ts`:

```ts
import type { ExpenseCategoryDto, ExpenseDto } from '@magermoney/contracts';
import type { ExpenseCategoryRow } from './category-repository.js';
import type { ExpenseRow } from './expense-repository.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toCategoryDto = ({ userId: _u, ...row }: ExpenseCategoryRow): ExpenseCategoryDto =>
  row;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toExpenseDto = ({ userId: _u, ...row }: ExpenseRow): ExpenseDto => row;
```

- [ ] **Step 4: Write the in-memory repositories**

Create `apps/api/src/modules/expenses/infrastructure/memory-expense-repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type {
  ExpensePatch,
  ExpenseRepository,
  ExpenseRow,
  NewExpense,
} from '../application/expense-repository.js';

export class MemoryExpenseRepository implements ExpenseRepository {
  constructor(public rows: ExpenseRow[] = []) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    return this.mine(userId).sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewExpense) {
    const row: ExpenseRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, patch: ExpensePatch) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    return this.rows.length < before;
  }
  async countByCategory(userId: string, categoryId: string) {
    return this.mine(userId).filter((r) => r.categoryId === categoryId).length;
  }
}
```

Create `apps/api/src/modules/expenses/infrastructure/memory-expense-category-repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type {
  ExpenseCategoryPatch,
  ExpenseCategoryRepository,
  ExpenseCategoryRow,
  NewExpenseCategory,
} from '../application/category-repository.js';
import type { ExpenseRepository } from '../application/expense-repository.js';

const key = (name: string) => name.trim().toLowerCase();

/** Takes the expenses repository so `delete` can refuse like the pg foreign key does. */
export class MemoryExpenseCategoryRepository implements ExpenseCategoryRepository {
  constructor(
    private readonly expenses: Pick<ExpenseRepository, 'countByCategory'>,
    public rows: ExpenseCategoryRow[] = [],
  ) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    return this.mine(userId).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async findByName(userId: string, name: string) {
    return this.mine(userId).find((r) => key(r.name) === key(name)) ?? null;
  }
  async insert(userId: string, data: NewExpenseCategory) {
    if (await this.findByName(userId, data.name)) return 'name_taken' as const;
    const row: ExpenseCategoryRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, patch: ExpenseCategoryPatch) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    if (patch.name !== undefined) {
      const holder = await this.findByName(userId, patch.name);
      if (holder && holder.id !== id) return 'name_taken' as const;
    }
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const row = await this.findById(userId, id);
    if (!row) return 'not_found' as const;
    if ((await this.expenses.countByCategory(userId, id)) > 0) return 'has_expenses' as const;
    this.rows = this.rows.filter((r) => r !== row);
    return 'deleted' as const;
  }
}
```

- [ ] **Step 5: Write the use cases**

Create `apps/api/src/modules/expenses/application/categories.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type {
  ExpenseCategoryDto,
  ExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { ExpenseCategoryPatch } from './category-repository.js';
import { toCategoryDto } from './dto.js';

type CategoryRepos = Pick<Repos, 'expenseCategories'>;

const nameTaken = () =>
  new ConflictError('category_name_taken', 'A category with this name already exists');

export const listCategories =
  (repos: CategoryRepos) =>
  async (userId: string): Promise<ExpenseCategoryDto[]> =>
    (await repos.expenseCategories.list(userId)).map(toCategoryDto);

export const createCategory =
  (repos: CategoryRepos) =>
  async (
    userId: string,
    input: ExpenseCategoryInput,
  ): Promise<Result<ExpenseCategoryDto, ConflictError>> => {
    const sortOrder = input.sortOrder ?? (await repos.expenseCategories.list(userId)).length;
    const row = await repos.expenseCategories.insert(userId, {
      name: input.name.trim(),
      icon: input.icon ?? null,
      sortOrder,
    });
    return row === 'name_taken' ? err(nameTaken()) : ok(toCategoryDto(row));
  };

export const updateCategory =
  (repos: CategoryRepos) =>
  async (
    userId: string,
    id: string,
    input: UpdateExpenseCategoryInput,
  ): Promise<Result<ExpenseCategoryDto, NotFoundError | ConflictError>> => {
    const patch: ExpenseCategoryPatch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
    const row = await repos.expenseCategories.update(userId, id, patch);
    if (row === null) return err(new NotFoundError('category'));
    return row === 'name_taken' ? err(nameTaken()) : ok(toCategoryDto(row));
  };

export const deleteCategory =
  (repos: CategoryRepos) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> => {
    const outcome = await repos.expenseCategories.delete(userId, id);
    if (outcome === 'not_found') return err(new NotFoundError('category'));
    if (outcome === 'has_expenses')
      return err(
        new ConflictError(
          'category_has_expenses',
          'Move or delete the expenses of this category first',
        ),
      );
    return ok(undefined);
  };
```

Create `apps/api/src/modules/expenses/application/list-expenses.ts`:

```ts
import type { ExpenseDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { toExpenseDto } from './dto.js';

/** Ended expenses are part of the list: the client decides what "active today" means. */
export const listExpenses =
  (repos: Pick<Repos, 'expenses'>) =>
  async (userId: string): Promise<ExpenseDto[]> =>
    (await repos.expenses.list(userId)).map(toExpenseDto);
```

Create `apps/api/src/modules/expenses/application/save-expense.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError, type Clock, type CurrencyRegistry } from '@magermoney/domain';
import type { ExpenseDto, ExpenseInput, UpdateExpenseInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import { toExpenseDto } from './dto.js';
import type { ExpensePatch, NewExpense } from './expense-repository.js';

export interface ExpenseDeps {
  /** The category may be created together with the expense, so both writes share a transaction. */
  uow: UnitOfWork<Repos>;
  repos: Pick<Repos, 'expenseCategories' | 'expenses'>;
  registry: CurrencyRegistry;
  clock: Clock;
}
export type ExpenseFailure = NotFoundError | ValidationError | UnknownCurrencyError;

type ExpenseShape = Pick<
  NewExpense,
  'amount' | 'currency' | 'period' | 'billingMonth' | 'activeFrom' | 'activeTo'
>;

/** Everything that can be wrong with an expense without asking the database. Runs on the merged row for a PATCH. */
function checkShape(deps: ExpenseDeps, e: ExpenseShape): Result<true, ExpenseFailure> {
  if (!deps.registry.has(e.currency)) return err(new UnknownCurrencyError(e.currency));
  if (e.amount.trim().startsWith('-'))
    return err(new ValidationError('An expense cannot be negative', 'negative_amount'));
  if (e.billingMonth !== null && e.period !== 'yearly')
    return err(
      new ValidationError(
        'billingMonth is only meaningful for a yearly expense',
        'billing_month_requires_yearly',
      ),
    );
  if (e.activeTo !== null && e.activeTo < e.activeFrom)
    return err(new ValidationError('activeTo is before activeFrom', 'active_period_invalid'));
  return ok(true);
}

type CategoryRef = { categoryId?: string | undefined; categoryName?: string | undefined };

/** `null` when the input names no category at all (a PATCH that leaves it alone). */
async function resolveCategory(
  repos: Repos,
  userId: string,
  ref: CategoryRef,
): Promise<Result<string | null, NotFoundError | ValidationError>> {
  if (ref.categoryId !== undefined && ref.categoryName !== undefined)
    return err(
      new ValidationError('Send categoryId or categoryName, not both', 'category_ambiguous'),
    );
  if (ref.categoryId !== undefined) {
    const found = await repos.expenseCategories.findById(userId, ref.categoryId);
    return found ? ok(found.id) : err(new NotFoundError('category'));
  }
  if (ref.categoryName === undefined) return ok(null);
  const name = ref.categoryName.trim();
  const existing = await repos.expenseCategories.findByName(userId, name);
  if (existing) return ok(existing.id);
  const sortOrder = (await repos.expenseCategories.list(userId)).length;
  const created = await repos.expenseCategories.insert(userId, { name, icon: null, sortOrder });
  if (created !== 'name_taken') return ok(created.id);
  // Lost a race with a parallel request that created the same name: use theirs.
  const winner = await repos.expenseCategories.findByName(userId, name);
  return winner ? ok(winner.id) : err(new NotFoundError('category'));
}

export const createExpense =
  (deps: ExpenseDeps) =>
  (userId: string, input: ExpenseInput): Promise<Result<ExpenseDto, ExpenseFailure>> =>
    deps.uow(async (repos) => {
      const shape: Omit<NewExpense, 'categoryId'> = {
        name: input.name.trim(),
        amount: input.amount,
        currency: input.currency,
        period: input.period,
        billingDay: input.billingDay ?? null,
        billingMonth: input.billingMonth ?? null,
        isEssential: input.isEssential ?? false,
        activeFrom: input.activeFrom ?? deps.clock.today(),
        activeTo: input.activeTo ?? null,
      };
      // Validate before touching the category, so a rejected expense leaves no orphan category behind.
      const checked = checkShape(deps, shape);
      if (checked.isErr()) return err(checked.error);
      const category = await resolveCategory(repos, userId, input);
      if (category.isErr()) return err(category.error);
      if (category.value === null)
        return err(
          new ValidationError('categoryId or categoryName is required', 'category_required'),
        );
      const row = await repos.expenses.insert(userId, { ...shape, categoryId: category.value });
      return ok(toExpenseDto(row));
    });

export const updateExpense =
  (deps: ExpenseDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateExpenseInput,
  ): Promise<Result<ExpenseDto, ExpenseFailure>> =>
    deps.uow(async (repos) => {
      const current = await repos.expenses.findById(userId, id);
      if (!current) return err(new NotFoundError('expense'));
      const patch: ExpensePatch = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.amount !== undefined) patch.amount = input.amount;
      if (input.currency !== undefined) patch.currency = input.currency;
      if (input.period !== undefined) patch.period = input.period;
      if (input.billingDay !== undefined) patch.billingDay = input.billingDay;
      if (input.billingMonth !== undefined) patch.billingMonth = input.billingMonth;
      if (input.isEssential !== undefined) patch.isEssential = input.isEssential;
      if (input.activeFrom !== undefined) patch.activeFrom = input.activeFrom;
      if (input.activeTo !== undefined) patch.activeTo = input.activeTo;
      const checked = checkShape(deps, { ...current, ...patch });
      if (checked.isErr()) return err(checked.error);
      const category = await resolveCategory(repos, userId, input);
      if (category.isErr()) return err(category.error);
      if (category.value !== null) patch.categoryId = category.value;
      const row = await repos.expenses.update(userId, id, patch);
      return row ? ok(toExpenseDto(row)) : err(new NotFoundError('expense'));
    });
```

If `UpdateExpenseInput` types `billingDay`/`billingMonth`/`activeTo` as optional-and-nullable (`number | null | undefined`), the assignments above compile as written. If Task 6 made them non-nullable in the update schema, fix the contract (a PATCH must be able to clear them with `null`), not this file.

Create `apps/api/src/modules/expenses/application/delete-expense.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { Repos } from '../../../app.js';
import { NotFoundError } from '../../../shared/errors/http.js';

/** Expenses carry no history in phase 3, so deleting one is unconditional. Ending it is a PATCH of activeTo. */
export const deleteExpense =
  (repos: Pick<Repos, 'expenses'>) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError>> =>
    (await repos.expenses.delete(userId, id)) ? ok(undefined) : err(new NotFoundError('expense'));
```

- [ ] **Step 6: Write the pg repositories**

Create `apps/api/src/modules/expenses/infrastructure/pg-expense-category-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import type {
  ExpenseCategoryPatch,
  ExpenseCategoryRepository,
  ExpenseCategoryRow,
  NewExpenseCategory,
} from '../application/category-repository.js';

const COLS = 'id, user_id, name, icon, sort_order';
const isPgError = (e: unknown, code: string): boolean =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === code;

export class PgExpenseCategoryRepository implements ExpenseCategoryRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    return this.sql<ExpenseCategoryRow[]>`
      select ${this.sql.unsafe(COLS)} from expense_categories
      where user_id = ${userId} order by sort_order, lower(name)`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<ExpenseCategoryRow[]>`
      select ${this.sql.unsafe(COLS)} from expense_categories where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async findByName(userId: string, name: string) {
    const [row] = await this.sql<ExpenseCategoryRow[]>`
      select ${this.sql.unsafe(COLS)} from expense_categories
      where user_id = ${userId} and lower(name) = lower(${name.trim()})`;
    return row ?? null;
  }
  async insert(userId: string, data: NewExpenseCategory) {
    // `on conflict do nothing` rather than catching 23505: a caught error would abort the surrounding transaction.
    const [row] = await this.sql<ExpenseCategoryRow[]>`
      insert into expense_categories (user_id, name, icon, sort_order)
      values (${userId}, ${data.name}, ${data.icon}, ${data.sortOrder})
      on conflict (user_id, lower(name)) do nothing
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? ('name_taken' as const);
  }
  async update(userId: string, id: string, patch: ExpenseCategoryPatch) {
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.icon !== undefined) data.icon = patch.icon;
    if (patch.sortOrder !== undefined) data.sort_order = patch.sortOrder;
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    if (patch.name !== undefined) {
      const holder = await this.findByName(userId, patch.name);
      if (holder && holder.id !== id) return 'name_taken' as const;
    }
    try {
      const [row] = await this.sql<ExpenseCategoryRow[]>`
        update expense_categories set ${this.sql(data)}
        where user_id = ${userId} and id = ${id} returning ${this.sql.unsafe(COLS)}`;
      return row ?? null;
    } catch (e) {
      // Two renames racing to the same name: the unique index is the last word.
      if (isPgError(e, '23505')) return 'name_taken' as const;
      throw e;
    }
  }
  async delete(userId: string, id: string) {
    const [{ count } = { count: 0 }] = await this.sql<{ count: number }[]>`
      select count(*)::int as count from expenses where user_id = ${userId} and category_id = ${id}`;
    if (count > 0) return 'has_expenses' as const;
    try {
      const res = await this
        .sql`delete from expense_categories where user_id = ${userId} and id = ${id}`;
      return res.count > 0 ? ('deleted' as const) : ('not_found' as const);
    } catch (e) {
      // An expense slipped in between the count and the delete; the foreign key (on delete restrict) caught it.
      if (isPgError(e, '23503')) return 'has_expenses' as const;
      throw e;
    }
  }
}
```

The `on conflict (user_id, lower(name))` target needs the unique expression index from migration `20260917000010_expenses.sql` (Task 7): `create unique index … on public.expense_categories (user_id, lower(name))`. If that index is declared differently, align the conflict target with it.

Create `apps/api/src/modules/expenses/infrastructure/pg-expense-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import type {
  ExpensePatch,
  ExpenseRepository,
  ExpenseRow,
  NewExpense,
} from '../application/expense-repository.js';

/** `active_from` / `active_to` are `date`: read them as text so no timezone can shift the day. */
const COLS = `id, user_id, category_id, name, amount::text as amount, currency, period, billing_day, billing_month,
  is_essential, to_char(active_from, 'YYYY-MM-DD') as active_from, to_char(active_to, 'YYYY-MM-DD') as active_to`;

const toColumns = (p: ExpensePatch): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  if (p.categoryId !== undefined) d.category_id = p.categoryId;
  if (p.name !== undefined) d.name = p.name;
  if (p.amount !== undefined) d.amount = p.amount;
  if (p.currency !== undefined) d.currency = p.currency;
  if (p.period !== undefined) d.period = p.period;
  if (p.billingDay !== undefined) d.billing_day = p.billingDay;
  if (p.billingMonth !== undefined) d.billing_month = p.billingMonth;
  if (p.isEssential !== undefined) d.is_essential = p.isEssential;
  if (p.activeFrom !== undefined) d.active_from = p.activeFrom;
  if (p.activeTo !== undefined) d.active_to = p.activeTo;
  return d;
};

export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    return this.sql<ExpenseRow[]>`
      select ${this.sql.unsafe(COLS)} from expenses where user_id = ${userId} order by lower(name), id`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<ExpenseRow[]>`
      select ${this.sql.unsafe(COLS)} from expenses where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, data: NewExpense) {
    const [row] = await this.sql<ExpenseRow[]>`
      insert into expenses ${this.sql({ user_id: userId, ...toColumns(data) })}
      returning ${this.sql.unsafe(COLS)}`;
    return row!;
  }
  async update(userId: string, id: string, patch: ExpensePatch) {
    const data = toColumns(patch);
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<ExpenseRow[]>`
      update expenses set ${this.sql(data)} where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? null;
  }
  async delete(userId: string, id: string) {
    return (
      (await this.sql`delete from expenses where user_id = ${userId} and id = ${id}`).count > 0
    );
  }
  async countByCategory(userId: string, categoryId: string) {
    const [{ count } = { count: 0 }] = await this.sql<{ count: number }[]>`
      select count(*)::int as count from expenses where user_id = ${userId} and category_id = ${categoryId}`;
    return count;
  }
}
```

- [ ] **Step 7: Write the routes**

Create `apps/api/src/modules/expenses/http/routes.ts`:

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  ExpenseCategoryDtoSchema,
  ExpenseCategoryInputSchema,
  ExpenseDtoSchema,
  ExpenseInputSchema,
  IdParamSchema,
  UpdateExpenseCategoryInputSchema,
  UpdateExpenseInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../application/categories.js';
import { deleteExpense } from '../application/delete-expense.js';
import { listExpenses } from '../application/list-expenses.js';
import { createExpense, updateExpense, type ExpenseDeps } from '../application/save-expense.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });

export function expenseRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: ExpenseDeps = {
    uow: deps.uow,
    repos: deps.repos,
    registry: deps.registry,
    clock: deps.clock,
  };
  const guard = requireUser({ jwks: deps.jwks, secret: deps.jwtSecret });
  r.use('/expense-categories', guard);
  r.use('/expense-categories/*', guard);
  r.use('/expenses', guard);
  r.use('/expenses/*', guard);

  r.openapi(
    createRoute({
      method: 'get',
      path: '/expense-categories',
      security: [{ bearer: [] }],
      responses: { 200: json(z.array(ExpenseCategoryDtoSchema), 'By sort order'), ...ERRORS },
    }),
    async (c) => c.json(await listCategories(deps.repos)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/expense-categories',
      security: [{ bearer: [] }],
      request: { body: body(ExpenseCategoryInputSchema) },
      responses: { 201: json(ExpenseCategoryDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createCategory(deps.repos)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/expense-categories/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateExpenseCategoryInputSchema) },
      responses: { 200: json(ExpenseCategoryDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (
        await updateCategory(deps.repos)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))
      ).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/expense-categories/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteCategory(deps.repos)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );

  r.openapi(
    createRoute({
      method: 'get',
      path: '/expenses',
      security: [{ bearer: [] }],
      responses: { 200: json(z.array(ExpenseDtoSchema), 'Including ended expenses'), ...ERRORS },
    }),
    async (c) => c.json(await listExpenses(deps.repos)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/expenses',
      security: [{ bearer: [] }],
      request: { body: body(ExpenseInputSchema) },
      responses: { 201: json(ExpenseDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createExpense(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/expenses/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateExpenseInputSchema) },
      responses: { 200: json(ExpenseDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateExpense(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/expenses/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteExpense(deps.repos)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
```

- [ ] **Step 8: Wire the module (additive edits — Tasks 8–10 and 12 touch the same three files; add lines, never rewrite the file)**

`apps/api/src/app.ts` — add to the imports:

```ts
import { expenseRoutes } from './modules/expenses/http/routes.js';
import type { ExpenseCategoryRepository } from './modules/expenses/application/category-repository.js';
import type { ExpenseRepository } from './modules/expenses/application/expense-repository.js';
```

add two members to `export interface Repos` (keep whatever is already there):

```ts
expenseCategories: ExpenseCategoryRepository;
expenses: ExpenseRepository;
```

and mount the routes next to the other `app.route('/', …)` calls, before `jobRoutes`:

```ts
app.route('/', expenseRoutes(deps));
```

`apps/api/src/shared/db/pg-unit-of-work.ts` — add the imports and two members to the object returned by `pgRepos`:

```ts
import { PgExpenseCategoryRepository } from '../../modules/expenses/infrastructure/pg-expense-category-repository.js';
import { PgExpenseRepository } from '../../modules/expenses/infrastructure/pg-expense-repository.js';
```

```ts
  expenseCategories: new PgExpenseCategoryRepository(sql),
  expenses: new PgExpenseRepository(sql),
```

`apps/api/test/helpers/deps.ts` — add the imports, and inside `memoryRepos()` build the two repositories and add them to the returned object:

```ts
import { MemoryExpenseCategoryRepository } from '../../src/modules/expenses/infrastructure/memory-expense-category-repository.js';
import { MemoryExpenseRepository } from '../../src/modules/expenses/infrastructure/memory-expense-repository.js';
```

```ts
const expenses = new MemoryExpenseRepository();
const expenseCategories = new MemoryExpenseCategoryRepository(expenses);
// …and in the return statement, next to the existing members:
//   expenseCategories, expenses,
```

`AccountDeps.repos` in `create-account.ts` is a `Pick<Repos, …>`, so widening `Repos` does not break the accounts module.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `bun run --filter @magermoney/api test -- test/expenses.test.ts`
Expected: PASS, 11 tests.

Run: `bun run lint && bun run typecheck && bun run test`
Expected: all green. A typecheck error `Property 'expenseCategories' is missing in type …` points at a `Repos` literal that was not extended (`pgRepos` or `memoryRepos`).

- [ ] **Step 10: Commit**

Use the `/git-commit` skill.

```bash
git add apps/api/src/modules/expenses apps/api/src/app.ts apps/api/src/shared/db/pg-unit-of-work.ts \
  apps/api/test/helpers/deps.ts apps/api/test/expenses.test.ts docs/discovery/phase-3-execution-ledger.md
git commit -m "feat(api): add expenses and expense categories"
```

The ledger gets one line: "400 `active_period_invalid`, `negative_amount`, `category_required`, `category_ambiguous` added to the expenses API beyond spec §4, so table checks never surface as 500; over HTTP the Task 6 contracts answer `VALIDATION` first for anything wrong within one payload, and these codes appear only when the merged row of a PATCH is wrong (or for callers that bypass zod)". The message ends with the two trailers from Global Constraints (`Co-Authored-By: …`, `Claude-Session: …`).

---

### Task 12: API — budgets

**Files:**

- Create: `apps/api/src/modules/budgets/application/budget-repository.ts`
- Create: `apps/api/src/modules/budgets/application/dto.ts`
- Create: `apps/api/src/modules/budgets/application/budgets.ts`
- Create: `apps/api/src/modules/budgets/infrastructure/memory-budget-repository.ts`
- Create: `apps/api/src/modules/budgets/infrastructure/pg-budget-repository.ts`
- Create: `apps/api/src/modules/budgets/http/routes.ts`
- Modify (additive): `apps/api/src/app.ts`, `apps/api/src/shared/db/pg-unit-of-work.ts`, `apps/api/test/helpers/deps.ts`
- Test: `apps/api/test/budgets.test.ts`

**Interfaces:**

- Consumes (Task 6): `BudgetDtoSchema`/`BudgetDto`, `BudgetInputSchema`/`BudgetInput` (`{ name, icon?, monthlyLimit, currency, activeFrom?, activeTo? }`), `UpdateBudgetInputSchema`/`UpdateBudgetInput`, `IdParamSchema`. Existing: `ERRORS`, `fail`, `ValidationError`, `NotFoundError`, `Repos`, `AppDeps`, `AppEnv`.
- Produces: `BudgetRow`, `BudgetRepository`, `Repos.budgets`, `budgetRoutes(deps: AppDeps)`, `BudgetDeps`, use cases `listBudgets`, `createBudget`, `updateBudget`, `deleteBudget`.
- Error codes: 400 `UNKNOWN_CURRENCY`, 400 `negative_amount`, 400 `active_period_invalid` (same addition as Task 11), 404 `NOT_FOUND`. Deletion is unconditional in phase 3 (phase 5 adds 409 `budget_has_spends`).

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/budgets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const mk = () => createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
const food = { name: 'Groceries', monthlyLimit: '1000.00', currency: 'EUR' };

describe('budgets', () => {
  it('creates a budget starting today by default and lists it only to its owner', async () => {
    const app = mk();
    const res = await authed(app, 'POST', '/budgets', food);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      name: 'Groceries',
      icon: null,
      monthlyLimit: '1000.00',
      currency: 'EUR',
      activeFrom: '2026-09-17',
      activeTo: null,
    });
    expect(await (await authed(app, 'GET', '/budgets')).json()).toHaveLength(1);
    expect(await (await authed(app, 'GET', '/budgets', undefined, OTHER)).json()).toEqual([]);
  });

  it('keeps an explicit icon and active period, and lists budgets by name', async () => {
    const app = mk();
    await authed(app, 'POST', '/budgets', { ...food, name: 'Taxi' });
    const res = await authed(app, 'POST', '/budgets', {
      ...food,
      name: 'Eating out',
      icon: 'lucide:utensils',
      activeFrom: '2026-01-01',
      activeTo: '2026-12-31',
    });
    expect(await res.json()).toMatchObject({
      icon: 'lucide:utensils',
      activeFrom: '2026-01-01',
      activeTo: '2026-12-31',
    });
    const list = await (await authed(app, 'GET', '/budgets')).json();
    expect(list.map((b: { name: string }) => b.name)).toEqual(['Eating out', 'Taxi']);
  });

  it('rejects an unknown currency, a negative limit and an inverted active period', async () => {
    const app = mk();
    const cur = await authed(app, 'POST', '/budgets', { ...food, currency: 'XYZ' });
    expect(cur.status).toBe(400);
    expect((await cur.json()).code).toBe('UNKNOWN_CURRENCY');
    expect((await authed(app, 'POST', '/budgets', { ...food, monthlyLimit: '-5' })).status).toBe(
      400,
    );
    const period = await authed(app, 'POST', '/budgets', {
      ...food,
      activeFrom: '2026-09-01',
      activeTo: '2026-08-31',
    });
    expect(period.status).toBe(400);
    // One payload, so the contract answers; the merged-row case below reaches `active_period_invalid`.
    expect((await period.json()).code).toBe('VALIDATION');
    expect(await (await authed(app, 'GET', '/budgets')).json()).toEqual([]);
  });

  it('patches the limit, ends through activeTo, validates the merged period and stays listed', async () => {
    const app = mk();
    const created = await (
      await authed(app, 'POST', '/budgets', { ...food, activeFrom: '2026-01-01' })
    ).json();
    const patched = await authed(app, 'PATCH', `/budgets/${created.id}`, { monthlyLimit: '1200' });
    expect(patched.status).toBe(200);
    expect((await patched.json()).monthlyLimit).toBe('1200');
    const ended = await authed(app, 'PATCH', `/budgets/${created.id}`, { activeTo: '2026-08-31' });
    expect((await ended.json()).activeTo).toBe('2026-08-31');
    const inverted = await authed(app, 'PATCH', `/budgets/${created.id}`, {
      activeFrom: '2026-09-01',
    });
    expect(inverted.status).toBe(400);
    expect((await inverted.json()).code).toBe('active_period_invalid');
    const reopened = await authed(app, 'PATCH', `/budgets/${created.id}`, { activeTo: null });
    expect((await reopened.json()).activeTo).toBeNull();
    expect(await (await authed(app, 'GET', '/budgets')).json()).toHaveLength(1);
  });

  it('deletes unconditionally and answers 404 for a missing or foreign budget', async () => {
    const app = mk();
    const created = await (await authed(app, 'POST', '/budgets', food)).json();
    expect(
      (await authed(app, 'PATCH', `/budgets/${created.id}`, { name: 'X' }, OTHER)).status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', `/budgets/${created.id}`, undefined, OTHER)).status).toBe(
      404,
    );
    expect((await authed(app, 'DELETE', `/budgets/${created.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/budgets/${created.id}`)).status).toBe(404);
  });

  it('requires a signed-in user', async () => {
    expect((await mk().request('/budgets')).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run --filter @magermoney/api test -- test/budgets.test.ts`
Expected: FAIL — `expected 404 to be 201` (no `/budgets` route yet).

- [ ] **Step 3: Write the repository interface, DTO mapper and in-memory repository**

Create `apps/api/src/modules/budgets/application/budget-repository.ts`:

```ts
export interface BudgetRow {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  monthlyLimit: string;
  currency: string;
  activeFrom: string; // YYYY-MM-DD
  activeTo: string | null; // YYYY-MM-DD
}
export type NewBudget = Omit<BudgetRow, 'id' | 'userId'>;
export type BudgetPatch = Partial<NewBudget>;

export interface BudgetRepository {
  /** Includes ended budgets; ordered by name, then id. */
  list(userId: string): Promise<BudgetRow[]>;
  findById(userId: string, id: string): Promise<BudgetRow | null>;
  insert(userId: string, data: NewBudget): Promise<BudgetRow>;
  update(userId: string, id: string, patch: BudgetPatch): Promise<BudgetRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
```

Create `apps/api/src/modules/budgets/application/dto.ts`:

```ts
import type { BudgetDto } from '@magermoney/contracts';
import type { BudgetRow } from './budget-repository.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toBudgetDto = ({ userId: _u, ...row }: BudgetRow): BudgetDto => row;
```

Create `apps/api/src/modules/budgets/infrastructure/memory-budget-repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type {
  BudgetPatch,
  BudgetRepository,
  BudgetRow,
  NewBudget,
} from '../application/budget-repository.js';

export class MemoryBudgetRepository implements BudgetRepository {
  constructor(public rows: BudgetRow[] = []) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    return this.mine(userId).sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewBudget) {
    const row: BudgetRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, patch: BudgetPatch) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    return this.rows.length < before;
  }
}
```

- [ ] **Step 4: Write the use cases**

Create `apps/api/src/modules/budgets/application/budgets.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError, type Clock, type CurrencyRegistry } from '@magermoney/domain';
import type { BudgetDto, BudgetInput, UpdateBudgetInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { BudgetPatch, NewBudget } from './budget-repository.js';
import { toBudgetDto } from './dto.js';

export interface BudgetDeps {
  repos: Pick<Repos, 'budgets'>;
  registry: CurrencyRegistry;
  clock: Clock;
}
export type BudgetFailure = NotFoundError | ValidationError | UnknownCurrencyError;

type BudgetShape = Pick<NewBudget, 'monthlyLimit' | 'currency' | 'activeFrom' | 'activeTo'>;

function checkShape(deps: BudgetDeps, b: BudgetShape): Result<true, BudgetFailure> {
  if (!deps.registry.has(b.currency)) return err(new UnknownCurrencyError(b.currency));
  if (b.monthlyLimit.trim().startsWith('-'))
    return err(new ValidationError('A budget limit cannot be negative', 'negative_amount'));
  if (b.activeTo !== null && b.activeTo < b.activeFrom)
    return err(new ValidationError('activeTo is before activeFrom', 'active_period_invalid'));
  return ok(true);
}

/** Ended budgets are part of the list: the client decides what "active today" means. */
export const listBudgets =
  (deps: BudgetDeps) =>
  async (userId: string): Promise<BudgetDto[]> =>
    (await deps.repos.budgets.list(userId)).map(toBudgetDto);

export const createBudget =
  (deps: BudgetDeps) =>
  async (userId: string, input: BudgetInput): Promise<Result<BudgetDto, BudgetFailure>> => {
    const data: NewBudget = {
      name: input.name.trim(),
      icon: input.icon ?? null,
      monthlyLimit: input.monthlyLimit,
      currency: input.currency,
      activeFrom: input.activeFrom ?? deps.clock.today(),
      activeTo: input.activeTo ?? null,
    };
    const checked = checkShape(deps, data);
    if (checked.isErr()) return err(checked.error);
    return ok(toBudgetDto(await deps.repos.budgets.insert(userId, data)));
  };

export const updateBudget =
  (deps: BudgetDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateBudgetInput,
  ): Promise<Result<BudgetDto, BudgetFailure>> => {
    const current = await deps.repos.budgets.findById(userId, id);
    if (!current) return err(new NotFoundError('budget'));
    const patch: BudgetPatch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.monthlyLimit !== undefined) patch.monthlyLimit = input.monthlyLimit;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.activeFrom !== undefined) patch.activeFrom = input.activeFrom;
    if (input.activeTo !== undefined) patch.activeTo = input.activeTo;
    const checked = checkShape(deps, { ...current, ...patch });
    if (checked.isErr()) return err(checked.error);
    const row = await deps.repos.budgets.update(userId, id, patch);
    return row ? ok(toBudgetDto(row)) : err(new NotFoundError('budget'));
  };

/** No spends exist before phase 5, so nothing can refer to a budget yet. */
export const deleteBudget =
  (deps: BudgetDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError>> =>
    (await deps.repos.budgets.delete(userId, id))
      ? ok(undefined)
      : err(new NotFoundError('budget'));
```

- [ ] **Step 5: Write the pg repository**

Create `apps/api/src/modules/budgets/infrastructure/pg-budget-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import type {
  BudgetPatch,
  BudgetRepository,
  BudgetRow,
  NewBudget,
} from '../application/budget-repository.js';

/** `active_from` / `active_to` are `date`: read them as text so no timezone can shift the day. */
const COLS = `id, user_id, name, icon, monthly_limit::text as monthly_limit, currency,
  to_char(active_from, 'YYYY-MM-DD') as active_from, to_char(active_to, 'YYYY-MM-DD') as active_to`;

const toColumns = (p: BudgetPatch): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  if (p.name !== undefined) d.name = p.name;
  if (p.icon !== undefined) d.icon = p.icon;
  if (p.monthlyLimit !== undefined) d.monthly_limit = p.monthlyLimit;
  if (p.currency !== undefined) d.currency = p.currency;
  if (p.activeFrom !== undefined) d.active_from = p.activeFrom;
  if (p.activeTo !== undefined) d.active_to = p.activeTo;
  return d;
};

export class PgBudgetRepository implements BudgetRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    return this.sql<BudgetRow[]>`
      select ${this.sql.unsafe(COLS)} from budgets where user_id = ${userId} order by lower(name), id`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<BudgetRow[]>`
      select ${this.sql.unsafe(COLS)} from budgets where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, data: NewBudget) {
    const [row] = await this.sql<BudgetRow[]>`
      insert into budgets ${this.sql({ user_id: userId, ...toColumns(data) })}
      returning ${this.sql.unsafe(COLS)}`;
    return row!;
  }
  async update(userId: string, id: string, patch: BudgetPatch) {
    const data = toColumns(patch);
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<BudgetRow[]>`
      update budgets set ${this.sql(data)} where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? null;
  }
  async delete(userId: string, id: string) {
    return (await this.sql`delete from budgets where user_id = ${userId} and id = ${id}`).count > 0;
  }
}
```

- [ ] **Step 6: Write the routes**

Create `apps/api/src/modules/budgets/http/routes.ts`:

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  BudgetDtoSchema,
  BudgetInputSchema,
  IdParamSchema,
  UpdateBudgetInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
  type BudgetDeps,
} from '../application/budgets.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });

export function budgetRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: BudgetDeps = { repos: deps.repos, registry: deps.registry, clock: deps.clock };
  const guard = requireUser({ jwks: deps.jwks, secret: deps.jwtSecret });
  r.use('/budgets', guard);
  r.use('/budgets/*', guard);

  r.openapi(
    createRoute({
      method: 'get',
      path: '/budgets',
      security: [{ bearer: [] }],
      responses: { 200: json(z.array(BudgetDtoSchema), 'Including ended budgets'), ...ERRORS },
    }),
    async (c) => c.json(await listBudgets(uc)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/budgets',
      security: [{ bearer: [] }],
      request: { body: body(BudgetInputSchema) },
      responses: { 201: json(BudgetDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createBudget(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/budgets/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateBudgetInputSchema) },
      responses: { 200: json(BudgetDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateBudget(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/budgets/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteBudget(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
```

- [ ] **Step 7: Wire the module (additive edits)**

`apps/api/src/app.ts` — add:

```ts
import { budgetRoutes } from './modules/budgets/http/routes.js';
import type { BudgetRepository } from './modules/budgets/application/budget-repository.js';
```

one member in `export interface Repos`:

```ts
budgets: BudgetRepository;
```

and, next to the other `app.route('/', …)` calls, before `jobRoutes`:

```ts
app.route('/', budgetRoutes(deps));
```

`apps/api/src/shared/db/pg-unit-of-work.ts` — add the import and one member in `pgRepos`:

```ts
import { PgBudgetRepository } from '../../modules/budgets/infrastructure/pg-budget-repository.js';
```

```ts
  budgets: new PgBudgetRepository(sql),
```

`apps/api/test/helpers/deps.ts` — add the import and one member in the object `memoryRepos()` returns:

```ts
import { MemoryBudgetRepository } from '../../src/modules/budgets/infrastructure/memory-budget-repository.js';
```

```ts
    budgets: new MemoryBudgetRepository(),
```

After Tasks 8–12 `memoryRepos()` reads as follows — check yours against it; the order matters because the inflow repository plugs into sources and accounts, and the category repository into expenses:

```ts
export function memoryRepos() {
  const balances = new MemoryBalanceRepository();
  const accounts = new MemoryAccountRepository(balances);
  const transfers = new MemoryTransferRepository(accounts);
  const incomeSources = new MemoryIncomeSourceRepository();
  const inflows = new MemoryInflowRepository(incomeSources, accounts);
  const expenses = new MemoryExpenseRepository();
  const expenseCategories = new MemoryExpenseCategoryRepository(expenses);
  return {
    accounts,
    balances,
    transfers,
    incomeSources,
    inflows,
    expenseCategories,
    expenses,
    budgets: new MemoryBudgetRepository(),
  };
}
```

`Repos` in `app.ts` and the object returned by `pgRepos` carry the same eight members: `accounts`, `balances`, `transfers`, `incomeSources`, `inflows`, `expenseCategories`, `expenses`, `budgets`; the four route factories are mounted in the order `incomeSourceRoutes`, `inflowRoutes`, `expenseRoutes`, `budgetRoutes`, all before `jobRoutes`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bun run --filter @magermoney/api test -- test/budgets.test.ts`
Expected: PASS, 6 tests.

Run: `bun run lint && bun run typecheck && bun run test`
Expected: all green.

- [ ] **Step 9: Commit**

Use the `/git-commit` skill.

```bash
git add apps/api/src/modules/budgets apps/api/src/app.ts apps/api/src/shared/db/pg-unit-of-work.ts \
  apps/api/test/helpers/deps.ts apps/api/test/budgets.test.ts
git commit -m "feat(api): add budgets"
```

The message ends with the two trailers from Global Constraints (`Co-Authored-By: …`, `Claude-Session: …`).

---

### Task 13: API — pg integration tests for phase 3

**Assumes** (written by Tasks 7–10; if a name differs in the code, adjust the import or the call in the test, never the production code, unless the test exposes a real defect):

- Migrations 0007–0011 are in `supabase/migrations` with the columns and checks of spec §3.
- `apps/api/src/modules/income-sources/application/create-income-source.ts` exports `createIncomeSource(deps)(userId, input: IncomeSourceInput): Promise<Result<IncomeSourceDto, …>>`; `update-income-source.ts` exports `updateIncomeSource(deps)(userId, id, input: UpdateIncomeSourceInput)`.
- `apps/api/src/modules/inflows/application/create-inflow.ts`, `update-inflow.ts`, `delete-inflow.ts` export `createInflow(deps)(userId, input: CreateInflowInput)`, `updateInflow(deps)(userId, id, input: UpdateInflowInput)`, `deleteInflow(deps)(userId, id)`, all returning `Promise<Result<…>>`.
- Their `deps` have the shape of `TransferDeps`: `{ uow, repos, registry, clock }`.
- A refused edit of a credited Inflow is a `ConflictError` whose `code` is `'inflow_not_latest'`.
- `IncomeSourceRepository.lockAll(userId)` (Task 8) takes `pg_advisory_xact_lock(hashtext('income_sources:' || userId))`, and `createIncomeSource` / `updateIncomeSource` call it as the first statement of their unit of work whenever `input.isPrimary === true`. The two concurrency tests in `pg-income-source-primary.test.ts` expect BOTH claimants to succeed, not one to lose on the unique index.
- Task 7 already ships `test/integration/pg-phase3-schema.test.ts` (checks, cascade/restrict, the single-primary index, the `(user_id, lower(name))` unique index). Do not repeat those constraint assertions here; this task covers repositories, use-case concurrency and RLS.

**Files:**

- Create: `apps/api/test/integration/helpers.ts`
- Create: `apps/api/test/integration/pg-phase3-repositories.test.ts`
- Create: `apps/api/test/integration/pg-inflow-credit-concurrency.test.ts`
- Create: `apps/api/test/integration/pg-income-source-primary.test.ts`
- Create: `apps/api/test/integration/pg-phase3-rls.test.ts`

**Interfaces:**

- Consumes: `pgRepos`, `pgUnitOfWork` (`src/shared/db/pg-unit-of-work.ts`), `createDb` (`src/shared/db/client.ts`), `createTransfer` (`src/modules/transfers/application/create-transfer.ts`), the use cases named under **Assumes**, `Repos.expenseCategories`, `Repos.expenses`, `Repos.budgets` (Tasks 11–12).
- Produces: nothing other tasks rely on. `test/integration/helpers.ts` exports `sql`, `deps`, `newUser()`, `usd(name)` for these four files only; the existing integration tests keep their own inline helpers.

These tests need the local Supabase stack. They are not TDD in the red-green sense: the code under test exists already, so a test that fails here is a finding. Fix the production code in the module that owns it (and say so in the ledger) rather than weakening the assertion.

- [ ] **Step 1: Start the local stack and export the environment**

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector
supabase db reset
eval "$(supabase status -o env)"
export DATABASE_URL="$DB_URL" SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_JWT_SECRET="$JWT_SECRET" CRON_SECRET=ci-cron
```

Expected: `supabase db reset` applies migrations `…0001` through `…0011` without an error. Keep this shell for the following steps (the exports are per shell). Supabase CLI lives at `~/.hermes/node/bin` on the owner's machine.

- [ ] **Step 2: Write the shared helper**

Create `apps/api/test/integration/helpers.ts`:

```ts
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';
import { pgRepos, pgUnitOfWork } from '../../src/shared/db/pg-unit-of-work.js';

export const sql = createDb(process.env.DATABASE_URL!);
/** The dependency bag every phase 2–3 use case accepts. */
export const deps = {
  uow: pgUnitOfWork(sql),
  repos: pgRepos(sql),
  registry: CurrencyRegistry.default(),
  clock: new SystemClock(),
};

export async function newUser(prefix = 'p3'): Promise<string> {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await admin.auth.admin.createUser({
    email: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

export const usd = (name: string) => ({
  name,
  bank: 'B',
  country: 'US',
  currency: 'USD',
  kind: 'bank_account' as const,
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
});

export const salary = {
  name: 'Salary',
  grossAmount: '1000',
  currency: 'USD',
  taxRate: '0',
  commissionRate: '0',
  payDays: [10, 25],
  isPrimary: false,
  activeFrom: '2026-01-01',
};
```

- [ ] **Step 3: Write the repository round-trip test**

Create `apps/api/test/integration/pg-phase3-repositories.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createIncomeSource } from '../../src/modules/income-sources/application/create-income-source.js';
import { createInflow } from '../../src/modules/inflows/application/create-inflow.js';
import { deps, newUser, salary, sql, usd } from './helpers.js';

const { repos } = deps;

describe('phase 3 pg repositories', () => {
  let uid: string;
  let other: string;
  beforeAll(async () => {
    uid = await newUser('repo');
    other = await newUser('repo');
  });

  it('categories: unique per user case-insensitively, ordered, restricted delete', async () => {
    const housing = await repos.expenseCategories.insert(uid, {
      name: 'Housing',
      icon: null,
      sortOrder: 1,
    });
    const subs = await repos.expenseCategories.insert(uid, {
      name: 'Subscriptions',
      icon: 'lucide:tv',
      sortOrder: 0,
    });
    if (housing === 'name_taken' || subs === 'name_taken') throw new Error('unexpected name_taken');
    expect(
      await repos.expenseCategories.insert(uid, { name: 'HOUSING', icon: null, sortOrder: 2 }),
    ).toBe('name_taken');
    // The same name is free for another user.
    expect(
      await repos.expenseCategories.insert(other, { name: 'Housing', icon: null, sortOrder: 0 }),
    ).not.toBe('name_taken');
    expect((await repos.expenseCategories.list(uid)).map((c) => c.name)).toEqual([
      'Subscriptions',
      'Housing',
    ]);
    expect((await repos.expenseCategories.findByName(uid, '  housing '))?.id).toBe(housing.id);
    expect(await repos.expenseCategories.findById(other, housing.id)).toBeNull();
    expect(await repos.expenseCategories.update(uid, subs.id, { name: 'housing' })).toBe(
      'name_taken',
    );
    expect(
      await repos.expenseCategories.update(uid, subs.id, { name: 'Subs', sortOrder: 5 }),
    ).toMatchObject({
      name: 'Subs',
      sortOrder: 5,
      icon: 'lucide:tv',
    });
    expect(await repos.expenseCategories.update(other, subs.id, { name: 'X' })).toBeNull();

    await repos.expenses.insert(uid, {
      categoryId: housing.id,
      name: 'Rent',
      amount: '900.00',
      currency: 'EUR',
      period: 'monthly',
      billingDay: 5,
      billingMonth: null,
      isEssential: true,
      activeFrom: '2026-01-01',
      activeTo: null,
    });
    expect(await repos.expenseCategories.delete(uid, housing.id)).toBe('has_expenses');
    expect(await repos.expenseCategories.delete(other, subs.id)).toBe('not_found');
    expect(await repos.expenseCategories.delete(uid, subs.id)).toBe('deleted');
  });

  it('expenses: dates and numerics round-trip as strings, patch clears nullable columns', async () => {
    const cat = await repos.expenseCategories.insert(uid, {
      name: 'Software',
      icon: null,
      sortOrder: 9,
    });
    if (cat === 'name_taken') throw new Error('unexpected name_taken');
    const created = await repos.expenses.insert(uid, {
      categoryId: cat.id,
      name: 'IDE licence',
      amount: '45.480000000000000001',
      currency: 'EUR',
      period: 'yearly',
      billingDay: 31,
      billingMonth: 12,
      isEssential: false,
      activeFrom: '2026-01-01',
      activeTo: '2026-12-31',
    });
    expect(created).toMatchObject({
      amount: '45.480000000000000001',
      period: 'yearly',
      billingDay: 31,
      billingMonth: 12,
      activeFrom: '2026-01-01',
      activeTo: '2026-12-31',
    });
    const patched = await repos.expenses.update(uid, created.id, {
      period: 'monthly',
      billingMonth: null,
      activeTo: null,
    });
    expect(patched).toMatchObject({
      period: 'monthly',
      billingMonth: null,
      activeTo: null,
      billingDay: 31,
    });
    expect(await repos.expenses.countByCategory(uid, cat.id)).toBe(1);
    expect(await repos.expenses.findById(other, created.id)).toBeNull();
    expect(await repos.expenses.update(other, created.id, { name: 'X' })).toBeNull();
    expect(await repos.expenses.delete(other, created.id)).toBe(false);
    expect((await repos.expenses.list(uid)).some((e) => e.id === created.id)).toBe(true);
    expect(await repos.expenses.delete(uid, created.id)).toBe(true);
    expect(await repos.expenses.countByCategory(uid, cat.id)).toBe(0);
  });

  it('expenses: the table refuses billing_month on a monthly row', async () => {
    const cat = await repos.expenseCategories.insert(uid, {
      name: 'Checks',
      icon: null,
      sortOrder: 10,
    });
    if (cat === 'name_taken') throw new Error('unexpected name_taken');
    await expect(
      repos.expenses.insert(uid, {
        categoryId: cat.id,
        name: 'Broken',
        amount: '1',
        currency: 'EUR',
        period: 'monthly',
        billingDay: null,
        billingMonth: 3,
        isEssential: false,
        activeFrom: '2026-01-01',
        activeTo: null,
      }),
    ).rejects.toThrow();
  });

  it('budgets: round-trip, patch, isolation, delete', async () => {
    const b = await repos.budgets.insert(uid, {
      name: 'Groceries',
      icon: null,
      monthlyLimit: '600.00',
      currency: 'EUR',
      activeFrom: '2026-09-01',
      activeTo: null,
    });
    expect(b).toMatchObject({ monthlyLimit: '600.00', activeFrom: '2026-09-01', activeTo: null });
    expect(
      await repos.budgets.update(uid, b.id, { monthlyLimit: '750', activeTo: '2026-12-31' }),
    ).toMatchObject({
      monthlyLimit: '750',
      activeTo: '2026-12-31',
    });
    expect(await repos.budgets.findById(other, b.id)).toBeNull();
    expect(await repos.budgets.list(other)).toEqual([]);
    expect(await repos.budgets.delete(other, b.id)).toBe(false);
    expect(await repos.budgets.delete(uid, b.id)).toBe(true);
  });

  it('income sources and inflows: a credited inflow persists with its balance entry', async () => {
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    expect(source).toMatchObject({
      payDays: [10, 25],
      activeFrom: '2026-01-01',
      activeTo: null,
      netMonthly: '1000',
    });
    const account = await repos.accounts.create(uid, usd('Payroll'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const inflow = (
      await createInflow(deps)(uid, {
        incomeSourceId: source.id,
        amount: '50',
        accountId: account.id,
      })
    )._unsafeUnwrap();
    expect(inflow).toMatchObject({
      amount: '50',
      currency: 'USD',
      accountId: account.id,
      creditedAmount: '50',
    });
    expect((await repos.accounts.findById(uid, account.id))?.balance).toBe('150');
    const entries = await sql<{ origin: string; inflowId: string | null; amount: string }[]>`
      select origin, inflow_id, amount::text as amount from balance_entries
      where user_id = ${uid} and account_id = ${account.id} order by recorded_at desc, created_at desc limit 1`;
    expect(entries[0]).toEqual({ origin: 'inflow', inflowId: inflow.id, amount: '150' });
    // The account can no longer be deleted: an inflow points at it.
    expect(await repos.accounts.delete(uid, account.id)).toBe('has_inflows');
  });
});
```

`netMonthly` is `'1000'`, not `'1000.00'`: `Money.round()` trims to the currency scale and `Money.toString()` is `Decimal.toFixed()`, which prints no trailing zeros.

- [ ] **Step 4: Run it**

Run (in the shell from Step 1): `bun run --filter @magermoney/api test:integration -- test/integration/pg-phase3-repositories.test.ts`
Expected: PASS, 5 tests. A failure in `insert` with `there is no unique or exclusion constraint matching the ON CONFLICT specification` means migration 0010 lacks the unique index on `(user_id, lower(name))`; fix the migration, `supabase db reset`, rerun.

- [ ] **Step 5: Write the credit concurrency test**

Create `apps/api/test/integration/pg-inflow-credit-concurrency.test.ts`:

```ts
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { createIncomeSource } from '../../src/modules/income-sources/application/create-income-source.js';
import { createInflow } from '../../src/modules/inflows/application/create-inflow.js';
import { deleteInflow } from '../../src/modules/inflows/application/delete-inflow.js';
import { updateInflow } from '../../src/modules/inflows/application/update-inflow.js';
import { createTransfer } from '../../src/modules/transfers/application/create-transfer.js';
import { deps, newUser, salary, sql, usd } from './helpers.js';

const { repos } = deps;

describe('credited inflows under concurrency', () => {
  it('a credit racing a transfer on the same account never loses an update', async () => {
    const uid = await newUser('race');
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    const main = await repos.accounts.create(uid, usd('main'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const savings = await repos.accounts.create(uid, usd('savings'));

    const [credit, transfer] = await Promise.all([
      createInflow(deps)(uid, { incomeSourceId: source.id, amount: '50', accountId: main.id }),
      createTransfer(deps)(uid, {
        fromAccountId: main.id,
        toAccountId: savings.id,
        amountSent: '70',
      }),
    ]);

    // The account lock serialises the two writes. Whichever ran second either built on the first one's
    // balance or was refused as "not the latest"; it never overwrote it. So the final balance is exactly
    // the opening balance plus the writes that report success.
    expect(credit.isOk() || transfer.isOk()).toBe(true);
    const expected = new Decimal(100)
      .plus(credit.isOk() ? 50 : 0)
      .minus(transfer.isOk() ? 70 : 0)
      .toFixed();
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe(expected);
    expect((await repos.accounts.findById(uid, savings.id))?.balance ?? '0').toBe(
      transfer.isOk() ? '70' : '0',
    );
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from balance_entries where user_id = ${uid} and account_id = ${main.id}`;
    expect(count).toBe(1 + (credit.isOk() ? 1 : 0) + (transfer.isOk() ? 1 : 0));
    if (credit.isErr())
      expect(['credit_not_latest']).toContain((credit.error as { code: string }).code);
    if (transfer.isErr())
      expect(['transfer_not_latest']).toContain((transfer.error as { code: string }).code);
  });

  it('two simultaneous credits to one account both land', async () => {
    const uid = await newUser('race');
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    const main = await repos.accounts.create(uid, usd('main'), {
      amount: '10',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const run = (amount: string) =>
      createInflow(deps)(uid, { incomeSourceId: source.id, amount, accountId: main.id });
    const results = await Promise.all([run('5'), run('7')]);
    const landed = results.filter((r) => r.isOk());
    expect(landed.length).toBeGreaterThanOrEqual(1);
    const sum = results.reduce(
      (acc, r, i) => (r.isOk() ? acc.plus(i === 0 ? 5 : 7) : acc),
      new Decimal(10),
    );
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe(sum.toFixed());
  });

  it('refuses to edit or delete a credited inflow once a newer entry exists, and leaves everything intact', async () => {
    const uid = await newUser('race');
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    const main = await repos.accounts.create(uid, usd('main'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const inflow = (
      await createInflow(deps)(uid, { incomeSourceId: source.id, amount: '50', accountId: main.id })
    )._unsafeUnwrap();
    // A newer declared balance supersedes the credit. Written through the repository so the date can sit a minute ahead.
    await repos.balances.insert(uid, {
      accountId: main.id,
      amount: '140',
      recordedAt: new Date(Date.now() + 60_000).toISOString(),
      origin: 'manual',
      transferId: null,
      inflowId: null,
      note: null,
    });

    const edited = await updateInflow(deps)(uid, inflow.id, { amount: '60' });
    expect(edited.isErr()).toBe(true);
    expect((edited._unsafeUnwrapErr() as { code: string }).code).toBe('inflow_not_latest');
    const removed = await deleteInflow(deps)(uid, inflow.id);
    expect(removed.isErr()).toBe(true);
    expect((removed._unsafeUnwrapErr() as { code: string }).code).toBe('inflow_not_latest');

    const [row] = await sql<{ amount: string; creditedAmount: string }[]>`
      select amount::text as amount, credited_amount::text as credited_amount from inflows
      where user_id = ${uid} and id = ${inflow.id}`;
    expect(row).toEqual({ amount: '50', creditedAmount: '50' });
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe('140');
  });

  it('edits and deletes a credited inflow while its entry is still the latest', async () => {
    const uid = await newUser('race');
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    const main = await repos.accounts.create(uid, usd('main'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const inflow = (
      await createInflow(deps)(uid, { incomeSourceId: source.id, amount: '50', accountId: main.id })
    )._unsafeUnwrap();
    expect((await updateInflow(deps)(uid, inflow.id, { amount: '80' })).isOk()).toBe(true);
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe('180');
    expect((await deleteInflow(deps)(uid, inflow.id)).isOk()).toBe(true);
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe('100');
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from balance_entries where user_id = ${uid} and origin = 'inflow'`;
    expect(count).toBe(0);
  });
});
```

`NewBalanceEntry` gains `inflowId` in Task 10, which is why the manual insert above passes `inflowId: null`. `decimal.js` is already a dependency of `@magermoney/api`.

- [ ] **Step 6: Run it**

Run: `bun run --filter @magermoney/api test:integration -- test/integration/pg-inflow-credit-concurrency.test.ts`
Expected: PASS, 4 tests. If the first test ends with a balance of `150` or `30` while both results are `ok`, the credit path reads the latest balance before taking the account lock: in `create-inflow.ts` the `repos.accounts.lock(userId, [accountId])` call must come first inside the unit of work and the balance must be read from the rows it returns. Fix it there and note the defect in the ledger.

- [ ] **Step 7: Write the primary-source concurrency test**

Create `apps/api/test/integration/pg-income-source-primary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createIncomeSource } from '../../src/modules/income-sources/application/create-income-source.js';
import { updateIncomeSource } from '../../src/modules/income-sources/application/update-income-source.js';
import { deps, newUser, salary, sql } from './helpers.js';

const primaries = async (uid: string) =>
  (
    await sql<{ id: string }[]>`
      select id from income_sources where user_id = ${uid} and is_primary order by id`
  ).map((r) => r.id);

describe('the primary income source', () => {
  it('moves from one source to another', async () => {
    const uid = await newUser('prim');
    const a = (
      await createIncomeSource(deps)(uid, { ...salary, name: 'A', isPrimary: true })
    )._unsafeUnwrap();
    const b = (
      await createIncomeSource(deps)(uid, { ...salary, name: 'B', isPrimary: true })
    )._unsafeUnwrap();
    expect(await primaries(uid)).toEqual([b.id]);
    expect((await updateIncomeSource(deps)(uid, a.id, { isPrimary: true })).isOk()).toBe(true);
    expect(await primaries(uid)).toEqual([a.id]);
  });

  it('stays single when two sources claim it at the same moment', async () => {
    const uid = await newUser('prim');
    const a = (await createIncomeSource(deps)(uid, { ...salary, name: 'A' }))._unsafeUnwrap();
    const b = (await createIncomeSource(deps)(uid, { ...salary, name: 'B' }))._unsafeUnwrap();
    // Task 8 queues the claimants on `incomeSources.lockAll` (a transaction-scoped advisory lock),
    // so neither trips the unique index: both succeed, one after the other, and the last one holds the flag.
    const results = await Promise.all([
      updateIncomeSource(deps)(uid, a.id, { isPrimary: true }),
      updateIncomeSource(deps)(uid, b.id, { isPrimary: true }),
    ]);
    expect(results.every((r) => r.isOk())).toBe(true);
    const now = await primaries(uid);
    expect(now).toHaveLength(1);
    expect([a.id, b.id]).toContain(now[0]);
  });

  it('stays single when two new sources are created as primary at the same moment, the user having none', async () => {
    const uid = await newUser('prim');
    // No rows to lock yet: this is why the lock is advisory and not `for update`.
    const results = await Promise.all([
      createIncomeSource(deps)(uid, { ...salary, name: 'A', isPrimary: true }),
      createIncomeSource(deps)(uid, { ...salary, name: 'B', isPrimary: true }),
    ]);
    expect(results.every((r) => r.isOk())).toBe(true);
    expect(await primaries(uid)).toHaveLength(1);
  });

  it('is scoped to the user: one primary each', async () => {
    const u1 = await newUser('prim');
    const u2 = await newUser('prim');
    const s1 = (await createIncomeSource(deps)(u1, { ...salary, isPrimary: true }))._unsafeUnwrap();
    const s2 = (await createIncomeSource(deps)(u2, { ...salary, isPrimary: true }))._unsafeUnwrap();
    expect(await primaries(u1)).toEqual([s1.id]);
    expect(await primaries(u2)).toEqual([s2.id]);
  });

  it('the partial unique index is the last line of defence', async () => {
    const uid = await newUser('prim');
    await createIncomeSource(deps)(uid, { ...salary, name: 'A', isPrimary: true });
    await expect(
      sql`insert into income_sources (user_id, name, gross_amount, currency, is_primary, active_from)
          values (${uid}, 'forced', 1, 'USD', true, '2026-01-01')`,
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 8: Run it**

Run: `bun run --filter @magermoney/api test:integration -- test/integration/pg-income-source-primary.test.ts`
Expected: PASS, 5 tests. The two concurrency tests rely on Task 8's `IncomeSourceRepository.lockAll(userId)` (`select pg_advisory_xact_lock(hashtext('income_sources:' || userId))`) being the first statement of `createIncomeSource` / `updateIncomeSource` whenever `input.isPrimary === true`. If one of them rejects with a unique violation, that call is missing or comes after the first read — fix it in Task 8's use cases, not in the test, and record the fix in the ledger.

- [ ] **Step 9: Write the RLS test**

Create `apps/api/test/integration/pg-phase3-rls.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface Person {
  c: SupabaseClient;
  id: string;
}

/** A real signed-in client, so every statement runs as `authenticated` with this user's `auth.uid()`. */
async function person(tag: string): Promise<Person> {
  const email = `rls3-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const admin = createClient(url, service);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'pw-123456',
    email_confirm: true,
  });
  if (error) throw error;
  const c = createClient(url, anon);
  await c.auth.signInWithPassword({ email, password: 'pw-123456' });
  return { c, id: data.user!.id };
}

describe('RLS on the phase 3 tables', () => {
  let a: Person;
  let b: Person;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    a = await person('a');
    b = await person('b');
    const insert = async (table: string, row: Record<string, unknown>) => {
      const { data, error } = await a.c
        .from(table)
        .insert({ user_id: a.id, ...row })
        .select('id')
        .single();
      expect(error, `${table}: ${error?.message}`).toBeNull();
      ids[table] = data!.id as string;
    };
    await insert('income_sources', {
      name: 'Salary',
      gross_amount: '1000',
      currency: 'USD',
      active_from: '2026-01-01',
    });
    await insert('inflows', {
      income_source_id: ids.income_sources,
      amount: '500',
      currency: 'USD',
      received_on: '2026-09-10',
    });
    await insert('expense_categories', { name: 'Housing' });
    await insert('expenses', {
      category_id: ids.expense_categories,
      name: 'Rent',
      amount: '900',
      currency: 'EUR',
      period: 'monthly',
      active_from: '2026-01-01',
    });
    await insert('budgets', {
      name: 'Groceries',
      monthly_limit: '1000',
      currency: 'EUR',
      active_from: '2026-01-01',
    });
  });

  const TABLES = [
    'income_sources',
    'inflows',
    'expense_categories',
    'expenses',
    'budgets',
  ] as const;

  it.each(TABLES)('%s: the owner reads the row, another user does not', async (table) => {
    expect((await a.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(1);
    expect((await b.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(0);
    expect((await b.c.from(table).select('id')).data).toHaveLength(0);
  });

  it.each(TABLES)('%s: another user can neither update nor delete the row', async (table) => {
    const column = table === 'inflows' ? 'note' : 'name';
    const updated = await b.c
      .from(table)
      .update({ [column]: 'hijacked' })
      .eq('id', ids[table]!)
      .select('id');
    expect(updated.data ?? []).toHaveLength(0);
    const deleted = await b.c.from(table).delete().eq('id', ids[table]!).select('id');
    expect(deleted.data ?? []).toHaveLength(0);
    expect((await a.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(1);
  });

  it('refuses a row forged for another user in every table', async () => {
    const forged: Record<(typeof TABLES)[number], Record<string, unknown>> = {
      income_sources: { name: 'X', gross_amount: '1', currency: 'USD', active_from: '2026-01-01' },
      inflows: {
        income_source_id: ids.income_sources,
        amount: '1',
        currency: 'USD',
        received_on: '2026-09-10',
      },
      expense_categories: { name: 'Forged' },
      expenses: {
        category_id: ids.expense_categories,
        name: 'X',
        amount: '1',
        currency: 'EUR',
        period: 'monthly',
        active_from: '2026-01-01',
      },
      budgets: { name: 'X', monthly_limit: '1', currency: 'EUR', active_from: '2026-01-01' },
    };
    for (const table of TABLES) {
      const { error } = await b.c.from(table).insert({ user_id: a.id, ...forged[table] });
      expect(error, table).not.toBeNull();
    }
  });

  it('does not let a user hang their own inflow on a foreign source through the API role', async () => {
    // RLS hides the foreign source from the FK's point of view only for reads; the insert itself names b as the owner,
    // so the policy passes — the use case is what refuses it (404 source). This asserts the database at least keeps
    // the row invisible to the source's owner.
    const { data } = await b.c
      .from('inflows')
      .insert({
        user_id: b.id,
        income_source_id: ids.income_sources,
        amount: '1',
        currency: 'USD',
        received_on: '2026-09-10',
      })
      .select('id');
    const visibleToA = await a.c
      .from('inflows')
      .select('id')
      .eq('income_source_id', ids.income_sources!);
    expect(visibleToA.data).toHaveLength(1);
    expect(visibleToA.data![0]!.id).toBe(ids.inflows);
    // Clean up so the source stays deletable for anything that runs later.
    if (data?.[0]) await b.c.from('inflows').delete().eq('id', data[0].id);
  });
});
```

- [ ] **Step 10: Run the whole integration suite**

Run: `bun run --filter @magermoney/api test:integration`
Expected: PASS — the four new files plus the six phase 1–2 files and `supabase/test/rls.test.ts`. A `permission denied for table …` in the RLS file means a migration forgot `alter table … enable row level security` plus the four owner policies (copy the block from `20260912000005_transfers.sql`); a `violates not-null constraint` means a column in spec §3 has no default where the test relies on one (`tax_rate`, `commission_rate`, `pay_days`, `is_primary`, `is_essential`, `sort_order`) — fix the migration, `supabase db reset`, rerun.

Then: `bun run lint && bun run typecheck && bun run test`
Expected: all green (the integration files are linted and typechecked with the rest of `test/`).

- [ ] **Step 11: Commit**

Use the `/git-commit` skill.

```bash
git add apps/api/test/integration/helpers.ts apps/api/test/integration/pg-phase3-repositories.test.ts \
  apps/api/test/integration/pg-inflow-credit-concurrency.test.ts \
  apps/api/test/integration/pg-income-source-primary.test.ts apps/api/test/integration/pg-phase3-rls.test.ts \
  docs/discovery/phase-3-execution-ledger.md
git commit -m "test(api): cover phase 3 repositories, credit races, primary source and RLS on pg"
```

Stage any production fix the suite forced together with the test that exposed it and describe it in the ledger. The message ends with the two trailers from Global Constraints (`Co-Authored-By: …`, `Claude-Session: …`). No CI change is needed: the `integration` job already runs `test:integration`, whose config includes `test/integration/**/*.test.ts`.

### Task 14: Import — native currency, sheet blocks, number helpers and the income mapper

**Files:**

- Modify: `apps/api/scripts/import/numbers.ts` (adds `parsePercent`, `parseRuDate`; `parseRuNumber` unchanged)
- Create: `apps/api/scripts/import/block.ts`
- Create: `apps/api/scripts/import/native-currency.ts`
- Create: `apps/api/scripts/import/income-mapper.ts`
- Test: `apps/api/test/import/native-currency.test.ts`, `apps/api/test/import/income-mapper.test.ts`

**Interfaces:**

- Consumes: `parseCsv(text): string[][]` (`csv.ts`), `parseRuNumber(raw): string | null` (`numbers.ts`), `ImportError` (`accounts-mapper.ts`), `Decimal` from `@magermoney/domain`.
- Produces:
  - `parsePercent(raw: string): string | null` — `"15%"` → `"0.15"`, empty → `"0"`, outside `[0, 1)` → `null`.
  - `parseRuDate(raw: string): string | null` — `"23.01.2025"` → `"2025-01-23"`.
  - `findBlock(rows, firstLabel): Result<SheetBlock, ImportError>`, `cellOf(block, row, label): string`, `interface SheetBlock { headerRow: number; columns: ReadonlyMap<string, number> }`.
  - `SHEET_CURRENCIES = ['USD','EUR','RUB']`, `interface NativeOptions { currencyOf: ReadonlyMap<string,string>; fallback: string }`, `interface NativePick { currency; amount; ambiguous }`, `isWhole(n: string): boolean`, `parseCurrencyOf(pairs: readonly string[]): Result<Map<string,string>, ImportError>`, `pickNative(name, amounts, opts): Result<NativePick, ImportError>`.
  - `interface MappedIncomeSource { name; currency; grossAmount; taxRate; commissionRate; ambiguous: boolean }` (all strings but the flag), `type IncomeMapOptions = NativeOptions & { known: ReadonlySet<string> }`, `mapIncomeSources(rows: string[][], opts: IncomeMapOptions): Result<MappedIncomeSource[], ImportError>`.

Rules this task pins (spec §6): a row's native currency is the one column whose amount has no fractional part when **exactly one** non-zero amount qualifies; otherwise `fallback` is taken and the row is `ambiguous`; `--currency-of` (matched against the name exactly as the sheet spells it, whitespace-collapsed) always wins. The income sheet's data is only the first table: header row starting with `Источник`, down to the first row with an empty name. Fixtures below are synthetic; never paste anything from `imports/`.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/import/native-currency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePercent, parseRuDate } from '../../scripts/import/numbers.js';
import { findBlock, cellOf } from '../../scripts/import/block.js';
import { isWhole, parseCurrencyOf, pickNative } from '../../scripts/import/native-currency.js';

const opts = (currencyOf: [string, string][] = [], fallback = 'EUR') => ({
  currencyOf: new Map(currencyOf),
  fallback,
});

describe('parsePercent', () => {
  it('turns a sheet percent into a fraction', () => {
    expect(parsePercent('15%')).toBe('0.15');
    expect(parsePercent('7,5 %')).toBe('0.075');
    expect(parsePercent('0%')).toBe('0');
    expect(parsePercent('')).toBe('0');
  });
  it('rejects what is not a rate below 100 %', () => {
    expect(parsePercent('100%')).toBeNull();
    expect(parsePercent('-5%')).toBeNull();
    expect(parsePercent('n/a')).toBeNull();
  });
});

describe('parseRuDate', () => {
  it('reads DD.MM.YYYY', () => {
    expect(parseRuDate('23.01.2025')).toBe('2025-01-23');
    expect(parseRuDate(' 01.12.2024 ')).toBe('2024-12-01');
  });
  it('rejects other shapes and impossible dates', () => {
    expect(parseRuDate('2025-01-23')).toBeNull();
    expect(parseRuDate('31.02.2025')).toBeNull();
    expect(parseRuDate('')).toBeNull();
  });
});

describe('findBlock', () => {
  const rows = [
    ['', '', '', ''],
    ['Позиция', 'USD', 'EUR', '', 'Позиция', 'USD'],
    ['Rent', '1', '2', '', 'Sofa', '9'],
  ];
  it('stops at the first empty header cell, so the neighbour block never leaks in', () => {
    const block = findBlock(rows, 'Позиция')._unsafeUnwrap();
    expect(block.headerRow).toBe(1);
    expect([...block.columns]).toEqual([
      ['Позиция', 0],
      ['USD', 1],
      ['EUR', 2],
    ]);
    expect(cellOf(block, rows[2]!, 'USD')).toBe('1');
    expect(cellOf(block, rows[2]!, 'RUB')).toBe('');
    expect(cellOf(block, ['Rent'], 'EUR')).toBe('');
  });
  it('fails when the header is missing', () => {
    expect(findBlock(rows, 'Источник').isErr()).toBe(true);
  });
});

describe('parseCurrencyOf', () => {
  it('splits on the last "=" so a name may contain one', () => {
    expect([...parseCurrencyOf(['Deposit=RUB', 'A=B = USD'])._unsafeUnwrap()]).toEqual([
      ['Deposit', 'RUB'],
      ['A=B', 'USD'],
    ]);
  });
  it('rejects a pair without a name or with a malformed code', () => {
    expect(parseCurrencyOf(['Deposit']).isErr()).toBe(true);
    expect(parseCurrencyOf(['=RUB']).isErr()).toBe(true);
    expect(parseCurrencyOf(['Deposit=rub']).isErr()).toBe(true);
  });
});

describe('pickNative', () => {
  it('knows a whole amount by the missing dot', () => {
    expect(isWhole('1400')).toBe(true);
    expect(isWhole('1400.5')).toBe(false);
  });
  it('takes the only round amount', () => {
    expect(
      pickNative('Rent', { USD: '1377.05', EUR: '1200', RUB: '116366.40' }, opts())._unsafeUnwrap(),
    ).toEqual({ currency: 'EUR', amount: '1200', ambiguous: false });
  });
  it('falls back and flags the row when two amounts are round', () => {
    expect(
      pickNative('Music', { USD: '3', EUR: '2.61', RUB: '254' }, opts())._unsafeUnwrap(),
    ).toEqual({ currency: 'EUR', amount: '2.61', ambiguous: true });
  });
  it('falls back and flags the row when no amount is round', () => {
    expect(
      pickNative(
        'Deposit',
        { USD: '41.07', EUR: '37.85', RUB: '3485.20' },
        opts([], 'RUB'),
      )._unsafeUnwrap(),
    ).toEqual({ currency: 'RUB', amount: '3485.20', ambiguous: true });
  });
  it('does not count zero as a round amount', () => {
    expect(pickNative('Idle', { USD: '0', EUR: '0', RUB: '0' }, opts())._unsafeUnwrap()).toEqual({
      currency: 'EUR',
      amount: '0',
      ambiguous: true,
    });
  });
  it('lets --currency-of win over the guess', () => {
    expect(
      pickNative(
        'Music',
        { USD: '3', EUR: '2.61', RUB: '254' },
        opts([['Music', 'USD']]),
      )._unsafeUnwrap(),
    ).toEqual({ currency: 'USD', amount: '3', ambiguous: false });
  });
  it('fails when the override or the fallback has no column', () => {
    expect(pickNative('Music', { USD: '2', EUR: null }, opts([['Music', 'GBP']])).isErr()).toBe(
      true,
    );
    expect(pickNative('Music', { USD: '2.5', RUB: '200.1' }, opts()).isErr()).toBe(true);
  });
});
```

`apps/api/test/import/income-mapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapIncomeSources } from '../../scripts/import/income-mapper.js';

/** Synthetic: the monthly table, its total, the yearly table below, a calculator to the right. */
const CSV = [
  'Источник,USD,EUR,RUB,Налоги,Коммисии,USD net,EUR net,RUB net,,Вариант,Часы,USD',
  'Acme Salary,"$4 123,45","€3 800,12","350 000,00 ₽",13%,5%,"$3 408,03","€3 140,80","289 275,00 ₽",,3h a day,60,"$3 000,00"',
  'Side Gig,"$2 000,00","€1 843,27","169 701,55 ₽",0%,0%,"$2 000,00","€1 843,27","169 701,55 ₽",,5h a day,100,"$5 000,00"',
  'Deposit,"$41,07","€37,85","3 485,20 ₽",0%,,"$41,07","€37,85","3 485,20 ₽",,This month,0,"$0,00"',
  ',,,,,,,,,,,,',
  'Месячный доход,"$6 164,52","€5 681,24","523 186,75 ₽",,,"$5 449,10","€5 021,92","462 461,75 ₽",,,,',
  ',,,,,,,,,,,,',
  'Источник,USD,EUR,RUB,Налоги,Коммисии,USD net,EUR net,RUB net,,,,',
  'Acme Salary,"$49 481,40","€45 601,44","4 200 000,00 ₽",13%,5%,"$40 896,36","€37 689,60","3 471 300,00 ₽",,,,',
].join('\n');

const known = new Set(['USD', 'EUR', 'RUB']);
const opts = (currencyOf: [string, string][] = []) => ({
  known,
  currencyOf: new Map(currencyOf),
  fallback: 'EUR',
});

describe('mapIncomeSources', () => {
  it('reads only the first table and picks each native currency by roundness', () => {
    expect(mapIncomeSources(parseCsv(CSV), opts())._unsafeUnwrap()).toEqual([
      {
        name: 'Acme Salary',
        currency: 'RUB',
        grossAmount: '350000',
        taxRate: '0.13',
        commissionRate: '0.05',
        ambiguous: false,
      },
      {
        name: 'Side Gig',
        currency: 'USD',
        grossAmount: '2000',
        taxRate: '0',
        commissionRate: '0',
        ambiguous: false,
      },
      {
        name: 'Deposit',
        currency: 'EUR',
        grossAmount: '37.85',
        taxRate: '0',
        commissionRate: '0',
        ambiguous: true,
      },
    ]);
  });
  it('honours --currency-of', () => {
    const deposit = mapIncomeSources(parseCsv(CSV), opts([['Deposit', 'RUB']]))._unsafeUnwrap()[2];
    expect(deposit).toMatchObject({ currency: 'RUB', grossAmount: '3485.20', ambiguous: false });
  });
  it('fails on a currency the database does not know', () => {
    const r = mapIncomeSources(parseCsv(CSV), { ...opts(), known: new Set(['USD', 'EUR']) });
    expect(r._unsafeUnwrapErr().message).toMatch(/unknown currency RUB/);
  });
  it('fails on a duplicated name, a bad percent, a missing header or an empty table', () => {
    const twice = CSV.replace('Side Gig', 'Acme Salary');
    expect(mapIncomeSources(parseCsv(twice), opts())._unsafeUnwrapErr().message).toMatch(/twice/);
    const badTax = CSV.replace('13%,5%', '130%,5%');
    expect(mapIncomeSources(parseCsv(badTax), opts())._unsafeUnwrapErr().message).toMatch(/tax/);
    expect(mapIncomeSources(parseCsv('a,b\n1,2'), opts()).isErr()).toBe(true);
    expect(mapIncomeSources(parseCsv('Источник,USD,EUR,RUB\n,,,'), opts()).isErr()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && bunx vitest run test/import/native-currency.test.ts test/import/income-mapper.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/import/block.js'` (and the other new modules); `parsePercent` is not exported.

- [ ] **Step 3: Implement**

Replace `apps/api/scripts/import/numbers.ts` with:

```ts
import { Decimal } from '@magermoney/domain';

/** "2 100 675,19", "$1 259,80", "0,00" → "2100675.19", "1259.80", "0". Anything else → null. */
export function parseRuNumber(raw: string): string | null {
  const s = raw
    .replace(/[\s ]/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const [int, frac] = s.split('.') as [string, string | undefined];
  const cleanInt = int.replace(/^(-?)0+(?=\d)/, '$1');
  if (frac === undefined || /^0+$/.test(frac)) return cleanInt;
  return `${cleanInt}.${frac}`;
}

/** "15%", "7,5 %" → "0.15", "0.075"; an empty cell → "0". Unparsable or outside [0, 1) → null. */
export function parsePercent(raw: string): string | null {
  if (raw.trim() === '') return '0';
  const n = parseRuNumber(raw);
  if (n === null) return null;
  const v = new Decimal(n).div(100);
  return v.gte(0) && v.lt(1) ? v.toFixed() : null;
}

/** "23.01.2025" → "2025-01-23". A date the calendar does not have (31.02) → null. */
export function parseRuDate(raw: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
```

Create `apps/api/scripts/import/block.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ImportError } from './accounts-mapper.js';

export interface SheetBlock {
  /** Index of the header row inside `rows`. */
  headerRow: number;
  /** Trimmed header label → column index, first occurrence wins. */
  columns: ReadonlyMap<string, number>;
}

/**
 * The owner's sheets put several tables side by side, separated by an empty
 * column. A block is the table whose header row starts with `firstLabel` in
 * column A; it ends at the first empty header cell, so the neighbours to the
 * right (which repeat labels such as "USD") never leak in.
 */
export function findBlock(rows: string[][], firstLabel: string): Result<SheetBlock, ImportError> {
  const headerRow = rows.findIndex((r) => (r[0] ?? '').trim() === firstLabel);
  if (headerRow < 0) return err(new ImportError(`No header row starting with "${firstLabel}"`));
  const columns = new Map<string, number>();
  const header = rows[headerRow]!;
  for (let i = 0; i < header.length; i++) {
    const label = header[i]!.trim();
    if (label === '') break;
    if (!columns.has(label)) columns.set(label, i);
  }
  return ok({ headerRow, columns });
}

/** The cell under `label`, trimmed; '' when the block has no such column or the row is short. */
export const cellOf = (block: SheetBlock, row: string[], label: string): string => {
  const i = block.columns.get(label);
  return i === undefined ? '' : (row[i] ?? '').trim();
};
```

Create `apps/api/scripts/import/native-currency.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ImportError } from './accounts-mapper.js';

/** The three columns every sheet shows each amount in. */
export const SHEET_CURRENCIES = ['USD', 'EUR', 'RUB'] as const;

export interface NativeOptions {
  /** `--currency-of "<name>=<CODE>"`: sheet name → currency, wins over the guess. */
  currencyOf: ReadonlyMap<string, string>;
  /** `--fallback-currency`: used when the guess cannot decide. */
  fallback: string;
}

export interface NativePick {
  currency: string;
  amount: string;
  /** True when roundness could not decide and the fallback was taken. */
  ambiguous: boolean;
}

/** `parseRuNumber` drops an all-zero fraction, so a whole amount has no dot. */
export const isWhole = (n: string): boolean => !n.includes('.');

/** ["Deposit=RUB", "A=B=USD"] → Map { "Deposit" → "RUB", "A=B" → "USD" }. */
export function parseCurrencyOf(
  pairs: readonly string[],
): Result<Map<string, string>, ImportError> {
  const out = new Map<string, string>();
  for (const pair of pairs) {
    const at = pair.lastIndexOf('=');
    const name = at < 0 ? '' : pair.slice(0, at).trim();
    const code = at < 0 ? '' : pair.slice(at + 1).trim();
    if (name === '' || !/^[A-Z0-9]{2,10}$/.test(code))
      return err(new ImportError(`--currency-of expects "<name>=<CODE>", got "${pair}"`));
    out.set(name, code);
  }
  return ok(out);
}

/**
 * The sheet shows every amount in USD, EUR and RUB and never says which one the
 * person typed. People type round numbers, conversions are never round: the
 * currency whose amount has no fractional part is native when exactly one
 * qualifies. Otherwise the fallback is taken and the row is marked ambiguous so
 * the dry run can show it.
 */
export function pickNative(
  name: string,
  amounts: Readonly<Record<string, string | null | undefined>>,
  opts: NativeOptions,
): Result<NativePick, ImportError> {
  const override = opts.currencyOf.get(name);
  if (override !== undefined) {
    const amount = amounts[override];
    if (amount === null || amount === undefined)
      return err(
        new ImportError(
          `"${name}": --currency-of says ${override}, but the sheet has no ${override} amount for it`,
        ),
      );
    return ok({ currency: override, amount, ambiguous: false });
  }
  const whole = Object.entries(amounts).filter(
    (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '0' && isWhole(e[1]),
  );
  if (whole.length === 1)
    return ok({ currency: whole[0]![0], amount: whole[0]![1], ambiguous: false });
  const amount = amounts[opts.fallback];
  if (amount === null || amount === undefined)
    return err(
      new ImportError(
        `"${name}": cannot tell its currency and the sheet has no ${opts.fallback} amount; pass --currency-of "${name}=<CODE>"`,
      ),
    );
  return ok({ currency: opts.fallback, amount, ambiguous: true });
}
```

Create `apps/api/scripts/import/income-mapper.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ImportError } from './accounts-mapper.js';
import { cellOf, findBlock } from './block.js';
import { pickNative, SHEET_CURRENCIES, type NativeOptions } from './native-currency.js';
import { parsePercent, parseRuNumber } from './numbers.js';

export interface MappedIncomeSource {
  name: string;
  currency: string;
  /** Monthly gross, in `currency`. */
  grossAmount: string;
  /** Fractions in [0, 1): "0.15" for 15 %. */
  taxRate: string;
  commissionRate: string;
  ambiguous: boolean;
}

export type IncomeMapOptions = NativeOptions & { known: ReadonlySet<string> };

/**
 * The income sheet stacks three tables (monthly, yearly, daily) under the same
 * header and keeps an hourly-rate calculator to the right. Only the first
 * table is data: from the header row "Источник" down to the first row without
 * a name. The "Месячный доход" total sits below that blank row and is never reached.
 */
export function mapIncomeSources(
  rows: string[][],
  opts: IncomeMapOptions,
): Result<MappedIncomeSource[], ImportError> {
  const found = findBlock(rows, 'Источник');
  if (found.isErr()) return err(found.error);
  const block = found.value;
  const out: MappedIncomeSource[] = [];
  const seen = new Set<string>();
  // Every problem is collected so one dry run lists them all.
  const problems: string[] = [];
  for (let i = block.headerRow + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellOf(block, row, 'Источник').replace(/\s+/g, ' ');
    if (name === '') break;
    if (seen.has(name)) {
      problems.push(`Row ${i + 1}: income source "${name}" is listed twice`);
      continue;
    }
    seen.add(name);
    const amounts = Object.fromEntries(
      SHEET_CURRENCIES.map((c) => [c, parseRuNumber(cellOf(block, row, c))]),
    );
    const native = pickNative(name, amounts, opts);
    if (native.isErr()) {
      problems.push(native.error.message);
      continue;
    }
    if (!opts.known.has(native.value.currency)) {
      problems.push(
        `Row ${i + 1}: unknown currency ${native.value.currency}; add it to the currencies table first`,
      );
      continue;
    }
    if (native.value.amount.startsWith('-')) {
      problems.push(`Row ${i + 1}: "${name}" has a negative amount`);
      continue;
    }
    const taxRate = parsePercent(cellOf(block, row, 'Налоги'));
    // The sheet spells the header "Коммисии"; accept the dictionary spelling too.
    const commissionRate = parsePercent(
      cellOf(block, row, 'Коммисии') || cellOf(block, row, 'Комиссии'),
    );
    if (taxRate === null || commissionRate === null) {
      problems.push(`Row ${i + 1}: "${name}" has a tax or commission outside 0–99 %`);
      continue;
    }
    out.push({
      name,
      currency: native.value.currency,
      grossAmount: native.value.amount,
      taxRate,
      commissionRate,
      ambiguous: native.value.ambiguous,
    });
  }
  if (problems.length > 0) return err(new ImportError(problems.join('\n')));
  if (out.length === 0)
    return err(new ImportError('The income sheet has no sources under its header'));
  return ok(out);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/api && bunx vitest run test/import && bun run typecheck && bun run lint`
Expected: PASS (19 new tests; the phase 2 import tests still green). Let prettier reformat long lines if lint asks (`bunx prettier --write scripts/import test/import`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/import/numbers.ts apps/api/scripts/import/block.ts apps/api/scripts/import/native-currency.ts apps/api/scripts/import/income-mapper.ts apps/api/test/import/native-currency.test.ts apps/api/test/import/income-mapper.test.ts
git commit -m "feat(api): map the income sheet and guess native currencies"
```

Commit with `/git-commit`; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

---

### Task 15: Import — inflows mapper

**Files:**

- Create: `apps/api/scripts/import/inflows-mapper.ts`
- Test: `apps/api/test/import/inflows-mapper.test.ts`

**Interfaces:**

- Consumes (Task 14): `findBlock`, `cellOf`, `isWhole`, `NativeOptions`, `parseRuDate`, `parseRuNumber`, `MappedIncomeSource`, `ImportError`.
- Produces:
  - `interface MappedInflow { source: string; amount: string; currency: string; receivedOn: string; realisedRateToUsd: string | null }`
  - `interface InflowSpan { first: string; last: string }`
  - `interface InflowMapOptions extends NativeOptions { known: ReadonlySet<string>; sources: ReadonlyMap<string,string>; createMissing: boolean }`
  - `interface MappedInflows { inflows: MappedInflow[]; created: MappedIncomeSource[]; spans: Map<string, InflowSpan> }`
  - `mapInflows(rows: string[][], opts: InflowMapOptions): Result<MappedInflows, ImportError>`

Rules (spec §6): columns `Дата` (`DD.MM.YYYY`), `Откуда`, `USD/RUB`, `RUB`, `USD`; everything right of the first empty header cell is ignored. The inflow takes its source's currency: RUB source → RUB column and `realisedRateToUsd = 1 / (USD/RUB)` to 10 significant digits; USD source → USD column, rate `null`; any other source currency fails the run with every such row listed. A source named only in `Откуда` is created (when `createMissing`) with gross `0`; its currency is the column — RUB or USD — that is whole-numbered and non-zero in **more** of that source's rows; a tie takes `fallback` and is `ambiguous` (and, unless the fallback is RUB or USD, then fails with the hint to pass `--currency-of`). With `createMissing = false` every name must be in `sources`. All problems are collected into one multi-line `ImportError`. Inflows are never credited to Accounts.

- [ ] **Step 1: Write the failing test**

`apps/api/test/import/inflows-mapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapInflows } from '../../scripts/import/inflows-mapper.js';

/** Synthetic: five data columns, then a per-source summary block to the right. */
const CSV = [
  'Дата,Откуда,USD/RUB,RUB,USD,,,,Acme Salary,Side Gig',
  '25.01.2025,Acme Salary,"101,50 ₽","152 250,00 ₽","$1 514,93",,,USD,"$9 000,00","$4 000,00"',
  '07.03.2025,Side Gig,"80,00 ₽","160 000,00 ₽","$2 000,00",,,EUR,"€8 300,00","€3 700,00"',
  '21.03.2025,Acme Salary,"92,50 ₽","152 250,00 ₽","$1 645,95",,,,,',
  '12.01.2025,Refund,"101,00 ₽","5 000,00 ₽","$49,50",,,,,',
  '20.03.2025,Refund,"90,00 ₽","1 800,00 ₽","$20,00",,,,,',
  '21.03.2025,Refund,"90,00 ₽","2 700,00 ₽","$30,00",,,,,',
  '22.03.2025,Refund,"90,00 ₽","4 000,00 ₽","$44,44",,,,,',
  ',,,,,,,,,',
].join('\n');

const known = new Set(['USD', 'EUR', 'RUB']);
const sheetSources = new Map([
  ['Acme Salary', 'RUB'],
  ['Side Gig', 'USD'],
]);
const opts = (over: Partial<Parameters<typeof mapInflows>[1]> = {}) => ({
  known,
  sources: sheetSources,
  createMissing: true,
  currencyOf: new Map<string, string>(),
  fallback: 'EUR',
  ...over,
});

describe('mapInflows', () => {
  it('stores a RUB inflow with its realised rate and a USD inflow without one', () => {
    const { inflows } = mapInflows(parseCsv(CSV), opts())._unsafeUnwrap();
    expect(inflows.slice(0, 3)).toEqual([
      {
        source: 'Acme Salary',
        amount: '152250',
        currency: 'RUB',
        receivedOn: '2025-01-25',
        realisedRateToUsd: '0.009852216749',
      },
      {
        source: 'Side Gig',
        amount: '2000',
        currency: 'USD',
        receivedOn: '2025-03-07',
        realisedRateToUsd: null,
      },
      {
        source: 'Acme Salary',
        amount: '152250',
        currency: 'RUB',
        receivedOn: '2025-03-21',
        realisedRateToUsd: '0.01081081081',
      },
    ]);
    expect(inflows).toHaveLength(7);
  });
  it('creates a source that only the inflows name, in the column that is round more often', () => {
    const { created, spans, inflows } = mapInflows(parseCsv(CSV), opts())._unsafeUnwrap();
    // Refund: RUB is whole in 4 rows, USD in 2.
    expect(created).toEqual([
      {
        name: 'Refund',
        currency: 'RUB',
        grossAmount: '0',
        taxRate: '0',
        commissionRate: '0',
        ambiguous: false,
      },
    ]);
    expect(spans.get('Refund')).toEqual({ first: '2025-01-12', last: '2025-03-22' });
    expect(spans.get('Acme Salary')).toEqual({ first: '2025-01-25', last: '2025-03-21' });
    expect(inflows.filter((i) => i.source === 'Refund').map((i) => i.amount)).toEqual([
      '5000',
      '1800',
      '2700',
      '4000',
    ]);
  });
  it('stops on a tie unless --currency-of or a RUB/USD fallback settles it', () => {
    const tie = [
      'Дата,Откуда,USD/RUB,RUB,USD',
      '07.07.2025,Bonus Co,"80,00 ₽","160 000,00 ₽","$2 000,00"',
    ].join('\n');
    const stopped = mapInflows(parseCsv(tie), opts())._unsafeUnwrapErr().message;
    expect(stopped).toMatch(/Income source "Bonus Co" is in EUR/);
    expect(stopped).toMatch(/--currency-of "Bonus Co=RUB"/);
    const forced = mapInflows(parseCsv(tie), opts({ currencyOf: new Map([['Bonus Co', 'USD']]) }));
    expect(forced._unsafeUnwrap().created[0]).toMatchObject({ currency: 'USD', ambiguous: false });
    const fallback = mapInflows(parseCsv(tie), opts({ fallback: 'RUB' }))._unsafeUnwrap();
    expect(fallback.created[0]).toMatchObject({ currency: 'RUB', ambiguous: true });
    expect(fallback.inflows[0]).toMatchObject({ amount: '160000', realisedRateToUsd: '0.0125' });
  });
  it('requires every source to exist when the sources sheet is not part of the run', () => {
    const r = mapInflows(parseCsv(CSV), opts({ createMissing: false }));
    expect(r._unsafeUnwrapErr().message).toMatch(/No income source named "Refund"/);
  });
  it('lists every bad row at once', () => {
    const bad = [
      'Дата,Откуда,USD/RUB,RUB,USD',
      '2025-01-25,Acme Salary,"101,50 ₽","1 000,00 ₽","$9,95"',
      '26.01.2025,Acme Salary,,"1 000,00 ₽","$9,95"',
      '27.01.2025,Side Gig,"101,50 ₽","1 000,00 ₽","$0,00"',
      '28.01.2025,,"101,50 ₽","1 000,00 ₽","$9,95"',
    ].join('\n');
    const message = mapInflows(parseCsv(bad), opts())._unsafeUnwrapErr().message;
    expect(message.split('\n')).toEqual([
      'Row 2: needs a DD.MM.YYYY date and a source',
      'Row 5: needs a DD.MM.YYYY date and a source',
      'Row 3: a RUB inflow needs its USD/RUB rate',
      'Row 4: the USD amount must be greater than zero',
    ]);
  });
  it('fails on an unknown currency and on a missing header', () => {
    const r = mapInflows(parseCsv(CSV), opts({ known: new Set(['USD']) }));
    expect(r._unsafeUnwrapErr().message).toMatch(/unknown currency RUB/);
    expect(mapInflows(parseCsv('a,b\n1,2'), opts()).isErr()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && bunx vitest run test/import/inflows-mapper.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/import/inflows-mapper.js'`.

- [ ] **Step 3: Implement**

Create `apps/api/scripts/import/inflows-mapper.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { Decimal } from '@magermoney/domain';
import { ImportError } from './accounts-mapper.js';
import { cellOf, findBlock } from './block.js';
import type { MappedIncomeSource } from './income-mapper.js';
import { isWhole, type NativeOptions } from './native-currency.js';
import { parseRuDate, parseRuNumber } from './numbers.js';

const D = Decimal.clone({ precision: 40 });
const SIG = 10;

export interface MappedInflow {
  /** Income source name, as in the "Откуда" column. */
  source: string;
  amount: string;
  currency: string;
  /** YYYY-MM-DD */
  receivedOn: string;
  /** USD per one unit of `currency` on that day; null for a USD inflow. */
  realisedRateToUsd: string | null;
}

export interface InflowSpan {
  first: string;
  last: string;
}

export interface InflowMapOptions extends NativeOptions {
  known: ReadonlySet<string>;
  /** Name → currency of the sources that exist: the sources sheet of this run, or the database. */
  sources: ReadonlyMap<string, string>;
  /** True when the sources sheet is part of this run: a name it lacks becomes a new source. */
  createMissing: boolean;
}

export interface MappedInflows {
  inflows: MappedInflow[];
  /** Sources named only in "Откуда": gross 0, no pay days; the runner dates them by their span. */
  created: MappedIncomeSource[];
  /** First and last inflow date per source name. */
  spans: Map<string, InflowSpan>;
}

interface RawInflow {
  line: number;
  source: string;
  receivedOn: string;
  usdRub: string | null;
  rub: string | null;
  usd: string | null;
}

/**
 * A source that exists only in the inflows sheet has no row to read a currency
 * from. Its inflows show RUB and USD side by side; the native column is the one
 * that is whole-numbered in more of its rows. A tie takes the fallback and is
 * flagged — and unless the fallback is RUB or USD the run then stops, asking
 * for --currency-of.
 */
function guessCurrency(name: string, rows: RawInflow[], opts: NativeOptions) {
  const override = opts.currencyOf.get(name);
  if (override !== undefined) return { currency: override, ambiguous: false };
  const whole = (v: string | null) => v !== null && v !== '0' && isWhole(v);
  const rub = rows.filter((r) => whole(r.rub)).length;
  const usd = rows.filter((r) => whole(r.usd)).length;
  if (rub > usd) return { currency: 'RUB', ambiguous: false };
  if (usd > rub) return { currency: 'USD', ambiguous: false };
  return { currency: opts.fallback, ambiguous: true };
}

/**
 * The "Поступления" sheet: Дата, Откуда, USD/RUB, RUB, USD, then a summary
 * block to the right that is ignored. An inflow is stored in its source's
 * currency: the RUB column with the day's realised rate (1 / USD/RUB), or the
 * USD column with no rate. Every problem is collected so one run lists them all.
 */
export function mapInflows(
  rows: string[][],
  opts: InflowMapOptions,
): Result<MappedInflows, ImportError> {
  const found = findBlock(rows, 'Дата');
  if (found.isErr()) return err(found.error);
  const block = found.value;
  const problems: string[] = [];
  const raw: RawInflow[] = [];
  for (let i = block.headerRow + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const dateCell = cellOf(block, row, 'Дата');
    const source = cellOf(block, row, 'Откуда').replace(/\s+/g, ' ');
    if (dateCell === '' && source === '') continue;
    const receivedOn = parseRuDate(dateCell);
    if (receivedOn === null || source === '') {
      problems.push(`Row ${i + 1}: needs a DD.MM.YYYY date and a source`);
      continue;
    }
    raw.push({
      line: i + 1,
      source,
      receivedOn,
      usdRub: parseRuNumber(cellOf(block, row, 'USD/RUB')),
      rub: parseRuNumber(cellOf(block, row, 'RUB')),
      usd: parseRuNumber(cellOf(block, row, 'USD')),
    });
  }

  const bySource = new Map<string, RawInflow[]>();
  for (const r of raw) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);

  const currencyOfSource = new Map(opts.sources);
  const created: MappedIncomeSource[] = [];
  const missing: string[] = [];
  for (const [name, list] of bySource) {
    if (currencyOfSource.has(name)) continue;
    if (!opts.createMissing) {
      missing.push(name);
      continue;
    }
    const guess = guessCurrency(name, list, opts);
    currencyOfSource.set(name, guess.currency);
    created.push({
      name,
      currency: guess.currency,
      grossAmount: '0',
      taxRate: '0',
      commissionRate: '0',
      ambiguous: guess.ambiguous,
    });
  }
  if (missing.length > 0)
    problems.push(
      `No income source named ${missing.map((n) => `"${n}"`).join(', ')}; create it first or pass --income-sources`,
    );

  const inflows: MappedInflow[] = [];
  const spans = new Map<string, InflowSpan>();
  const unreadable = new Set<string>();
  for (const r of raw) {
    const currency = currencyOfSource.get(r.source);
    if (currency === undefined) continue; // already reported as missing
    if (!opts.known.has(currency)) {
      problems.push(
        `Row ${r.line}: unknown currency ${currency}; add it to the currencies table first`,
      );
      continue;
    }
    if (currency !== 'RUB' && currency !== 'USD') {
      // Once per source, not once per row: the fix is one flag.
      if (!unreadable.has(r.source)) {
        unreadable.add(r.source);
        problems.push(
          `Income source "${r.source}" is in ${currency}, but the inflows sheet only has RUB and USD amounts; pass --currency-of "${r.source}=RUB" or --currency-of "${r.source}=USD"`,
        );
      }
      continue;
    }
    const amount = currency === 'RUB' ? r.rub : r.usd;
    if (amount === null || !new D(amount).gt(0)) {
      problems.push(`Row ${r.line}: the ${currency} amount must be greater than zero`);
      continue;
    }
    let realisedRateToUsd: string | null = null;
    if (currency === 'RUB') {
      if (r.usdRub === null || !new D(r.usdRub).gt(0)) {
        problems.push(`Row ${r.line}: a RUB inflow needs its USD/RUB rate`);
        continue;
      }
      realisedRateToUsd = new D(1).div(r.usdRub).toSignificantDigits(SIG).toFixed();
    }
    inflows.push({
      source: r.source,
      amount,
      currency,
      receivedOn: r.receivedOn,
      realisedRateToUsd,
    });
    const span = spans.get(r.source);
    spans.set(r.source, {
      first: span && span.first < r.receivedOn ? span.first : r.receivedOn,
      last: span && span.last > r.receivedOn ? span.last : r.receivedOn,
    });
  }
  if (problems.length > 0) return err(new ImportError(problems.join('\n')));
  return ok({ inflows, created, spans });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/api && bunx vitest run test/import && bun run typecheck && bun run lint`
Expected: PASS (6 new tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/import/inflows-mapper.ts apps/api/test/import/inflows-mapper.test.ts
git commit -m "feat(api): map the inflows sheet"
```

Commit with `/git-commit`; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

---

### Task 16: Import — expenses mapper

**Files:**

- Create: `apps/api/scripts/import/expenses-mapper.ts`
- Test: `apps/api/test/import/expenses-mapper.test.ts`

**Interfaces:**

- Consumes (Task 14): `findBlock`, `cellOf`, `pickNative`, `SHEET_CURRENCIES`, `NativeOptions`, `parseRuNumber`, `ImportError`.
- Produces:
  - `SUBSCRIPTIONS_CATEGORY = 'Подписки'`, `OTHER_CATEGORY = 'Прочее'`
  - `interface MappedExpense { name; category; currency; amount; period: 'monthly' | 'yearly'; ambiguous: boolean; approx: boolean }`
  - `interface MappedBudget { name; currency; monthlyLimit; ambiguous: boolean }`
  - `interface MappedExpenses { categories: string[]; expenses: MappedExpense[]; budgets: MappedBudget[] }`
  - `type ExpenseMapOptions = NativeOptions & { known: ReadonlySet<string>; asBudget: ReadonlySet<string> }`
  - `mapExpenses(rows: string[][], opts: ExpenseMapOptions): Result<MappedExpenses, ImportError>`

Rules (spec §6): only the first block (header row starting with `Позиция`, its columns up to the first empty header cell) down to the row named `Итого`; `Минимум` and anything below is never reached; blocks to the right are ignored. Rows whose three amounts are all zero or blank are skipped. A name containing `(year` → `period = 'yearly'`, the parenthesised suffix is removed, `amount = monthly × 12` rounded half-up to 2 decimals, `approx = true`. A name starting with `Подписка ` → category `Подписки` with that prefix removed; everything else → `Прочее`. A row whose sheet name is in `asBudget` becomes a `MappedBudget` instead (name kept as written). `--currency-of` and `--as-budget` match the name as the sheet spells it (whitespace collapsed, before any stripping). An `--as-budget` name with no row is an error. `is_essential`, `billing_day` and `active_from` are the runner's business (Task 17).

- [ ] **Step 1: Write the failing test**

`apps/api/test/import/expenses-mapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapExpenses } from '../../scripts/import/expenses-mapper.js';

/** Synthetic: a blank first row, the obligations block, wish-list blocks to the right, totals below. */
const CSV = [
  ',,,,,,,,,',
  'Позиция,USD,EUR,RUB,,Позиция,USD,EUR,RUB,Куплено',
  'Rent,"$1 377,05","€1 200,00","116 366,40 ₽",,Sofa,"$1 000,00","€871,42","84 500,00 ₽",TRUE',
  '"Utilities\n","$137,70","€120,00","11 636,64 ₽",,Desk,"$500,00","€435,71","42 250,00 ₽",FALSE',
  'Groceries,"$918,03","€800,00","77 577,60 ₽",,,"$0,00","€0,00","0,00 ₽",',
  'Gift to family,"$236,69","€206,25","20 000,00 ₽",,,,,,',
  'Подписка Music,"$3,00","€2,61","254,00 ₽",,,,,,',
  'Подписка IDE (yearly),"$5,75","€5,01","485,90 ₽",,,,,,',
  'Подписка Old (yearly),"$0,00","€0,00","0,00 ₽",,Итого,"$1 500,00","€1 307,13","126 750,00 ₽",',
  'Итого,"$2 807,05","€2 446,12","237 205,24 ₽",,,,,,',
  'Минимум,"$1 526,24","€1 330,00","128 972,74 ₽",,,,,,',
  'Stray note,"$1,00","€1,00","1,00 ₽",,,,,,',
].join('\n');

const known = new Set(['USD', 'EUR', 'RUB']);
const opts = (over: Partial<Parameters<typeof mapExpenses>[1]> = {}) => ({
  known,
  currencyOf: new Map<string, string>(),
  fallback: 'EUR',
  asBudget: new Set<string>(),
  ...over,
});

describe('mapExpenses', () => {
  it('reads the first block up to "Итого", skipping zero rows and the neighbours', () => {
    const { expenses, budgets, categories } = mapExpenses(parseCsv(CSV), opts())._unsafeUnwrap();
    expect(budgets).toEqual([]);
    expect(categories).toEqual(['Прочее', 'Подписки']);
    expect(expenses).toEqual([
      {
        name: 'Rent',
        category: 'Прочее',
        currency: 'EUR',
        amount: '1200',
        period: 'monthly',
        ambiguous: false,
        approx: false,
      },
      {
        name: 'Utilities',
        category: 'Прочее',
        currency: 'EUR',
        amount: '120',
        period: 'monthly',
        ambiguous: false,
        approx: false,
      },
      {
        name: 'Groceries',
        category: 'Прочее',
        currency: 'EUR',
        amount: '800',
        period: 'monthly',
        ambiguous: false,
        approx: false,
      },
      {
        name: 'Gift to family',
        category: 'Прочее',
        currency: 'RUB',
        amount: '20000',
        period: 'monthly',
        ambiguous: false,
        approx: false,
      },
      // $3,00 and 254,00 ₽ are both round: the fallback is taken and flagged.
      {
        name: 'Music',
        category: 'Подписки',
        currency: 'EUR',
        amount: '2.61',
        period: 'monthly',
        ambiguous: true,
        approx: false,
      },
      // Nothing is round; 5,01 × 12 rebuilt as the yearly amount.
      {
        name: 'IDE',
        category: 'Подписки',
        currency: 'EUR',
        amount: '60.12',
        period: 'yearly',
        ambiguous: true,
        approx: true,
      },
    ]);
  });
  it('matches --currency-of against the name as the sheet spells it', () => {
    const { expenses } = mapExpenses(
      parseCsv(CSV),
      opts({ currencyOf: new Map([['Подписка IDE (yearly)', 'USD']]) }),
    )._unsafeUnwrap();
    expect(expenses.at(-1)).toEqual({
      name: 'IDE',
      category: 'Подписки',
      currency: 'USD',
      amount: '69',
      period: 'yearly',
      ambiguous: false,
      approx: true,
    });
  });
  it('turns an --as-budget row into a Budget', () => {
    const { expenses, budgets } = mapExpenses(
      parseCsv(CSV),
      opts({ asBudget: new Set(['Groceries']) }),
    )._unsafeUnwrap();
    expect(budgets).toEqual([
      { name: 'Groceries', currency: 'EUR', monthlyLimit: '800', ambiguous: false },
    ]);
    expect(expenses.map((e) => e.name)).not.toContain('Groceries');
  });
  it('fails on an --as-budget name the sheet does not have', () => {
    const r = mapExpenses(parseCsv(CSV), opts({ asBudget: new Set(['Groceries ', 'Taxi']) }));
    expect(r._unsafeUnwrapErr().message).toMatch(/"Groceries ", "Taxi"/);
  });
  it('fails on an unknown currency, a missing header, or a block without "Итого"', () => {
    const unknown = mapExpenses(parseCsv(CSV), opts({ known: new Set(['USD', 'RUB']) }));
    expect(unknown._unsafeUnwrapErr().message).toMatch(/unknown currency EUR/);
    expect(mapExpenses(parseCsv('a,b\n1,2'), opts()).isErr()).toBe(true);
    const open = 'Позиция,USD,EUR,RUB\nRent,"$1,50","€1,00","101,50 ₽"';
    expect(mapExpenses(parseCsv(open), opts())._unsafeUnwrapErr().message).toMatch(/Итого/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && bunx vitest run test/import/expenses-mapper.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/import/expenses-mapper.js'`.

- [ ] **Step 3: Implement**

Create `apps/api/scripts/import/expenses-mapper.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { Decimal } from '@magermoney/domain';
import { ImportError } from './accounts-mapper.js';
import { cellOf, findBlock } from './block.js';
import { pickNative, SHEET_CURRENCIES, type NativeOptions } from './native-currency.js';
import { parseRuNumber } from './numbers.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
/** The sheet only has USD, EUR and RUB columns, and all three have two decimals. */
const SCALE = 2;

export const SUBSCRIPTIONS_CATEGORY = 'Подписки';
export const OTHER_CATEGORY = 'Прочее';

export interface MappedExpense {
  name: string;
  category: string;
  currency: string;
  /** Per `period`: the monthly amount, or the rebuilt yearly one. */
  amount: string;
  period: 'monthly' | 'yearly';
  ambiguous: boolean;
  /** True when the yearly amount was rebuilt from a rounded monthly figure. */
  approx: boolean;
}

export interface MappedBudget {
  name: string;
  currency: string;
  monthlyLimit: string;
  ambiguous: boolean;
}

export interface MappedExpenses {
  /** Categories the expenses use, in order of first appearance. */
  categories: string[];
  expenses: MappedExpense[];
  budgets: MappedBudget[];
}

export type ExpenseMapOptions = NativeOptions & {
  known: ReadonlySet<string>;
  /** `--as-budget`: sheet names (whitespace-normalised) imported as Budgets instead. */
  asBudget: ReadonlySet<string>;
};

const YEARLY = /\s*\(year[^)]*\)?/i;
const SUBSCRIPTION = /^Подписка\s+/i;

/**
 * The expenses sheet keeps the fixed obligations in its first four columns and
 * wish lists to the right. Only the first block counts, from the header row
 * "Позиция" to the row "Итого"; "Минимум" below it is never reached. The sheet
 * has no category, period or billing day, so category and period come from the
 * name and the rest is left for the person to fill in.
 */
export function mapExpenses(
  rows: string[][],
  opts: ExpenseMapOptions,
): Result<MappedExpenses, ImportError> {
  const found = findBlock(rows, 'Позиция');
  if (found.isErr()) return err(found.error);
  const block = found.value;
  const out: MappedExpenses = { categories: [], expenses: [], budgets: [] };
  const budgetsSeen = new Set<string>();
  // Every problem is collected so one dry run lists them all.
  const problems: string[] = [];
  let closed = false;
  for (let i = block.headerRow + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const sheetName = cellOf(block, row, 'Позиция').replace(/\s+/g, ' ');
    if (sheetName === 'Итого') {
      closed = true;
      break;
    }
    if (sheetName === '') continue;
    const amounts = Object.fromEntries(
      SHEET_CURRENCIES.map((c) => [c, parseRuNumber(cellOf(block, row, c))]),
    );
    if (SHEET_CURRENCIES.every((c) => amounts[c] === null || amounts[c] === '0')) continue;
    const native = pickNative(sheetName, amounts, opts);
    if (native.isErr()) {
      problems.push(native.error.message);
      continue;
    }
    const { currency, amount, ambiguous } = native.value;
    if (!opts.known.has(currency)) {
      problems.push(
        `Row ${i + 1}: unknown currency ${currency}; add it to the currencies table first`,
      );
      continue;
    }
    if (amount.startsWith('-')) {
      problems.push(`Row ${i + 1}: "${sheetName}" has a negative amount`);
      continue;
    }
    if (opts.asBudget.has(sheetName)) {
      budgetsSeen.add(sheetName);
      out.budgets.push({ name: sheetName, currency, monthlyLimit: amount, ambiguous });
      continue;
    }
    const yearly = YEARLY.test(sheetName);
    const subscription = SUBSCRIPTION.test(sheetName);
    const name = sheetName.replace(YEARLY, '').replace(SUBSCRIPTION, '').trim();
    const category = subscription ? SUBSCRIPTIONS_CATEGORY : OTHER_CATEGORY;
    if (!out.categories.includes(category)) out.categories.push(category);
    out.expenses.push({
      name,
      category,
      currency,
      amount: yearly ? new D(amount).times(12).toDecimalPlaces(SCALE).toFixed() : amount,
      period: yearly ? 'yearly' : 'monthly',
      ambiguous,
      approx: yearly,
    });
  }
  if (!closed)
    return err(new ImportError('The expenses block has no "Итого" row; is this the right sheet?'));
  const unused = [...opts.asBudget].filter((n) => !budgetsSeen.has(n));
  if (unused.length > 0)
    problems.push(
      `--as-budget names no row in the sheet (rows whose amounts are all zero are skipped): ${unused.map((n) => `"${n}"`).join(', ')}`,
    );
  if (problems.length > 0) return err(new ImportError(problems.join('\n')));
  return ok(out);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/api && bunx vitest run test/import && bun run typecheck && bun run lint`
Expected: PASS (5 new tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/import/expenses-mapper.ts apps/api/test/import/expenses-mapper.test.ts
git commit -m "feat(api): map the expenses sheet into expenses and budgets"
```

Commit with `/git-commit`; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

---

### Task 17: Import — runner flags, per-kind idempotency, dry-run tables, docs

**Files:**

- Modify: `apps/api/scripts/import/run.ts` (full replacement below)
- Modify: `apps/api/scripts/import-sheet.ts` (header comment only)
- Modify: `apps/api/test/import/run.test.ts` (three assertions)
- Test: `apps/api/test/import/run-phase3.test.ts`
- Modify: `README.md` ("Import from the spreadsheet" section), `AGENTS.md` ("Scripts" section)

**Interfaces:**

- Consumes: Tasks 14–16 mappers; Task 7 tables `income_sources`, `inflows`, `expense_categories`, `expenses`, `budgets` with the columns of spec §3; `PgAccountRepository`, `PgRateRepository` (phase 2). After Task 10, `PgAccountRepository.delete` may also return `'has_inflows'`; the runner treats every outcome other than `'deleted'` as "kept".
- Produces:
  - `IMPORT_KINDS = ['accounts','rates','income','expenses','inflows']`, `type ImportKind`
  - `interface ImportArgs` gains `incomeSources`, `expenses`, `inflows` (`string | undefined`), `currencyOf: string[]`, `fallbackCurrency: string` (default `'EUR'`), `asBudget: string[]`, `only: ImportKind[] | undefined`
  - `activeKinds(args): Set<ImportKind>`
  - `interface PlannedSource extends MappedIncomeSource { activeFrom: string; activeTo: string | null }`, `interface Phase3Plan { sources; inflows; categories; expenses; budgets; importDay }`, `EMPTY_PHASE3`, `interface Phase3Input`, `planPhase3(input): Result<Phase3Plan, ImportError>`
  - `renderTotals(accounts, rates, plan = EMPTY_PHASE3)`, `renderSources`, `renderInflows`, `renderExpenses`, `renderDryRun(kinds, accounts, rates, plan)`; `renderPlan` and `avoidTakenNames` keep their phase 2 signatures
  - CLI: `bun run import -- --user <email> [--accounts f] [--rates f] [--income-sources f] [--expenses f] [--inflows f] [--currency-of "<name>=<CODE>"]… [--fallback-currency CODE] [--as-budget "<name>"]… [--only kinds] [--recorded-at iso] [--dry-run] [--force]`

Design notes for the implementer:

- As in phase 2, the database part of `runImport` is not unit-tested (the existing `run.test.ts` only tests pure functions). Everything decidable without a database lives in `planPhase3` and the renderers, which are tested; `writePhase3` is raw SQL through the postgres client inside the same `sql.begin` as accounts and rates, verified by the manual run in Step 5.
- Kinds: every kind whose file flag was passed is active; `--only` narrows that set and naming a kind without its file is an error. A file of an inactive kind is not even read. Accounts and rates are untouched unless active.
- Idempotency per kind, checked inside the transaction before any delete: existing `inflows` / `income_sources` / (`expenses` or `budgets`) rows stop the run unless `--force`. With `--force`: delete the user's uncredited inflows (`account_id is null`), then sources without remaining inflows, then expenses, budgets and categories left without expenses; then import. A source that survived (it has credited inflows) is reused by name; a currency mismatch between it and the sheet is an error.
- `active_from`: a sheet source → its earliest imported inflow date, else the import day; an inflow-only source → first/last inflow date as `active_from`/`active_to`; expenses and budgets → the import day. The import day is `--recorded-at`'s date part, else today (UTC).
- Unknown currencies fail in the mappers, i.e. before the transaction opens.
- A real run logs only the totals line (plus `removed …` counts under `--force`): no names, no amounts.

- [ ] **Step 1: Write the failing test and update the phase 2 assertions**

Create `apps/api/test/import/run-phase3.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import {
  activeKinds,
  parseArgs,
  planPhase3,
  renderDryRun,
  renderTotals,
} from '../../scripts/import/run.js';

const INCOME = [
  'Источник,USD,EUR,RUB,Налоги,Коммисии',
  'Acme Salary,"$4 123,45","€3 800,12","350 000,00 ₽",13%,5%',
  'Side Gig,"$2 000,00","€1 843,27","169 701,55 ₽",0%,0%',
  ',,,,,',
  'Месячный доход,"$6 123,45","€5 643,39","519 701,55 ₽",,',
].join('\n');
const INFLOWS = [
  'Дата,Откуда,USD/RUB,RUB,USD',
  '25.01.2025,Acme Salary,"100,00 ₽","150 000,00 ₽","$1 500,00"',
  '10.02.2025,Acme Salary,"92,50 ₽","152 250,00 ₽","$1 645,95"',
  '12.01.2025,Refund,"101,00 ₽","5 000,00 ₽","$49,50"',
].join('\n');
const EXPENSES = [
  'Позиция,USD,EUR,RUB',
  'Rent,"$1 377,05","€1 200,00","116 366,40 ₽"',
  'Groceries,"$918,03","€800,00","77 577,60 ₽"',
  'Подписка IDE (yearly),"$5,75","€5,01","485,90 ₽"',
  'Итого,"$2 300,83","€2 005,01","194 429,90 ₽"',
].join('\n');

const base = {
  incomeRows: undefined,
  inflowRows: undefined,
  expenseRows: undefined,
  existingSources: new Map<string, string>(),
  importDay: '2026-09-17',
  known: new Set(['USD', 'EUR', 'RUB']),
  currencyOf: new Map<string, string>(),
  fallback: 'EUR',
  asBudget: new Set<string>(),
};

describe('parseArgs, phase 3 flags', () => {
  it('collects repeatable flags and defaults the fallback to EUR', () => {
    const args = parseArgs([
      '--user',
      'a@b.c',
      '--income-sources',
      'i.csv',
      '--expenses',
      'e.csv',
      '--inflows',
      'f.csv',
      '--currency-of',
      'Deposit=RUB',
      '--currency-of',
      'Music=USD',
      '--as-budget',
      'Groceries',
      '--only',
      'income,inflows',
    ]);
    expect(args).toMatchObject({
      incomeSources: 'i.csv',
      expenses: 'e.csv',
      inflows: 'f.csv',
      currencyOf: ['Deposit=RUB', 'Music=USD'],
      asBudget: ['Groceries'],
      fallbackCurrency: 'EUR',
      only: ['income', 'inflows'],
    });
    expect(parseArgs(['--user', 'a@b.c', '--fallback-currency', 'RUB']).fallbackCurrency).toBe(
      'RUB',
    );
  });
  it('rejects a bad --only or --fallback-currency before any database work', () => {
    expect(() => parseArgs(['--user', 'a@b.c', '--only', 'goals'])).toThrow(/--only accepts/);
    expect(() => parseArgs(['--user', 'a@b.c', '--fallback-currency', 'eur'])).toThrow(
      /--fallback-currency/,
    );
  });
});

describe('activeKinds', () => {
  it('is every kind whose file was passed', () => {
    const args = parseArgs(['--user', 'a@b.c', '--rates', 'r.csv', '--inflows', 'f.csv']);
    expect([...activeKinds(args)]).toEqual(['rates', 'inflows']);
  });
  it('is narrowed by --only and refuses a kind without its file', () => {
    const args = parseArgs([
      '--user',
      'a@b.c',
      '--accounts',
      'a.csv',
      '--expenses',
      'e.csv',
      '--only',
      'expenses',
    ]);
    expect([...activeKinds(args)]).toEqual(['expenses']);
    expect(() => activeKinds(parseArgs(['--user', 'a@b.c', '--only', 'inflows']))).toThrow(
      /--inflows was not passed/,
    );
  });
});

describe('planPhase3', () => {
  it('dates a sheet source by its first inflow, else by the import day, and ends an inflow-only one', () => {
    const plan = planPhase3({
      ...base,
      incomeRows: parseCsv(INCOME),
      inflowRows: parseCsv(INFLOWS),
    })._unsafeUnwrap();
    expect(
      plan.sources.map((s) => [s.name, s.currency, s.grossAmount, s.activeFrom, s.activeTo]),
    ).toEqual([
      ['Acme Salary', 'RUB', '350000', '2025-01-25', null],
      ['Side Gig', 'USD', '2000', '2026-09-17', null],
      ['Refund', 'RUB', '0', '2025-01-12', '2025-01-12'],
    ]);
    expect(plan.inflows).toHaveLength(3);
  });
  it('resolves inflows against existing sources when the sources sheet is absent', () => {
    const ok = planPhase3({
      ...base,
      inflowRows: parseCsv(INFLOWS),
      existingSources: new Map([
        ['Acme Salary', 'RUB'],
        ['Refund', 'RUB'],
      ]),
    })._unsafeUnwrap();
    expect(ok.sources).toEqual([]);
    expect(ok.inflows).toHaveLength(3);
    const missing = planPhase3({ ...base, inflowRows: parseCsv(INFLOWS) });
    expect(missing._unsafeUnwrapErr().message).toMatch(/"Acme Salary", "Refund"/);
  });
  it('splits expenses and budgets', () => {
    const plan = planPhase3({
      ...base,
      expenseRows: parseCsv(EXPENSES),
      asBudget: new Set(['Groceries']),
    })._unsafeUnwrap();
    expect(plan.categories).toEqual(['Прочее', 'Подписки']);
    expect(plan.expenses.map((e) => e.name)).toEqual(['Rent', 'IDE']);
    expect(plan.budgets.map((b) => b.name)).toEqual(['Groceries']);
    expect(plan.importDay).toBe('2026-09-17');
  });
  it('lists the problems of every sheet at once', () => {
    const r = planPhase3({
      ...base,
      inflowRows: parseCsv(INFLOWS),
      expenseRows: parseCsv(EXPENSES),
      asBudget: new Set(['Taxi']),
    });
    const message = r._unsafeUnwrapErr().message;
    expect(message).toMatch(/No income source named/);
    expect(message).toMatch(/--as-budget names no row in the sheet/);
  });
});

describe('rendering', () => {
  const plan = planPhase3({
    ...base,
    incomeRows: parseCsv(INCOME),
    inflowRows: parseCsv(INFLOWS),
    expenseRows: parseCsv(EXPENSES),
    asBudget: new Set(['Groceries']),
  })._unsafeUnwrap();
  it('prints one table per active kind and the totals line in a dry run', () => {
    const text = renderDryRun(new Set(['income', 'inflows', 'expenses'] as const), [], [], plan);
    expect(text).toContain('# Income sources');
    expect(text).toContain('# Inflows');
    expect(text).toMatch(/Acme Salary\s+2 inflows\s+2025-01-25…2025-02-10\s+302250 RUB/);
    expect(text).toContain('# Expenses and budgets');
    expect(text).toMatch(/IDE\s+Подписки\s+EUR\s+60\.12\s+yearly\s+ambiguous approx/);
    expect(text).toMatch(/Groceries\s+budget/);
    expect(text).not.toContain('# Accounts');
    expect(text.split('\n').at(-1)).toBe(
      '0 accounts, 0 rates, 3 income sources, 3 inflows, 2 expenses, 1 budgets',
    );
  });
  it('prints totals alone for a real run, with no name or amount', () => {
    const totals = renderTotals([], [], plan);
    expect(totals).toBe('0 accounts, 0 rates, 3 income sources, 3 inflows, 2 expenses, 1 budgets');
  });
});
```

In `apps/api/test/import/run.test.ts` change three expectations to the new shapes:

```ts
// 'parses flags and requires a user'
expect(parseArgs(['--user', 'a@b.c', '--accounts', 'x.csv', '--dry-run'])).toEqual({
  user: 'a@b.c',
  accounts: 'x.csv',
  rates: undefined,
  incomeSources: undefined,
  expenses: undefined,
  inflows: undefined,
  recordedAt: undefined,
  currencyOf: [],
  fallbackCurrency: 'EUR',
  asBudget: [],
  only: undefined,
  dryRun: true,
  force: false,
});
// 'renders a table and totals'
expect(text).toContain('1 accounts, 1 rates, 0 income sources');
// 'renders totals alone, without the table'
expect(totals).toBe('1 accounts, 1 rates, 0 income sources, 0 inflows, 0 expenses, 0 budgets');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && bunx vitest run test/import/run.test.ts test/import/run-phase3.test.ts`
Expected: FAIL — `planPhase3`, `activeKinds`, `renderDryRun` are not exported; `parseArgs` throws `Unknown option --income-sources`.

- [ ] **Step 3: Implement the runner**

Replace `apps/api/scripts/import/run.ts` with:

```ts
import { readFile } from 'node:fs/promises';
import { err, ok, type Result } from 'neverthrow';
import type { Sql } from '../../src/shared/db/client.js';
import { PgAccountRepository } from '../../src/modules/accounts/infrastructure/pg-account-repository.js';
import { PgRateRepository } from '../../src/modules/rates/infrastructure/pg-rate-repository.js';
import { parseCsv } from './csv.js';
import { ImportError, mapAccounts, type MappedAccount } from './accounts-mapper.js';
import { mapRates } from './rates-mapper.js';
import { mapIncomeSources, type MappedIncomeSource } from './income-mapper.js';
import { mapInflows, type MappedInflow } from './inflows-mapper.js';
import { mapExpenses, type MappedBudget, type MappedExpense } from './expenses-mapper.js';
import { parseCurrencyOf } from './native-currency.js';

export const IMPORT_KINDS = ['accounts', 'rates', 'income', 'expenses', 'inflows'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export interface ImportArgs {
  user: string;
  accounts: string | undefined;
  rates: string | undefined;
  incomeSources: string | undefined;
  expenses: string | undefined;
  inflows: string | undefined;
  recordedAt: string | undefined;
  currencyOf: string[];
  fallbackCurrency: string;
  asBudget: string[];
  only: ImportKind[] | undefined;
  dryRun: boolean;
  force: boolean;
}

/** Date, time and a zone; `Date.parse` alone would happily accept "2026-09-11" or "yesterday" in some runtimes. */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const VALUE_FLAGS = [
  '--user',
  '--accounts',
  '--rates',
  '--income-sources',
  '--expenses',
  '--inflows',
  '--recorded-at',
  '--fallback-currency',
  '--only',
];
const REPEAT_FLAGS = ['--currency-of', '--as-budget'];
const BOOL_FLAGS = ['--dry-run', '--force'];

export function parseArgs(argv: string[]): ImportArgs {
  const values: Record<string, string> = {};
  const repeated: Record<string, string[]> = { '--currency-of': [], '--as-budget': [] };
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (VALUE_FLAGS.includes(arg) || REPEAT_FLAGS.includes(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`);
      if (REPEAT_FLAGS.includes(arg)) repeated[arg]!.push(value);
      else values[arg] = value;
      i++;
    } else if (BOOL_FLAGS.includes(arg)) {
      flags.add(arg);
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
  }
  const user = values['--user'];
  if (!user) throw new Error('--user <email> is required');
  const recordedAt = values['--recorded-at'];
  // Checked here, before anything touches the database: a mistyped date would
  // otherwise only surface as a Postgres error in the middle of the import.
  if (recordedAt !== undefined && !ISO_DATETIME.test(recordedAt))
    throw new Error(
      `--recorded-at must be an ISO datetime such as 2026-09-11T12:00:00Z, not "${recordedAt}"`,
    );
  const fallbackCurrency = values['--fallback-currency'] ?? 'EUR';
  if (!/^[A-Z0-9]{2,10}$/.test(fallbackCurrency))
    throw new Error(
      `--fallback-currency must be a currency code such as EUR, not "${fallbackCurrency}"`,
    );
  const only = values['--only']?.split(',').map((k) => k.trim());
  const unknownKind = only?.find((k) => !(IMPORT_KINDS as readonly string[]).includes(k));
  if (unknownKind !== undefined)
    throw new Error(`--only accepts ${IMPORT_KINDS.join(', ')}; got "${unknownKind}"`);
  return {
    user,
    accounts: values['--accounts'],
    rates: values['--rates'],
    incomeSources: values['--income-sources'],
    expenses: values['--expenses'],
    inflows: values['--inflows'],
    recordedAt,
    currencyOf: repeated['--currency-of']!,
    fallbackCurrency,
    asBudget: repeated['--as-budget']!,
    only: only as ImportKind[] | undefined,
    dryRun: flags.has('--dry-run'),
    force: flags.has('--force'),
  };
}

const FILE_FLAG: Record<ImportKind, string> = {
  accounts: '--accounts',
  rates: '--rates',
  income: '--income-sources',
  expenses: '--expenses',
  inflows: '--inflows',
};
const fileOf = (args: ImportArgs, kind: ImportKind): string | undefined =>
  ({
    accounts: args.accounts,
    rates: args.rates,
    income: args.incomeSources,
    expenses: args.expenses,
    inflows: args.inflows,
  })[kind];

/** Every kind whose file was passed, narrowed by `--only`; a kind named without its file is a mistake. */
export function activeKinds(args: ImportArgs): Set<ImportKind> {
  if (args.only === undefined)
    return new Set(IMPORT_KINDS.filter((k) => fileOf(args, k) !== undefined));
  for (const k of args.only)
    if (fileOf(args, k) === undefined)
      throw new Error(`--only names "${k}", but ${FILE_FLAG[k]} was not passed`);
  return new Set(args.only);
}

/**
 * Numbers an imported name that is already taken by an account kept because it
 * has transfers, the way the mapper numbers collisions inside one import: two
 * accounts with the same name are indistinguishable in the list.
 */
export function avoidTakenNames(accounts: MappedAccount[], taken: string[]): MappedAccount[] {
  const used = new Set(taken);
  return accounts.map((a) => {
    if (!used.has(a.name)) {
      used.add(a.name);
      return a;
    }
    let n = 2;
    while (used.has(`${a.name} ${n}`)) n++;
    const name = `${a.name} ${n}`;
    used.add(name);
    return { ...a, name };
  });
}

export interface PlannedSource extends MappedIncomeSource {
  activeFrom: string;
  activeTo: string | null;
}

export interface Phase3Plan {
  sources: PlannedSource[];
  inflows: MappedInflow[];
  categories: string[];
  expenses: MappedExpense[];
  budgets: MappedBudget[];
  /** YYYY-MM-DD; `active_from` of expenses and budgets. */
  importDay: string;
}

export const EMPTY_PHASE3: Phase3Plan = {
  sources: [],
  inflows: [],
  categories: [],
  expenses: [],
  budgets: [],
  importDay: '1970-01-01',
};

export interface Phase3Input {
  /** Parsed CSV rows of each sheet; undefined when that kind is not part of the run. */
  incomeRows: string[][] | undefined;
  inflowRows: string[][] | undefined;
  expenseRows: string[][] | undefined;
  /** Name → currency of the user's sources already in the database. */
  existingSources: ReadonlyMap<string, string>;
  /** YYYY-MM-DD; `active_from` of everything the sheets do not date. */
  importDay: string;
  known: ReadonlySet<string>;
  currencyOf: ReadonlyMap<string, string>;
  fallback: string;
  asBudget: ReadonlySet<string>;
}

/** Everything the three phase 3 sheets turn into, decided without touching the database. */
export function planPhase3(input: Phase3Input): Result<Phase3Plan, ImportError> {
  const native = { currencyOf: input.currencyOf, fallback: input.fallback, known: input.known };
  const plan: Phase3Plan = { ...EMPTY_PHASE3, importDay: input.importDay };

  // The three sheets are judged independently so one dry run lists every
  // problem; only inflows wait for the income sheet, whose currencies they need.
  const problems: string[] = [];
  let sheetSources: MappedIncomeSource[] = [];
  let incomeFailed = false;
  if (input.incomeRows) {
    const mapped = mapIncomeSources(input.incomeRows, native);
    if (mapped.isErr()) {
      problems.push(mapped.error.message);
      incomeFailed = true;
    } else sheetSources = mapped.value;
  }
  let spans = new Map<string, { first: string; last: string }>();
  let inflowOnly: MappedIncomeSource[] = [];
  if (input.inflowRows && !incomeFailed) {
    const mapped = mapInflows(input.inflowRows, {
      ...native,
      sources: input.incomeRows
        ? new Map(sheetSources.map((s) => [s.name, s.currency]))
        : input.existingSources,
      createMissing: input.incomeRows !== undefined,
    });
    if (mapped.isErr()) problems.push(mapped.error.message);
    else {
      plan.inflows = mapped.value.inflows;
      spans = mapped.value.spans;
      inflowOnly = mapped.value.created;
    }
  }
  plan.sources = [
    ...sheetSources.map((s) => ({
      ...s,
      activeFrom: spans.get(s.name)?.first ?? input.importDay,
      activeTo: null,
    })),
    // Known only from past receipts: not something to expect money from today.
    ...inflowOnly.map((s) => ({
      ...s,
      activeFrom: spans.get(s.name)!.first,
      activeTo: spans.get(s.name)!.last,
    })),
  ];
  if (input.expenseRows) {
    const mapped = mapExpenses(input.expenseRows, { ...native, asBudget: input.asBudget });
    if (mapped.isErr()) problems.push(mapped.error.message);
    else {
      plan.categories = mapped.value.categories;
      plan.expenses = mapped.value.expenses;
      plan.budgets = mapped.value.budgets;
    }
  }
  if (problems.length > 0) return err(new ImportError(problems.join('\n')));
  return ok(plan);
}

export function renderTotals(
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
  plan: Phase3Plan = EMPTY_PHASE3,
): string {
  return [
    `${accounts.length} accounts`,
    `${rates.length} rates`,
    `${plan.sources.length} income sources`,
    `${plan.inflows.length} inflows`,
    `${plan.expenses.length} expenses`,
    `${plan.budgets.length} budgets`,
  ].join(', ');
}

const renderAccounts = (accounts: MappedAccount[]): string[] =>
  accounts.map((a) =>
    [
      a.name.padEnd(32),
      a.bank.padEnd(20),
      a.country,
      a.currency.padEnd(5),
      a.kind.padEnd(13),
      a.balance.padStart(16),
      `note ${a.note?.length ?? 0}`,
    ].join('  '),
  );

export function renderPlan(
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
): string {
  return [...renderAccounts(accounts), renderTotals(accounts, rates)].join('\n');
}

const flagsOf = (row: { ambiguous: boolean; approx?: boolean }): string =>
  [row.ambiguous ? 'ambiguous' : '', row.approx ? 'approx' : ''].filter(Boolean).join(' ');

export function renderSources(sources: PlannedSource[]): string[] {
  return sources.map((s) =>
    [
      s.name.padEnd(28),
      s.currency.padEnd(5),
      s.grossAmount.padStart(14),
      `tax ${s.taxRate}`.padEnd(10),
      `fee ${s.commissionRate}`.padEnd(10),
      `${s.activeFrom}…${s.activeTo ?? ''}`.padEnd(22),
      flagsOf(s),
    ]
      .join('  ')
      .trimEnd(),
  );
}

/** One line per source: a journal of eighty rows is noise, its shape is not. */
export function renderInflows(inflows: MappedInflow[]): string[] {
  const groups = new Map<string, MappedInflow[]>();
  for (const i of inflows) groups.set(i.source, [...(groups.get(i.source) ?? []), i]);
  return [...groups].map(([source, list]) => {
    const dates = list.map((i) => i.receivedOn).sort();
    // Display only: amounts are summed as scaled integers to stay exact.
    const total = list.reduce((sum, i) => sum + toMinor(i.amount), 0n);
    return [
      source.padEnd(28),
      `${list.length} inflows`.padEnd(12),
      `${dates[0]}…${dates.at(-1)}`.padEnd(22),
      `${fromMinor(total)} ${list[0]!.currency}`.padStart(20),
    ].join('  ');
  });
}

const MINOR = 8;
const toMinor = (amount: string): bigint => {
  const [int, frac = ''] = amount.split('.') as [string, string | undefined];
  return BigInt(int + frac.padEnd(MINOR, '0').slice(0, MINOR));
};
const fromMinor = (v: bigint): string => {
  const s = v.toString().padStart(MINOR + 1, '0');
  const frac = s.slice(-MINOR).replace(/0+$/, '');
  return frac === '' ? s.slice(0, -MINOR) : `${s.slice(0, -MINOR)}.${frac}`;
};

export function renderExpenses(expenses: MappedExpense[], budgets: MappedBudget[]): string[] {
  return [
    ...expenses.map((e) =>
      [
        e.name.padEnd(32),
        e.category.padEnd(10),
        e.currency.padEnd(5),
        e.amount.padStart(12),
        e.period.padEnd(8),
        flagsOf(e),
      ]
        .join('  ')
        .trimEnd(),
    ),
    ...budgets.map((b) =>
      [
        b.name.padEnd(32),
        'budget'.padEnd(10),
        b.currency.padEnd(5),
        b.monthlyLimit.padStart(12),
        'monthly'.padEnd(8),
        flagsOf(b),
      ]
        .join('  ')
        .trimEnd(),
    ),
  ];
}

/** The dry-run report: one table per kind that is part of the run, then the totals line. */
export function renderDryRun(
  kinds: ReadonlySet<ImportKind>,
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
  plan: Phase3Plan,
): string {
  const section = (title: string, lines: string[]) =>
    lines.length > 0 ? [`# ${title}`, ...lines, ''] : [];
  return [
    ...(kinds.has('accounts') ? section('Accounts', renderAccounts(accounts)) : []),
    ...(kinds.has('income') || kinds.has('inflows')
      ? section('Income sources', renderSources(plan.sources))
      : []),
    ...(kinds.has('inflows') ? section('Inflows', renderInflows(plan.inflows)) : []),
    ...(kinds.has('expenses')
      ? section('Expenses and budgets', renderExpenses(plan.expenses, plan.budgets))
      : []),
    renderTotals(accounts, rates, plan),
  ].join('\n');
}

class DryRun extends Error {}

const unwrap = <T>(r: Result<T, Error>): T =>
  r.match(
    (v) => v,
    (e) => {
      throw e;
    },
  );

const count = async (
  t: Sql,
  table: 'income_sources' | 'inflows' | 'expenses' | 'budgets',
  userId: string,
) =>
  (
    await t<{ n: number }[]>`select count(*)::int as n from ${t(table)} where user_id = ${userId}`
  )[0]!.n;

/**
 * Writes the phase 3 plan inside the caller's transaction. Each kind guards
 * itself: rows of that kind already there stop the run unless `--force`, which
 * clears what nothing else depends on (uncredited inflows, sources without
 * inflows, expenses, budgets, categories left empty) and imports again.
 */
async function writePhase3(
  t: Sql,
  userId: string,
  plan: Phase3Plan,
  kinds: ReadonlySet<ImportKind>,
  force: boolean,
  io: { log: (s: string) => void },
): Promise<void> {
  const refuse = (what: string, n: number) => {
    if (n > 0 && !force)
      throw new ImportError(`User already has ${n} ${what}; pass --force to replace them`);
  };
  if (kinds.has('inflows')) refuse('inflows', await count(t, 'inflows', userId));
  if (kinds.has('income')) refuse('income sources', await count(t, 'income_sources', userId));
  if (kinds.has('expenses')) {
    refuse('expenses', await count(t, 'expenses', userId));
    refuse('budgets', await count(t, 'budgets', userId));
  }

  if (force && kinds.has('inflows')) {
    const gone = await t`delete from inflows where user_id = ${userId} and account_id is null`;
    io.log(`removed ${gone.count} uncredited inflows`);
  }
  if (force && kinds.has('income')) {
    const gone = await t`
      delete from income_sources s
      where s.user_id = ${userId}
        and not exists (select 1 from inflows i where i.income_source_id = s.id)`;
    io.log(`removed ${gone.count} income sources without inflows`);
  }
  if (force && kinds.has('expenses')) {
    await t`delete from expenses where user_id = ${userId}`;
    await t`delete from budgets where user_id = ${userId}`;
    await t`
      delete from expense_categories c
      where c.user_id = ${userId}
        and not exists (select 1 from expenses e where e.category_id = c.id)`;
  }

  const sourceIds = new Map<string, { id: string; currency: string }>();
  if (kinds.has('income') || kinds.has('inflows'))
    for (const s of await t<{ id: string; name: string; currency: string }[]>`
      select id, name, currency from income_sources where user_id = ${userId}`)
      sourceIds.set(s.name, { id: s.id, currency: s.currency });

  // With only `inflows` active the plan holds no sheet sources, just the ones
  // the inflows brought; with only `income` active it holds no inflow-only ones.
  for (const s of plan.sources) {
    const kept = sourceIds.get(s.name);
    if (kept) {
      // A source that survived --force still has credited inflows: reuse it.
      if (kept.currency !== s.currency)
        throw new ImportError(
          `Income source "${s.name}" already exists in ${kept.currency}, the sheet says ${s.currency}`,
        );
      // Refresh what the sheet knows; pay days, the primary mark and the active
      // period were set by hand and stay. An inflow-only source has nothing to refresh.
      if (kinds.has('income') && s.activeTo === null)
        await t`
          update income_sources
          set gross_amount = ${s.grossAmount}, tax_rate = ${s.taxRate}, commission_rate = ${s.commissionRate}
          where id = ${kept.id} and user_id = ${userId}`;
      continue;
    }
    const [row] = await t<{ id: string }[]>`
      insert into income_sources
        (user_id, name, gross_amount, currency, tax_rate, commission_rate, pay_days, is_primary, active_from, active_to)
      values
        (${userId}, ${s.name}, ${s.grossAmount}, ${s.currency}, ${s.taxRate}, ${s.commissionRate},
         '{}'::int[], false, ${s.activeFrom}, ${s.activeTo})
      returning id`;
    sourceIds.set(s.name, { id: row!.id, currency: s.currency });
  }

  for (const i of plan.inflows) {
    const source = sourceIds.get(i.source);
    if (!source) throw new ImportError(`No income source named "${i.source}"`);
    if (source.currency !== i.currency)
      throw new ImportError(
        `Income source "${i.source}" is in ${source.currency}, its inflows were read as ${i.currency}`,
      );
    await t`
      insert into inflows (user_id, income_source_id, amount, currency, received_on, realised_rate_to_usd, note)
      values (${userId}, ${source.id}, ${i.amount}, ${i.currency}, ${i.receivedOn}, ${i.realisedRateToUsd},
              'Imported from spreadsheet')`;
  }

  const categoryIds = new Map<string, string>();
  if (kinds.has('expenses'))
    for (const c of await t<{ id: string; name: string }[]>`
      select id, name from expense_categories where user_id = ${userId}`)
      categoryIds.set(c.name.toLowerCase(), c.id);
  for (const [index, name] of plan.categories.entries()) {
    if (categoryIds.has(name.toLowerCase())) continue;
    const [row] = await t<{ id: string }[]>`
      insert into expense_categories (user_id, name, sort_order)
      values (${userId}, ${name}, ${index})
      returning id`;
    categoryIds.set(name.toLowerCase(), row!.id);
  }
  for (const e of plan.expenses)
    await t`
      insert into expenses (user_id, category_id, name, amount, currency, period, is_essential, active_from)
      values (${userId}, ${categoryIds.get(e.category.toLowerCase())!}, ${e.name}, ${e.amount}, ${e.currency},
              ${e.period}, false, ${plan.importDay})`;
  for (const b of plan.budgets)
    await t`
      insert into budgets (user_id, name, monthly_limit, currency, active_from)
      values (${userId}, ${b.name}, ${b.monthlyLimit}, ${b.currency}, ${plan.importDay})`;
}

export async function runImport(
  args: ImportArgs,
  sql: Sql,
  io: { log: (s: string) => void } = console,
): Promise<void> {
  const kinds = activeKinds(args);
  const currencyOf = unwrap(parseCurrencyOf(args.currencyOf));
  const [userRow] = await sql<
    { id: string }[]
  >`select id from auth.users where email = ${args.user}`;
  if (!userRow) throw new ImportError('No user found for the given --user email');
  const userId = userRow.id;
  const known = new Set(
    (await sql<{ code: string }[]>`select code from currencies`).map((r) => r.code),
  );
  const rowsOf = async (kind: ImportKind, path: string | undefined) =>
    kinds.has(kind) && path !== undefined ? parseCsv(await readFile(path, 'utf8')) : undefined;

  const accountRows = await rowsOf('accounts', args.accounts);
  const accounts = accountRows ? unwrap(mapAccounts(accountRows, { known })) : [];
  const rateRows = await rowsOf('rates', args.rates);
  const rates = rateRows ? unwrap(mapRates(rateRows)) : [];

  const recordedAt = args.recordedAt ?? new Date().toISOString();
  const existingSources = new Map(
    kinds.has('inflows') && !kinds.has('income')
      ? (
          await sql<{ name: string; currency: string }[]>`
            select name, currency from income_sources where user_id = ${userId}`
        ).map((s) => [s.name, s.currency] as const)
      : [],
  );
  const plan = unwrap(
    planPhase3({
      incomeRows: await rowsOf('income', args.incomeSources),
      inflowRows: await rowsOf('inflows', args.inflows),
      expenseRows: await rowsOf('expenses', args.expenses),
      existingSources,
      importDay: recordedAt.slice(0, 10),
      known,
      currencyOf,
      fallback: args.fallbackCurrency,
      asBudget: new Set(args.asBudget.map((n) => n.replace(/\s+/g, ' ').trim())),
    }),
  );
  io.log(
    args.dryRun ? renderDryRun(kinds, accounts, rates, plan) : renderTotals(accounts, rates, plan),
  );

  try {
    await sql.begin(async (tx) => {
      const t = tx as unknown as Sql;
      const accountRepo = new PgAccountRepository(t);
      const existing = await accountRepo.list(userId);
      const kept: string[] = [];
      if (accounts.length > 0 && existing.length > 0) {
        if (!args.force)
          throw new ImportError(
            `User already has ${existing.length} accounts; pass --force to replace the ones without transfers`,
          );
        for (const a of existing) {
          const outcome = await accountRepo.delete(userId, a.id);
          if (outcome !== 'deleted') kept.push(a.name);
          io.log(`${outcome === 'deleted' ? 'removed' : 'kept (still referenced)'}: ${a.name}`);
        }
      }
      for (const { balance, ...data } of avoidTakenNames(accounts, kept))
        await accountRepo.create(userId, data, {
          amount: balance,
          recordedAt,
          note: 'Imported from spreadsheet',
        });
      if (rates.length > 0)
        await new PgRateRepository(t).upsertMany(
          rates.map((r) => ({ ...r, source: 'manual' as const, userId })),
        );
      await writePhase3(t, userId, plan, kinds, args.force, io);
      if (args.dryRun) throw new DryRun();
    });
    io.log(kinds.size > 0 ? 'Imported.' : 'Nothing to import.');
  } catch (e) {
    if (e instanceof DryRun) {
      io.log('Dry run: rolled back.');
      return;
    }
    throw e;
  }
}
```

Replace the header comment of `apps/api/scripts/import-sheet.ts` (code below it unchanged):

```ts
/**
 * Imports the owner's spreadsheet from CSV files that never enter the
 * repository: the "Счета" sheet and the yearly rates block (phase 2), the
 * income sources, "Поступления" and expenses sheets (phase 3). Reads
 * DATABASE_URL from the environment; point it at local Supabase or, with
 * `.env.prod.local`, at production.
 *
 *   bun run import -- --user me@example.com --income-sources imports/income-sources.csv \
 *     --inflows imports/inflows.csv --expenses imports/expenses.csv --as-budget "Groceries" --dry-run
 */
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `cd apps/api && bun run test && bun run typecheck && bun run lint`
Expected: PASS (10 new tests in `run-phase3.test.ts`, 7 in `run.test.ts`).

- [ ] **Step 5: Verify against local Supabase with synthetic files**

Requires Task 7's migrations applied (`supabase db reset`). Write the three synthetic CSVs from `run-phase3.test.ts` (`INCOME`, `INFLOWS`, `EXPENSES`) into `imports/demo-income.csv`, `imports/demo-inflows.csv`, `imports/demo-expenses.csv` (git-ignored; delete them afterwards). Sign up a local user (Inbucket at http://127.0.0.1:54324), then from `apps/api`:

1. `bun run import -- --user <email> --income-sources ../../imports/demo-income.csv --inflows ../../imports/demo-inflows.csv --expenses ../../imports/demo-expenses.csv --as-budget "Groceries" --dry-run` → three tables, `0 accounts, 0 rates, 3 income sources, 3 inflows, 2 expenses, 1 budgets`, `Dry run: rolled back.`; `select count(*) from inflows` is 0.
2. Same without `--dry-run` → only the totals line and `Imported.`; counts in the database match; `Refund` has `active_to` set; every inflow has `account_id is null`.
3. Same again → fails with `User already has 3 inflows; pass --force to replace them`, nothing changed.
4. Same with `--force` → `removed 3 uncredited inflows`, `removed 3 income sources without inflows`, counts unchanged afterwards.
5. Pass only `--inflows … --force` (no `--income-sources`) → succeeds, resolving all three names against the existing sources; then `update income_sources set name = 'Renamed' where name = 'Refund'` and rerun → fails with `No income source named "Refund"; create it first or pass --income-sources`, nothing changed.
6. The phase 2 accounts are untouched throughout (`select count(*) from accounts` constant).

Record anything that behaves differently in `docs/discovery/phase-3-execution-ledger.md`. Whatever happens, append these rulings of Tasks 14–17 to the ledger (create the file with a `# Phase 3 execution ledger` heading if Task 27 has not yet):

- Import: `--currency-of` and `--as-budget` match the name as the sheet spells it (whitespace collapsed), before "Подписка" or "(year…)" is stripped; an `--as-budget` name that matches no row stops the run.
- Import: a source known only from inflows whose RUB and USD columns tie takes `--fallback-currency` and is marked `ambiguous`; unless that currency is RUB or USD the run stops and names the `--currency-of "<source>=RUB|USD"` flag to pass.
- Import: inflow rows with a zero or missing amount, or a RUB row without its USD/RUB rate, stop the run (they are listed, never skipped silently); expense rows whose three amounts are all zero are skipped.
- Import: under `--force` a source that survives because one of its inflows was credited to an Account is reused by name, its gross amount, tax and commission are refreshed, and a currency mismatch with the sheet stops the run.
- Import: every mapping problem of all three sheets is collected and printed together; database-dependent refusals (existing rows without `--force`) are still reported one at a time.
- Import: the totals line always names all six kinds (`N accounts, N rates, N income sources, N inflows, N expenses, N budgets`).

- [ ] **Step 6: Docs**

Replace the "Import from the spreadsheet" section of `README.md` with:

```markdown
## Import from the spreadsheet

Export the sheets as CSV into `imports/` (git-ignored): "Счета" and the "Курсы пересчёта" block (History by years), the income sources sheet, "Поступления" and the expenses sheet. Then:

    cd apps/api
    bun run import -- --user you@example.com --accounts ../../imports/accounts.csv --rates ../../imports/rates.csv --dry-run
    bun run import -- --user you@example.com \
      --income-sources ../../imports/income-sources.csv --inflows ../../imports/inflows.csv \
      --expenses ../../imports/expenses.csv --as-budget "Groceries" --dry-run

Drop `--dry-run` to write. Only the kinds whose files are passed are touched; `--only accounts,rates,income,expenses,inflows` narrows that further.

- **Accounts, rates.** Every row becomes an Account with one Balance entry dated now (or `--recorded-at <ISO>`); yearly rates become manual rates dated January 1.
- **Native currency.** The income and expenses sheets show each amount in USD, EUR and RUB. The import takes the one that is a whole number; when none or several are, it takes `--fallback-currency` (default `EUR`) and marks the row `ambiguous` in the dry run. Fix such rows with `--currency-of "<name as in the sheet>=<CODE>"` (repeatable).
- **Income sources.** Only the first (monthly) table is read. Pay days and the primary mark are not in the sheet; set them in the app.
- **Inflows.** Stored in the source's currency (RUB with the day's realised rate, or USD) and never credited to an Account. A source that appears only in "Поступления" is created with a zero expected amount and an active period spanning its inflows. Without `--income-sources`, every source must already exist by name.
- **Expenses.** Only the first block up to "Итого". "Подписка …" rows go to the "Подписки" category, the rest to "Прочее"; `(yearly)` rows become yearly with the amount rebuilt as monthly × 12 (`approx`). `--as-budget "<name>"` (repeatable) imports a row as a Budget. Essential marks and billing days are set in the app.
- **Second run.** Each kind refuses when the user already has rows of it, unless `--force`, which replaces accounts without transfers or inflows, uncredited inflows, sources without remaining inflows, and all expenses, budgets and empty categories. A source kept because an inflow of it was credited to an Account is reused by name and its gross amount, tax and commission are refreshed from the sheet; a different currency stops the run. Everything runs in one transaction, and a dry run lists every problem of every sheet at once.

Against production use `bun --env-file=.env.prod.local scripts/import-sheet.ts …`.
```

Replace the bullet under "## Scripts" in `AGENTS.md` with:

```markdown
- `apps/api/scripts/import-sheet.ts` — local-only CLI that imports the owner's spreadsheet exports into `accounts`/`balance_entries`/`rates` (phase 2) and `income_sources`/`inflows`/`expense_categories`/`expenses`/`budgets` (phase 3). Pure mappers live in `scripts/import/` (`block.ts` finds a table inside a sheet, `native-currency.ts` guesses which of the USD/EUR/RUB columns was typed); `run.ts` plans without the database (`planPhase3`) and writes in one transaction. Never reads real data from the repo (`imports/` is git-ignored; tests use synthetic CSVs only); run from `apps/api` as `bun run import -- --user <email> [...] --dry-run`.
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/scripts/import/run.ts apps/api/scripts/import-sheet.ts apps/api/test/import/run.test.ts apps/api/test/import/run-phase3.test.ts README.md AGENTS.md docs/discovery/phase-3-execution-ledger.md
git commit -m "feat(api): import income sources, inflows, expenses and budgets"
```

Commit with `/git-commit`; the message ends with the two trailers from Global Constraints (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm`).

### Task 18: UI kit — segmented control, day picker, percent input, progress rule, route fallbacks

**Files:**

- Create: `packages/ui/src/components/segmented-control/{SegmentedControl.vue, types.ts}`
- Create: `packages/ui/src/components/day-of-month-picker/DayOfMonthPicker.vue`
- Create: `packages/ui/src/components/percent-input/{PercentInput.vue, percent.ts}`
- Create: `packages/ui/src/components/progress-rule/ProgressRule.vue`
- Create: `packages/ui/src/components/async-fallback/{RouteLoading.vue, RouteError.vue}`
- Create (generated by the shadcn-vue CLI): `packages/ui/src/components/ui/switch/**`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/test/{segmented-control.test.ts, day-of-month-picker.test.ts, percent-input.test.ts, progress-rule.test.ts, async-fallback.test.ts, phase3-exports.test.ts}`

**Interfaces:**

- Consumes: nothing from earlier tasks. `packages/ui` imports only Vue, reka-ui and the Tailwind family — never `@magermoney/domain`, `@magermoney/contracts`, `decimal.js` or `vue-i18n` (it has none of them as a dependency), so percentages are moved with string arithmetic and every label arrives as a prop.
- Produces (all exported from `@magermoney/ui`):
  - `SegmentedControl` — props `modelValue: string`, `options: SegmentedOption[]`, `ariaLabel?: string`, `class?: string`; emits `update:modelValue: [value: string]`. `type SegmentedOption = { value: string; label: string }`. Radio-group semantics: `role="radiogroup"`, each segment `role="radio"` + `aria-checked`, roving `tabindex`, arrow keys move and select. Each segment carries `data-value="<value>"` and `data-testid="segment-<value>"`.
  - `DayOfMonthPicker` — props `modelValue: number[] | number | null`, `multiple?: boolean` (default `true`), `ariaLabel?: string`, `class?: string`; emits `update:modelValue: [value: number[] | number | null]`. Multiple (pay days): `v-model` is `number[]`, always emitted sorted ascending and unique. `:multiple="false"` (a billing day, Task 23): `v-model` is `number | null`; clicking the chosen day again emits `null`. Each day is a `button` with `aria-pressed` and `data-testid="day-<n>"`.
  - `PercentInput` — props `modelValue: string` (a `DecimalString` fraction in `[0, 1)`, e.g. `"0.15"`), `locale: 'ru' | 'en'`, `class?: string`; emits `update:modelValue: [fraction: string]`. Shows `15`, accepts `0..99.99` with at most two decimals, empty text emits `"0"`, invalid text is kept in the field with `aria-invalid="true"` and nothing is emitted.
  - `percentToFraction(raw: string): string | null`, `fractionToPercent(fraction: string): string`.
  - `ProgressRule` — props `value: number`, `max: number` (the caller turns exact amounts into numbers for drawing only; the share is `value / max` clamped to `0..1`, and `0` when `max` is not positive or either is not finite), `label?: string`, `class?: string`. Renders `role="progressbar"` with `aria-valuenow` 0–100.
  - `RouteLoading` — props `label: string`. `RouteError` — props `title: string`, `actionLabel: string`; emits `retry: []`.
  - shadcn-vue primitive `Switch` (Tasks 21 and 23 use it). The expense category field in Task 23 is an `<input>` with a `<datalist>`, so no Popover/Command primitives are installed (YAGNI).

- [ ] **Step 1: Write the failing tests for the pure percent functions and the four components**

`packages/ui/test/percent-input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { fractionToPercent, percentToFraction } from '../src/components/percent-input/percent';
import PercentInput from '../src/components/percent-input/PercentInput.vue';

describe('percentToFraction', () => {
  it('moves the point two places left without ever touching a float', () => {
    expect(percentToFraction('15')).toBe('0.15');
    expect(percentToFraction('5')).toBe('0.05');
    expect(percentToFraction('10')).toBe('0.1');
    expect(percentToFraction('15,5')).toBe('0.155');
    expect(percentToFraction('0.25')).toBe('0.0025');
    expect(percentToFraction('13 %')).toBe('0.13');
    expect(percentToFraction('0')).toBe('0');
    expect(percentToFraction('')).toBe('0');
  });
  it('rejects 100 and above, three decimals, negatives and junk', () => {
    expect(percentToFraction('100')).toBeNull();
    expect(percentToFraction('12.345')).toBeNull();
    expect(percentToFraction('-5')).toBeNull();
    expect(percentToFraction('abc')).toBeNull();
    expect(percentToFraction('1.2.3')).toBeNull();
  });
});

describe('fractionToPercent', () => {
  it('moves the point two places right and drops padding zeros', () => {
    expect(fractionToPercent('0.15')).toBe('15');
    expect(fractionToPercent('0.05')).toBe('5');
    expect(fractionToPercent('0.1')).toBe('10');
    expect(fractionToPercent('0.155')).toBe('15.5');
    expect(fractionToPercent('0.0025')).toBe('0.25');
    expect(fractionToPercent('0')).toBe('0');
    expect(fractionToPercent('0.150')).toBe('15');
  });
  it('round-trips every value the field accepts', () => {
    for (const p of ['0', '1', '9.5', '13', '15.25', '99.99'])
      expect(fractionToPercent(percentToFraction(p)!)).toBe(p);
  });
});

describe('PercentInput', () => {
  it('shows the fraction as a percentage in the locale and emits a fraction', async () => {
    const w = mount(PercentInput, { props: { modelValue: '0.155', locale: 'ru' } });
    const input = w.get('input');
    expect(input.element.value).toBe('15,5');
    await input.setValue('13');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['0.13']);
  });
  it('keeps junk in the field, marks it invalid and emits nothing for it', async () => {
    const w = mount(PercentInput, { props: { modelValue: '0', locale: 'en' } });
    const input = w.get('input');
    await input.setValue('120');
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
  it('follows an external change', async () => {
    const w = mount(PercentInput, { props: { modelValue: '0.1', locale: 'en' } });
    await w.setProps({ modelValue: '0.2' });
    expect(w.get('input').element.value).toBe('20');
  });
});
```

`packages/ui/test/segmented-control.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SegmentedControl from '../src/components/segmented-control/SegmentedControl.vue';

const options = [
  { value: 'income', label: 'Income' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'budgets', label: 'Budgets' },
];
const mountIt = (modelValue = 'income') =>
  mount(SegmentedControl, {
    props: { modelValue, options, ariaLabel: 'Plan section' },
    attachTo: document.body,
  });

describe('SegmentedControl', () => {
  it('is a radio group: one checked segment, one tab stop', () => {
    const w = mountIt('expenses');
    expect(w.get('[role="radiogroup"]').attributes('aria-label')).toBe('Plan section');
    const radios = w.findAll('[role="radio"]');
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1']);
    w.unmount();
  });
  it('emits the value of the segment that was clicked', async () => {
    const w = mountIt();
    await w.get('[data-value="budgets"]').trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['budgets']]);
    w.unmount();
  });
  it('moves with the arrow keys, wrapping at both ends, and takes focus along', async () => {
    const w = mountIt('income');
    await w.get('[data-testid="segment-income"]').trigger('keydown', { key: 'ArrowLeft' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['budgets']);
    expect(document.activeElement).toBe(w.get('[data-testid="segment-budgets"]').element);
    await w.get('[data-testid="segment-budgets"]').trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['income']);
    w.unmount();
  });
});
```

`packages/ui/test/day-of-month-picker.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DayOfMonthPicker from '../src/components/day-of-month-picker/DayOfMonthPicker.vue';

describe('DayOfMonthPicker', () => {
  it('offers 31 days and marks the chosen ones', () => {
    const w = mount(DayOfMonthPicker, { props: { modelValue: [10, 25] } });
    expect(w.findAll('button')).toHaveLength(31);
    expect(w.get('[data-testid="day-10"]').attributes('aria-pressed')).toBe('true');
    expect(w.get('[data-testid="day-11"]').attributes('aria-pressed')).toBe('false');
  });
  it('adds a day in order and removes one that was already chosen', async () => {
    const w = mount(DayOfMonthPicker, { props: { modelValue: [25] } });
    await w.get('[data-testid="day-10"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([[10, 25]]);
    await w.setProps({ modelValue: [10, 25] });
    await w.get('[data-testid="day-25"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([[10]]);
  });
  it('in single mode holds one day or none', async () => {
    const w = mount(DayOfMonthPicker, { props: { modelValue: null, multiple: false } });
    await w.get('[data-testid="day-15"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([15]);
    await w.setProps({ modelValue: 15 });
    expect(w.get('[data-testid="day-15"]').attributes('aria-pressed')).toBe('true');
    await w.get('[data-testid="day-20"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([20]);
    await w.setProps({ modelValue: 20 });
    await w.get('[data-testid="day-20"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([null]);
  });
  it('never emits a duplicate, even when it was handed one', async () => {
    const w = mount(DayOfMonthPicker, { props: { modelValue: [5, 5, 1] } });
    await w.get('[data-testid="day-3"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([[1, 3, 5]]);
  });
});
```

`packages/ui/test/progress-rule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProgressRule from '../src/components/progress-rule/ProgressRule.vue';

const now = (value: number, max: number) =>
  mount(ProgressRule, { props: { value, max, label: 'Received' } })
    .get('[role="progressbar"]')
    .attributes('aria-valuenow');

describe('ProgressRule', () => {
  it('reports the share of max as a whole percentage', () => {
    expect(now(50, 100)).toBe('50');
    expect(now(1, 3)).toBe('33');
  });
  it('clamps below zero and above max, and draws nothing for a missing or broken max', () => {
    expect(now(-1, 10)).toBe('0');
    expect(now(17, 10)).toBe('100');
    expect(now(5, 0)).toBe('0');
    expect(now(Number.NaN, 10)).toBe('0');
    expect(now(5, Number.NaN)).toBe('0');
  });
  it('names itself for a screen reader', () => {
    const w = mount(ProgressRule, { props: { value: 2, max: 10, label: 'Received' } });
    expect(w.get('[role="progressbar"]').attributes('aria-label')).toBe('Received');
  });
});
```

`packages/ui/test/async-fallback.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RouteError from '../src/components/async-fallback/RouteError.vue';
import RouteLoading from '../src/components/async-fallback/RouteLoading.vue';

describe('route fallbacks', () => {
  it('announces loading politely', () => {
    const w = mount(RouteLoading, { props: { label: 'Loading' } });
    expect(w.get('[role="status"]').text()).toContain('Loading');
  });
  it('says what happened and asks for a retry instead of doing it', async () => {
    const w = mount(RouteError, { props: { title: 'Could not load', actionLabel: 'Reload' } });
    expect(w.get('[role="alert"]').text()).toContain('Could not load');
    await w.get('button').trigger('click');
    expect(w.emitted('retry')).toHaveLength(1);
  });
});
```

`packages/ui/test/phase3-exports.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as ui from '../src/index';

describe('phase 3 exports', () => {
  it('exposes the hand-written components', () => {
    for (const name of [
      'SegmentedControl',
      'DayOfMonthPicker',
      'PercentInput',
      'ProgressRule',
      'RouteLoading',
      'RouteError',
      'percentToFraction',
      'fractionToPercent',
    ])
      expect(ui).toHaveProperty(name);
  });
  it('exposes the shadcn-vue primitives the phase 3 forms use', () => {
    expect(ui).toHaveProperty('Switch');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd packages/ui && bun run test`
Expected: FAIL — `Failed to resolve import "../src/components/percent-input/percent"` and the same for the other new files; the six older test files still pass.

- [ ] **Step 3: Add the shadcn-vue `Switch` through the CLI**

Run inside `packages/ui`: `bunx shadcn-vue@latest add switch` (or the equivalent shadcn-vue MCP call from `.mcp.json`). Then, in every generated file, rewrite `@/lib/utils` to the relative path (`../../../lib/utils`) and any `@/components/ui/<x>` to `../<x>`, exactly as the existing `button`, `sheet` and `select` folders do — a consumer of the package has no `@/` alias pointing here. Check with:

```bash
cd packages/ui && grep -rn "from '@/" src/components/ui/switch
```

Expected: no output. If the CLI edited `package.json`, run `bun install` from the repo root. Open `src/components/ui/switch/Switch.vue`: it must forward `modelValue` / `update:modelValue` to reka-ui's `SwitchRoot` (reka-ui 2 does) — every phase 3 form binds it with `v-model`. If the registry handed out an older `checked`-based file, re-run the CLI for `switch` against the current registry rather than adapting the forms.

- [ ] **Step 4: Write the percent functions and `PercentInput`**

`packages/ui/src/components/percent-input/percent.ts`:

```ts
/**
 * Text ↔ fraction for tax and commission fields. A rate is a decimal string in
 * [0, 1) end to end (ADR 0001), so the point is moved by slicing the string —
 * `15 / 100` would hand the domain 0.15000000000000002 sooner or later.
 */
const NOISE = /[\s  %]/g;

/** "15,5" → "0.155". Empty means zero. Null when the text is not a percentage below 100 with at most two decimals. */
export function percentToFraction(raw: string): string | null {
  const s = raw.replace(NOISE, '').replace(',', '.');
  if (s === '') return '0';
  const m = /^(\d{1,2})(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const digits = `${(m[1] ?? '0').padStart(2, '0')}${m[2] ?? ''}`.replace(/0+$/, '');
  return digits === '' ? '0' : `0.${digits}`;
}

/** "0.155" → "15.5". The input is a fraction below one; anything before the point is ignored. */
export function fractionToPercent(fraction: string): string {
  const frac = (fraction.split('.')[1] ?? '').padEnd(2, '0');
  const int = frac.slice(0, 2).replace(/^0(?=\d)/, '');
  const rest = frac.slice(2).replace(/0+$/, '');
  return rest === '' ? int : `${int}.${rest}`;
}
```

`packages/ui/src/components/percent-input/PercentInput.vue`:

```vue
<script setup lang="ts">
/**
 * A rate typed as a percentage and emitted as a fraction ("15" → "0.15").
 * Invalid text stays in the field, marked invalid, and the last good value
 * stays emitted — the same contract as `MoneyInput`.
 */
import { ref, watch } from 'vue';
import { cn } from '../../lib/utils';
import { fractionToPercent, percentToFraction } from './percent';

const props = withDefaults(
  defineProps<{ modelValue: string; locale: 'ru' | 'en'; class?: string }>(),
  { class: '' },
);
const emit = defineEmits<{ 'update:modelValue': [fraction: string] }>();

const show = (fraction: string) =>
  props.locale === 'ru'
    ? fractionToPercent(fraction).replace('.', ',')
    : fractionToPercent(fraction);

const text = ref(show(props.modelValue));
const invalid = ref(false);

watch(
  () => props.modelValue,
  (v) => {
    if (percentToFraction(text.value) !== v) {
      text.value = show(v);
      invalid.value = false;
    }
  },
);

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  text.value = raw;
  const parsed = percentToFraction(raw);
  invalid.value = parsed === null;
  if (parsed !== null) emit('update:modelValue', parsed);
}

function onBlur() {
  if (!invalid.value) text.value = show(props.modelValue);
}
</script>

<template>
  <span :class="cn('relative block', props.class)">
    <input
      :value="text"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      :aria-invalid="invalid ? 'true' : undefined"
      data-slot="percent-input"
      class="h-11 w-full rounded-lg border border-border bg-background pl-3 pr-8 font-mono text-base tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
      @input="onInput"
      @blur="onBlur"
    />
    <span
      class="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-sm text-muted-foreground"
      aria-hidden="true"
      >%</span
    >
  </span>
</template>
```

- [ ] **Step 5: Write `SegmentedControl`**

`packages/ui/src/components/segmented-control/types.ts`:

```ts
/** One segment: the value the model takes and the words on it. */
export interface SegmentedOption {
  value: string;
  label: string;
}
```

`packages/ui/src/components/segmented-control/SegmentedControl.vue`:

```vue
<script setup lang="ts">
/**
 * Two to four mutually exclusive views of one screen. A radio group, not tabs:
 * the caller decides what the choice shows, and the control promises only that
 * exactly one segment is chosen and that the arrow keys move between them.
 */
import { cn } from '../../lib/utils';
import type { SegmentedOption } from './types';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SegmentedOption[];
    ariaLabel?: string;
    class?: string;
  }>(),
  { ariaLabel: undefined, class: '' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function onKeydown(e: KeyboardEvent, index: number) {
  const step = STEP[e.key];
  if (!step) return;
  e.preventDefault();
  const count = props.options.length;
  const nextIndex = (index + step + count) % count;
  const next = props.options[nextIndex];
  if (!next) return;
  emit('update:modelValue', next.value);
  // Focus follows selection, as in a native radio group.
  const group = (e.currentTarget as HTMLElement).parentElement;
  (group?.children[nextIndex] as HTMLElement | undefined)?.focus();
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="ariaLabel"
    data-slot="segmented-control"
    :class="cn('flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5', props.class)"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue ? 'true' : 'false'"
      :tabindex="option.value === modelValue ? 0 : -1"
      :data-value="option.value"
      :data-testid="`segment-${option.value}`"
      class="min-h-9 flex-1 rounded-lg px-3 py-1 text-sm outline-offset-2 transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      :class="
        option.value === modelValue
          ? 'bg-surface-raised text-foreground ring-1 ring-foreground/10'
          : 'text-muted-foreground hover:text-foreground'
      "
      @click="emit('update:modelValue', option.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
```

- [ ] **Step 6: Write `DayOfMonthPicker`, `ProgressRule`, `RouteLoading`, `RouteError`**

`packages/ui/src/components/day-of-month-picker/DayOfMonthPicker.vue`:

```vue
<script setup lang="ts">
/**
 * The days of a month something happens on: 31 toggles in a week-wide grid.
 * Two shapes of one control: several days (a pay schedule) or exactly one or
 * none (a billing day). What the multiple mode emits is always sorted and
 * unique, so the caller can send it as is.
 */
import { computed } from 'vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{
    modelValue: number[] | number | null;
    multiple?: boolean;
    ariaLabel?: string;
    class?: string;
  }>(),
  { multiple: true, ariaLabel: undefined, class: '' },
);
const emit = defineEmits<{ 'update:modelValue': [value: number[] | number | null] }>();

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const chosen = computed(
  () =>
    new Set(
      Array.isArray(props.modelValue)
        ? props.modelValue
        : props.modelValue === null
          ? []
          : [props.modelValue],
    ),
);

function toggle(day: number) {
  if (!props.multiple) {
    emit('update:modelValue', chosen.value.has(day) ? null : day);
    return;
  }
  const next = new Set(chosen.value);
  if (next.has(day)) next.delete(day);
  else next.add(day);
  emit(
    'update:modelValue',
    [...next].sort((a, b) => a - b),
  );
}
</script>

<template>
  <div
    role="group"
    :aria-label="ariaLabel"
    data-slot="day-of-month-picker"
    :class="cn('grid grid-cols-7 gap-1', props.class)"
  >
    <button
      v-for="day in DAYS"
      :key="day"
      type="button"
      :aria-pressed="chosen.has(day) ? 'true' : 'false'"
      :data-testid="`day-${day}`"
      class="flex min-h-9 items-center justify-center rounded-lg font-mono text-sm tabular-nums outline-offset-2 transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      :class="
        chosen.has(day)
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      "
      @click="toggle(day)"
    >
      {{ day }}
    </button>
  </div>
</template>
```

`packages/ui/src/components/progress-rule/ProgressRule.vue`:

```vue
<script setup lang="ts">
/**
 * Progress drawn as a ledger rule: a hairline that fills in. The caller hands
 * two numbers made from exact amounts for drawing only; the float here decides a
 * width and never reaches a figure a person reads.
 */
import { computed } from 'vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{ value: number; max: number; label?: string; class?: string }>(),
  { label: undefined, class: '' },
);

const percent = computed(() => {
  const share = props.max > 0 ? props.value / props.max : 0;
  return Number.isFinite(share) ? Math.round(Math.min(1, Math.max(0, share)) * 100) : 0;
});
</script>

<template>
  <div
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="percent"
    :aria-label="label"
    data-slot="progress-rule"
    :class="cn('h-0.5 w-full overflow-hidden rounded-full bg-border', props.class)"
  >
    <div
      class="h-full origin-left rounded-full bg-foreground transition-[width] duration-300 ease-out"
      :style="{ width: `${percent}%` }"
    />
  </div>
</template>
```

`packages/ui/src/components/async-fallback/RouteLoading.vue`:

```vue
<script setup lang="ts">
/** What a routed screen shows while its chunk is on the way: the shape of a page, and a word for a screen reader. */
import { Skeleton } from '../ui/skeleton';

defineProps<{ label: string }>();
</script>

<template>
  <div role="status" aria-live="polite" data-slot="route-loading" class="space-y-4 pt-2">
    <span class="sr-only">{{ label }}</span>
    <Skeleton class="h-8 w-40" />
    <Skeleton class="h-12 w-64" />
    <Skeleton class="h-11 w-full" />
    <Skeleton class="h-11 w-full" />
  </div>
</template>
```

`packages/ui/src/components/async-fallback/RouteError.vue`:

```vue
<script setup lang="ts">
/**
 * What a routed screen shows when its chunk did not arrive — after a deploy the
 * old file is gone. It says so and offers the one thing that helps; what "retry"
 * means (a reload) is the app's business, not the design system's.
 */
import { Button } from '../ui/button';

defineProps<{ title: string; actionLabel: string }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div role="alert" data-slot="route-error" class="mt-10 text-center">
    <p class="text-lg font-semibold">{{ title }}</p>
    <Button
      type="button"
      class="mt-4 min-h-9 pointer-coarse:min-h-11"
      data-testid="route-reload"
      @click="emit('retry')"
    >
      {{ actionLabel }}
    </Button>
  </div>
</template>
```

- [ ] **Step 7: Export everything from the package index**

In `packages/ui/src/index.ts`, after the `alert-dialog` export line add:

```ts
export * from './components/ui/switch';
```

(add `export * from './components/ui/dialog';` too if Step 3 generated that folder), and after the `MoneyInput` exports add:

```ts
export { default as PercentInput } from './components/percent-input/PercentInput.vue';
export { percentToFraction, fractionToPercent } from './components/percent-input/percent';

export { default as SegmentedControl } from './components/segmented-control/SegmentedControl.vue';
export type { SegmentedOption } from './components/segmented-control/types';

export { default as DayOfMonthPicker } from './components/day-of-month-picker/DayOfMonthPicker.vue';
export { default as ProgressRule } from './components/progress-rule/ProgressRule.vue';

export { default as RouteLoading } from './components/async-fallback/RouteLoading.vue';
export { default as RouteError } from './components/async-fallback/RouteError.vue';
```

- [ ] **Step 8: Run the tests to see them pass**

Run: `cd packages/ui && bun run test && bun run typecheck && bun run lint`
Expected: PASS — all twelve test files green, no type or lint errors.

- [ ] **Step 9: Design pass**

Run `/frontend-design` on the four hand-written components with this brief: they must read as siblings of `CurrencySwitch` and `MoneyInput` (docs/design/direction.md — warm neutrals, 8px control radius, mono tabular figures for anything numeric, accent marks only "chosen"); the segmented control's chosen segment is a raised surface with a hairline ring, not a filled accent; the day grid is dense (seven columns) but every day keeps a 44px target under `pointer-coarse:`; the progress rule is a rule, not a bar — 2px, ink, no gradient, no colour. Then `/animate`: the only motion is the progress rule's width settling (ease-out, ≤300ms) and the segment colour transition; nothing bounces; both must survive `prefers-reduced-motion` (the width transition is a CSS transition — add `motion-reduce:transition-none`). Then `/impeccable` on all six components. Re-run Step 8; behaviour tests must stay green — they assert roles, values and emits, never classes.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/src packages/ui/test packages/ui/package.json bun.lock
git commit -m "feat(ui): add segmented control, day picker, percent input and route fallbacks"
```

Use the `/git-commit` skill; the message ends with the two trailers from Global Constraints (`Co-Authored-By: …` and `Claude-Session: …`).

---

### Task 19: Web shell — home and accounts routes, four tabs, rates under settings, route fallbacks

**Files:**

- Create: `apps/web/src/shared/layout/route-fallback.ts`
- Create: `apps/web/src/modules/dashboard/{index.ts, ui/DashboardPage.vue}` (placeholder; Task 26 replaces the page and extends the barrel)
- Create: `apps/web/src/modules/plan/{index.ts, ui/PlanPage.vue}` (placeholder; Task 25 replaces the page)
- Modify: `apps/web/src/app/router.ts`, `apps/web/src/app/i18n.ts` (+`ruPlural`), `apps/web/src/app/QuickActions.vue`, `apps/web/src/shared/layout/AppShell.vue`
- Modify: `apps/web/src/modules/accounts/index.ts`, `apps/web/src/modules/transfers/index.ts`, `apps/web/src/modules/rates/index.ts` (async pages through `routeComponent`)
- Modify: `apps/web/src/modules/accounts/ui/AccountDetailPage.vue` (`router.replace('/')` → `'/accounts'`)
- Modify: `apps/web/src/modules/profile/ui/SettingsPage.vue` (Rates row), `apps/web/src/modules/rates/ui/CurrencySwitch.vue` (link to rates)
- Modify: `apps/web/src/locales/ru.json`, `apps/web/src/locales/en.json`
- Modify: `apps/web/e2e/smoke.spec.ts` (the accounts list now lives at `/accounts`)
- Test: `apps/web/test/{i18n-plural.test.ts, route-fallback.test.ts, router.test.ts, shell.test.ts (rewrite), CurrencySwitch.test.ts (extend), SettingsPage.test.ts}`

**Interfaces:**

- Consumes: `RouteLoading`, `RouteError` from `@magermoney/ui` (Task 18).
- Produces:
  - `routeComponent(loader: AsyncComponentLoader): Component` and `isChunkLoadError(error: unknown): boolean`, `pageReloader: { reload(): void }` from `@/shared/layout/route-fallback`. **Every module barrel exports its routed screens as `routeComponent(() => import('./ui/XPage.vue'))`** — Tasks 21–26 must use it instead of a bare `defineAsyncComponent`.
  - Route names and paths: `home` `/`, `accounts` `/accounts`, `account-new` `/accounts/new`, `account` `/accounts/:id`, `account-edit` `/accounts/:id/edit`, `transfers` `/transfers`, `plan` `/plan`, `income-source-new` `/plan/income/new`, `income-source` `/plan/income/:id`, `income-source-edit` `/plan/income/:id/edit`, `expense-new` `/plan/expenses/new`, `expense-edit` `/plan/expenses/:id/edit`, `budget-new` `/plan/budgets/new`, `budget-edit` `/plan/budgets/:id/edit`, `settings` `/settings`, `rates` `/settings/rates`; `/rates` redirects to `/settings/rates`. The `routes` array is exported from `app/router.ts` for tests.
  - `@/modules/dashboard` exporting `DashboardPage` — **a placeholder with a heading only (`data-testid="dashboard"`); Task 26 replaces `ui/DashboardPage.vue` and adds `useDashboard` to the barrel, keeping the export name.**
  - `@/modules/plan` exporting `PlanPage` — **a placeholder with a heading only (`data-testid="plan"`); Task 25 replaces `ui/PlanPage.vue`, keeping the export name and the `?tab=income|expenses|budgets` query.**
  - The router already points at `m.IncomeSourcePage`, `m.IncomeSourceFormPage` (`@/modules/income`, Task 21), `m.ExpenseFormPage` (`@/modules/expenses`, Task 23) and `m.BudgetFormPage` (`@/modules/budgets`, Task 24). Those imports are lazy, so the app builds and every other route works before those modules exist — **but `bun run typecheck` fails on a missing module**, so this task creates one-line stub barrels for the three (`export {};` is not enough for the `.then((m) => m.X)` access): see Step 5.
  - i18n: `nav.home`, `nav.plan` added, `nav.rates` removed; `dashboard.title`, `plan.title`, `settings.rates.{label,hint}`, `a11y.openRates`, `route.{loading,failed,reload}`.
  - The FAB shows on `/` and `/accounts`.
  - `ruPlural(choice: number, choicesLength: number): number` exported from `@/app/i18n` and wired as `pluralRules.ru`, so a RU message written `"{n} день | {n} дня | {n} дней"` (three forms: one · few · many) picks the right one; a two-form message keeps vue-i18n's default. Task 26 relies on it for "N дней". A component test that needs it passes `pluralRules: { ru: ruPlural }` to its own `createI18n`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/i18n-plural.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { ruPlural } from '../src/app/i18n.js';

describe('ruPlural', () => {
  const t = createI18n({
    legacy: false,
    locale: 'ru',
    pluralRules: { ru: ruPlural },
    messages: { ru: { days: '{n} день | {n} дня | {n} дней', items: 'штука | штуки' } },
  }).global.t;

  it('picks one, few or many the way Russian counts', () => {
    const cases: [number, string][] = [
      [0, '0 дней'],
      [1, '1 день'],
      [2, '2 дня'],
      [4, '4 дня'],
      [5, '5 дней'],
      [11, '11 дней'],
      [12, '12 дней'],
      [14, '14 дней'],
      [21, '21 день'],
      [22, '22 дня'],
      [25, '25 дней'],
      [101, '101 день'],
      [111, '111 дней'],
    ];
    for (const [n, text] of cases) expect(t('days', { n }, n)).toBe(text);
  });
  it('leaves a two-form message to the default rule', () => {
    expect(ruPlural(1, 2)).toBe(0);
    expect(ruPlural(5, 2)).toBe(1);
  });
});
```

`apps/web/test/route-fallback.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';
import {
  isChunkLoadError,
  pageReloader,
  routeComponent,
} from '../src/shared/layout/route-fallback.js';

const i18n = () =>
  createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } });

afterEach(() => vi.restoreAllMocks());

describe('routeComponent', () => {
  it('renders the screen once its chunk arrives', async () => {
    const Page = defineComponent({ setup: () => () => h('p', 'the page') });
    const w = mount(
      routeComponent(() => Promise.resolve({ default: Page })),
      {
        global: { plugins: [i18n()] },
      },
    );
    await flushPromises();
    expect(w.text()).toContain('the page');
  });

  it('offers a reload when the chunk is gone, instead of a blank screen', async () => {
    const reload = vi.spyOn(pageReloader, 'reload').mockImplementation(() => undefined);
    // Vue warns about the rejected loader; that warning is the point of the test.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const w = mount(
      routeComponent(() =>
        Promise.reject(new Error('Failed to fetch dynamically imported module')),
      ),
      { global: { plugins: [i18n()] } },
    );
    await flushPromises();
    expect(w.get('[role="alert"]').text()).toContain('Reload');
    await w.get('[data-testid="route-reload"]').trigger('click');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('isChunkLoadError', () => {
  it('recognises a lazy import that failed in each browser', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  });
  it('leaves every other failure alone', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });
});
```

`apps/web/test/router.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { routes } from '../src/app/router.js';

const byName = (name: string) => routes.find((r) => r.name === name);

describe('routes', () => {
  it('puts the dashboard at home and the accounts on their own tab', () => {
    expect(byName('home')?.path).toBe('/');
    expect(byName('accounts')?.path).toBe('/accounts');
  });
  it('keeps the phase 2 screens where links and bookmarks expect them', () => {
    expect(byName('account-new')?.path).toBe('/accounts/new');
    expect(byName('account')?.path).toBe('/accounts/:id');
    expect(byName('account-edit')?.path).toBe('/accounts/:id/edit');
    expect(byName('transfers')?.path).toBe('/transfers');
  });
  it('moves rates under settings and forwards the old address', () => {
    expect(byName('rates')?.path).toBe('/settings/rates');
    expect(routes.find((r) => r.path === '/rates')?.redirect).toBe('/settings/rates');
  });
  it('declares the plan screens', () => {
    expect(byName('plan')?.path).toBe('/plan');
    expect(byName('income-source-new')?.path).toBe('/plan/income/new');
    expect(byName('income-source')?.path).toBe('/plan/income/:id');
    expect(byName('income-source-edit')?.path).toBe('/plan/income/:id/edit');
    expect(byName('expense-new')?.path).toBe('/plan/expenses/new');
    expect(byName('expense-edit')?.path).toBe('/plan/expenses/:id/edit');
    expect(byName('budget-new')?.path).toBe('/plan/budgets/new');
    expect(byName('budget-edit')?.path).toBe('/plan/budgets/:id/edit');
  });
  it('declares static segments before the :id that would swallow them', () => {
    const index = (name: string) => routes.findIndex((r) => r.name === name);
    expect(index('account-new')).toBeLessThan(index('account'));
    expect(index('income-source-new')).toBeLessThan(index('income-source'));
  });
  it('leaves only sign-in and the auth callback public', () => {
    expect(routes.filter((r) => r.meta?.public).map((r) => r.name)).toEqual([
      'sign-in',
      'auth-callback',
    ]);
  });
});
```

Replace `apps/web/test/shell.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppShell from '../src/shared/layout/AppShell.vue';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const page = (text: string) => ({ template: `<p>${text}</p>` });

async function mountShell(at = '/') {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { ru, en },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page('home') },
      { path: '/accounts', component: page('accounts') },
      { path: '/accounts/:id', component: page('account') },
      { path: '/transfers', component: page('transfers') },
      { path: '/plan', component: page('plan') },
      { path: '/plan/income/:id', component: page('source') },
      { path: '/settings', component: page('settings') },
      { path: '/settings/rates', component: page('rates') },
    ],
  });
  await router.push(at);
  await router.isReady();
  const shell = mount(AppShell, {
    props: { theme: 'system' as const },
    global: { plugins: [i18n, router] },
  });
  await flushPromises();
  return shell;
}

/** The labels of the links that claim to be the current page, across both navigations. */
const current = (shell: Awaited<ReturnType<typeof mountShell>>) => [
  ...new Set(shell.findAll('a[aria-current="page"]').map((a) => a.text())),
];

describe('AppShell', () => {
  it('offers four tabs in both navigations, and rates is no longer one of them', async () => {
    const shell = await mountShell();
    const labels = shell.findAll('nav a').map((a) => a.text());
    // Two navs (desktop bar, phone tab bar), four links each.
    expect(labels).toEqual([
      'Home',
      'Accounts',
      'Plan',
      'Settings',
      'Home',
      'Accounts',
      'Plan',
      'Settings',
    ]);
  });

  it('marks home only on home itself', async () => {
    expect(current(await mountShell('/'))).toEqual(['Home']);
    expect(current(await mountShell('/plan'))).toEqual(['Plan']);
  });

  it('keeps a tab lit on the screens that belong to it', async () => {
    expect(current(await mountShell('/accounts/abc'))).toEqual(['Accounts']);
    expect(current(await mountShell('/transfers'))).toEqual(['Accounts']);
    expect(current(await mountShell('/plan/income/abc'))).toEqual(['Plan']);
    expect(current(await mountShell('/settings/rates'))).toEqual(['Settings']);
  });

  it('makes the skip link target focusable, so the skip actually moves focus', async () => {
    expect((await mountShell()).get('main#main').attributes('tabindex')).toBe('-1');
  });

  it('asks for the next theme in the cycle rather than setting it itself', async () => {
    const shell = await mountShell();
    await shell.get('button').trigger('click');
    expect(shell.emitted('update:theme')).toEqual([['light']]);
  });
});
```

Append to `apps/web/test/CurrencySwitch.test.ts` (inside the existing `describe`), and change `mountSwitch()` so the mount options carry `stubs: { RouterLink: RouterLinkStub }` inside `global` (import `RouterLinkStub` from `@vue/test-utils`):

```ts
it('links to the rates screen, which no longer has a tab of its own', async () => {
  const wrapper = mountSwitch();
  await flushPromises();

  const link = wrapper.getComponent(RouterLinkStub);

  expect(link.props('to')).toBe('/settings/rates');
  expect(link.attributes('aria-label')).toBe('Exchange rates');
});
```

`apps/web/test/SettingsPage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import SettingsPage from '../src/modules/profile/ui/SettingsPage.vue';

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('SettingsPage', () => {
  it('is where the rates screen is reached from', async () => {
    const w = mount(SettingsPage, {
      global: {
        plugins: [
          createPinia(),
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
          createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } }),
        ],
        provide: {
          [API_KEY as unknown as string]: {
            fetch: async (path: string) => json(path === '/me' ? profile : []),
          },
        },
        stubs: { RouterLink: RouterLinkStub },
        mocks: { $router: { push: () => undefined } },
      },
    });
    await flushPromises();
    const link = w
      .findAllComponents(RouterLinkStub)
      .find((l) => l.props('to') === '/settings/rates');
    expect(link?.text()).toContain('Exchange rates');
  });
});
```

`SettingsPage` calls `useRouter()` and `useSession()`. If mounting fails on a missing router injection, replace the `mocks` line with a real memory router (`createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }, { path: '/settings/rates', component: { template: '<i/>' } }] })` in `plugins`, drop the `RouterLink` stub, and assert on `w.get('[data-testid="settings-rates"]').attributes('href')` being `/settings/rates`). `test/use-profile.test.ts` shows what `useSession` needs in a test.

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd apps/web && bunx vitest run test/i18n-plural.test.ts test/route-fallback.test.ts test/router.test.ts test/shell.test.ts test/CurrencySwitch.test.ts test/SettingsPage.test.ts`
Expected: FAIL — `ruPlural` is not exported from `i18n.js`; `route-fallback.js` cannot be resolved; `routes` is not exported from `router.js`; the shell still renders `Accounts, Rates, Settings`; `CurrencySwitch` has no link; `SettingsPage` has no rates row.

- [ ] **Step 3: Add the copy (both locales, same keys)**

`apps/web/src/locales/ru.json` — replace the `nav` object and add the new top-level namespaces; inside `settings` add `rates`; inside `a11y` add `openRates`:

```json
"nav": { "home": "Главная", "accounts": "Счета", "plan": "План", "settings": "Настройки" },
"dashboard": { "title": "Главная" },
"plan": { "title": "План" },
"route": {
  "loading": "Загружаем экран",
  "failed": "Экран не загрузился. Скорее всего, вышло обновление.",
  "reload": "Обновить страницу"
}
```

```json
"settings": { "rates": { "label": "Курсы валют", "hint": "Курсы на сегодня и свои курсы на любую дату." } }
"a11y": { "openRates": "Курсы валют" }
```

`apps/web/src/locales/en.json`:

```json
"nav": { "home": "Home", "accounts": "Accounts", "plan": "Plan", "settings": "Settings" },
"dashboard": { "title": "Home" },
"plan": { "title": "Plan" },
"route": {
  "loading": "Loading the screen",
  "failed": "This screen did not load. An update has most likely shipped.",
  "reload": "Reload"
}
```

```json
"settings": { "rates": { "label": "Exchange rates", "hint": "Today's rates, and your own rate for any date." } }
"a11y": { "openRates": "Exchange rates" }
```

(The `settings` and `a11y` snippets are merged into the existing objects, not pasted over them.) `nav.rates` is deleted from both files; `grep -rn "nav.rates" apps/web/src` must come back empty after Step 6. Run `/humanize-text:humanize-text` over the new RU and EN strings.

- [ ] **Step 4: Write the plural rule and the route fallback helper**

Replace `apps/web/src/app/i18n.ts`:

```ts
import { createI18n } from 'vue-i18n';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';

/**
 * Russian counts in three forms — 1 день, 2 дня, 5 дней — and the teens are all
 * "many" (11 дней, not 11 день). A message with three forms is written
 * `one | few | many`; anything else keeps vue-i18n's two-form default.
 */
export function ruPlural(choice: number, choicesLength: number): number {
  const n = Math.abs(choice);
  if (choicesLength !== 3) return n === 1 ? 0 : 1;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  if (!teen && n % 10 === 1) return 0;
  if (!teen && n % 10 >= 2 && n % 10 <= 4) return 1;
  return 2;
}

/** Russian is the interface language; English is the fallback for missing keys. */
export const i18n = createI18n({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'en',
  pluralRules: { ru: ruPlural },
  messages: { ru, en },
});
```

`apps/web/src/shared/layout/route-fallback.ts`:

```ts
import {
  defineAsyncComponent,
  defineComponent,
  h,
  type AsyncComponentLoader,
  type Component,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { RouteError, RouteLoading } from '@magermoney/ui';

/**
 * A routed screen is a chunk of its own, and after a deploy the chunk a running
 * tab asks for no longer exists. Without a fallback the content area just stays
 * blank. Every module barrel wraps its pages in `routeComponent`, so a missing
 * chunk becomes a sentence and a Reload button, and a slow one becomes a
 * skeleton instead of nothing.
 */

/** Behind an object so a test can replace it: `location.reload` cannot be spied on in every DOM. */
export const pageReloader = {
  reload(): void {
    window.location.reload();
  },
};

const LoadingView = defineComponent({
  name: 'RouteLoadingView',
  setup() {
    const { t } = useI18n();
    return () => h(RouteLoading, { label: t('route.loading') });
  },
});

const ErrorView = defineComponent({
  name: 'RouteErrorView',
  setup() {
    const { t } = useI18n();
    return () =>
      h(RouteError, {
        title: t('route.failed'),
        actionLabel: t('route.reload'),
        onRetry: () => pageReloader.reload(),
      });
  },
});

/** 200ms before the skeleton: a chunk already in the HTTP cache must not flash one. */
const LOADING_DELAY_MS = 200;

export function routeComponent(loader: AsyncComponentLoader): Component {
  return defineAsyncComponent({
    loader,
    loadingComponent: LoadingView,
    errorComponent: ErrorView,
    delay: LOADING_DELAY_MS,
  });
}

const CHUNK_ERRORS = [
  'Failed to fetch dynamically imported module', // Chromium
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
];

/**
 * A module barrel is itself loaded lazily by the router, and that import fails
 * before any `routeComponent` exists to catch it. The router's `onError` uses
 * this to tell "the file is gone" from a real bug.
 */
export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERRORS.some((m) => error.message.includes(m));
}
```

- [ ] **Step 5: Placeholder modules, stub barrels, the router**

`apps/web/src/modules/dashboard/ui/DashboardPage.vue`:

```vue
<script setup lang="ts">
/** Placeholder: the dashboard arrives in Task 26. Home has to render something until then. */
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section class="pb-8" data-testid="dashboard">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">{{ t('dashboard.title') }}</h1>
  </section>
</template>
```

`apps/web/src/modules/dashboard/index.ts`:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the dashboard module: a read model over the other modules, with no data of its own. */
export const DashboardPage = routeComponent(() => import('./ui/DashboardPage.vue'));
```

`apps/web/src/modules/plan/ui/PlanPage.vue`:

```vue
<script setup lang="ts">
/** Placeholder: the Plan screen (Income / Expenses / Budgets) arrives in Task 25. */
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section class="pb-8" data-testid="plan">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">{{ t('plan.title') }}</h1>
  </section>
</template>
```

`apps/web/src/modules/plan/index.ts`:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the plan module: one screen that hosts the income, expenses and budgets segments. */
export const PlanPage = routeComponent(() => import('./ui/PlanPage.vue'));
```

Stub barrels so the router type-checks before Tasks 21, 23 and 24 land. Every stub points at one shared stand-in screen; the owning task replaces its barrel, and Task 24 (the last importer) deletes `PendingPage.vue`.

`apps/web/src/shared/layout/PendingPage.vue`:

```vue
<script setup lang="ts">
/** Stands in for a routed screen whose module has not landed yet. Each owning task (21, 23, 24) swaps its barrel to the real screens; Task 24, the last of them, deletes this file. */
</script>

<template>
  <section class="pb-8" data-testid="pending-page" />
</template>
```

`apps/web/src/modules/income/index.ts`:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Stub: Tasks 20–22 build this module. The router needs the names to exist. */
export const IncomeSourcePage = routeComponent(() => import('@/shared/layout/PendingPage.vue'));
export const IncomeSourceFormPage = routeComponent(() => import('@/shared/layout/PendingPage.vue'));
```

`apps/web/src/modules/expenses/index.ts`:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Stub: Task 23 builds this module. */
export const ExpenseFormPage = routeComponent(() => import('@/shared/layout/PendingPage.vue'));
```

`apps/web/src/modules/budgets/index.ts`:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Stub: Task 24 builds this module. */
export const BudgetFormPage = routeComponent(() => import('@/shared/layout/PendingPage.vue'));
```

Replace `apps/web/src/app/router.ts`:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isChunkLoadError } from '@/shared/layout/route-fallback';

/**
 * Pages are reached through each module's public API, so a route never points
 * inside a module. Everything is private unless `meta.public` says otherwise —
 * the guard defaults to closed, so a new screen cannot leak by omission.
 *
 * A static segment (`/accounts/new`) is declared before the `:id` that would
 * otherwise match it.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/modules/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: '/accounts',
    name: 'accounts',
    component: () => import('@/modules/accounts').then((m) => m.AccountsPage),
  },
  {
    path: '/accounts/new',
    name: 'account-new',
    component: () => import('@/modules/accounts').then((m) => m.AccountFormPage),
  },
  {
    path: '/accounts/:id',
    name: 'account',
    component: () => import('@/modules/accounts').then((m) => m.AccountDetailPage),
  },
  {
    path: '/accounts/:id/edit',
    name: 'account-edit',
    component: () => import('@/modules/accounts').then((m) => m.AccountFormPage),
  },
  {
    path: '/transfers',
    name: 'transfers',
    component: () => import('@/modules/transfers').then((m) => m.TransfersPage),
  },
  {
    path: '/plan',
    name: 'plan',
    component: () => import('@/modules/plan').then((m) => m.PlanPage),
  },
  {
    path: '/plan/income/new',
    name: 'income-source-new',
    component: () => import('@/modules/income').then((m) => m.IncomeSourceFormPage),
  },
  {
    path: '/plan/income/:id',
    name: 'income-source',
    component: () => import('@/modules/income').then((m) => m.IncomeSourcePage),
  },
  {
    path: '/plan/income/:id/edit',
    name: 'income-source-edit',
    component: () => import('@/modules/income').then((m) => m.IncomeSourceFormPage),
  },
  {
    path: '/plan/expenses/new',
    name: 'expense-new',
    component: () => import('@/modules/expenses').then((m) => m.ExpenseFormPage),
  },
  {
    path: '/plan/expenses/:id/edit',
    name: 'expense-edit',
    component: () => import('@/modules/expenses').then((m) => m.ExpenseFormPage),
  },
  {
    path: '/plan/budgets/new',
    name: 'budget-new',
    component: () => import('@/modules/budgets').then((m) => m.BudgetFormPage),
  },
  {
    path: '/plan/budgets/:id/edit',
    name: 'budget-edit',
    component: () => import('@/modules/budgets').then((m) => m.BudgetFormPage),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/modules/profile').then((m) => m.SettingsPage),
  },
  {
    path: '/settings/rates',
    name: 'rates',
    component: () => import('@/modules/rates').then((m) => m.RatesPage),
  },
  // Rates had a tab of its own in phase 2; bookmarks and the installed PWA's history still point here.
  { path: '/rates', redirect: '/settings/rates' },
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('@/modules/auth').then((m) => m.SignInPage),
    meta: { public: true },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/modules/auth').then((m) => m.AuthCallbackPage),
    meta: { public: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

/**
 * A module barrel that fails to load takes the navigation down with it, before
 * any screen exists to show a fallback. After a deploy that means the file is
 * gone, and the only cure is the new `index.html`: go to the target with a full
 * page load instead of leaving the person on a dead link.
 */
router.onError((error, to) => {
  if (isChunkLoadError(error)) window.location.assign(to.fullPath);
});
```

- [ ] **Step 6: Barrels, shell, quick actions, account delete, settings, currency switch**

In `apps/web/src/modules/accounts/index.ts` replace the `defineAsyncComponent` import with `import { routeComponent } from '@/shared/layout/route-fallback';` and the three page exports with:

```ts
export const AccountsPage = routeComponent(() => import('./ui/AccountsPage.vue'));
export const AccountDetailPage = routeComponent(() => import('./ui/AccountDetailPage.vue'));
export const AccountFormPage = routeComponent(() => import('./ui/AccountFormPage.vue'));
```

Same change in `apps/web/src/modules/transfers/index.ts` (`TransfersPage`) and `apps/web/src/modules/rates/index.ts` (`RatesPage`). `AccountDetailPage.vue` keeps its own `defineAsyncComponent` for `TransferSheet` — that one is a sheet, not a route.

In `apps/web/src/modules/accounts/ui/AccountDetailPage.vue` change `await router.replace('/');` to `await router.replace('/accounts');` — after deleting an account the person goes back to the list, which is no longer home.

In `apps/web/src/shared/layout/AppShell.vue` replace the `NAV` constant and add the route-aware predicate (add `import { useRoute } from 'vue-router';`):

```ts
const route = useRoute();

/**
 * `owns` is the set of path prefixes a tab stays lit for. vue-router's own
 * `isActive` only follows nested records, and these routes are flat, so an
 * account's page would otherwise light nothing. Home owns nothing but itself —
 * every path starts with "/".
 */
const NAV = [
  { to: '/', label: 'nav.home', owns: [] },
  { to: '/accounts', label: 'nav.accounts', owns: ['/accounts', '/transfers'] },
  { to: '/plan', label: 'nav.plan', owns: ['/plan'] },
  { to: '/settings', label: 'nav.settings', owns: ['/settings'] },
] as const;

const isCurrent = (item: (typeof NAV)[number]): boolean =>
  item.owns.length === 0
    ? route.path === '/'
    : item.owns.some((p) => route.path === p || route.path.startsWith(`${p}/`));
```

and in **both** navigations change the slot to `v-slot="{ href, navigate }"` and every use of `isActive` to `isCurrent(item)`:

```vue
<a
  :href="href"
  :aria-current="isCurrent(item) ? 'page' : undefined"
  …
  :class="isCurrent(item) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
  @click="navigate"
>
```

(the phone tab bar's class keeps its own variant without the hover colour). Update the component's doc comment: the named slot note "(Task 16)" stays, add "Four tabs: Home · Accounts · Plan · Settings; Goals joins in phase 4."

In `apps/web/src/app/QuickActions.vue` replace `onHome` with:

```ts
/** The "+" belongs to the two screens about money on hand: the dashboard and the accounts list. */
const FAB_PATHS = ['/', '/accounts'];
const showFab = computed(() => FAB_PATHS.includes(route.path));
```

and the root `v-if` with `v-if="showFab && accounts.length > 0"`; update the doc comment's first line to `The "+" on Home and Accounts: …`.

In `apps/web/src/modules/profile/ui/SettingsPage.vue`, between the currencies block and the sign-out block, add:

```vue
<div class="border-t border-border pt-6 md:pt-5">
          <RouterLink
            to="/settings/rates"
            data-testid="settings-rates"
            class="flex min-h-11 items-center justify-between gap-4 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span>
              <span class="block text-sm font-medium">{{ t('settings.rates.label') }}</span>
              <span class="mt-1 block text-sm leading-relaxed text-muted-foreground">{{
                t('settings.rates.hint')
              }}</span>
            </span>
            <span class="text-muted-foreground" aria-hidden="true">→</span>
          </RouterLink>
        </div>
```

In `apps/web/src/modules/rates/ui/CurrencySwitch.vue`, inside the root `div` after the `v-for` button, add:

```vue
<RouterLink
  to="/settings/rates"
  :aria-label="t('a11y.openRates')"
  :title="t('a11y.openRates')"
  data-testid="currency-switch-rates"
  class="flex min-h-9 items-center rounded-lg px-2 text-muted-foreground outline-offset-2 transition-colors duration-fast hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4"
        aria-hidden="true"
      >
        <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
      </svg>
    </RouterLink>
```

and extend the component's doc comment: "The arrows at the end open the rates screen — it lost its tab in phase 3, and this is where a person wonders what rate they are looking at."

In `apps/web/e2e/smoke.spec.ts` change both `await page.goto('/');` calls that are followed by an assertion on `capital-total` to `await page.goto('/accounts');` (home is a placeholder until Task 26; Task 27 revisits the scenario).

- [ ] **Step 7: Run the tests to see them pass**

Run: `cd apps/web && bun run test && bun run typecheck && bun run lint`
Expected: PASS. `grep -rn "nav.rates\|path === '/'" apps/web/src` → no output (the `route.path === '/'` inside `isCurrent` is the only `'/'` comparison left, in `AppShell.vue`; adjust the grep if it trips on it). `locales.test.ts` confirms RU/EN parity.

- [ ] **Step 8: Build once and look at the chunks**

Run: `cd apps/web && bun run build`
Expected: the build succeeds and the entry chunk did not swallow the pages — `ls -la dist/assets | grep -i "Page"` lists separate `AccountsPage-*.js`, `DashboardPage-*.js`, `PlanPage-*.js`, `RatesPage-*.js` files.

- [ ] **Step 9: Design pass**

`/frontend-design` brief: four tabs on a 375px phone must each keep a ≥44px target with 13px labels (they do at `flex-1`); the rates arrows in the header must not push the theme button off a 320px screen when four reporting currencies are chosen — if they do, hide the currency _codes'_ text below `sm:` rather than the link; the Settings "Rates" row is a ledger row like its neighbours, not a card. `/animate`: nothing new moves in this task except the existing currency indicator; confirm the route skeleton does not flash on a warm cache (the 200ms delay). `/impeccable` on `AppShell.vue`, `SettingsPage.vue`, `CurrencySwitch.vue` and the two fallbacks in context. Re-run Step 7.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src apps/web/test apps/web/e2e/smoke.spec.ts docs/discovery/phase-3-execution-ledger.md
git commit -m "feat(web): make the dashboard home, add the plan tab and route fallbacks"
```

Use `/git-commit`; end the message with the two trailers from Global Constraints. Append to `docs/discovery/phase-3-execution-ledger.md` (create the file with a `# Phase 3 execution ledger` heading if this is the first ruling) and include it in the same commit: "A module barrel that fails to load triggers a full-page navigation to the target (`router.onError` + `isChunkLoadError`), in addition to the per-screen Reload fallback the spec names." and "A tab stays lit by path prefix (`/transfers` lights Accounts, `/settings/rates` lights Settings)."

---

### Task 20: Web `income` — data layer (API clients, mappers, queries, source and inflow mutations)

**Files:**

- Create: `apps/web/src/modules/income/domain/mappers.ts`
- Create: `apps/web/src/modules/income/infrastructure/{income-sources-api.ts, inflows-api.ts}`
- Create: `apps/web/src/modules/income/application/{use-income-sources.ts, use-income-source-mutations.ts, use-inflows.ts, invalidate.ts, use-inflow-mutations.ts}`
- Modify: `apps/web/src/modules/income/index.ts` (replaces the Task 19 stub; the two page exports stay stubs until Task 21)
- Modify: `apps/web/src/shared/api/error-messages.ts`, `apps/web/src/locales/{ru,en}.json`
- Test: `apps/web/test/{fixtures/income.ts, income-api.test.ts, income-mappers.test.ts, use-income-sources.test.ts, error-messages.test.ts}`

**Interfaces:**

- Consumes: from `@magermoney/contracts` (Task 6) `IncomeSourceDtoSchema`, `IncomeSourceDto`, `IncomeSourceInput`, `UpdateIncomeSourceInput`, `InflowDtoSchema`, `InflowDto`, `CreateInflowInput`, `UpdateInflowInput`; from `@magermoney/domain` (Tasks 2–3) `IncomeSource`, `Inflow`, `Money`, `Decimal`, `CurrencyRegistry`; `useCurrencyRegistry` from `@/modules/currencies`; `ACCOUNTS_KEY`, `balancesKey` from `@/modules/accounts/offline`; `routeComponent` (Task 19).
  - `invalidateAfterInflow(qc: QueryClient, accountIds: readonly string[]): Promise<unknown>` lives in `application/invalidate.ts` (produced here, reused by Task 22).
- Produces (module-internal names; Task 22 adds `offline.ts` and re-exports the keys through it):
  - `toIncomeSource(dto: IncomeSourceDto, registry: CurrencyRegistry): IncomeSource`
  - `toInflow(dto: InflowDto, registry: CurrencyRegistry, accountCurrency?: string): Inflow` — **addition to the shared interface**: the DTO does not say which currency `creditedAmount` is in (it is the Account's), so the caller passes it; without it `creditedAmount` is `null` in the domain object. The read models never read it.
  - `incomeSourcesApi(client)`: `list()`, `create(input)`, `update(id, input)`, `remove(id)`; `inflowsApi(client)`: `list(params)`, `create(input)`, `update(id, input)`, `remove(id)`.
  - `INCOME_SOURCES_KEY = ['income-sources']`, `INFLOWS_KEY = ['inflows']`, `type InflowParams = { from?: string; to?: string; sourceId?: string }`, `inflowsKey(params: InflowParams)`, `matchesInflowParams(row: { receivedOn: string; incomeSourceId: string }, params: InflowParams): boolean`.
  - `useIncomeSources(): { sources: ComputedRef<IncomeSource[]>; dtos: ComputedRef<IncomeSourceDto[]>; isLoading: ComputedRef<boolean>; isError: ComputedRef<boolean> }`, `useIncomeSource(id): ComputedRef<IncomeSourceDto | undefined>`.
  - `useCreateIncomeSource(): { create(input: IncomeSourceInput): Promise<IncomeSourceDto>; isPending }`, `useUpdateIncomeSource(): { update(id, input: UpdateIncomeSourceInput): Promise<IncomeSourceDto>; isPending }`, `useDeleteIncomeSource(): { remove(id): Promise<void>; isPending }`.
  - `useInflows(params: MaybeRefOrGetter<InflowParams>): { inflows: ComputedRef<Inflow[]>; dtos: ComputedRef<InflowDto[]>; isLoading: ComputedRef<boolean> }`.
  - `useUpdateInflow(): { update(id, input: UpdateInflowInput, accountIds: string[]): Promise<InflowDto>; isPending }`, `useDeleteInflow(): { remove(id, accountIds: string[]): Promise<void>; isPending }` — `accountIds` are the Accounts whose balance the change touches (the old and the new one), so their caches are refetched. `useCreateInflow` is Task 22.
  - Error messages for `credit_not_latest`, `inflow_not_latest`, `credited_amount_required`, `credited_mismatch`, `received_in_future`, `source_has_inflows`, `default_account_not_found`, `non_positive_amount`, `credited_without_account`, `active_period_invalid`, `pay_days_invalid`, `rate_out_of_range`, `account_has_inflows` under `errors.*` (an `InflowError` reaches the web as its `reason`, so there is no `INFLOW_INVALID` code to map). Tasks 23–24 add their own codes (`category_has_expenses`, `category_name_taken`, `billing_month_requires_yearly`) to the same table.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/fixtures/income.ts` (shared by this task's tests and by Tasks 21–22; not a test file, so vitest's `test/**/*.test.ts` glob skips it):

```ts
export const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
export const INFLOW_ID = '22222222-2222-4222-8222-222222222222';
export const sourceDto = {
  id: SOURCE_ID,
  name: 'Salary',
  grossAmount: '1000',
  currency: 'USD',
  taxRate: '0.15',
  commissionRate: '0.1',
  payDays: [10, 25],
  isPrimary: true,
  activeFrom: '2026-01-01',
  activeTo: null,
  defaultAccountId: null,
  netMonthly: '765.00',
};
export const inflowDto = {
  id: INFLOW_ID,
  incomeSourceId: SOURCE_ID,
  amount: '500',
  currency: 'USD',
  receivedOn: '2026-09-10',
  realisedRateToUsd: null,
  accountId: null,
  creditedAmount: null,
  realisedRate: null,
  note: null,
};
```

`apps/web/test/income-api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { incomeSourcesApi } from '../src/modules/income/infrastructure/income-sources-api.js';
import { inflowsApi } from '../src/modules/income/infrastructure/inflows-api.js';
import { INFLOW_ID, SOURCE_ID, inflowDto, sourceDto } from './fixtures/income.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('incomeSourcesApi', () => {
  it('lists, creates, updates and deletes through the documented routes', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = incomeSourcesApi({
      fetch: async (path, init) => {
        calls.push([path, init]);
        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        return init?.method === 'GET' ? json([sourceDto]) : json(sourceDto);
      },
    });
    expect(await api.list()).toEqual([sourceDto]);
    await api.create({
      name: 'Salary',
      grossAmount: '1000',
      currency: 'USD',
      taxRate: '0.15',
      commissionRate: '0.1',
      payDays: [10, 25],
      isPrimary: true,
      activeFrom: '2026-01-01',
    });
    await api.update(SOURCE_ID, { activeTo: '2026-12-31' });
    await api.remove(SOURCE_ID);
    expect(calls.map(([p, i]) => `${i?.method} ${p}`)).toEqual([
      'GET /income-sources',
      'POST /income-sources',
      `PATCH /income-sources/${SOURCE_ID}`,
      `DELETE /income-sources/${SOURCE_ID}`,
    ]);
    expect(JSON.parse(calls[2]?.[1]?.body as string)).toEqual({ activeTo: '2026-12-31' });
  });
  it('refuses a body that is not the contract', async () => {
    const api = incomeSourcesApi({ fetch: async () => json([{ id: 'nope' }]) });
    await expect(api.list()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });
});

describe('inflowsApi', () => {
  it('sends only the filters that were given, and asks for the biggest page', async () => {
    const paths: string[] = [];
    const api = inflowsApi({
      fetch: async (path) => {
        paths.push(path);
        return json([inflowDto]);
      },
    });
    expect(await api.list({})).toEqual([inflowDto]);
    await api.list({ from: '2026-09-01', to: '2026-09-30', sourceId: SOURCE_ID });
    expect(paths).toEqual([
      '/inflows?limit=200',
      `/inflows?limit=200&from=2026-09-01&to=2026-09-30&sourceId=${SOURCE_ID}`,
    ]);
  });
  it('creates, updates and deletes', async () => {
    const calls: string[] = [];
    const api = inflowsApi({
      fetch: async (path, init) => {
        calls.push(`${init?.method} ${path}`);
        return init?.method === 'DELETE'
          ? new Response(null, { status: 204 })
          : json(inflowDto, 201);
      },
    });
    await api.create({ incomeSourceId: SOURCE_ID, amount: '500' });
    await api.update(INFLOW_ID, { accountId: null });
    await api.remove(INFLOW_ID);
    expect(calls).toEqual([
      'POST /inflows',
      `PATCH /inflows/${INFLOW_ID}`,
      `DELETE /inflows/${INFLOW_ID}`,
    ]);
  });
});
```

`apps/web/test/income-mappers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CurrencyRegistry } from '@magermoney/domain';
import { toIncomeSource, toInflow } from '../src/modules/income/domain/mappers.js';
import { inflowDto, sourceDto } from './fixtures/income.js';

const registry = new CurrencyRegistry([
  { code: 'USD', kind: 'fiat', scale: 2 },
  { code: 'EUR', kind: 'fiat', scale: 2 },
]);

describe('toIncomeSource', () => {
  it('turns strings into Money and Decimal once, at the boundary', () => {
    const s = toIncomeSource(sourceDto, registry);
    expect(s.grossAmount.toString()).toBe('1000');
    expect(s.grossAmount.currency.code).toBe('USD');
    expect(s.taxRate.toFixed()).toBe('0.15');
    expect(s.commissionRate.toFixed()).toBe('0.1');
    expect(s.payDays).toEqual([10, 25]);
    expect(s.activeTo).toBeNull();
  });
  it('still renders a source whose currency the registry does not know', () => {
    const s = toIncomeSource({ ...sourceDto, currency: 'XXX' }, registry);
    expect(s.grossAmount.currency).toEqual({ code: 'XXX', kind: 'fiat', scale: 2 });
  });
});

describe('toInflow', () => {
  it('maps an uncredited inflow', () => {
    const i = toInflow(inflowDto, registry);
    expect(i.amount.toString()).toBe('500');
    expect(i.creditedAmount).toBeNull();
    expect(i.realisedRateToUsd).toBeNull();
  });
  it('puts the credited amount in the account currency the caller names', () => {
    const dto = {
      ...inflowDto,
      accountId: '33333333-3333-4333-8333-333333333333',
      creditedAmount: '430',
      realisedRateToUsd: '1',
    };
    expect(toInflow(dto, registry, 'EUR').creditedAmount?.currency.code).toBe('EUR');
    expect(toInflow(dto, registry).creditedAmount).toBeNull();
    expect(toInflow(dto, registry).realisedRateToUsd?.toFixed()).toBe('1');
  });
});
```

`apps/web/test/use-income-sources.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { API_KEY } from '../src/shared/api/use-api.js';
import { useIncomeSources } from '../src/modules/income/application/use-income-sources.js';
import {
  useCreateIncomeSource,
  useDeleteIncomeSource,
} from '../src/modules/income/application/use-income-source-mutations.js';
import { matchesInflowParams, useInflows } from '../src/modules/income/application/use-inflows.js';
import { inflowDto, sourceDto } from './fixtures/income.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const cur = (code: string) => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: null,
  icon: null,
});

function mountIt(fetchImpl: (path: string, init?: RequestInit) => Promise<Response>) {
  let sources!: ReturnType<typeof useIncomeSources>;
  let create!: ReturnType<typeof useCreateIncomeSource>;
  let remove!: ReturnType<typeof useDeleteIncomeSource>;
  let inflows!: ReturnType<typeof useInflows>;
  const Probe = defineComponent({
    setup() {
      sources = useIncomeSources();
      create = useCreateIncomeSource();
      remove = useDeleteIncomeSource();
      inflows = useInflows(() => ({ from: '2026-09-01', to: '2026-09-30' }));
      return () => h('div');
    },
  });
  mount(Probe, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
      ],
      provide: { [API_KEY as unknown as string]: { fetch: fetchImpl } },
    },
  });
  return {
    sources: () => sources,
    create: () => create,
    remove: () => remove,
    inflows: () => inflows,
  };
}

describe('income queries', () => {
  it('serves sources as DTOs and as domain objects, and inflows for the asked window', async () => {
    const fetch = vi.fn(async (path: string) => {
      if (path === '/currencies') return json([cur('USD')]);
      if (path.startsWith('/inflows')) return json([inflowDto]);
      return json([sourceDto]);
    });
    const p = mountIt(fetch);
    await flushPromises();
    expect(p.sources().dtos.value).toEqual([sourceDto]);
    expect(p.sources().sources.value[0]?.grossAmount.currency.code).toBe('USD');
    expect(p.inflows().inflows.value[0]?.amount.toString()).toBe('500');
    expect(
      fetch.mock.calls.some(
        ([path]) => path === '/inflows?limit=200&from=2026-09-01&to=2026-09-30',
      ),
    ).toBe(true);
  });

  it('shows a created source at once and drops a deleted one', async () => {
    let stored = [sourceDto];
    const second = {
      ...sourceDto,
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Other',
      isPrimary: false,
    };
    const p = mountIt(async (path, init) => {
      if (path === '/currencies') return json([cur('USD')]);
      if (path.startsWith('/inflows')) return json([]);
      if (init?.method === 'POST') {
        stored = [...stored, second];
        return json(second, 201);
      }
      if (init?.method === 'DELETE') {
        stored = stored.filter((s) => s.id !== second.id);
        return new Response(null, { status: 204 });
      }
      return json(stored);
    });
    await flushPromises();
    await p.create().create({
      name: 'Other',
      grossAmount: '0',
      currency: 'USD',
      taxRate: '0',
      commissionRate: '0',
      payDays: [],
      isPrimary: false,
      activeFrom: '2026-09-17',
    });
    await flushPromises();
    expect(p.sources().dtos.value.map((s) => s.name)).toEqual(['Salary', 'Other']);
    await p.remove().remove(second.id);
    await flushPromises();
    expect(p.sources().dtos.value.map((s) => s.name)).toEqual(['Salary']);
  });
});

describe('matchesInflowParams', () => {
  const row = { receivedOn: '2026-09-10', incomeSourceId: 'a' };
  it('is inclusive at both ends and respects the source filter', () => {
    expect(matchesInflowParams(row, {})).toBe(true);
    expect(matchesInflowParams(row, { from: '2026-09-10', to: '2026-09-10' })).toBe(true);
    expect(matchesInflowParams(row, { from: '2026-09-11' })).toBe(false);
    expect(matchesInflowParams(row, { to: '2026-09-09' })).toBe(false);
    expect(matchesInflowParams(row, { sourceId: 'b' })).toBe(false);
  });
});
```

`apps/web/test/error-messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/shared/api/client.js';
import { errorKeyFor } from '../src/shared/api/error-messages.js';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const CODES = [
  'credit_not_latest',
  'inflow_not_latest',
  'credited_amount_required',
  'credited_mismatch',
  'received_in_future',
  'source_has_inflows',
  'default_account_not_found',
  'non_positive_amount',
  'credited_without_account',
  'active_period_invalid',
  'pay_days_invalid',
  'rate_out_of_range',
  'account_has_inflows',
];

describe('errorKeyFor — income codes', () => {
  it('has words of its own for every code the income screens can provoke, in both locales', () => {
    for (const code of CODES) {
      const key = errorKeyFor(new ApiError(400, code, 'x'), 'fallback');
      expect(key, code).not.toBe('fallback');
      const leaf = key.split('.')[1] as string;
      expect((ru.errors as Record<string, string>)[leaf], `ru ${key}`).toBeTruthy();
      expect((en.errors as Record<string, string>)[leaf], `en ${key}`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd apps/web && bunx vitest run test/income-api.test.ts test/income-mappers.test.ts test/use-income-sources.test.ts test/error-messages.test.ts`
Expected: FAIL — the `income/infrastructure`, `income/domain` and `income/application` files cannot be resolved; `errorKeyFor` returns `fallback` for `credit_not_latest`.

- [ ] **Step 3: Write the API clients**

`apps/web/src/modules/income/infrastructure/income-sources-api.ts`:

```ts
import {
  IncomeSourceDtoSchema,
  type IncomeSourceDto,
  type IncomeSourceInput,
  type UpdateIncomeSourceInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const sourceList = listOf(IncomeSourceDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const incomeSourcesApi = (client: ApiClient) => ({
  list: async (): Promise<IncomeSourceDto[]> =>
    parse(await client.fetch('/income-sources', { method: 'GET' }), sourceList),
  create: async (input: IncomeSourceInput): Promise<IncomeSourceDto> =>
    parse(
      await client.fetch('/income-sources', { method: 'POST', body: JSON.stringify(input) }),
      IncomeSourceDtoSchema,
    ),
  update: async (id: string, input: UpdateIncomeSourceInput): Promise<IncomeSourceDto> =>
    parse(
      await client.fetch(`/income-sources/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      IncomeSourceDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/income-sources/${id}`, { method: 'DELETE' }), noContent),
});
```

`IncomeSourceInput` is the zod _output_ type, where the defaulted fields are required. If Task 6 also exports the input type (`z.input<…>`), use that for `create`; the test passes every field either way.

`apps/web/src/modules/income/infrastructure/inflows-api.ts`:

```ts
import {
  InflowDtoSchema,
  type CreateInflowInput,
  type InflowDto,
  type UpdateInflowInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const inflowList = listOf(InflowDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };
/** The API's largest page. A month of inflows is a handful of rows; a source's whole history pages by cursor if it ever outgrows this. */
export const INFLOWS_PAGE = 200;

export interface InflowListParams {
  from?: string | undefined;
  to?: string | undefined;
  sourceId?: string | undefined;
}

export const inflowsApi = (client: ApiClient) => ({
  list: async (params: InflowListParams): Promise<InflowDto[]> => {
    const q = new URLSearchParams({ limit: String(INFLOWS_PAGE) });
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.sourceId) q.set('sourceId', params.sourceId);
    return parse(await client.fetch(`/inflows?${q}`, { method: 'GET' }), inflowList);
  },
  create: async (input: CreateInflowInput): Promise<InflowDto> =>
    parse(
      await client.fetch('/inflows', { method: 'POST', body: JSON.stringify(input) }),
      InflowDtoSchema,
    ),
  update: async (id: string, input: UpdateInflowInput): Promise<InflowDto> =>
    parse(
      await client.fetch(`/inflows/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      InflowDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/inflows/${id}`, { method: 'DELETE' }), noContent),
});
```

- [ ] **Step 4: Write the mappers**

`apps/web/src/modules/income/domain/mappers.ts`:

```ts
import type { IncomeSourceDto, InflowDto } from '@magermoney/contracts';
import {
  Decimal,
  Money,
  type Currency,
  type CurrencyRegistry,
  type IncomeSource,
  type Inflow,
} from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });
const currencyOf = (code: string, registry: CurrencyRegistry): Currency =>
  registry.get(code).unwrapOr(fallback(code));

/** DTO → domain. An unknown currency still gets a Money (scale 2) so the list renders; conversion then reports it as unconvertible. */
export function toIncomeSource(dto: IncomeSourceDto, registry: CurrencyRegistry): IncomeSource {
  return {
    id: dto.id,
    name: dto.name,
    grossAmount: Money.of(dto.grossAmount, currencyOf(dto.currency, registry)),
    taxRate: new Decimal(dto.taxRate),
    commissionRate: new Decimal(dto.commissionRate),
    payDays: [...dto.payDays],
    isPrimary: dto.isPrimary,
    activeFrom: dto.activeFrom,
    activeTo: dto.activeTo,
    defaultAccountId: dto.defaultAccountId,
  };
}

/**
 * The DTO carries `creditedAmount` without a currency: it is the Account's. A
 * caller that knows the Account passes its code; one that does not (the
 * dashboard's read models never look at the credit) gets `null` rather than an
 * amount in a guessed currency.
 */
export function toInflow(
  dto: InflowDto,
  registry: CurrencyRegistry,
  accountCurrency?: string,
): Inflow {
  return {
    id: dto.id,
    incomeSourceId: dto.incomeSourceId,
    amount: Money.of(dto.amount, currencyOf(dto.currency, registry)),
    receivedOn: dto.receivedOn,
    realisedRateToUsd: dto.realisedRateToUsd === null ? null : new Decimal(dto.realisedRateToUsd),
    accountId: dto.accountId,
    creditedAmount:
      dto.creditedAmount !== null && accountCurrency
        ? Money.of(dto.creditedAmount, currencyOf(accountCurrency, registry))
        : null,
    note: dto.note,
  };
}
```

- [ ] **Step 5: Write the queries and mutations**

`apps/web/src/modules/income/application/use-income-sources.ts`:

```ts
import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { IncomeSourceDto } from '@magermoney/contracts';
import type { IncomeSource } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toIncomeSource } from '../domain/mappers';
import { incomeSourcesApi } from '../infrastructure/income-sources-api';

export const INCOME_SOURCES_KEY = ['income-sources'] as const;

/** Every source, ended ones included: one query, and the screens decide what "current" means with the domain's `isActiveOn`. */
export function useIncomeSources(): {
  sources: ComputedRef<IncomeSource[]>;
  dtos: ComputedRef<IncomeSourceDto[]>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
} {
  const api = incomeSourcesApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: INCOME_SOURCES_KEY, queryFn: api.list });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    sources: computed(() => dtos.value.map((d) => toIncomeSource(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
  };
}

export function useIncomeSource(
  id: MaybeRefOrGetter<string>,
): ComputedRef<IncomeSourceDto | undefined> {
  const { dtos } = useIncomeSources();
  return computed(() => dtos.value.find((s) => s.id === toValue(id)));
}
```

`apps/web/src/modules/income/application/use-income-source-mutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type {
  IncomeSourceDto,
  IncomeSourceInput,
  UpdateIncomeSourceInput,
} from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { incomeSourcesApi } from '../infrastructure/income-sources-api';
import { INCOME_SOURCES_KEY } from './use-income-sources';

/**
 * Making a source primary clears the flag on the others server-side, so an
 * answer is patched into the list and the list is refetched anyway: the patch
 * is for the next frame, the refetch is for the truth.
 */
export function useCreateIncomeSource() {
  const api = incomeSourcesApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.create,
    onSuccess: (dto) =>
      qc.setQueryData<IncomeSourceDto[]>(INCOME_SOURCES_KEY, (list) => [...(list ?? []), dto]),
    onSettled: () => qc.invalidateQueries({ queryKey: INCOME_SOURCES_KEY }),
  });
  return { create: (input: IncomeSourceInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateIncomeSource() {
  const api = incomeSourcesApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIncomeSourceInput }) =>
      api.update(id, input),
    onSuccess: (dto) =>
      qc.setQueryData<IncomeSourceDto[]>(INCOME_SOURCES_KEY, (list) =>
        (list ?? []).map((s) => (s.id === dto.id ? dto : s)),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: INCOME_SOURCES_KEY }),
  });
  return {
    update: (id: string, input: UpdateIncomeSourceInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useDeleteIncomeSource() {
  const api = incomeSourcesApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.remove,
    onSuccess: (_v, id) =>
      qc.setQueryData<IncomeSourceDto[]>(INCOME_SOURCES_KEY, (list) =>
        (list ?? []).filter((s) => s.id !== id),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: INCOME_SOURCES_KEY }),
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
```

`apps/web/src/modules/income/application/use-inflows.ts`:

```ts
import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { InflowDto } from '@magermoney/contracts';
import type { Inflow } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toInflow } from '../domain/mappers';
import { inflowsApi } from '../infrastructure/inflows-api';

export interface InflowParams {
  from?: string | undefined;
  to?: string | undefined;
  sourceId?: string | undefined;
}

/** Every inflow list, whatever window or source it is filtered by. */
export const INFLOWS_KEY = ['inflows'] as const;
/** Nulls rather than missing keys, so `{}` and `{ from: undefined }` are one cache entry. */
export const inflowsKey = (p: InflowParams) =>
  ['inflows', { from: p.from ?? null, to: p.to ?? null, sourceId: p.sourceId ?? null }] as const;

/** Whether a row belongs in the list these params describe — what an optimistic insert has to decide per cache entry. */
export function matchesInflowParams(
  row: { receivedOn: string; incomeSourceId: string },
  p: InflowParams,
): boolean {
  if (p.from && row.receivedOn < p.from) return false;
  if (p.to && row.receivedOn > p.to) return false;
  if (p.sourceId && row.incomeSourceId !== p.sourceId) return false;
  return true;
}

export function useInflows(params: MaybeRefOrGetter<InflowParams>): {
  inflows: ComputedRef<Inflow[]>;
  dtos: ComputedRef<InflowDto[]>;
  isLoading: ComputedRef<boolean>;
} {
  const api = inflowsApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({
    queryKey: computed(() => inflowsKey(toValue(params))),
    queryFn: () => api.list(toValue(params)),
  });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    inflows: computed(() => dtos.value.map((d) => toInflow(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
  };
}
```

`apps/web/src/modules/income/application/invalidate.ts` (a file of its own: Task 22's `mutation-defaults.ts` needs it too, and `use-inflow-mutations.ts` will import `mutation-defaults.ts` — sharing it from either would be a cycle):

```ts
import type { QueryClient } from '@tanstack/vue-query';
import { ACCOUNTS_KEY, balancesKey } from '@/modules/accounts/offline';
import { INFLOWS_KEY } from './use-inflows';

/**
 * An inflow that credits an Account writes a Balance entry, so changing it
 * changes that Account's balance and journal too. `accountIds` names the
 * Accounts involved — the one it was on and the one it moves to.
 *
 * The keys come from `@/modules/accounts/offline`, not the accounts barrel:
 * this file is reached from `income/offline.ts`, which the composition root
 * loads statically, and the barrel would drag every accounts screen into the
 * entry chunk. (Phase 2's `transfers/mutation-defaults.ts` imports the barrel;
 * the ledger lists that as a follow-up — follow the rule, not the precedent.)
 */
export const invalidateAfterInflow = (
  qc: QueryClient,
  accountIds: readonly string[],
): Promise<unknown> =>
  Promise.all([
    qc.invalidateQueries({ queryKey: INFLOWS_KEY }),
    ...(accountIds.length > 0 ? [qc.invalidateQueries({ queryKey: ACCOUNTS_KEY })] : []),
    ...accountIds.map((id) => qc.invalidateQueries({ queryKey: balancesKey(id) })),
  ]);
```

`apps/web/src/modules/income/application/use-inflow-mutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { UpdateInflowInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { inflowsApi } from '../infrastructure/inflows-api';
import { invalidateAfterInflow } from './invalidate';

export function useUpdateInflow() {
  const api = inflowsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInflowInput; accountIds: string[] }) =>
      api.update(id, input),
    onSettled: (_d, _e, { accountIds }) => invalidateAfterInflow(qc, accountIds),
  });
  return {
    update: (id: string, input: UpdateInflowInput, accountIds: string[]) =>
      m.mutateAsync({ id, input, accountIds }),
    isPending: m.isPending,
  };
}

export function useDeleteInflow() {
  const api = inflowsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id }: { id: string; accountIds: string[] }) => api.remove(id),
    onSettled: (_d, _e, { accountIds }) => invalidateAfterInflow(qc, accountIds),
  });
  return {
    remove: (id: string, accountIds: string[]) => m.mutateAsync({ id, accountIds }),
    isPending: m.isPending,
  };
}
```

- [ ] **Step 6: Replace the stub barrel**

`apps/web/src/modules/income/index.ts`:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the income module: Income sources, their pay schedule, and the Inflows that actually arrived. */

export { toIncomeSource, toInflow } from './domain/mappers';
export {
  useIncomeSources,
  useIncomeSource,
  INCOME_SOURCES_KEY,
} from './application/use-income-sources';
export {
  useCreateIncomeSource,
  useUpdateIncomeSource,
  useDeleteIncomeSource,
} from './application/use-income-source-mutations';
export { useInflows, INFLOWS_KEY, inflowsKey, type InflowParams } from './application/use-inflows';
export { useUpdateInflow, useDeleteInflow } from './application/use-inflow-mutations';

/** Still the Task 19 stand-ins; Task 21 points these at the real screens. */
export const IncomeSourcePage = routeComponent(() => import('@/shared/layout/PendingPage.vue'));
export const IncomeSourceFormPage = routeComponent(() => import('@/shared/layout/PendingPage.vue'));
```

- [ ] **Step 7: Give the new API codes their words**

In `apps/web/src/shared/api/error-messages.ts` append to `KEY_BY_CODE`:

```ts
  received_in_future: 'errors.receivedInFuture',
  credit_not_latest: 'errors.creditNotLatest',
  inflow_not_latest: 'errors.inflowNotLatest',
  credited_amount_required: 'errors.creditedAmountRequired',
  credited_mismatch: 'errors.creditedMismatch',
  non_positive_amount: 'errors.nonPositiveAmount',
  credited_without_account: 'errors.creditedWithoutAccount',
  active_period_invalid: 'errors.activePeriodInvalid',
  pay_days_invalid: 'errors.payDaysInvalid',
  rate_out_of_range: 'errors.rateOutOfRange',
  source_has_inflows: 'errors.sourceHasInflows',
  default_account_not_found: 'errors.defaultAccountNotFound',
  account_has_inflows: 'errors.accountHasInflows',
```

Add to `errors` in `ru.json`:

```json
"receivedInFuture": "Дата в будущем. Поставьте сегодня или раньше.",
"creditNotLatest": "На счёте уже есть более поздний остаток. Запишите поступление без счёта и обновите остаток вручную.",
"inflowNotLatest": "После этого поступления остаток счёта уже менялся. Изменить можно только самое свежее.",
"creditedAmountRequired": "Валюты разные. Укажите, сколько пришло на счёт.",
"creditedMismatch": "Валюта одна, значит на счёт пришла та же сумма. Уберите второе число.",
"nonPositiveAmount": "Сумма должна быть больше нуля.",
"creditedWithoutAccount": "Сумма зачисления есть, а счёта нет. Выберите счёт или уберите сумму.",
"activePeriodInvalid": "Дата окончания раньше даты начала.",
"payDaysInvalid": "Дни выплат — числа от 1 до 31 без повторов.",
"rateOutOfRange": "Налог и комиссия — от 0 до 99,99 %.",
"sourceHasInflows": "По источнику уже есть поступления. Его можно завершить, но не удалить, и валюту не поменять.",
"defaultAccountNotFound": "Счёт по умолчанию не найден. Выберите другой.",
"accountHasInflows": "На счёт зачислялись поступления. Его можно только архивировать."
```

and to `errors` in `en.json`:

```json
"receivedInFuture": "That date is in the future. Use today or earlier.",
"creditNotLatest": "This account already has a later balance. Record the inflow without an account and update the balance by hand.",
"inflowNotLatest": "The account's balance has changed since this inflow. Only the most recent one can be edited.",
"creditedAmountRequired": "The currencies differ. Enter how much reached the account.",
"creditedMismatch": "Same currency, so the account received the same amount. Remove the second number.",
"nonPositiveAmount": "The amount has to be more than zero.",
"creditedWithoutAccount": "There's a credited amount but no account. Pick an account or clear the amount.",
"activePeriodInvalid": "The end date is before the start date.",
"payDaysInvalid": "Pay days are numbers from 1 to 31, each once.",
"rateOutOfRange": "Tax and commission go from 0 to 99.99%.",
"sourceHasInflows": "This source already has inflows. You can end it, but not delete it or change its currency.",
"defaultAccountNotFound": "The default account wasn't found. Pick another one.",
"accountHasInflows": "Inflows were credited to this account. It can only be archived."
```

Run `/humanize-text:humanize-text` over both sets.

- [ ] **Step 8: Run the tests to see them pass**

Run: `cd apps/web && bun run test && bun run typecheck && bun run lint`
Expected: PASS, including `locales.test.ts` (key parity) and the boundaries rule — `@/modules/accounts/offline` is the one deep import the rule allows.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/modules/income apps/web/src/shared/api/error-messages.ts apps/web/src/locales apps/web/test
git commit -m "feat(web): add the income module's data layer"
```

Use `/git-commit`; end the message with the two trailers from Global Constraints. Append to `docs/discovery/phase-3-execution-ledger.md` and add it to the same commit: "`toInflow` takes the Account's currency as an optional third argument, because `InflowDto.creditedAmount` carries no currency; without it the domain object's `creditedAmount` is null."

---

### Task 21: Web `income` — the Income segment, the source page, the source form

**Files:**

- Create: `apps/web/src/modules/income/domain/labels.ts`
- Create: `apps/web/src/modules/income/ui/{IncomeSegment.vue, IncomeSourceRow.vue, IncomeSourcePage.vue, IncomeSourceFormPage.vue, InflowRow.vue}`
- Modify: `apps/web/src/modules/income/index.ts`, `apps/web/src/shared/dates/format.ts` (+`formatDay`), `apps/web/src/locales/{ru,en}.json`
- Test: `apps/web/test/{fixtures/income-mount.ts, date-format.test.ts (extend), income-labels.test.ts, IncomeSegment.test.ts, IncomeSourcePage.test.ts, IncomeSourceFormPage.test.ts}`

**Interfaces:**

- Consumes: Task 20's composables and mappers; from `@magermoney/domain` `netMonthly`, `Money`, `Decimal`; from `@magermoney/ui` `DayOfMonthPicker`, `PercentInput`, `Switch` (Task 18), `MoneyInput`, `AlertDialog*`, `Badge`, `Button`, `Input`, `Skeleton`, `useToast`; `MoneyText`, `todayIso` from `@/modules/rates`; `useCurrencies`, `useCurrencyRegistry` from `@/modules/currencies`; `useAccounts` from `@/modules/accounts`; `errorKeyFor`.
- Produces:
  - `IncomeSegment` — sync component, **no props, no emits**; Task 25 drops it into the Plan screen's Income segment as is. Lists active sources (link to `/plan/income/:id`), an "Ended" disclosure, an "Add source" link (`data-testid="income-add"` → `/plan/income/new`), an empty state.
  - `IncomeSourcePage` (async, route `income-source`), `IncomeSourceFormPage` (async, routes `income-source-new` / `income-source-edit`); after save both go to `/plan/income/:id`; after delete to `/plan?tab=income`.
  - Test ids the Task 27 e2e drives — form: `source-name`, `source-gross`, `source-currency` (a native `<select>`), `source-tax`, `source-commission`, `source-net`, `day-<n>`, `source-primary`, `source-account`, `source-submit`; page: `source-title`, `source-net-monthly`, `source-edit`, `source-end`, `source-delete`, `source-delete-confirm`, `inflow-row-<id>`; segment: `income-add`, `source-row-<id>`, `income-ended-toggle`, `income-empty`.
  - `InflowRow` — props `inflow: InflowDto`, `accountName?: string`; emits `select: [inflow: InflowDto]`. Task 22 listens to it to open the sheet; Task 26 may reuse it on the dashboard.
  - `formatDay(isoDate: string, locale: DateLocale): string` in `@/shared/dates/format` — for every `YYYY-MM-DD` the phase 3 screens print (Tasks 23–26 use it for billing dates, periods and upcoming events).
  - `payDaysLabel(days: readonly number[]): string` (`"10, 25"`, `""` when irregular).
  - i18n namespace `income.*`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/income-labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { payDaysLabel } from '../src/modules/income/domain/labels.js';

describe('payDaysLabel', () => {
  it('lists the days in order', () => {
    expect(payDaysLabel([25, 10])).toBe('10, 25');
    expect(payDaysLabel([5])).toBe('5');
  });
  it('is empty for an irregular source, so the screen can say so in words', () => {
    expect(payDaysLabel([])).toBe('');
  });
});
```

`apps/web/test/fixtures/income-mount.ts` (one mount helper for every income screen test, here and in Task 22):

```ts
import { mount, type ComponentMountingOptions } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { Component } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../../src/locales/ru.json';
import { API_KEY } from '../../src/shared/api/use-api.js';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const cur = (code: string) => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: null,
  icon: null,
});
export const profile = {
  id: 'u',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
export const acc = (id: string, currency: string, over: object = {}) => ({
  id,
  name: `Acc ${currency}`,
  bank: 'B',
  country: 'RU',
  currency,
  kind: 'bank_account',
  cardType: null,
  isSpending: true,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '100',
  balanceRecordedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

export type Fetch = (path: string, init?: RequestInit) => Promise<Response>;

/** Answers the reference data every screen asks for; `routes` answers the rest, first match wins. */
export function apiOf(routes: (path: string, init?: RequestInit) => Response | undefined): Fetch {
  return async (path, init) => {
    const own = routes(path, init);
    if (own) return own;
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json([cur('USD'), cur('EUR'), cur('RUB')]);
    if (path.startsWith('/rates'))
      return json([
        { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-17', source: 'api' },
      ]);
    return json([]);
  };
}

export async function mountAt<C extends Component>(
  component: C,
  at: string,
  fetch: Fetch,
  options: ComponentMountingOptions<C> = {},
) {
  const blank = { template: '<i />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: blank },
      { path: '/plan', component: blank },
      { path: '/plan/income/new', component: blank },
      { path: '/plan/income/:id', component: blank },
      { path: '/plan/income/:id/edit', component: blank },
    ],
  });
  await router.push(at);
  await router.isReady();
  const wrapper = mount(component, {
    ...options,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
        createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
    },
    attachTo: document.body,
  } as ComponentMountingOptions<C>);
  return { wrapper, router };
}
```

`apps/web/test/IncomeSegment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import IncomeSegment from '../src/modules/income/ui/IncomeSegment.vue';
import { sourceDto } from './fixtures/income.js';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const ended = {
  ...sourceDto,
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Old job',
  isPrimary: false,
  activeTo: '2025-12-31',
};
const irregular = {
  ...sourceDto,
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Other',
  isPrimary: false,
  payDays: [],
  grossAmount: '0',
  netMonthly: '0.00',
};

describe('IncomeSegment', () => {
  it('lists the current sources with their net and pay days, and keeps ended ones behind a disclosure', async () => {
    resetDisplayCurrency();
    const { wrapper } = await mountAt(
      IncomeSegment,
      '/plan',
      apiOf((p) => (p === '/income-sources' ? json([sourceDto, ended, irregular]) : undefined)),
    );
    await flushPromises();
    const row = wrapper.get(`[data-testid="source-row-${sourceDto.id}"]`);
    expect(row.text()).toContain('Salary');
    expect(row.text()).toContain('765.00 USD');
    expect(row.text()).toContain('10, 25');
    expect(row.text()).toContain('Основной');
    expect(row.attributes('href')).toBe(`/plan/income/${sourceDto.id}`);
    expect(wrapper.get(`[data-testid="source-row-${irregular.id}"]`).text()).toContain(
      'Нерегулярный',
    );
    expect(wrapper.find(`[data-testid="source-row-${ended.id}"]`).exists()).toBe(false);
    await wrapper.get('[data-testid="income-ended-toggle"]').trigger('click');
    expect(wrapper.get(`[data-testid="source-row-${ended.id}"]`).text()).toContain('Old job');
    wrapper.unmount();
  });

  it('invites the first source when there is none', async () => {
    const { wrapper } = await mountAt(
      IncomeSegment,
      '/plan',
      apiOf(() => undefined),
    );
    await flushPromises();
    expect(wrapper.get('[data-testid="income-empty"]').text()).toContain(
      'Пока ни одного источника',
    );
    expect(wrapper.get('[data-testid="income-add"]').attributes('href')).toBe('/plan/income/new');
    wrapper.unmount();
  });
});
```

The `activeTo: '2025-12-31'` fixture is in the past whatever day the suite runs, and `sourceDto.activeFrom` is `2026-01-01`; if the suite is ever run before that date the first assertion fails — the fixtures are dated for 2026-09 on purpose, matching the rest of the repo's tests.

`apps/web/test/IncomeSourcePage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import IncomeSourcePage from '../src/modules/income/ui/IncomeSourcePage.vue';
import { inflowDto, sourceDto } from './fixtures/income.js';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast: vi.fn() }) };
});

describe('IncomeSourcePage', () => {
  it("shows the source and asks the API for this source's inflows only", async () => {
    const paths: string[] = [];
    const { wrapper } = await mountAt(
      IncomeSourcePage,
      `/plan/income/${sourceDto.id}`,
      apiOf((p) => {
        paths.push(p);
        if (p === '/income-sources') return json([sourceDto]);
        if (p.startsWith('/inflows')) return json([inflowDto]);
        return undefined;
      }),
    );
    await flushPromises();
    expect(wrapper.get('[data-testid="source-title"]').text()).toBe('Salary');
    expect(wrapper.get('[data-testid="source-net-monthly"]').text()).toContain('765.00');
    expect(wrapper.get(`[data-testid="inflow-row-${inflowDto.id}"]`).text()).toContain('500');
    expect(paths).toContain(`/inflows?limit=200&sourceId=${sourceDto.id}`);
    wrapper.unmount();
  });

  it('ends a source by dating it, never by deleting it', async () => {
    const bodies: unknown[] = [];
    const { wrapper } = await mountAt(
      IncomeSourcePage,
      `/plan/income/${sourceDto.id}`,
      apiOf((p, init) => {
        if (init?.method === 'PATCH') {
          bodies.push(JSON.parse(init.body as string));
          return json({ ...sourceDto, activeTo: '2026-09-17' });
        }
        return p === '/income-sources' ? json([sourceDto]) : undefined;
      }),
    );
    await flushPromises();
    await wrapper.get('[data-testid="source-end"]').trigger('click');
    await flushPromises();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toHaveProperty('activeTo');
    wrapper.unmount();
  });

  it('deletes only after a confirmation and returns to the plan', async () => {
    let deleted = false;
    const { wrapper, router } = await mountAt(
      IncomeSourcePage,
      `/plan/income/${sourceDto.id}`,
      apiOf((p, init) => {
        if (init?.method === 'DELETE') {
          deleted = true;
          return new Response(null, { status: 204 });
        }
        return p === '/income-sources' ? json([sourceDto]) : undefined;
      }),
    );
    await flushPromises();
    await wrapper.get('[data-testid="source-delete"]').trigger('click');
    expect(deleted).toBe(false);
    // The dialog is teleported to the body.
    await new DOMWrapper(document.body)
      .get('[data-testid="source-delete-confirm"]')
      .trigger('click');
    await flushPromises();
    expect(deleted).toBe(true);
    expect(router.currentRoute.value.fullPath).toBe('/plan?tab=income');
    wrapper.unmount();
  });
});
```

`apps/web/test/IncomeSourceFormPage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import IncomeSourceFormPage from '../src/modules/income/ui/IncomeSourceFormPage.vue';
import { sourceDto } from './fixtures/income.js';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast: vi.fn() }) };
});

describe('IncomeSourceFormPage', () => {
  it('posts rates as fractions and pay days sorted, previews the net, and opens the new source', async () => {
    let body: Record<string, unknown> | undefined;
    const { wrapper, router } = await mountAt(
      IncomeSourceFormPage,
      '/plan/income/new',
      apiOf((_p, init) => {
        if (init?.method !== 'POST') return undefined;
        body = JSON.parse(init.body as string) as Record<string, unknown>;
        return json(sourceDto, 201);
      }),
    );
    await flushPromises();
    await wrapper.get('[data-testid="source-name"]').setValue('Salary');
    await wrapper.get('[data-testid="source-gross"]').setValue('1000');
    await wrapper.get('[data-testid="source-tax"] input').setValue('15');
    await wrapper.get('[data-testid="source-commission"] input').setValue('10');
    await wrapper.get('[data-testid="day-25"]').trigger('click');
    await wrapper.get('[data-testid="day-10"]').trigger('click');
    // 1000 × 0.85 × 0.9
    expect(wrapper.get('[data-testid="source-net"]').text()).toContain('765.00');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(body).toMatchObject({
      name: 'Salary',
      grossAmount: '1000',
      currency: 'USD',
      taxRate: '0.15',
      commissionRate: '0.1',
      payDays: [10, 25],
      isPrimary: false,
      activeTo: null,
      defaultAccountId: null,
    });
    expect(body?.activeFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(router.currentRoute.value.path).toBe(`/plan/income/${sourceDto.id}`);
    wrapper.unmount();
  });

  it('fills the form from the source being edited and patches it', async () => {
    let method = '';
    const { wrapper } = await mountAt(
      IncomeSourceFormPage,
      `/plan/income/${sourceDto.id}/edit`,
      apiOf((p, init) => {
        if (init?.method === 'PATCH') {
          method = `PATCH ${p}`;
          return json(sourceDto);
        }
        return p === '/income-sources' ? json([sourceDto]) : undefined;
      }),
    );
    await flushPromises();
    expect((wrapper.get('[data-testid="source-name"]').element as HTMLInputElement).value).toBe(
      'Salary',
    );
    expect(wrapper.get('[data-testid="day-10"]').attributes('aria-pressed')).toBe('true');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(method).toBe(`PATCH /income-sources/${sourceDto.id}`);
    wrapper.unmount();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd apps/web && bunx vitest run test/income-labels.test.ts test/IncomeSegment.test.ts test/IncomeSourcePage.test.ts test/IncomeSourceFormPage.test.ts`
Expected: FAIL — `labels.js` and the three `.vue` files cannot be resolved.

- [ ] **Step 3: Add the copy**

`ru.json`, new top-level `income`:

```json
"income": {
  "title": "Доходы",
  "add": "Добавить источник",
  "primary": "Основной",
  "irregular": "Нерегулярный",
  "payDays": "Выплаты: {days}",
  "perMonth": "в месяц на руки",
  "gross": "До налогов: {amount}",
  "period": "С {from}",
  "periodEnded": "С {from} по {to}",
  "ended": { "show": "Завершённые · {n}", "hide": "Скрыть завершённые" },
  "empty": { "title": "Пока ни одного источника", "body": "Добавьте зарплату или другой доход. От него посчитаем план месяца и дни до зарплаты." },
  "source": {
    "edit": "Изменить", "end": "Завершить сегодня", "delete": "Удалить",
    "deleteTitle": "Удалить источник?", "deleteBody": "Удалить можно только источник без поступлений. Если деньги уже приходили, завершите его.",
    "cancel": "Отмена", "inflows": "Поступления", "noInflows": "Поступлений пока нет.", "failed": "Не получилось. Попробуйте ещё раз."
  },
  "inflow": { "credited": "на {account}", "creditedAmount": "зачислено {amount}" },
  "form": {
    "createTitle": "Новый источник", "editTitle": "Источник дохода",
    "name": "Название", "gross": "Сумма в месяц до налогов", "currency": "Валюта",
    "tax": "Налог", "commission": "Комиссия", "net": "На руки в месяц",
    "payDays": "Дни выплат", "payDaysHint": "Сумма делится поровну между днями. Без дней источник считается нерегулярным.",
    "primary": "Основной источник", "primaryHint": "По нему считаем дни до зарплаты.",
    "activeFrom": "Действует с", "activeTo": "По (необязательно)",
    "defaultAccount": "Куда обычно приходит", "noAccount": "Не выбирать",
    "create": "Создать", "save": "Сохранить", "saveFailed": "Не получилось сохранить. Попробуйте ещё раз."
  }
}
```

`en.json`, same keys:

```json
"income": {
  "title": "Income",
  "add": "Add a source",
  "primary": "Primary",
  "irregular": "Irregular",
  "payDays": "Paid on: {days}",
  "perMonth": "net per month",
  "gross": "Before tax: {amount}",
  "period": "Since {from}",
  "periodEnded": "{from} to {to}",
  "ended": { "show": "Ended · {n}", "hide": "Hide ended" },
  "empty": { "title": "No income sources yet", "body": "Add a salary or any other income. The month plan and the days to payday are worked out from it." },
  "source": {
    "edit": "Edit", "end": "End today", "delete": "Delete",
    "deleteTitle": "Delete this source?", "deleteBody": "Only a source with no inflows can be deleted. If money has already come in, end it instead.",
    "cancel": "Cancel", "inflows": "Inflows", "noInflows": "No inflows yet.", "failed": "That didn't work. Try again."
  },
  "inflow": { "credited": "to {account}", "creditedAmount": "credited {amount}" },
  "form": {
    "createTitle": "New source", "editTitle": "Income source",
    "name": "Name", "gross": "Monthly amount before tax", "currency": "Currency",
    "tax": "Tax", "commission": "Commission", "net": "Net per month",
    "payDays": "Pay days", "payDaysHint": "The amount is split evenly between the days. With no days the source counts as irregular.",
    "primary": "Primary source", "primaryHint": "Days to payday are counted from it.",
    "activeFrom": "Active from", "activeTo": "Until (optional)",
    "defaultAccount": "Where it usually lands", "noAccount": "None",
    "create": "Create", "save": "Save", "saveFailed": "Couldn't save. Try again."
  }
}
```

Run `/humanize-text:humanize-text` over both.

- [ ] **Step 4: Run `/frontend-design` before any markup**

Brief: the Income segment is a ledger page, not a card grid — hairline-separated rows at ≥52px, the source name left with a quiet second line (pay days, or "Irregular"), the net per month right in mono tabular figures with its code, and the display-currency conversion beneath it through `MoneyText`; "Primary" is a small badge, the only ornament. The source page leads with the net per month as the amount lockup (32px), gross and period as quiet lines, then actions, then the inflows as the same hairline list. The form is a routed page like `AccountFormPage`: one column, 12px muted labels, the net preview sits directly under tax and commission and updates as they change; the day grid is the one dense control. Amounts are ink; nothing here is a delta, so nothing takes colour.

- [ ] **Step 5: Write the label helper and the components (functional baseline)**

`apps/web/src/modules/income/domain/labels.ts`:

```ts
/** "10, 25" — empty for an irregular source, which the screen names in words instead. */
export const payDaysLabel = (days: readonly number[]): string =>
  [...days].sort((a, b) => a - b).join(', ');
```

`apps/web/src/shared/dates/format.ts` — add (a bare `YYYY-MM-DD` parses as UTC midnight, which `formatDate` would print as the previous day west of Greenwich; a calendar date has no zone, so it is formatted at local noon):

```ts
/** A calendar date (`YYYY-MM-DD`), as opposed to an instant: formatted at local noon so no zone can move it to the day before. */
export const formatDay = (isoDate: string, locale: DateLocale): string =>
  new Intl.DateTimeFormat(intl(locale), dateOptions(locale)).format(
    new Date(`${isoDate}T12:00:00`),
  );
```

and to `apps/web/test/date-format.test.ts`, inside its `describe`:

```ts
it('formats a calendar date as that day, whatever the zone', () => {
  expect(formatDay('2026-09-10', 'ru')).toBe('10.09.2026');
  expect(formatDay('2026-09-10', 'en')).toBe('Sep 10, 2026');
});
```

(import `formatDay` next to the functions that file already imports).

`apps/web/src/modules/income/ui/IncomeSourceRow.vue`:

```vue
<script setup lang="ts">
/** One source: what it is on the left, what it brings per month on the right, in its own currency first. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { netMonthly, type IncomeSource } from '@magermoney/domain';
import { Badge } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import { payDaysLabel } from '../domain/labels';

const { source } = defineProps<{ source: IncomeSource }>();
const { t } = useI18n();
const net = computed(() => netMonthly(source));
/** Padded to the currency's scale, as every own-currency amount in the app is: `Money.toString()` prints 765, a ledger prints 765.00. */
const netText = computed(() => net.value.amount.toFixed(net.value.currency.scale));
const days = computed(() => payDaysLabel(source.payDays));
</script>

<template>
  <RouterLink
    :to="`/plan/income/${source.id}`"
    :data-testid="`source-row-${source.id}`"
    class="flex min-h-14 items-center gap-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
  >
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2">
        <span class="truncate text-[15px]">{{ source.name }}</span>
        <Badge v-if="source.isPrimary" variant="secondary">{{ t('income.primary') }}</Badge>
      </span>
      <span class="block text-xs text-muted-foreground">
        {{ days ? t('income.payDays', { days }) : t('income.irregular') }}
      </span>
    </span>
    <span class="text-right">
      <span class="block font-mono text-[15px] tabular-nums"
        >{{ netText }} {{ net.currency.code }}</span
      >
      <MoneyText
        class="text-xs text-muted-foreground"
        :amount="net.toString()"
        :currency="net.currency.code"
      />
    </span>
  </RouterLink>
</template>
```

`apps/web/src/modules/income/ui/IncomeSegment.vue`:

```vue
<script setup lang="ts">
/**
 * The Income segment of the Plan screen: what is coming in, and what used to.
 * A source counts as ended once its `activeTo` is behind today; one that starts
 * next month is already listed — it is part of the plan, just not of this
 * month's numbers, which the domain's `isActiveOn` decides on the dashboard.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Motion } from 'motion-v';
import { Button, Skeleton, listStagger } from '@magermoney/ui';
import { todayIso } from '@/modules/rates';
import { useIncomeSources } from '../application/use-income-sources';
import IncomeSourceRow from './IncomeSourceRow.vue';

const { t } = useI18n();
const { sources, isLoading } = useIncomeSources();
const showEnded = ref(false);

const today = todayIso();
/** Primary first, then by name: the primary source is the one the dashboard counts from. */
const byPrimaryThenName = (a: { isPrimary: boolean; name: string }, b: typeof a) =>
  Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name);
const current = computed(() =>
  sources.value.filter((s) => s.activeTo === null || s.activeTo >= today).sort(byPrimaryThenName),
);
const ended = computed(() =>
  sources.value.filter((s) => s.activeTo !== null && s.activeTo < today).sort(byPrimaryThenName),
);
</script>

<template>
  <section data-testid="income-segment">
    <div v-if="isLoading" class="space-y-3">
      <Skeleton class="h-14 w-full" />
      <Skeleton class="h-14 w-full" />
    </div>

    <div v-else-if="sources.length === 0" class="mt-10 text-center" data-testid="income-empty">
      <p class="text-lg font-semibold">{{ t('income.empty.title') }}</p>
      <p class="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">
        {{ t('income.empty.body') }}
      </p>
    </div>

    <ul v-else class="divide-y divide-border/60 border-t border-border">
      <Motion v-for="(s, i) in current" :key="s.id" tag="li" v-bind="listStagger(i)">
        <IncomeSourceRow :source="s" />
      </Motion>
    </ul>

    <div class="mt-4" :class="sources.length === 0 ? 'text-center' : ''">
      <Button as-child variant="outline" class="min-h-9 pointer-coarse:min-h-11">
        <RouterLink to="/plan/income/new" data-testid="income-add">{{
          t('income.add')
        }}</RouterLink>
      </Button>
    </div>

    <div v-if="ended.length > 0" class="mt-8">
      <Button
        variant="ghost"
        size="sm"
        class="min-h-9 pointer-coarse:min-h-11"
        :aria-expanded="showEnded"
        aria-controls="ended-sources"
        data-testid="income-ended-toggle"
        @click="showEnded = !showEnded"
      >
        {{ showEnded ? t('income.ended.hide') : t('income.ended.show', { n: ended.length }) }}
      </Button>
      <ul v-if="showEnded" id="ended-sources" class="mt-2 divide-y divide-border/60 opacity-70">
        <li v-for="s in ended" :key="s.id"><IncomeSourceRow :source="s" /></li>
      </ul>
    </div>
  </section>
</template>
```

`apps/web/src/modules/income/ui/InflowRow.vue`:

```vue
<script setup lang="ts">
/** One receipt: when, how much in its own currency, and where it landed if it was credited. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { InflowDto } from '@magermoney/contracts';
import { MoneyText } from '@/modules/rates';
import { formatDay, type DateLocale } from '@/shared/dates/format';

const props = defineProps<{ inflow: InflowDto; accountName?: string }>();
const emit = defineEmits<{ select: [inflow: InflowDto] }>();
const { t, locale } = useI18n();
const date = computed(() => formatDay(props.inflow.receivedOn, locale.value as DateLocale));
</script>

<template>
  <button
    type="button"
    :data-testid="`inflow-row-${inflow.id}`"
    class="flex min-h-14 w-full items-center gap-3 py-2 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
    @click="emit('select', inflow)"
  >
    <span class="min-w-0 flex-1">
      <span class="block font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">{{
        date
      }}</span>
      <span v-if="accountName" class="block truncate text-xs text-muted-foreground">
        {{ t('income.inflow.credited', { account: accountName }) }}
      </span>
      <span v-if="inflow.note" class="block truncate text-xs text-muted-foreground">{{
        inflow.note
      }}</span>
    </span>
    <span class="text-right">
      <span class="block font-mono text-[15px] tabular-nums"
        >{{ inflow.amount }} {{ inflow.currency }}</span
      >
      <MoneyText
        class="text-xs text-muted-foreground"
        :amount="inflow.amount"
        :currency="inflow.currency"
      />
    </span>
  </button>
</template>
```

`apps/web/src/modules/income/ui/IncomeSourcePage.vue`:

```vue
<script setup lang="ts">
/** One source: what it brings, when it pays, and every receipt that actually came from it. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { netMonthly } from '@magermoney/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Skeleton,
  useToast,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencyRegistry } from '@/modules/currencies';
import { MoneyText, todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import { payDaysLabel } from '../domain/labels';
import { toIncomeSource } from '../domain/mappers';
import { useIncomeSource, useIncomeSources } from '../application/use-income-sources';
import {
  useDeleteIncomeSource,
  useUpdateIncomeSource,
} from '../application/use-income-source-mutations';
import { useInflows } from '../application/use-inflows';
import InflowRow from './InflowRow.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const id = computed(() => String(route.params.id));
const dto = useIncomeSource(id);
const { isLoading } = useIncomeSources();
const registry = useCurrencyRegistry();
const { accounts } = useAccounts();
const { dtos: inflows, isLoading: inflowsLoading } = useInflows(() => ({ sourceId: id.value }));
const { update } = useUpdateIncomeSource();
const { remove } = useDeleteIncomeSource();

const uiLocale = computed(() => locale.value as DateLocale);
const source = computed(() => (dto.value ? toIncomeSource(dto.value, registry.value) : undefined));
const net = computed(() => (source.value ? netMonthly(source.value) : undefined));
const netText = computed(() => net.value?.amount.toFixed(net.value.currency.scale) ?? '');
const days = computed(() => payDaysLabel(dto.value?.payDays ?? []));
const isCurrent = computed(() => dto.value?.activeTo == null || dto.value.activeTo >= todayIso());
const accountName = (accountId: string | null) =>
  accounts.value.find((a) => a.id === accountId)?.name;
const confirmDelete = ref(false);

async function end() {
  if (!dto.value) return;
  try {
    await update(dto.value.id, { activeTo: todayIso() });
  } catch (e) {
    toast(t(errorKeyFor(e, 'income.source.failed')));
  }
}
async function del() {
  if (!dto.value) return;
  try {
    await remove(dto.value.id);
    await router.replace({ path: '/plan', query: { tab: 'income' } });
  } catch (e) {
    toast(t(errorKeyFor(e, 'income.source.failed')));
  }
}
</script>

<template>
  <section v-if="dto && source && net" class="pb-8">
    <header>
      <div class="flex items-center gap-2">
        <h1 class="truncate text-2xl font-semibold tracking-[-0.01em]" data-testid="source-title">
          {{ dto.name }}
        </h1>
        <Badge v-if="dto.isPrimary" variant="secondary">{{ t('income.primary') }}</Badge>
      </div>
      <p
        class="mt-4 text-[32px] font-semibold leading-[1.1] tabular-nums"
        data-testid="source-net-monthly"
      >
        {{ netText }}
        <span class="font-mono text-[0.6em] uppercase tracking-[0.08em] text-muted-foreground">{{
          net.currency.code
        }}</span>
      </p>
      <p class="text-sm text-muted-foreground">
        {{ t('income.perMonth') }} ·
        <MoneyText :amount="net.toString()" :currency="net.currency.code" />
      </p>
      <p class="mt-3 text-sm text-muted-foreground">
        {{ t('income.gross', { amount: `${dto.grossAmount} ${dto.currency}` }) }}
      </p>
      <p class="text-sm text-muted-foreground">
        {{ days ? t('income.payDays', { days }) : t('income.irregular') }}
      </p>
      <p class="text-sm text-muted-foreground">
        {{
          dto.activeTo
            ? t('income.periodEnded', {
                from: formatDay(dto.activeFrom, uiLocale),
                to: formatDay(dto.activeTo, uiLocale),
              })
            : t('income.period', { from: formatDay(dto.activeFrom, uiLocale) })
        }}
      </p>
    </header>

    <div class="mt-6 flex flex-wrap gap-2">
      <Button
        variant="outline"
        class="min-h-9 pointer-coarse:min-h-11"
        data-testid="source-edit"
        @click="router.push(`/plan/income/${dto.id}/edit`)"
      >
        {{ t('income.source.edit') }}
      </Button>
      <Button
        v-if="isCurrent"
        variant="outline"
        class="min-h-9 pointer-coarse:min-h-11"
        data-testid="source-end"
        @click="end"
      >
        {{ t('income.source.end') }}
      </Button>
      <Button
        variant="ghost"
        class="min-h-9 text-destructive pointer-coarse:min-h-11"
        data-testid="source-delete"
        @click="confirmDelete = true"
      >
        {{ t('income.source.delete') }}
      </Button>
    </div>

    <h2 class="mt-8 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('income.source.inflows') }}
    </h2>
    <Skeleton v-if="inflowsLoading" class="mt-2 h-14 w-full" />
    <p v-else-if="inflows.length === 0" class="mt-2 text-sm text-muted-foreground">
      {{ t('income.source.noInflows') }}
    </p>
    <ul v-else class="mt-1 divide-y divide-border/60 border-t border-border">
      <li v-for="i in inflows" :key="i.id">
        <InflowRow :inflow="i" :account-name="accountName(i.accountId)" />
      </li>
    </ul>

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('income.source.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('income.source.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('income.source.cancel') }}</AlertDialogCancel>
          <AlertDialogAction data-testid="source-delete-confirm" @click="del">
            {{ t('income.source.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
  <div v-else-if="isLoading" class="space-y-4">
    <Skeleton class="h-8 w-40" />
    <Skeleton class="h-12 w-64" />
  </div>
</template>
```

`apps/web/src/modules/income/ui/IncomeSourceFormPage.vue`:

```vue
<script setup lang="ts">
/**
 * Create or edit an Income source. Gross is monthly; tax and commission are
 * typed as percentages and travel as fractions; the net under them is the
 * domain's own `netMonthly`, so the preview and the dashboard cannot disagree.
 */
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Decimal, Money, netMonthly } from '@magermoney/domain';
import {
  Button,
  DayOfMonthPicker,
  Input,
  MoneyInput,
  PercentInput,
  Switch,
  useToast,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useIncomeSource } from '../application/use-income-sources';
import {
  useCreateIncomeSource,
  useUpdateIncomeSource,
} from '../application/use-income-source-mutations';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const registry = useCurrencyRegistry();
const { accounts } = useAccounts();
const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = useIncomeSource(() => editingId.value ?? '');
const { create, isPending: creating } = useCreateIncomeSource();
const { update, isPending: updating } = useUpdateIncomeSource();

const NO_ACCOUNT = '';
const form = reactive({
  name: '',
  grossAmount: '',
  currency: 'USD',
  taxRate: '0',
  commissionRate: '0',
  payDays: [] as number[],
  isPrimary: false,
  activeFrom: todayIso(),
  activeTo: '',
  defaultAccountId: NO_ACCOUNT,
});
watch(
  existing,
  (s) => {
    if (!s) return;
    Object.assign(form, {
      name: s.name,
      grossAmount: s.grossAmount,
      currency: s.currency,
      taxRate: s.taxRate,
      commissionRate: s.commissionRate,
      payDays: [...s.payDays],
      isPrimary: s.isPrimary,
      activeFrom: s.activeFrom,
      activeTo: s.activeTo ?? '',
      defaultAccountId: s.defaultAccountId ?? NO_ACCOUNT,
    });
  },
  { immediate: true },
);

const uiLocale = computed(() => locale.value as DateLocale);
const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const activeAccounts = computed(() => accounts.value.filter((a) => a.archivedAt === null));
const busy = computed(() => creating.value || updating.value);

const net = computed(() => {
  if (form.grossAmount === '') return null;
  const currency = registry.value
    .get(form.currency)
    .unwrapOr({ code: form.currency, kind: 'fiat' as const, scale: scale.value });
  return netMonthly({
    grossAmount: Money.of(form.grossAmount, currency),
    taxRate: new Decimal(form.taxRate),
    commissionRate: new Decimal(form.commissionRate),
  });
});
const netText = computed(() => net.value?.amount.toFixed(scale.value) ?? '—');

async function submit() {
  const input = {
    name: form.name.trim(),
    grossAmount: form.grossAmount === '' ? '0' : form.grossAmount,
    currency: form.currency,
    taxRate: form.taxRate,
    commissionRate: form.commissionRate,
    payDays: form.payDays,
    isPrimary: form.isPrimary,
    activeFrom: form.activeFrom,
    activeTo: form.activeTo || null,
    defaultAccountId: form.defaultAccountId || null,
  };
  try {
    const saved = editingId.value ? await update(editingId.value, input) : await create(input);
    await router.replace(`/plan/income/${saved.id}`);
  } catch (e) {
    toast(t(errorKeyFor(e, 'income.form.saveFailed')));
  }
}
</script>

<template>
  <form class="space-y-5 pb-8" data-testid="source-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('income.form.editTitle') : t('income.form.createTitle') }}
    </h1>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('income.form.name') }}</span>
      <Input v-model="form.name" required maxlength="80" data-testid="source-name" class="mt-1" />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground"
        >{{ t('income.form.gross') }} · {{ form.currency }}</span
      >
      <MoneyInput
        v-model="form.grossAmount"
        :scale="scale"
        :locale="uiLocale"
        data-testid="source-gross"
        class="mt-1"
      />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('income.form.currency') }}</span>
      <!-- A native select, like the account pickers: the e2e drives it with `selectOption`, and on a phone it is the better control anyway. -->
      <select
        v-model="form.currency"
        data-testid="source-currency"
        class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
      >
        <option v-for="c in currencies" :key="c.code" :value="c.code">{{ c.code }}</option>
      </select>
    </label>

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{ t('income.form.tax') }}</span>
        <PercentInput
          v-model="form.taxRate"
          :locale="uiLocale"
          data-testid="source-tax"
          class="mt-1"
        />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('income.form.commission')
        }}</span>
        <PercentInput
          v-model="form.commissionRate"
          :locale="uiLocale"
          data-testid="source-commission"
          class="mt-1"
        />
      </label>
    </div>

    <p class="flex items-baseline justify-between border-y border-border py-3" aria-live="polite">
      <span class="text-sm text-muted-foreground">{{ t('income.form.net') }}</span>
      <span class="font-mono text-lg tabular-nums" data-testid="source-net"
        >{{ netText }} {{ form.currency }}</span
      >
    </p>

    <fieldset>
      <legend class="text-xs font-medium text-muted-foreground">
        {{ t('income.form.payDays') }}
      </legend>
      <DayOfMonthPicker
        :model-value="form.payDays"
        :aria-label="t('income.form.payDays')"
        class="mt-2"
        @update:model-value="(v) => (form.payDays = Array.isArray(v) ? v : [])"
      />
      <p class="mt-2 text-xs text-muted-foreground">{{ t('income.form.payDaysHint') }}</p>
    </fieldset>

    <div class="flex min-h-11 items-center justify-between gap-4">
      <span>
        <span id="source-primary-label" class="block text-sm font-medium">{{
          t('income.form.primary')
        }}</span>
        <span class="block text-xs text-muted-foreground">{{ t('income.form.primaryHint') }}</span>
      </span>
      <Switch
        v-model="form.isPrimary"
        aria-labelledby="source-primary-label"
        data-testid="source-primary"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('income.form.activeFrom')
        }}</span>
        <Input v-model="form.activeFrom" type="date" required class="mt-1" />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('income.form.activeTo')
        }}</span>
        <Input v-model="form.activeTo" type="date" :min="form.activeFrom" class="mt-1" />
      </label>
    </div>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('income.form.defaultAccount')
      }}</span>
      <select
        v-model="form.defaultAccountId"
        data-testid="source-account"
        class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
      >
        <option :value="NO_ACCOUNT">{{ t('income.form.noAccount') }}</option>
        <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
          {{ a.name }} · {{ a.currency }}
        </option>
      </select>
    </label>

    <Button
      type="submit"
      size="lg"
      class="w-full"
      :disabled="busy || form.name.trim() === ''"
      data-testid="source-submit"
    >
      {{ editingId ? t('income.form.save') : t('income.form.create') }}
    </Button>
  </form>
</template>
```

The edit form sends `currency` even when unchanged; the API only refuses a _change_ once Inflows exist (`source_has_inflows`), and that answer already has words from Task 20.

- [ ] **Step 6: Point the barrel at the real screens**

In `apps/web/src/modules/income/index.ts` replace the two stub exports and add the components:

```ts
export { payDaysLabel } from './domain/labels';
export { default as IncomeSegment } from './ui/IncomeSegment.vue';
export { default as InflowRow } from './ui/InflowRow.vue';
export const IncomeSourcePage = routeComponent(() => import('./ui/IncomeSourcePage.vue'));
export const IncomeSourceFormPage = routeComponent(() => import('./ui/IncomeSourceFormPage.vue'));
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `cd apps/web && bun run test && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 8: `/animate`, `/impeccable`**

`/animate`: rows enter with `listStagger` (already wired in the segment); the net preview must not animate on every keystroke — it is a number being typed against, so it swaps instantly; the "Ended" disclosure opens without a height animation (a list of unknown length, and `direction.md` says short distances). `/impeccable` on the four components: focus order of the form (name → gross → currency → tax → commission → days → primary → dates → account → submit), 44px targets under `pointer-coarse:` on every day, the delete dialog's default focus on Cancel, contrast of the 12px muted labels in dark mode. Re-run Step 7.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/modules/income apps/web/src/shared/dates/format.ts apps/web/src/locales apps/web/test
git commit -m "feat(web): add the income segment, source page and source form"
```

Use `/git-commit`; end the message with the two trailers from Global Constraints.

---

### Task 22: Web `income` — the inflow sheet, offline parking of "record inflow", the quick action

**Files:**

- Create: `apps/web/src/modules/income/application/mutation-defaults.ts`
- Create: `apps/web/src/modules/income/offline.ts`
- Create: `apps/web/src/modules/income/ui/InflowSheet.vue`
- Modify: `apps/web/src/modules/income/application/use-inflow-mutations.ts` (+`useCreateInflow`), `apps/web/src/modules/income/index.ts`, `apps/web/src/modules/income/ui/IncomeSourcePage.vue`
- Modify: `apps/web/src/app/main.ts`, `apps/web/src/app/query.ts`, `apps/web/src/app/QuickActions.vue`
- Modify: `apps/web/src/modules/accounts/ui/BalanceTimeline.vue` (label `origin: 'inflow'` entries)
- Modify: `apps/web/src/locales/{ru,en}.json`
- Test: `apps/web/test/{BalanceTimeline.test.ts (extend), use-create-inflow.test.ts, income-offline.test.ts, InflowSheet.test.ts, quick-actions.test.ts}`

**Interfaces:**

- Consumes: Task 20 (`inflowsApi`, `INFLOWS_KEY`, `matchesInflowParams`, `InflowParams`, `INCOME_SOURCES_KEY`, `invalidateAfterInflow` from `application/invalidate.ts`, `useUpdateInflow`, `useDeleteInflow`, `useCreateIncomeSource`), Task 21 (`InflowRow`'s `select`), `deriveInflowCredit` and `Money`, `Decimal` from `@magermoney/domain`; `ACCOUNTS_KEY` from `@/modules/accounts/offline`; `assertOwner`, `ForeignWriteError`, `settledOrParked` from `@/shared/api/offline-write`; `useOwnerId`.
- Produces:
  - `@/modules/income/offline`: `INCOME_SOURCES_KEY`, `INFLOWS_KEY`, `inflowsKey`, `CREATE_INFLOW_KEY = ['inflows', 'create']`, `registerIncomeMutations(queryClient, client, signedInId?)`, `type CreateInflowVars = { ownerId: string | null; input: CreateInflowInput }`. The barrel re-exports the same names.
  - `useCreateInflow(): { create(input: CreateInflowInput): Promise<'sent' | 'parked'>; isPending: ComputedRef<boolean> }` — **deviation from the header**, which says `Promise<InflowDto | 'parked'>`: it returns `settledOrParked`'s `WriteOutcome`, exactly like `useRecordBalance` and `useCreateTransfer`; no caller needs the DTO.
  - `InflowSheet` — props `open: boolean`, `sourceId?: string` (preselects the source), `inflow?: InflowDto` (edit mode); emits `update:open: [open: boolean]`. Test ids: `inflow-source`, `inflow-new-name`, `inflow-new-currency`, `inflow-amount`, `inflow-date`, `inflow-account`, `inflow-credited`, `inflow-hint`, `inflow-rate`, `inflow-more`, `inflow-usd-rate`, `inflow-save`, `inflow-delete`. Task 26's dashboard opens it with no props for "Record inflow".
  - `QuickActions` shows on `/` and `/accounts` even with no accounts, and gains `data-testid="quick-inflow"`; "Record balance" and "Transfer" appear only when there is an active account.
  - i18n namespace `inflows.*`, plus `quick.inflow` and `accounts.detail.byInflow`.
  - A Balance entry with `origin: 'inflow'` (its DTO carries `inflowId`, Task 6/10) is labelled in the Account's journal and stays non-editable there: `AccountDetailPage` already offers edit only for the latest _manual_ entry, and the API answers 409 `entry_not_manual` otherwise. It is changed through its Inflow.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/use-create-inflow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { API_KEY } from '../src/shared/api/use-api.js';
import { useAccounts } from '../src/modules/accounts/application/use-accounts.js';
import { useIncomeSources } from '../src/modules/income/application/use-income-sources.js';
import { useInflows } from '../src/modules/income/application/use-inflows.js';
import { useCreateInflow } from '../src/modules/income/application/use-inflow-mutations.js';
import { inflowDto, sourceDto, SOURCE_ID } from './fixtures/income.js';
import { acc, cur, json } from './fixtures/income-mount.js';

const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

function mountIt(fetchImpl: (path: string, init?: RequestInit) => Promise<Response>) {
  let accounts!: ReturnType<typeof useAccounts>;
  let inflows!: ReturnType<typeof useInflows>;
  let other!: ReturnType<typeof useInflows>;
  let creator!: ReturnType<typeof useCreateInflow>;
  const Probe = defineComponent({
    setup() {
      accounts = useAccounts();
      // The optimistic row takes its currency from the cached sources, as a real screen has them.
      useIncomeSources();
      inflows = useInflows(() => ({ from: '2026-09-01', to: '2026-09-30' }));
      other = useInflows(() => ({ from: '2026-08-01', to: '2026-08-31' }));
      creator = useCreateInflow();
      return () => h('div');
    },
  });
  mount(Probe, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
      ],
      provide: { [API_KEY as unknown as string]: { fetch: fetchImpl } },
    },
  });
  return {
    accounts: () => accounts,
    inflows: () => inflows,
    other: () => other,
    creator: () => creator,
  };
}

describe('useCreateInflow', () => {
  it('shows the receipt and the grown balance before the POST answers, only in the lists it belongs to, and takes both back on failure', async () => {
    const post = deferred<Response>();
    // After the POST is sent every GET blocks, so what is on screen can only be the optimistic patch or its rollback.
    let block: Promise<Response> | null = null;
    const p = mountIt(async (path, init) => {
      if (init?.method === 'POST') return post.promise;
      if (block) return block;
      if (path === '/currencies') return json([cur('USD')]);
      if (path === '/income-sources') return json([sourceDto]);
      if (path.startsWith('/inflows')) return json([]);
      return json([acc(ACCOUNT_ID, 'USD', { balance: '10' })]);
    });
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('10');

    block = new Promise<Response>(() => undefined);
    const settled = p
      .creator()
      .create({
        incomeSourceId: SOURCE_ID,
        amount: '5.5',
        receivedOn: '2026-09-10',
        accountId: ACCOUNT_ID,
      })
      .catch(() => 'failed');
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('15.5');
    expect(p.inflows().dtos.value.map((i) => i.amount)).toEqual(['5.5']);
    expect(p.inflows().dtos.value[0]?.currency).toBe('USD');
    expect(p.other().dtos.value).toEqual([]);

    post.resolve(json({ code: 'credit_not_latest', message: 'no' }, 400));
    expect(await settled).toBe('failed');
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('10');
    expect(p.inflows().dtos.value).toEqual([]);
  });

  it('adds the credited amount, not the inflow amount, when the account is in another currency', async () => {
    const post = deferred<Response>();
    let block: Promise<Response> | null = null;
    const p = mountIt(async (path, init) => {
      if (init?.method === 'POST') return post.promise;
      if (block) return block;
      if (path === '/income-sources') return json([sourceDto]);
      if (path.startsWith('/inflows') || path === '/currencies') return json([]);
      return json([acc(ACCOUNT_ID, 'EUR', { balance: '100' })]);
    });
    await flushPromises();
    block = new Promise<Response>(() => undefined);
    void p.creator().create({
      incomeSourceId: SOURCE_ID,
      amount: '500',
      accountId: ACCOUNT_ID,
      creditedAmount: '430',
    });
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('530');
    post.resolve(json({ ...inflowDto, accountId: ACCOUNT_ID, creditedAmount: '430' }, 201));
  });

  it('leaves the balances alone for an inflow that credits nothing', async () => {
    const p = mountIt(async (path, init) => {
      if (init?.method === 'POST') return json(inflowDto, 201);
      if (path === '/income-sources') return json([sourceDto]);
      if (path.startsWith('/inflows') || path === '/currencies') return json([]);
      return json([acc(ACCOUNT_ID, 'USD', { balance: '10' })]);
    });
    await flushPromises();
    expect(await p.creator().create({ incomeSourceId: SOURCE_ID, amount: '500' })).toBe('sent');
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('10');
  });
});
```

`apps/web/test/income-offline.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QueryClient,
  dehydrate,
  hydrate,
  onlineManager,
  type DehydratedState,
} from '@tanstack/vue-query';
import { defaultQueryOptions } from '../src/app/query.js';
import { ACCOUNTS_KEY } from '../src/modules/accounts/offline.js';
import { CREATE_INFLOW_KEY, registerIncomeMutations } from '../src/modules/income/offline.js';
import { inflowDto, SOURCE_ID } from './fixtures/income.js';
import { acc, json } from './fixtures/income-mount.js';

const OWNER = '99999999-9999-4999-8999-999999999999';
const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
const clients: QueryClient[] = [];
const newClient = () => {
  const client = new QueryClient({ defaultOptions: defaultQueryOptions });
  client.mount();
  clients.push(client);
  return client;
};
async function whenPaused(client: QueryClient): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (
      client
        .getMutationCache()
        .getAll()
        .some((m) => m.state.isPaused)
    )
      return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('The mutation never paused');
}
const run = (client: QueryClient, vars: unknown) =>
  client
    .getMutationCache()
    .build(client, {
      ...client.getMutationDefaults(CREATE_INFLOW_KEY),
      mutationKey: CREATE_INFLOW_KEY,
    })
    .execute(vars);

afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) client.unmount();
});

describe('an inflow recorded offline', () => {
  it('is persisted while paused and posted by the next tab', async () => {
    const offline = newClient();
    registerIncomeMutations(
      offline,
      {
        fetch: async () => {
          throw new TypeError('Failed to fetch');
        },
      },
      () => OWNER,
    );
    onlineManager.setOnline(false);
    void run(offline, {
      ownerId: OWNER,
      input: { incomeSourceId: SOURCE_ID, amount: '500' },
    }).catch(() => undefined);
    await whenPaused(offline);
    const persisted = JSON.parse(JSON.stringify(dehydrate(offline))) as DehydratedState;
    expect(persisted.mutations).toHaveLength(1);

    onlineManager.setOnline(true);
    const fetch = vi.fn(async (_path: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(inflowDto, 201) : json([]),
    );
    const restored = newClient();
    registerIncomeMutations(restored, { fetch }, () => OWNER);
    hydrate(restored, persisted);
    await restored.resumePausedMutations();

    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/inflows');
    // The owner id decides whether the write may travel; it is never part of the body.
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      incomeSourceId: SOURCE_ID,
      amount: '500',
    });
  }, 15000);

  it("is never sent under another account's token, and does not roll that account's cache back to the previous owner's", async () => {
    const fetch = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(inflowDto, 201),
    );
    const client = newClient();
    registerIncomeMutations(client, { fetch }, () => 'somebody-else');
    const theirs = [acc(ACCOUNT_ID, 'USD', { balance: '77' })];
    client.setQueryData(ACCOUNTS_KEY, theirs);

    await expect(
      run(client, {
        ownerId: OWNER,
        input: { incomeSourceId: SOURCE_ID, amount: '500', accountId: ACCOUNT_ID },
      }),
    ).rejects.toThrow();

    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    // The optimistic +500 is undone by a refetch, not by restoring a snapshot: after a real
    // sign-out/sign-in that snapshot would be the previous person's accounts.
    const state = client.getQueryState(ACCOUNTS_KEY);
    expect(state?.isInvalidated).toBe(true);
  });
});
```

`apps/web/test/InflowSheet.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import InflowSheet from '../src/modules/income/ui/InflowSheet.vue';
import { inflowDto, sourceDto, SOURCE_ID } from './fixtures/income.js';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const USD_ACC = '33333333-3333-4333-8333-333333333333';
const EUR_ACC = '44444444-4444-4444-8444-444444444444';
const body = () => new DOMWrapper(document.body);
const postBodies = (calls: [string, RequestInit | undefined][], path: string) =>
  calls
    .filter(([p, i]) => p === path && i?.method === 'POST')
    .map(([, i]) => JSON.parse(i?.body as string));

function api(
  calls: [string, RequestInit | undefined][],
  sources = [{ ...sourceDto, defaultAccountId: USD_ACC }],
) {
  return apiOf((path, init) => {
    calls.push([path, init]);
    if (path === '/income-sources' && init?.method === 'POST')
      return json(
        { ...sourceDto, id: '77777777-7777-4777-8777-777777777777', name: 'Gift', currency: 'EUR' },
        201,
      );
    if (path === '/income-sources') return json(sources);
    if (path === '/inflows' && init?.method === 'POST') return json(inflowDto, 201);
    if (path.startsWith('/inflows') && init?.method === 'PATCH') return json(inflowDto);
    if (path.startsWith('/inflows') && init?.method === 'DELETE')
      return new Response(null, { status: 204 });
    if (path === '/accounts') return json([acc(USD_ACC, 'USD'), acc(EUR_ACC, 'EUR')]);
    return undefined;
  });
}

describe('InflowSheet', () => {
  it("defaults to the source's account, asks for the credited amount only across currencies, and posts both", async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls), {
      props: { open: true, sourceId: SOURCE_ID },
    });
    await flushPromises();
    expect((body().get('[data-testid="inflow-account"]').element as HTMLSelectElement).value).toBe(
      USD_ACC,
    );
    expect(body().find('[data-testid="inflow-credited"]').exists()).toBe(false);

    await body().get('[data-testid="inflow-account"]').setValue(EUR_ACC);
    await body().get('[data-testid="inflow-amount"]').setValue('116');
    expect(body().find('[data-testid="inflow-credited"]').exists()).toBe(true);
    // 116 USD at 1 EUR = 1.16 USD
    expect(body().get('[data-testid="inflow-hint"]').text()).toContain('100');
    await body().get('[data-testid="inflow-credited"]').setValue('98');
    expect(body().get('[data-testid="inflow-rate"]').text()).toContain('0.8448275862');

    await body().get('form').trigger('submit');
    await flushPromises();
    const [posted] = postBodies(calls, '/inflows');
    expect(posted).toMatchObject({
      incomeSourceId: SOURCE_ID,
      amount: '116',
      accountId: EUR_ACC,
      creditedAmount: '98',
    });
    // Untouched date: the server stamps today.
    expect(posted).not.toHaveProperty('receivedOn');
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
    wrapper.unmount();
  });

  it('records an inflow without an account, and sends the date once it was touched', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls, [sourceDto]), {
      props: { open: true, sourceId: SOURCE_ID },
    });
    await flushPromises();
    await body().get('[data-testid="inflow-amount"]').setValue('500');
    const date = body().get('[data-testid="inflow-date"]');
    await date.setValue('2026-09-01');
    await date.trigger('change');
    await body().get('form').trigger('submit');
    await flushPromises();
    const [posted] = postBodies(calls, '/inflows');
    expect(posted).toEqual({
      incomeSourceId: SOURCE_ID,
      amount: '500',
      receivedOn: '2026-09-01',
      note: null,
    });
    wrapper.unmount();
  });

  it('creates a source on the fly — no gross, no pay days — and records against it', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls), { props: { open: true } });
    await flushPromises();
    await body().get('[data-testid="inflow-source"]').setValue('__new__');
    await body().get('[data-testid="inflow-new-name"]').setValue('Gift');
    await body().get('[data-testid="inflow-new-currency"]').setValue('EUR');
    await body().get('[data-testid="inflow-amount"]').setValue('50');
    await body().get('form').trigger('submit');
    await flushPromises();
    expect(postBodies(calls, '/income-sources')[0]).toMatchObject({
      name: 'Gift',
      currency: 'EUR',
      grossAmount: '0',
      payDays: [],
      isPrimary: false,
      taxRate: '0',
      commissionRate: '0',
    });
    expect(postBodies(calls, '/inflows')[0]).toMatchObject({
      incomeSourceId: '77777777-7777-4777-8777-777777777777',
      amount: '50',
    });
    wrapper.unmount();
  });

  it('edits an existing inflow, and says in its own words why a frozen one cannot change', async () => {
    toast.mockClear();
    const calls: [string, RequestInit | undefined][] = [];
    const credited = { ...inflowDto, accountId: USD_ACC, creditedAmount: '500' };
    const fetch = apiOf((path, init) => {
      calls.push([path, init]);
      if (init?.method === 'PATCH') return json({ code: 'inflow_not_latest', message: 'x' }, 409);
      if (path === '/income-sources') return json([sourceDto]);
      if (path === '/accounts') return json([acc(USD_ACC, 'USD')]);
      return undefined;
    });
    const { wrapper } = await mountAt(InflowSheet, '/', fetch, {
      props: { open: true, inflow: credited },
    });
    await flushPromises();
    expect((body().get('[data-testid="inflow-amount"]').element as HTMLInputElement).value).toBe(
      '500',
    );
    expect(body().get('[data-testid="inflow-source"]').attributes('disabled')).toBeDefined();
    await body().get('[data-testid="inflow-amount"]').setValue('600');
    await body().get('form').trigger('submit');
    await flushPromises();
    expect(calls.some(([p, i]) => p === `/inflows/${inflowDto.id}` && i?.method === 'PATCH')).toBe(
      true,
    );
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('самое свежее'));
    expect(wrapper.emitted('update:open')).toBeUndefined();
    wrapper.unmount();
  });
});
```

Append to `apps/web/test/BalanceTimeline.test.ts` (inside the `describe`):

```ts
it('says which entries an inflow wrote, and offers no edit for them', () => {
  const w = mount(BalanceTimeline, {
    props: {
      entries: [
        { ...entry('9', '600'), origin: 'inflow' as const, inflowId: 'i' },
        entry('2', '100'),
      ],
      currency: 'USD',
      scale: 2,
      editableId: null,
    },
    global: { plugins: [createI18n({ legacy: false, locale: 'ru', messages: { ru } })] },
  });
  const row = w.get('[data-testid="balance-entry-9"]');
  expect(row.text()).toContain('поступление');
  expect(row.attributes('disabled')).toBeDefined();
});
```

If `BalanceEntryDto` now requires `inflowId` (Task 6), add `inflowId: null` to this file's `entry()` helper too.

`apps/web/test/quick-actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import QuickActions from '../src/app/QuickActions.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

describe('QuickActions', () => {
  it('offers the inflow even before there is an account, and the account actions only once there is one', async () => {
    const { wrapper } = await mountAt(
      QuickActions,
      '/',
      apiOf(() => undefined),
    );
    await flushPromises();
    await wrapper.get('[data-testid="fab"]').trigger('click');
    const body = new DOMWrapper(document.body);
    expect(body.find('[data-testid="quick-inflow"]').exists()).toBe(true);
    expect(body.find('[data-testid="quick-record"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps all three actions on home when accounts exist, and hides the button elsewhere', async () => {
    const fetch = apiOf((p) =>
      p === '/accounts' ? json([acc('33333333-3333-4333-8333-333333333333', 'USD')]) : undefined,
    );
    const home = await mountAt(QuickActions, '/', fetch);
    await flushPromises();
    await home.wrapper.get('[data-testid="fab"]').trigger('click');
    const body = new DOMWrapper(document.body);
    for (const id of ['quick-record', 'quick-transfer', 'quick-inflow'])
      expect(body.find(`[data-testid="${id}"]`).exists()).toBe(true);
    home.wrapper.unmount();

    const plan = await mountAt(QuickActions, '/plan', fetch);
    await flushPromises();
    expect(plan.wrapper.find('[data-testid="fab"]').exists()).toBe(false);
    plan.wrapper.unmount();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd apps/web && bunx vitest run test/BalanceTimeline.test.ts test/use-create-inflow.test.ts test/income-offline.test.ts test/InflowSheet.test.ts test/quick-actions.test.ts`
Expected: FAIL — the timeline has no word for an inflow entry; `useCreateInflow` is not exported, `income/offline.js` and `InflowSheet.vue` cannot be resolved, `quick-inflow` is not found and the FAB is absent with no accounts.

- [ ] **Step 3: Write the mutation defaults**

`apps/web/src/modules/income/application/mutation-defaults.ts`:

```ts
import type { QueryClient, QueryKey } from '@tanstack/vue-query';
import type {
  AccountDto,
  CreateInflowInput,
  IncomeSourceDto,
  InflowDto,
} from '@magermoney/contracts';
import { Decimal } from '@magermoney/domain';
import { ACCOUNTS_KEY } from '@/modules/accounts/offline';
import type { ApiClient } from '@/shared/api/client';
import { assertOwner, ForeignWriteError } from '@/shared/api/offline-write';
import { inflowsApi } from '../infrastructure/inflows-api';
import { INCOME_SOURCES_KEY } from './use-income-sources';
import { invalidateAfterInflow } from './invalidate';
import { INFLOWS_KEY, matchesInflowParams, type InflowParams } from './use-inflows';

/**
 * Salary lands while a person is on the metro. Recording an inflow therefore
 * survives a closed tab exactly like recording a balance: a stable key, and
 * defaults registered on the client, so a mutation restored from IndexedDB with
 * no screen behind it still knows what to send and what to patch.
 */
export const CREATE_INFLOW_KEY = ['inflows', 'create'] as const;

export interface CreateInflowVars {
  /** Who made the write; checked against the session before it is sent, never part of the body. */
  ownerId: string | null;
  input: CreateInflowInput;
}
export interface CreateInflowContext {
  prevAccounts: AccountDto[] | undefined;
  prevInflows: [QueryKey, InflowDto[] | undefined][];
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** The row the lists show until the server answers. Never parsed against the contract: it lives only in the cache. */
function optimisticInflow(queryClient: QueryClient, input: CreateInflowInput): InflowDto {
  const source = queryClient
    .getQueryData<IncomeSourceDto[]>(INCOME_SOURCES_KEY)
    ?.find((s) => s.id === input.incomeSourceId);
  return {
    id: `optimistic-${Date.now()}`,
    incomeSourceId: input.incomeSourceId,
    amount: input.amount,
    currency: input.currency ?? source?.currency ?? '',
    receivedOn: input.receivedOn ?? todayIso(),
    realisedRateToUsd: input.realisedRateToUsd ?? null,
    accountId: input.accountId ?? null,
    creditedAmount: input.accountId ? (input.creditedAmount ?? input.amount) : null,
    realisedRate: null,
    note: input.note ?? null,
  };
}

export function registerIncomeMutations(
  queryClient: QueryClient,
  client: ApiClient,
  signedInId: () => string | null = () => null,
): void {
  const api = inflowsApi(client);
  queryClient.setMutationDefaults(CREATE_INFLOW_KEY, {
    mutationFn: ({ ownerId, input }: CreateInflowVars): Promise<InflowDto> => {
      assertOwner(ownerId, signedInId());
      return api.create(input);
    },
    // The receipt appears in every list whose window and source it falls into,
    // and a credited Account grows by what reached it — the credited amount
    // when currencies differ, the inflow amount otherwise. No float: the sum is
    // a Decimal and goes back into the cache as the string it came as.
    onMutate: async ({ input }: CreateInflowVars): Promise<CreateInflowContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: INFLOWS_KEY }),
        queryClient.cancelQueries({ queryKey: ACCOUNTS_KEY }),
      ]);
      const prevAccounts = queryClient.getQueryData<AccountDto[]>(ACCOUNTS_KEY);
      const prevInflows = queryClient.getQueriesData<InflowDto[]>({ queryKey: INFLOWS_KEY });
      const row = optimisticInflow(queryClient, input);
      for (const [key, list] of prevInflows) {
        const params = key[1] as InflowParams | undefined;
        // `['inflows', 'create']` is this mutation's own key, not a list.
        if (!params || typeof params !== 'object' || !matchesInflowParams(row, params)) continue;
        queryClient.setQueryData<InflowDto[]>(key, [row, ...(list ?? [])]);
      }
      if (input.accountId) {
        const credit = input.creditedAmount ?? input.amount;
        queryClient.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
          (list ?? []).map((a) =>
            a.id === input.accountId
              ? { ...a, balance: new Decimal(a.balance ?? '0').plus(credit).toFixed() }
              : a,
          ),
        );
      }
      return { prevAccounts, prevInflows };
    },
    onError: (e: unknown, _vars: CreateInflowVars, ctx: CreateInflowContext | undefined): void => {
      // A write refused because it belongs to another account carries that
      // account's snapshot. Restoring it would paint the previous person's
      // money into this person's cache; the refetch in `onSettled` undoes the
      // optimistic patch instead.
      if (!ctx || e instanceof ForeignWriteError) return;
      if (ctx.prevAccounts) queryClient.setQueryData(ACCOUNTS_KEY, ctx.prevAccounts);
      for (const [key, list] of ctx.prevInflows) queryClient.setQueryData(key, list);
    },
    onSettled: (
      _d: InflowDto | undefined,
      _e: unknown,
      { input }: CreateInflowVars,
    ): Promise<unknown> =>
      invalidateAfterInflow(queryClient, input.accountId ? [input.accountId] : []),
  });
}
```

In the foreign-write test the Account list has no `balancesKey` observers, and `invalidateQueries` on `ACCOUNTS_KEY` is what flips `isInvalidated`; `onSettled` runs after `onError` for a rejected `mutationFn`, so the assertion holds.

- [ ] **Step 4: Add `useCreateInflow`, the offline entry, and wire the composition root**

Append to `apps/web/src/modules/income/application/use-inflow-mutations.ts` (add `computed` from `vue`, `CreateInflowInput`, `InflowDto` from contracts, `settledOrParked`, `useOwnerId` to the imports):

```ts
import {
  CREATE_INFLOW_KEY,
  registerIncomeMutations,
  type CreateInflowVars,
} from './mutation-defaults';

/**
 * What recording an inflow does — the POST, the optimistic receipt and balance,
 * the rollback — lives in the client's mutation defaults, so one that paused
 * offline and was restored from IndexedDB behaves exactly like one this screen
 * started.
 */
export function useCreateInflow() {
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  registerIncomeMutations(qc, useApi(), ownerId);
  const m = useMutation<InflowDto, Error, CreateInflowVars>({ mutationKey: CREATE_INFLOW_KEY });
  return {
    /** Resolves `'parked'` when the write is waiting for a connection, so the sheet can close. */
    create: (input: CreateInflowInput) =>
      settledOrParked(m.mutateAsync({ ownerId: ownerId(), input }), m.isPaused),
    // A parked write is not pending on anything the person should wait for.
    isPending: computed(() => m.isPending.value && !m.isPaused.value),
  };
}
```

`apps/web/src/modules/income/offline.ts`:

```ts
/**
 * The income module's second public entry, for the composition root only: the
 * keys and the mutation registration a restored offline write needs, with no
 * screen behind them (see `modules/accounts/offline.ts`).
 */
export { INCOME_SOURCES_KEY } from './application/use-income-sources';
export { INFLOWS_KEY, inflowsKey } from './application/use-inflows';
export {
  CREATE_INFLOW_KEY,
  registerIncomeMutations,
  type CreateInflowVars,
} from './application/mutation-defaults';
```

`use-inflows.ts` and `use-income-sources.ts` import `@/modules/currencies` (a barrel with no screens) — nothing routed reaches the entry chunk through this file; Step 9 checks it.

In `apps/web/src/modules/income/index.ts` add:

```ts
export { CREATE_INFLOW_KEY, registerIncomeMutations, type CreateInflowVars } from './offline';
export { useCreateInflow } from './application/use-inflow-mutations';
export { default as InflowSheet } from './ui/InflowSheet.vue';
```

In `apps/web/src/app/main.ts` add the import `import { registerIncomeMutations } from '@/modules/income/offline';` and, after `registerTransferMutations(queryClient, api, ownerId);`:

```ts
registerIncomeMutations(queryClient, api, ownerId);
```

In `apps/web/src/app/query.ts` add `import { INFLOWS_KEY } from '@/modules/income/offline';` and a third line to `replayOfflineMutations`' `Promise.all`:

```ts
    client.invalidateQueries({ queryKey: INFLOWS_KEY }),
```

- [ ] **Step 5: Add the copy**

`ru.json` — new top-level `inflows`, `"inflow": "Поступление"` inside `quick`, and `"byInflow": "поступление"` inside `accounts.detail` (next to `byTransfer`):

```json
"inflows": {
  "title": "Поступление", "editTitle": "Изменить поступление",
  "source": "Откуда", "newSource": "Новый источник…", "newName": "Название источника", "newCurrency": "Валюта источника",
  "amount": "Сколько пришло", "date": "Когда",
  "account": "Зачислить на счёт", "noAccount": "Не зачислять",
  "credited": "Сколько пришло на счёт", "hint": "по курсу дня ≈ {amount}", "rate": "Курс: 1 {from} = {rate} {to}",
  "more": "Ещё", "usdRate": "Курс к доллару в этот день", "usdRateHint": "Сколько долларов дали за 1 {code}. Пусто — возьмём из таблицы курсов.",
  "note": "Заметка", "save": "Записать", "update": "Сохранить", "delete": "Удалить",
  "record": "Записать поступление", "failed": "Не получилось записать. Попробуйте ещё раз."
}
```

`en.json` — `"inflow": "Inflow"` inside `quick`, `"byInflow": "inflow"` inside `accounts.detail`, and:

```json
"inflows": {
  "title": "Inflow", "editTitle": "Edit inflow",
  "source": "From", "newSource": "New source…", "newName": "Source name", "newCurrency": "Source currency",
  "amount": "Amount received", "date": "When",
  "account": "Credit to account", "noAccount": "Don't credit",
  "credited": "Amount that reached the account", "hint": "at today's rate ≈ {amount}", "rate": "Rate: 1 {from} = {rate} {to}",
  "more": "More", "usdRate": "Rate to the dollar that day", "usdRateHint": "Dollars per 1 {code}. Leave empty to use the rates table.",
  "note": "Note", "save": "Record", "update": "Save", "delete": "Delete",
  "record": "Record an inflow", "failed": "Couldn't record that. Try again."
}
```

Run `/humanize-text:humanize-text` over both.

- [ ] **Step 6: Run `/frontend-design`, then write `InflowSheet.vue`**

Brief: a sibling of `TransferSheet` and `RecordBalanceSheet` — bottom sheet, 12px muted labels, the amount as the one big mono field with focus on open; the source is the first control because it decides the currency printed beside the amount label; "credited" appears in place, under the account, only when the currencies differ, with the day-rate hint and the derived rate as two quiet lines exactly as the transfer sheet does; "More" is a plain disclosure, closed by default, holding the one rarely used field. Nothing is coloured.

`apps/web/src/modules/income/ui/InflowSheet.vue`:

```vue
<script setup lang="ts">
/**
 * Money that arrived. The source decides the currency; an Account is optional,
 * and when its currency differs the person types what actually reached it — the
 * app never converts a balance by itself (ADR 0002). The day's rate is a hint,
 * the realised rate is derived once both numbers are in.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { InflowDto } from '@magermoney/contracts';
import { Money, deriveInflowCredit, type Currency } from '@magermoney/domain';
import {
  Button,
  Input,
  MoneyInput,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useToast,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useRates } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useIncomeSources } from '../application/use-income-sources';
import { useCreateIncomeSource } from '../application/use-income-source-mutations';
import {
  useCreateInflow,
  useDeleteInflow,
  useUpdateInflow,
} from '../application/use-inflow-mutations';

const props = defineProps<{ open: boolean; sourceId?: string; inflow?: InflowDto }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const NEW_SOURCE = '__new__';
const NO_ACCOUNT = '';

const { t, locale } = useI18n();
const uiLocale = computed(() => locale.value as DateLocale);
const { toast } = useToast();
const { dtos: sources } = useIncomeSources();
const { accounts } = useAccounts();
const currencies = useCurrencies();
const registry = useCurrencyRegistry();
const rates = useRates();
const { create, isPending: creating } = useCreateInflow();
const { update, isPending: updating } = useUpdateInflow();
const { remove } = useDeleteInflow();
const { create: createSource, isPending: creatingSource } = useCreateIncomeSource();

const source = ref('');
const newName = ref('');
const newCurrency = ref('USD');
const amount = ref('');
const receivedOn = ref(todayIso());
/** The server's "today" is the truth for an untouched date; the field's default is only what the person sees. */
const dateTouched = ref(false);
const accountId = ref(NO_ACCOUNT);
const credited = ref('');
const usdRate = ref('');
const more = ref(false);
const note = ref('');

const today = todayIso();
const currentSources = computed(() =>
  sources.value.filter(
    (s) => s.activeTo === null || s.activeTo >= today || s.id === props.inflow?.incomeSourceId,
  ),
);
const activeAccounts = computed(() =>
  accounts.value.filter((a) => a.archivedAt === null || a.id === props.inflow?.accountId),
);
const chosenSource = computed(() => sources.value.find((s) => s.id === source.value));

function reset() {
  const i = props.inflow;
  source.value = i?.incomeSourceId ?? props.sourceId ?? currentSources.value[0]?.id ?? NEW_SOURCE;
  newName.value = '';
  amount.value = i?.amount ?? '';
  receivedOn.value = i?.receivedOn ?? todayIso();
  dateTouched.value = false;
  accountId.value = i
    ? (i.accountId ?? NO_ACCOUNT)
    : (chosenSource.value?.defaultAccountId ?? NO_ACCOUNT);
  credited.value = i?.creditedAmount ?? '';
  usdRate.value = i?.realisedRateToUsd ?? '';
  more.value = Boolean(i?.realisedRateToUsd);
  note.value = i?.note ?? '';
}
watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
  { immediate: true },
);
/** The sheet can open before the lists arrive; the defaults are re-read once, as long as nothing was typed. */
watch([sources, accounts], () => {
  if (props.open && amount.value === '' && !props.inflow) reset();
});
/** Choosing another source moves the account to that source's usual one. */
watch(source, (id, before) => {
  if (!before || props.inflow) return;
  accountId.value = sources.value.find((s) => s.id === id)?.defaultAccountId ?? NO_ACCOUNT;
});

const isNew = computed(() => source.value === NEW_SOURCE);
const currencyCode = computed(() =>
  isNew.value ? newCurrency.value : (props.inflow?.currency ?? chosenSource.value?.currency ?? ''),
);
const account = computed(() => accounts.value.find((a) => a.id === accountId.value));
const cross = computed(() =>
  Boolean(account.value && account.value.currency !== currencyCode.value),
);
const scaleOf = (code: string | undefined) =>
  currencies.value.find((c) => c.code === code)?.scale ?? 2;
const currencyOf = (code: string): Currency =>
  registry.value.get(code).unwrapOr({ code, kind: 'fiat', scale: scaleOf(code) });

const hint = computed(() => {
  if (!cross.value || !account.value || amount.value === '' || !rates.table.value) return null;
  return rates.table.value
    .convert(Money.of(amount.value, currencyOf(currencyCode.value)), account.value.currency)
    .match(
      (m) => m.round().toString(),
      () => null,
    );
});
const realised = computed(() => {
  if (!cross.value || !account.value || amount.value === '' || credited.value === '') return null;
  const accountCurrency = currencyOf(account.value.currency);
  return deriveInflowCredit({
    amount: Money.of(amount.value, currencyOf(currencyCode.value)),
    accountCurrency,
    creditedAmount: Money.of(credited.value, accountCurrency),
  }).match(
    (d) => d.realisedRate?.toFixed() ?? null,
    () => null,
  );
});
const busy = computed(() => creating.value || updating.value || creatingSource.value);
const canSubmit = computed(
  () =>
    amount.value !== '' &&
    amount.value !== '0' &&
    (isNew.value ? newName.value.trim() !== '' : source.value !== '') &&
    (!cross.value || credited.value !== ''),
);

async function resolveSourceId(): Promise<string> {
  if (!isNew.value) return source.value;
  // A source born from a receipt expects nothing: no gross, no schedule. It is
  // irregular until the person says otherwise, and it starts the day the money came.
  const created = await createSource({
    name: newName.value.trim(),
    grossAmount: '0',
    currency: newCurrency.value,
    taxRate: '0',
    commissionRate: '0',
    payDays: [],
    isPrimary: false,
    activeFrom: receivedOn.value,
  });
  return created.id;
}

async function submit() {
  if (!canSubmit.value) return;
  try {
    const credit = account.value
      ? { accountId: account.value.id, ...(cross.value ? { creditedAmount: credited.value } : {}) }
      : {};
    const rate = usdRate.value === '' ? {} : { realisedRateToUsd: usdRate.value };
    const noteValue = note.value.trim() || null;
    let parked = false;
    if (props.inflow) {
      const before = props.inflow.accountId;
      await update(
        props.inflow.id,
        {
          amount: amount.value,
          ...(dateTouched.value ? { receivedOn: receivedOn.value } : {}),
          // `null` removes the credit; an unchanged account is sent again so a new amount re-applies to it.
          ...(account.value ? credit : { accountId: null }),
          realisedRateToUsd: usdRate.value === '' ? null : usdRate.value,
          note: noteValue,
        },
        [before, account.value?.id].filter((x): x is string => Boolean(x)),
      );
    } else {
      const incomeSourceId = await resolveSourceId();
      parked =
        (await create({
          incomeSourceId,
          amount: amount.value,
          ...(dateTouched.value ? { receivedOn: receivedOn.value } : {}),
          ...credit,
          ...rate,
          note: noteValue,
        })) === 'parked';
    }
    emit('update:open', false);
    if (parked) toast(t('offline.saved'));
  } catch (e) {
    toast(t(errorKeyFor(e, 'inflows.failed')));
  }
}

async function del() {
  if (!props.inflow) return;
  try {
    await remove(props.inflow.id, props.inflow.accountId ? [props.inflow.accountId] : []);
    emit('update:open', false);
  } catch (e) {
    toast(t(errorKeyFor(e, 'inflows.failed')));
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent
      side="bottom"
      class="max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <SheetHeader>
        <SheetTitle>{{ inflow ? t('inflows.editTitle') : t('inflows.title') }}</SheetTitle>
      </SheetHeader>
      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('inflows.source') }}</span>
          <select
            v-model="source"
            data-testid="inflow-source"
            :disabled="Boolean(inflow)"
            class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
          >
            <option v-for="s in currentSources" :key="s.id" :value="s.id">
              {{ s.name }} · {{ s.currency }}
            </option>
            <option v-if="!inflow" :value="NEW_SOURCE">{{ t('inflows.newSource') }}</option>
          </select>
        </label>

        <div v-if="isNew" class="grid grid-cols-[1fr_7rem] gap-3">
          <label class="block">
            <span class="text-xs font-medium text-muted-foreground">{{
              t('inflows.newName')
            }}</span>
            <Input v-model="newName" maxlength="80" data-testid="inflow-new-name" class="mt-1" />
          </label>
          <label class="block">
            <span class="text-xs font-medium text-muted-foreground">{{
              t('inflows.newCurrency')
            }}</span>
            <select
              v-model="newCurrency"
              data-testid="inflow-new-currency"
              class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
            >
              <option v-for="c in currencies" :key="c.code" :value="c.code">{{ c.code }}</option>
            </select>
          </label>
        </div>

        <label class="block">
          <span class="text-xs font-medium text-muted-foreground"
            >{{ t('inflows.amount') }} · {{ currencyCode }}</span
          >
          <MoneyInput
            v-model="amount"
            data-testid="inflow-amount"
            :scale="scaleOf(currencyCode)"
            :locale="uiLocale"
            class="mt-1"
            autofocus
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('inflows.date') }}</span>
          <Input
            v-model="receivedOn"
            type="date"
            :max="today"
            class="mt-1"
            data-testid="inflow-date"
            @change="dateTouched = true"
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('inflows.account') }}</span>
          <select
            v-model="accountId"
            data-testid="inflow-account"
            class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
          >
            <option :value="NO_ACCOUNT">{{ t('inflows.noAccount') }}</option>
            <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
              {{ a.name }} · {{ a.balance ?? '0' }} {{ a.currency }}
            </option>
          </select>
        </label>

        <label v-if="cross" class="block">
          <span class="text-xs font-medium text-muted-foreground"
            >{{ t('inflows.credited') }} · {{ account?.currency }}</span
          >
          <MoneyInput
            v-model="credited"
            data-testid="inflow-credited"
            :scale="scaleOf(account?.currency)"
            :locale="uiLocale"
            class="mt-1"
          />
          <span
            v-if="hint"
            data-testid="inflow-hint"
            class="mt-1 block text-xs text-muted-foreground"
          >
            {{ t('inflows.hint', { amount: `${hint} ${account?.currency}` }) }}
          </span>
          <span
            v-if="realised"
            data-testid="inflow-rate"
            class="mt-1 block text-xs text-muted-foreground"
          >
            {{ t('inflows.rate', { from: currencyCode, to: account?.currency, rate: realised }) }}
          </span>
        </label>

        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="min-h-9 pointer-coarse:min-h-11"
            :aria-expanded="more"
            aria-controls="inflow-more-fields"
            data-testid="inflow-more"
            @click="more = !more"
          >
            {{ t('inflows.more') }}
          </Button>
          <div v-if="more" id="inflow-more-fields" class="mt-2 space-y-4">
            <label class="block">
              <span class="text-xs font-medium text-muted-foreground">{{
                t('inflows.usdRate')
              }}</span>
              <MoneyInput
                v-model="usdRate"
                data-testid="inflow-usd-rate"
                :scale="10"
                :locale="uiLocale"
                class="mt-1 h-11 text-base"
              />
              <span class="mt-1 block text-xs text-muted-foreground">{{
                t('inflows.usdRateHint', { code: currencyCode })
              }}</span>
            </label>
            <label class="block">
              <span class="text-xs font-medium text-muted-foreground">{{ t('inflows.note') }}</span>
              <Input v-model="note" maxlength="1000" class="mt-1" />
            </label>
          </div>
        </div>

        <div class="flex gap-2">
          <Button
            type="submit"
            size="lg"
            class="min-h-9 flex-1 pointer-coarse:min-h-11"
            :disabled="!canSubmit || busy"
            data-testid="inflow-save"
          >
            {{ inflow ? t('inflows.update') : t('inflows.save') }}
          </Button>
          <Button
            v-if="inflow"
            type="button"
            size="lg"
            variant="destructive"
            class="min-h-9 pointer-coarse:min-h-11"
            data-testid="inflow-delete"
            @click="del"
          >
            {{ t('inflows.delete') }}
          </Button>
        </div>
      </form>
    </SheetContent>
  </Sheet>
</template>
```

Three notes for the implementer. An edit of a credited cross-currency inflow always resends `creditedAmount` together with `accountId` (the `credit` spread) — the API recomputes the Account's entry from both and refuses one without the other (`credited_amount_required`). The second test expects the POST body to equal `{ incomeSourceId, amount, receivedOn, note: null }` — no `accountId` key when nothing is credited, no `realisedRateToUsd` key when the field is empty; keep the spreads as written. Creating a source on the fly is an ordinary (not parked) request: offline it fails with the generic message and the sheet stays open with everything typed — record the ruling below.

- [ ] **Step 7: Wire the sheet into the source page and the quick actions**

In `apps/web/src/modules/income/ui/IncomeSourcePage.vue`: import `InflowSheet from './InflowSheet.vue'` and `type { InflowDto } from '@magermoney/contracts'`; add

```ts
const sheetOpen = ref(false);
const editing = ref<InflowDto | undefined>();
function openSheet(inflow?: InflowDto) {
  editing.value = inflow;
  sheetOpen.value = true;
}
```

put a primary button first in the actions row:

```vue
<Button
  class="min-h-9 pointer-coarse:min-h-11"
  data-testid="source-record-inflow"
  @click="openSheet()"
>
        {{ t('inflows.record') }}
      </Button>
```

change the row to `<InflowRow :inflow="i" :account-name="accountName(i.accountId)" @select="openSheet" />`, and add before `<AlertDialog>`:

```vue
<InflowSheet v-model:open="sheetOpen" :source-id="dto.id" :inflow="editing" />
```

In `apps/web/src/modules/accounts/ui/BalanceTimeline.vue`, after the `byTransfer` badge, add:

```vue
<Badge v-else-if="e.origin === 'inflow'" variant="secondary">
          {{ t('accounts.detail.byInflow') }}
        </Badge>
```

Replace `apps/web/src/app/QuickActions.vue`'s script and menu:

```vue
<script setup lang="ts">
/** The "+" on Home and Accounts: record a balance (pick the account first), make a transfer, or record an inflow. */
import { computed, defineAsyncComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@magermoney/ui';
import { RecordBalanceSheet, useAccounts } from '@/modules/accounts';
import { TransferSheet } from '@/modules/transfers';

/**
 * Lazy, unlike its two neighbours: the income barrel is otherwise reached only
 * through routed screens, and a static import here would put the whole module
 * into the entry chunk for a sheet most sessions never open.
 */
const InflowSheet = defineAsyncComponent(() =>
  import('@/modules/income').then((m) => m.InflowSheet),
);

const { t } = useI18n();
const route = useRoute();
const { accounts } = useAccounts();
const menu = ref(false);
const pick = ref(false);
const record = ref(false);
const transfer = ref(false);
const inflow = ref(false);
/** Mounted on first use, so the chunk is not fetched until someone asks for it. */
const inflowWanted = ref(false);
const chosen = ref('');
const active = computed(() => accounts.value.filter((a) => a.archivedAt === null));
/** The "+" belongs to the two screens about money on hand: the dashboard and the accounts list. */
const FAB_PATHS = ['/', '/accounts'];
const showFab = computed(() => FAB_PATHS.includes(route.path));
function choose(id: string) {
  chosen.value = id;
  pick.value = false;
  record.value = true;
}
function openInflow() {
  menu.value = false;
  inflowWanted.value = true;
  inflow.value = true;
}
</script>
```

In the template: the root becomes `<template v-if="showFab">`; wrap the two existing menu buttons in `<template v-if="active.length > 0"> … </template>`; add after them

```vue
<Button
  size="lg"
  variant="outline"
  class="min-h-9 pointer-coarse:min-h-11"
  data-testid="quick-inflow"
  @click="openInflow"
>
            {{ t('quick.inflow') }}
          </Button>
```

and after `<TransferSheet … />` add `<InflowSheet v-if="inflowWanted" v-model:open="inflow" />`.

- [ ] **Step 8: Run the tests to see them pass**

Run: `cd apps/web && bun run test && bun run typecheck && bun run lint`
Expected: PASS, including the older `offline-mutations.test.ts`, `RecordBalanceSheet.test.ts` and `TransferSheet.test.ts` (the accounts cache key and shape are untouched).

- [ ] **Step 9: Check the entry chunk, then `/animate` and `/impeccable`**

Run: `cd apps/web && bun run build && ls dist/assets | grep -iE "InflowSheet|IncomeSource|index-"`
Expected: `InflowSheet`/`IncomeSourcePage` code is not in the entry `index-*.js` — `grep -l "inflow-credited" dist/assets/*.js` names a lazy chunk, not the entry file. If it names the entry, something in `income/offline.ts`'s import graph reaches a `.vue` file; fix the import, not the test.

`/animate`: the "credited" block appears when the account changes — a 150ms fade only (no height animation inside a sheet that is already sliding); "More" opens instantly. `/impeccable` on `InflowSheet.vue` and `QuickActions.vue`: the sheet must scroll inside `92dvh` with the keyboard up on a 667px-tall phone and keep Save reachable; label–control association for the three native selects; the FAB's sheet lists three actions in the order balance · transfer · inflow. Re-run Step 8.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src apps/web/test docs/discovery/phase-3-execution-ledger.md
git commit -m "feat(web): record inflows from a sheet, parked offline and replayed"
```

Use `/git-commit`; end the message with the two trailers from Global Constraints. Rulings to append to `docs/discovery/phase-3-execution-ledger.md` in this commit: "`useCreateInflow().create` resolves `'sent' | 'parked'`, like the other parked writes, not the DTO."; "A source created from the inflow sheet starts on the inflow's date (today unless the date was changed), so a backdated first receipt is inside its active period."; "Creating that source is not parked offline — only the inflow itself is; offline, 'New source…' fails with the generic message and keeps the sheet open."; "The quick-action button now shows with zero accounts, because an inflow needs none; balance and transfer stay hidden until an account exists."; "A parked inflow refused as another account's write skips the snapshot rollback and relies on the refetch (closes the matching phase 2 follow-up for this mutation only)."; "The source picker is locked when editing an inflow; moving a receipt to another source is delete-and-recreate."

---

### Task 23: Web — `expenses` module: transport, grouping, segment and form

**Assumes** (from Tasks 18–19; adjust the import if a name differs): `Switch` (bound with `v-model`) exported from `@magermoney/ui`; `DayOfMonthPicker` from `@magermoney/ui`, which is multi-select by default and takes `:multiple="false"` for a single `v-model: number | null` (the billing day); `routeComponent(loader)` from `@/shared/layout/route-fallback`; routes `plan`, `expense-new` (`/plan/expenses/new`) and `expense-edit` (`/plan/expenses/:id/edit`) already registered by Task 19 and pointing at `@/modules/expenses` → `ExpenseFormPage`.

**Files:**

- Create: `apps/web/src/modules/expenses/infrastructure/expenses-api.ts`, `domain/mappers.ts`, `application/use-expenses.ts`, `application/use-expense-categories.ts`, `application/use-expense-mutations.ts`, `application/expense-groups.ts`, `ui/ExpensesSegment.vue`, `ui/ExpenseFormPage.vue`
- Replace: `apps/web/src/modules/expenses/index.ts` (Task 19 left a stub barrel there exporting only `ExpenseFormPage` → `PendingPage.vue`; the real barrel keeps that export name, which the router uses)
- Modify: `apps/web/src/locales/ru.json`, `apps/web/src/locales/en.json`, `apps/web/src/shared/api/error-messages.ts`
- Test: `apps/web/test/expenses-api.test.ts`, `apps/web/test/expense-groups.test.ts`, `apps/web/test/ExpensesSegment.test.ts`, `apps/web/test/ExpenseFormPage.test.ts`

**Interfaces:**

- Consumes: `ExpenseDtoSchema`, `ExpenseCategoryDtoSchema`, `ExpenseInput`, `UpdateExpenseInput` (contracts); `Expense`, `monthlyAmount`, `isActiveOn`, `Money`, `RateTable`, `CurrencyRegistry`, `EXPENSE_PERIODS` (domain); `useRates`, `useDisplayCurrency`, `MoneyText`, `todayIso` (`@/modules/rates`); `useCurrencies`, `useCurrencyRegistry` (`@/modules/currencies`).
- Produces (public `@/modules/expenses`): `useExpenses(): { expenses: ComputedRef<Expense[]>; dtos: ComputedRef<ExpenseDto[]>; isLoading: ComputedRef<boolean> }`, `useExpenseCategories(): { categories: ComputedRef<ExpenseCategoryDto[]> }`, `useCreateExpense()`, `useUpdateExpense()`, `useDeleteExpense()`, `toExpense(dto, registry): Expense`, `groupExpenses(...)`, `EXPENSES_KEY`, `ExpensesSegment` (sync), `ExpenseFormPage` (async). Test ids: `expense-row-<id>`, `expenses-planned`, `expenses-essential`, `expenses-empty`, `expense-form`, `expense-name`, `expense-amount`, `expense-category`, `expense-submit`, `expense-end`, `expense-delete`.

- [ ] **Step 1: Write the failing transport and grouping tests**

`apps/web/test/expenses-api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { expensesApi } from '../src/modules/expenses/infrastructure/expenses-api.js';

const dto = {
  id: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
  name: 'Rent',
  amount: '1400',
  currency: 'EUR',
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2026-01-01',
  activeTo: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('expensesApi', () => {
  it('lists expenses and categories through the contract', async () => {
    const fetch = vi.fn(async (path: string) =>
      path === '/expenses'
        ? json([dto])
        : json([{ id: dto.categoryId, name: 'Housing', icon: null, sortOrder: 0 }]),
    );
    const api = expensesApi({ fetch });
    expect((await api.list())[0]?.name).toBe('Rent');
    expect((await api.categories())[0]?.name).toBe('Housing');
  });

  it('posts a new expense with a category name', async () => {
    const fetch = vi.fn(async () => json(dto, 201));
    await expensesApi({ fetch }).create({
      categoryName: 'Housing',
      name: 'Rent',
      amount: '1400',
      currency: 'EUR',
      period: 'monthly',
      isEssential: true,
      activeFrom: '2026-01-01',
    });
    const [path, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/expenses');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body)).categoryName).toBe('Housing');
  });

  it('rejects a malformed body', async () => {
    const fetch = vi.fn(async () => json([{ id: 'nope' }]));
    await expect(expensesApi({ fetch }).list()).rejects.toThrow();
  });
});
```

`apps/web/test/expense-groups.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, Decimal, RateTable } from '@magermoney/domain';
import type { ExpenseCategoryDto, ExpenseDto } from '@magermoney/contracts';
import { groupExpenses } from '../src/modules/expenses/application/expense-groups.js';

const reg = CurrencyRegistry.default();
const table = new RateTable(
  '2026-09-17',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.2'), date: '2026-09-17', source: 'api' }],
  reg,
);
const cats: ExpenseCategoryDto[] = [
  { id: 'c1', name: 'Housing', icon: null, sortOrder: 0 },
  { id: 'c2', name: 'Subscriptions', icon: null, sortOrder: 1 },
];
const exp = (over: Partial<ExpenseDto>): ExpenseDto => ({
  id: 'e',
  categoryId: 'c1',
  name: 'Rent',
  amount: '1000',
  currency: 'EUR',
  period: 'monthly',
  billingDay: null,
  billingMonth: null,
  isEssential: false,
  activeFrom: '2026-01-01',
  activeTo: null,
  ...over,
});

describe('groupExpenses', () => {
  it('groups active expenses by category with monthly totals in the display currency', () => {
    const g = groupExpenses(
      [
        exp({ id: 'a', isEssential: true }),
        exp({
          id: 'b',
          categoryId: 'c2',
          name: 'IDE',
          amount: '120',
          currency: 'USD',
          period: 'yearly',
        }),
        exp({ id: 'c', name: 'Old', activeTo: '2026-06-30' }),
      ],
      cats,
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.groups.map((x) => x.category.name)).toEqual(['Housing', 'Subscriptions']);
    expect(g.groups[0]?.total.round().toString()).toBe('1200');
    expect(g.groups[1]?.rows[0]?.monthly.toString()).toBe('10');
    expect(g.planned.round().toString()).toBe('1210');
    expect(g.essential.round().toString()).toBe('1200');
    expect(g.ended.map((e) => e.id)).toEqual(['c']);
  });

  it('lists what it cannot convert instead of dropping it', () => {
    const g = groupExpenses(
      [exp({ id: 'x', currency: 'BTC', amount: '1' })],
      cats,
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.unconvertible.map((e) => e.id)).toEqual(['x']);
    expect(g.planned.toString()).toBe('0');
  });

  it('is undefined until rates and the display currency exist', () => {
    expect(groupExpenses([], cats, undefined, reg, 'USD', '2026-09-17')).toBeUndefined();
    expect(groupExpenses([], cats, table, reg, 'XXX', '2026-09-17')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bun run --filter @magermoney/web test -- expenses-api expense-groups`
Expected: FAIL — `Cannot find module '../src/modules/expenses/…'`.

- [ ] **Step 3: Transport, mapper, queries, mutations, grouping**

`infrastructure/expenses-api.ts`:

```ts
import {
  ExpenseCategoryDtoSchema,
  ExpenseDtoSchema,
  type ExpenseCategoryDto,
  type ExpenseDto,
  type ExpenseInput,
  type UpdateExpenseInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const expenseList = listOf(ExpenseDtoSchema);
const categoryList = listOf(ExpenseCategoryDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const expensesApi = (client: ApiClient) => ({
  list: async (): Promise<ExpenseDto[]> =>
    parse(await client.fetch('/expenses', { method: 'GET' }), expenseList),
  categories: async (): Promise<ExpenseCategoryDto[]> =>
    parse(await client.fetch('/expense-categories', { method: 'GET' }), categoryList),
  create: async (input: ExpenseInput): Promise<ExpenseDto> =>
    parse(
      await client.fetch('/expenses', { method: 'POST', body: JSON.stringify(input) }),
      ExpenseDtoSchema,
    ),
  update: async (id: string, input: UpdateExpenseInput): Promise<ExpenseDto> =>
    parse(
      await client.fetch(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      ExpenseDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/expenses/${id}`, { method: 'DELETE' }), noContent),
});
```

`domain/mappers.ts`:

```ts
import type { ExpenseDto } from '@magermoney/contracts';
import { Money, type Currency, type CurrencyRegistry, type Expense } from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

/** DTO → domain. An unknown currency still renders (scale 2); conversion then reports it as unconvertible. */
export function toExpense(dto: ExpenseDto, registry: CurrencyRegistry): Expense {
  const currency = registry.get(dto.currency).unwrapOr(fallback(dto.currency));
  return {
    id: dto.id,
    categoryId: dto.categoryId,
    name: dto.name,
    amount: Money.of(dto.amount, currency),
    period: dto.period,
    billingDay: dto.billingDay,
    billingMonth: dto.billingMonth,
    isEssential: dto.isEssential,
    activeFrom: dto.activeFrom,
    activeTo: dto.activeTo,
  };
}
```

`application/use-expenses.ts`:

```ts
import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { ExpenseDto } from '@magermoney/contracts';
import type { Expense } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toExpense } from '../domain/mappers';
import { expensesApi } from '../infrastructure/expenses-api';

export const EXPENSES_KEY = ['expenses'] as const;

/** Every expense, ended ones included: the segment decides what is current. */
export function useExpenses(): {
  expenses: ComputedRef<Expense[]>;
  dtos: ComputedRef<ExpenseDto[]>;
  isLoading: ComputedRef<boolean>;
} {
  const api = expensesApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: EXPENSES_KEY, queryFn: api.list });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    expenses: computed(() => dtos.value.map((d) => toExpense(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
  };
}
```

`application/use-expense-categories.ts`:

```ts
import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { ExpenseCategoryDto } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { expensesApi } from '../infrastructure/expenses-api';

export const EXPENSE_CATEGORIES_KEY = ['expense-categories'] as const;

export function useExpenseCategories(): { categories: ComputedRef<ExpenseCategoryDto[]> } {
  const api = expensesApi(useApi());
  const query = useQuery({ queryKey: EXPENSE_CATEGORIES_KEY, queryFn: api.categories });
  return { categories: computed(() => query.data.value ?? []) };
}
```

`application/use-expense-mutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { ExpenseInput, UpdateExpenseInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { expensesApi } from '../infrastructure/expenses-api';
import { EXPENSE_CATEGORIES_KEY } from './use-expense-categories';
import { EXPENSES_KEY } from './use-expenses';

/** A save may have created a category on the fly, so both lists are refreshed. */
function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
      qc.invalidateQueries({ queryKey: EXPENSE_CATEGORIES_KEY }),
    ]);
}

export function useCreateExpense() {
  const api = expensesApi(useApi());
  const m = useMutation({ mutationFn: api.create, onSettled: useRefresh() });
  return { create: (input: ExpenseInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateExpense() {
  const api = expensesApi(useApi());
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) => api.update(id, input),
    onSettled: useRefresh(),
  });
  return {
    update: (id: string, input: UpdateExpenseInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useDeleteExpense() {
  const api = expensesApi(useApi());
  const m = useMutation({ mutationFn: api.remove, onSettled: useRefresh() });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
```

`application/expense-groups.ts`:

```ts
import type { ExpenseCategoryDto, ExpenseDto } from '@magermoney/contracts';
import {
  isActiveOn,
  Money,
  monthlyAmount,
  type CurrencyRegistry,
  type Expense,
  type IsoDate,
  type RateTable,
} from '@magermoney/domain';
import { toExpense } from '../domain/mappers';

export interface ExpenseRowModel {
  expense: Expense;
  /** Monthly-normalised, in the expense's own currency. */
  monthly: Money;
}
export interface ExpenseGroup {
  category: ExpenseCategoryDto;
  rows: ExpenseRowModel[];
  /** Monthly total of the group in the display currency. */
  total: Money;
}
export interface ExpenseGroups {
  groups: ExpenseGroup[];
  planned: Money;
  essential: Money;
  ended: Expense[];
  unconvertible: Expense[];
}

const UNKNOWN: ExpenseCategoryDto = {
  id: '',
  name: '—',
  icon: null,
  sortOrder: Number.MAX_SAFE_INTEGER,
};

/** Pure: the Expenses segment from DTOs, a rate table and a display currency. Undefined while an input is missing. */
export function groupExpenses(
  dtos: readonly ExpenseDto[],
  categories: readonly ExpenseCategoryDto[],
  table: RateTable | undefined,
  registry: CurrencyRegistry,
  display: string,
  today: IsoDate,
): ExpenseGroups | undefined {
  const currency = registry.get(display);
  if (!table || currency.isErr()) return undefined;
  const zero = Money.zero(currency.value);
  const all = dtos.map((d) => toExpense(d, registry));
  const active = all.filter((e) => isActiveOn(e, today));
  const byCategory = new Map<string, ExpenseGroup>();
  let planned = zero;
  let essential = zero;
  const unconvertible: Expense[] = [];

  for (const expense of [...active].sort((a, b) => a.name.localeCompare(b.name))) {
    const category = categories.find((c) => c.id === expense.categoryId) ?? UNKNOWN;
    const group = byCategory.get(category.id) ?? { category, rows: [], total: zero };
    const monthly = monthlyAmount(expense);
    group.rows.push({ expense, monthly });
    const converted = table.convert(monthly, display);
    if (converted.isErr()) unconvertible.push(expense);
    else {
      group.total = group.total.add(converted.value)._unsafeUnwrap();
      planned = planned.add(converted.value)._unsafeUnwrap();
      if (expense.isEssential) essential = essential.add(converted.value)._unsafeUnwrap();
    }
    byCategory.set(category.id, group);
  }

  return {
    groups: [...byCategory.values()].sort(
      (a, b) =>
        a.category.sortOrder - b.category.sortOrder ||
        a.category.name.localeCompare(b.category.name),
    ),
    planned,
    essential,
    ended: all.filter((e) => e.activeTo !== null && e.activeTo < today),
    unconvertible,
  };
}
```

- [ ] **Step 4: Run the two tests**

Run: `bun run --filter @magermoney/web test -- expenses-api expense-groups`
Expected: PASS (6 tests).

- [ ] **Step 5: Copy**

Add to `ru.json` (and the same keys to `en.json` with the EN text), then run `/humanize-text:humanize-text` over the new RU strings:

| key                                 | RU                                                                        | EN                                                        |
| ----------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| `expenses.title`                    | Расходы                                                                   | Expenses                                                  |
| `expenses.add`                      | Добавить расход                                                           | Add expense                                               |
| `expenses.perMonth`                 | / мес                                                                     | / mo                                                      |
| `expenses.yearly`                   | {amount} / год · ≈ {monthly} / мес                                        | {amount} / yr · ≈ {monthly} / mo                          |
| `expenses.essential`                | обязательный                                                              | essential                                                 |
| `expenses.planned`                  | Всего в месяц                                                             | Per month                                                 |
| `expenses.essentialTotal`           | из них обязательные                                                       | of which essential                                        |
| `expenses.unconvertible`            | Нет курса для: {names}. Они не вошли в итог.                              | No rate for: {names}. Left out of the total.              |
| `expenses.ended.show`               | Завершённые ({n})                                                         | Ended ({n})                                               |
| `expenses.ended.hide`               | Скрыть завершённые                                                        | Hide ended                                                |
| `expenses.empty.title`              | Пока ни одного расхода                                                    | No expenses yet                                           |
| `expenses.empty.body`               | Аренда, связь, подписки — всё, что списывается регулярно.                 | Rent, phone, subscriptions — anything that recurs.        |
| `expenses.form.createTitle`         | Новый расход                                                              | New expense                                               |
| `expenses.form.editTitle`           | Расход                                                                    | Expense                                                   |
| `expenses.form.name`                | Название                                                                  | Name                                                      |
| `expenses.form.amount`              | Сумма                                                                     | Amount                                                    |
| `expenses.form.currency`            | Валюта                                                                    | Currency                                                  |
| `expenses.form.period`              | Как часто                                                                 | How often                                                 |
| `expenses.period.monthly`           | Каждый месяц                                                              | Monthly                                                   |
| `expenses.period.yearly`            | Раз в год                                                                 | Yearly                                                    |
| `expenses.form.billingDay`          | День списания                                                             | Billing day                                               |
| `expenses.form.billingMonth`        | Месяц списания                                                            | Billing month                                             |
| `expenses.form.noMonth`             | Не указан                                                                 | Not set                                                   |
| `expenses.form.category`            | Категория                                                                 | Category                                                  |
| `expenses.form.categoryHint`        | Выберите или введите новую                                                | Pick one or type a new one                                |
| `expenses.form.essential`           | Обязательный расход                                                       | Essential                                                 |
| `expenses.form.activeFrom`          | Действует с                                                               | Active from                                               |
| `expenses.form.activeTo`            | По (необязательно)                                                        | Until (optional)                                          |
| `expenses.form.create`              | Создать                                                                   | Create                                                    |
| `expenses.form.save`                | Сохранить                                                                 | Save                                                      |
| `expenses.form.endToday`            | Завершить сегодня                                                         | End today                                                 |
| `expenses.form.delete`              | Удалить                                                                   | Delete                                                    |
| `expenses.form.deleteTitle`         | Удалить расход?                                                           | Delete this expense?                                      |
| `expenses.form.deleteBody`          | Он исчезнет из плана. Если расход просто закончился, лучше завершить его. | It leaves the plan. If it simply stopped, end it instead. |
| `expenses.form.cancel`              | Отмена                                                                    | Cancel                                                    |
| `expenses.form.saveFailed`          | Не получилось сохранить                                                   | Could not save                                            |
| `errors.billingMonthRequiresYearly` | Месяц списания бывает только у годового расхода                           | Only a yearly expense has a billing month                 |
| `errors.categoryNameTaken`          | Такая категория уже есть                                                  | That category already exists                              |
| `errors.categoryHasExpenses`        | В категории ещё есть расходы                                              | The category still has expenses                           |

In `shared/api/error-messages.ts` add to `KEY_BY_CODE`:

```ts
  billing_month_requires_yearly: 'errors.billingMonthRequiresYearly',
  category_name_taken: 'errors.categoryNameTaken',
  category_has_expenses: 'errors.categoryHasExpenses',
```

`active_period_invalid` → `errors.activePeriodInvalid` is already present from Task 20 (the income source form needs it first); the three codes above are new here. The locales test fails on a duplicate or a missing key, so add each exactly once.

- [ ] **Step 6: Design pass**

Run `/frontend-design` with this brief: a ledger page of fixed obligations (`docs/design/direction.md`): category headers are mono uppercase 12px labels on a hairline with the category's monthly total right-aligned in the display currency; rows are 52px hairline-separated, name left (the word "обязательный" as a small muted mark, never a coloured badge), own-currency amount right in tabular mono with the display conversion in 12px muted beneath; a yearly row reads "X / год · ≈ Y / мес"; the footer repeats the planned total and the essential sub-total as quiet rows, no cards inside cards, no colour on amounts. The form is a routed page like `AccountFormPage`. Keep every `data-testid` below.

- [ ] **Step 7: Write the failing component tests**

`apps/web/test/ExpensesSegment.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import ExpensesSegment from '../src/modules/expenses/ui/ExpensesSegment.vue';

const profile = {
  id: 'u',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
const currencies = [
  { code: 'USD', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
  { code: 'EUR', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
];
const rates = [{ base: 'EUR', quote: 'USD', value: '1.2', date: '2026-09-17', source: 'api' }];
const CAT = '22222222-2222-4222-8222-222222222222';
const exp = (id: string, over: object) => ({
  id,
  categoryId: CAT,
  name: id,
  amount: '100',
  currency: 'USD',
  period: 'monthly',
  billingDay: null,
  billingMonth: null,
  isEssential: false,
  activeFrom: '2020-01-01',
  activeTo: null,
  ...over,
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function mountSegment(expenses: unknown[]) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json(currencies);
    if (path.startsWith('/rates')) return json(rates);
    if (path === '/expense-categories')
      return json([{ id: CAT, name: 'Housing', icon: null, sortOrder: 0 }]);
    return json(expenses);
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: ExpensesSegment },
      { path: '/plan/expenses/new', name: 'expense-new', component: { template: '<div />' } },
      { path: '/plan/expenses/:id/edit', name: 'expense-edit', component: { template: '<div />' } },
    ],
  });
  return mount(ExpensesSegment, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
        createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
      stubs: { Motion: { template: '<div><slot /></div>' } },
    },
  });
}

describe('ExpensesSegment', () => {
  it('shows a row per active expense, the planned total and the essential total', async () => {
    const A = '11111111-1111-4111-8111-111111111111';
    const B = '33333333-3333-4333-8333-333333333333';
    const C = '44444444-4444-4444-8444-444444444444';
    const w = mountSegment([
      exp(A, { isEssential: true }),
      exp(B, { amount: '120', period: 'yearly' }),
      exp(C, { activeTo: '2021-01-01' }),
    ]);
    await flushPromises();
    expect(w.findAll('[data-testid^="expense-row-"]')).toHaveLength(2);
    expect(w.get('[data-testid="expenses-planned"]').text()).toContain('110');
    expect(w.get('[data-testid="expenses-essential"]').text()).toContain('100');
    expect(w.text()).toContain('Housing');
    expect(w.get(`[data-testid="expense-row-${B}"]`).text()).toContain('год');

    const toggle = w.get('button[aria-controls="ended-expenses"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(w.find(`[data-testid="expense-row-${C}"]`).exists()).toBe(true);
  });

  it('offers to add the first expense when there are none', async () => {
    const w = mountSegment([]);
    await flushPromises();
    expect(w.get('[data-testid="expenses-empty"]').text()).toContain('Пока ни одного расхода');
  });
});
```

`apps/web/test/ExpenseFormPage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import ExpenseFormPage from '../src/modules/expenses/ui/ExpenseFormPage.vue';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const CAT = '22222222-2222-4222-8222-222222222222';
const ID = '11111111-1111-4111-8111-111111111111';
const dto = {
  id: ID,
  categoryId: CAT,
  name: 'Rent',
  amount: '1400',
  currency: 'EUR',
  period: 'monthly',
  billingDay: null,
  billingMonth: null,
  isEssential: false,
  activeFrom: '2026-01-01',
  activeTo: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function mountForm(
  path: string,
  fetch: (p: string, init?: RequestInit) => Promise<Response>,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/plan', name: 'plan', component: { template: '<div />' } },
      { path: '/plan/expenses/new', name: 'expense-new', component: ExpenseFormPage },
      { path: '/plan/expenses/:id/edit', name: 'expense-edit', component: ExpenseFormPage },
    ],
  });
  await router.push(path);
  const w = mount(ExpenseFormPage, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
        createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
    },
    attachTo: document.body,
  });
  await flushPromises();
  return { w, router };
}

const base = (path: string) => {
  if (path === '/currencies')
    return json([
      { code: 'EUR', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
    ]);
  if (path === '/expense-categories')
    return json([{ id: CAT, name: 'Housing', icon: null, sortOrder: 0 }]);
  return null;
};

describe('ExpenseFormPage', () => {
  it('sends categoryName for a category typed in, and categoryId for a known one', async () => {
    const posts: unknown[] = [];
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      const b = base(path);
      if (b) return b;
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)));
        return json(dto, 201);
      }
      return json([]);
    });
    const { w, router } = await mountForm('/plan/expenses/new', fetch);
    await w.get('[data-testid="expense-name"]').setValue('Gym');
    await w.get('[data-testid="expense-amount"]').setValue('30');
    await w.get('[data-testid="expense-category"]').setValue('Health');
    await w.get('[data-testid="expense-form"]').trigger('submit');
    await flushPromises();
    expect(posts[0]).toMatchObject({ name: 'Gym', amount: '30', categoryName: 'Health' });
    expect(posts[0]).not.toHaveProperty('categoryId');
    expect(router.currentRoute.value.fullPath).toBe('/plan?tab=expenses');

    await router.push('/plan/expenses/new');
    const second = await mountForm('/plan/expenses/new', fetch);
    await second.w.get('[data-testid="expense-name"]').setValue('Rent');
    await second.w.get('[data-testid="expense-amount"]').setValue('1400');
    await second.w.get('[data-testid="expense-category"]').setValue('housing');
    await second.w.get('[data-testid="expense-form"]').trigger('submit');
    await flushPromises();
    expect(posts[1]).toMatchObject({ categoryId: CAT });
    expect(posts[1]).not.toHaveProperty('categoryName');
  });

  it('ends an expense today with a PATCH of activeTo', async () => {
    const patches: unknown[] = [];
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      const b = base(path);
      if (b) return b;
      if (init?.method === 'PATCH') {
        patches.push(JSON.parse(String(init.body)));
        return json(dto);
      }
      return json([dto]);
    });
    const { w } = await mountForm(`/plan/expenses/${ID}/edit`, fetch);
    expect((w.get('[data-testid="expense-name"]').element as HTMLInputElement).value).toBe('Rent');
    await w.get('[data-testid="expense-end"]').trigger('click');
    await flushPromises();
    expect(patches[0]).toEqual({ activeTo: new Date().toISOString().slice(0, 10) });
  });
});
```

Run: `bun run --filter @magermoney/web test -- ExpensesSegment ExpenseFormPage` — Expected: FAIL (components missing).

- [ ] **Step 8: The segment**

`ui/ExpensesSegment.vue`:

```vue
<script setup lang="ts">
/** Fixed obligations by category: what each costs a month, what all of it costs, and how much of that is not optional. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Expense } from '@magermoney/domain';
import { Button, Skeleton } from '@magermoney/ui';
import { useCurrencyRegistry } from '@/modules/currencies';
import { MoneyText, todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { groupExpenses } from '../application/expense-groups';
import { useExpenseCategories } from '../application/use-expense-categories';
import { useExpenses } from '../application/use-expenses';

const { t } = useI18n();
const { dtos, isLoading } = useExpenses();
const { categories } = useExpenseCategories();
const rates = useRates();
const registry = useCurrencyRegistry();
const { current } = useDisplayCurrency();
const showEnded = ref(false);

const model = computed(() =>
  groupExpenses(
    dtos.value,
    categories.value,
    rates.table.value,
    registry.value,
    current.value,
    todayIso(),
  ),
);
const isEmpty = computed(
  () => !isLoading.value && model.value !== undefined && dtos.value.length === 0,
);
const unconvertibleNames = computed(() => model.value?.unconvertible.map((e) => e.name).join(', '));
const own = (e: Expense) => `${e.amount.round().toString()} ${e.amount.currency.code}`;
</script>

<template>
  <section class="pb-8">
    <h2 class="sr-only">{{ t('expenses.title') }}</h2>
    <Skeleton v-if="!model" class="h-24 w-full" />

    <div v-else-if="isEmpty" class="mt-10 text-center" data-testid="expenses-empty">
      <p class="text-lg font-semibold">{{ t('expenses.empty.title') }}</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('expenses.empty.body') }}</p>
      <Button class="mt-4" @click="$router.push({ name: 'expense-new' })">
        {{ t('expenses.add') }}
      </Button>
    </div>

    <template v-else>
      <section
        v-for="g in model.groups"
        :key="g.category.id"
        class="mt-5 border-t border-border pt-3"
      >
        <header class="flex items-baseline justify-between gap-3">
          <h3 class="truncate font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {{ g.category.name }}
          </h3>
          <span class="text-sm">
            <MoneyText :amount="g.total.toString()" :currency="g.total.currency.code" />
            <span class="text-xs text-muted-foreground"> {{ t('expenses.perMonth') }}</span>
          </span>
        </header>
        <ul class="divide-y divide-border/60">
          <li v-for="{ expense, monthly } in g.rows" :key="expense.id">
            <RouterLink
              :to="{ name: 'expense-edit', params: { id: expense.id } }"
              :data-testid="`expense-row-${expense.id}`"
              class="flex min-h-13 items-center gap-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px]">{{ expense.name }}</span>
                <span v-if="expense.isEssential" class="block text-xs text-muted-foreground">{{
                  t('expenses.essential')
                }}</span>
              </span>
              <span class="text-right">
                <span class="block font-mono text-[15px] tabular-nums">
                  <template v-if="expense.period === 'yearly'">{{
                    t('expenses.yearly', {
                      amount: own(expense),
                      monthly: monthly.round().toString(),
                    })
                  }}</template>
                  <template v-else>{{ own(expense) }}</template>
                </span>
                <MoneyText
                  class="text-xs text-muted-foreground"
                  :amount="monthly.toString()"
                  :currency="monthly.currency.code"
                />
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <dl class="mt-6 border-t border-border pt-3 text-sm">
        <div class="flex items-baseline justify-between py-1">
          <dt>{{ t('expenses.planned') }}</dt>
          <dd data-testid="expenses-planned">
            <MoneyText :amount="model.planned.toString()" :currency="model.planned.currency.code" />
          </dd>
        </div>
        <div class="flex items-baseline justify-between py-1 text-muted-foreground">
          <dt>{{ t('expenses.essentialTotal') }}</dt>
          <dd data-testid="expenses-essential">
            <MoneyText
              :amount="model.essential.toString()"
              :currency="model.essential.currency.code"
            />
          </dd>
        </div>
      </dl>
      <p v-if="model.unconvertible.length > 0" class="mt-3 text-xs text-muted-foreground">
        {{ t('expenses.unconvertible', { names: unconvertibleNames }) }}
      </p>

      <div v-if="model.ended.length > 0" class="mt-8">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-9 pointer-coarse:min-h-11"
          :aria-expanded="showEnded"
          aria-controls="ended-expenses"
          @click="showEnded = !showEnded"
        >
          {{
            showEnded
              ? t('expenses.ended.hide')
              : t('expenses.ended.show', { n: model.ended.length })
          }}
        </Button>
        <ul v-if="showEnded" id="ended-expenses" class="mt-2 divide-y divide-border/60">
          <li v-for="e in model.ended" :key="e.id">
            <RouterLink
              :to="{ name: 'expense-edit', params: { id: e.id } }"
              :data-testid="`expense-row-${e.id}`"
              class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-muted-foreground"
            >
              <span class="truncate">{{ e.name }}</span>
              <span class="font-mono tabular-nums">{{ own(e) }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
```

- [ ] **Step 9: The form**

The category field is a text input backed by a `<datalist>`: type to filter, pick to reuse, keep typing to create. It is the functional baseline; if the `/impeccable` pass decides a popover combobox is worth it, add the shadcn `Popover` + `Command` primitives then (through the CLI, in `packages/ui`), **keeping `data-testid="expense-category"` on the text input and the resolve-by-name rule below**.

`ui/ExpenseFormPage.vue`:

```vue
<script setup lang="ts">
/**
 * Create or edit a fixed expense. The category is resolved by name: a known
 * name (case-insensitive) sends its id, anything else sends `categoryName` and
 * the API creates it in the same transaction. Ending is a PATCH of `activeTo`.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { ExpenseInput } from '@magermoney/contracts';
import { EXPENSE_PERIODS, type ExpensePeriod } from '@magermoney/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DayOfMonthPicker,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  useToast,
} from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useExpenseCategories } from '../application/use-expense-categories';
import {
  useCreateExpense,
  useDeleteExpense,
  useUpdateExpense,
} from '../application/use-expense-mutations';
import { useExpenses } from '../application/use-expenses';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { dtos } = useExpenses();
const { categories } = useExpenseCategories();
const { create, isPending: creating } = useCreateExpense();
const { update, isPending: updating } = useUpdateExpense();
const { remove } = useDeleteExpense();

const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = computed(() => dtos.value.find((e) => e.id === editingId.value));
const confirmDelete = ref(false);
const NO_MONTH = '0';

const form = reactive({
  name: '',
  amount: '',
  currency: 'EUR',
  period: 'monthly' as ExpensePeriod,
  billingDay: null as number | null,
  billingMonth: NO_MONTH,
  category: '',
  isEssential: false,
  activeFrom: todayIso(),
  activeTo: '',
});
watch(
  [existing, categories],
  ([e, cats]) => {
    if (!e) return;
    Object.assign(form, {
      name: e.name,
      amount: e.amount,
      currency: e.currency,
      period: e.period,
      billingDay: e.billingDay,
      billingMonth: e.billingMonth === null ? NO_MONTH : String(e.billingMonth),
      category: cats.find((c) => c.id === e.categoryId)?.name ?? form.category,
      isEssential: e.isEssential,
      activeFrom: e.activeFrom,
      activeTo: e.activeTo ?? '',
    });
  },
  { immediate: true },
);

const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const busy = computed(() => creating.value || updating.value);
const uiLocale = computed(() => locale.value as DateLocale);
const months = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat(uiLocale.value === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'long',
    }).format(new Date(Date.UTC(2026, i, 1))),
  })),
);

function payload(): ExpenseInput {
  const name = form.category.trim();
  const known = categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return {
    ...(known ? { categoryId: known.id } : { categoryName: name }),
    name: form.name.trim(),
    amount: form.amount,
    currency: form.currency,
    period: form.period,
    billingDay: form.billingDay,
    billingMonth:
      form.period === 'yearly' && form.billingMonth !== NO_MONTH ? Number(form.billingMonth) : null,
    isEssential: form.isEssential,
    activeFrom: form.activeFrom,
    activeTo: form.activeTo || null,
  };
}
const back = () => router.replace({ name: 'plan', query: { tab: 'expenses' } });

async function submit() {
  try {
    if (editingId.value) await update(editingId.value, payload());
    else await create(payload());
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
async function endToday() {
  if (!editingId.value) return;
  try {
    await update(editingId.value, { activeTo: todayIso() });
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
async function del() {
  if (!editingId.value) return;
  try {
    await remove(editingId.value);
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
</script>

<template>
  <form class="space-y-5 pb-8" data-testid="expense-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('expenses.form.editTitle') : t('expenses.form.createTitle') }}
    </h1>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('expenses.form.name') }}</span>
      <Input v-model="form.name" required data-testid="expense-name" class="mt-1" />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground"
        >{{ t('expenses.form.amount') }} · {{ form.currency }}</span
      >
      <MoneyInput
        v-model="form.amount"
        :scale="scale"
        :locale="uiLocale"
        data-testid="expense-amount"
        class="mt-1"
      />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('expenses.form.currency')
      }}</span>
      <Select v-model="form.currency">
        <SelectTrigger class="mt-1 w-full" data-testid="expense-currency"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">{{
            c.code
          }}</SelectItem>
        </SelectContent>
      </Select>
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('expenses.form.period') }}</span>
      <Select v-model="form.period">
        <SelectTrigger class="mt-1 w-full" data-testid="expense-period"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="p in EXPENSE_PERIODS" :key="p" :value="p">{{
            t(`expenses.period.${p}`)
          }}</SelectItem>
        </SelectContent>
      </Select>
    </label>

    <label v-if="form.period === 'yearly'" class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('expenses.form.billingMonth')
      }}</span>
      <Select v-model="form.billingMonth">
        <SelectTrigger class="mt-1 w-full" data-testid="expense-billing-month"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent>
          <SelectItem :value="NO_MONTH">{{ t('expenses.form.noMonth') }}</SelectItem>
          <SelectItem v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</SelectItem>
        </SelectContent>
      </Select>
    </label>

    <div>
      <span class="text-xs font-medium text-muted-foreground">{{
        t('expenses.form.billingDay')
      }}</span>
      <!-- The picker emits `number[] | number | null`; single mode only ever sends the last two. -->
      <DayOfMonthPicker
        :model-value="form.billingDay"
        :multiple="false"
        :aria-label="t('expenses.form.billingDay')"
        class="mt-1"
        data-testid="expense-billing-day"
        @update:model-value="(v) => (form.billingDay = Array.isArray(v) ? null : v)"
      />
    </div>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('expenses.form.category')
      }}</span>
      <Input
        v-model="form.category"
        required
        list="expense-categories"
        autocomplete="off"
        :placeholder="t('expenses.form.categoryHint')"
        data-testid="expense-category"
        class="mt-1"
      />
      <datalist id="expense-categories">
        <option v-for="c in categories" :key="c.id" :value="c.name" />
      </datalist>
    </label>

    <label class="flex min-h-9 items-center justify-between gap-3 pointer-coarse:min-h-11">
      <span class="text-sm">{{ t('expenses.form.essential') }}</span>
      <Switch v-model="form.isEssential" data-testid="expense-essential" />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('expenses.form.activeFrom')
        }}</span>
        <Input v-model="form.activeFrom" type="date" required class="mt-1" />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('expenses.form.activeTo')
        }}</span>
        <Input v-model="form.activeTo" type="date" :min="form.activeFrom" class="mt-1" />
      </label>
    </div>

    <Button type="submit" size="lg" class="w-full" :disabled="busy" data-testid="expense-submit">
      {{ editingId ? t('expenses.form.save') : t('expenses.form.create') }}
    </Button>

    <div v-if="editingId" class="grid gap-2 border-t border-border pt-4">
      <Button
        v-if="!existing?.activeTo"
        type="button"
        variant="outline"
        class="min-h-9 pointer-coarse:min-h-11"
        data-testid="expense-end"
        @click="endToday"
      >
        {{ t('expenses.form.endToday') }}
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="min-h-9 text-destructive pointer-coarse:min-h-11"
        data-testid="expense-delete"
        @click="confirmDelete = true"
      >
        {{ t('expenses.form.delete') }}
      </Button>
    </div>

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('expenses.form.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('expenses.form.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('expenses.form.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="del">{{ t('expenses.form.delete') }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </form>
</template>
```

`Switch` is bound with `v-model` (Task 18 verified that the generated component forwards `modelValue`).

- [ ] **Step 10: Replace the stub barrel**

Replace the whole of `apps/web/src/modules/expenses/index.ts` (the Task 19 stub). `ExpenseFormPage` keeps its name and stays a `routeComponent`; do not delete `shared/layout/PendingPage.vue` here — Task 24 removes it once the budgets stub, its last importer, is gone.

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the expenses module: fixed obligations and their categories. */
export { toExpense } from './domain/mappers';
export { EXPENSES_KEY, useExpenses } from './application/use-expenses';
export { useExpenseCategories } from './application/use-expense-categories';
export {
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from './application/use-expense-mutations';
export { groupExpenses, type ExpenseGroups } from './application/expense-groups';
export { default as ExpensesSegment } from './ui/ExpensesSegment.vue';
/** Routed screen, async: the Plan screen and the dashboard import this barrel statically. */
export const ExpenseFormPage = routeComponent(() => import('./ui/ExpenseFormPage.vue'));
```

- [ ] **Step 11: Run, polish, verify**

Run: `bun run --filter @magermoney/web test -- expenses-api expense-groups ExpensesSegment ExpenseFormPage locales` — Expected: PASS.
Then `/animate` (group sections may take `listStagger(index)` like `ProviderGroup`; nothing else moves), `/impeccable` on both screens at 390px and desktop, light and dark. Re-run the tests, then `bun run lint && bun run typecheck`.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/modules/expenses apps/web/src/locales apps/web/src/shared/api/error-messages.ts apps/web/test/expenses-api.test.ts apps/web/test/expense-groups.test.ts apps/web/test/ExpensesSegment.test.ts apps/web/test/ExpenseFormPage.test.ts
git commit -m "feat(web): add the expenses module with categories and the expense form"
```

End the message with the two trailers from Global Constraints (via `/git-commit`).

---

### Task 24: Web — `budgets` module

**Assumes** (Tasks 18–19): `routeComponent(loader)` from `@/shared/layout/route-fallback`; routes `budget-new` (`/plan/budgets/new`) and `budget-edit` (`/plan/budgets/:id/edit`) registered by Task 19 and pointing at `@/modules/budgets` → `BudgetFormPage`; route `plan`.

**Files:**

- Create: `apps/web/src/modules/budgets/infrastructure/budgets-api.ts`, `domain/mappers.ts`, `application/use-budgets.ts`, `application/use-budget-mutations.ts`, `application/budget-summary.ts`, `ui/BudgetsSegment.vue`, `ui/BudgetFormPage.vue`
- Replace: `apps/web/src/modules/budgets/index.ts` (Task 19 stub barrel exporting only `BudgetFormPage` → `PendingPage.vue`)
- Delete: `apps/web/src/shared/layout/PendingPage.vue` (this barrel was its last importer: Task 21 replaced the income stubs, Task 23 the expenses stub)
- Modify: `apps/web/src/locales/ru.json`, `apps/web/src/locales/en.json`
- Test: `apps/web/test/budgets-api.test.ts`, `apps/web/test/budget-summary.test.ts`, `apps/web/test/BudgetsSegment.test.ts`, `apps/web/test/BudgetFormPage.test.ts`

**Interfaces:**

- Consumes: `BudgetDtoSchema`, `BudgetInput`, `UpdateBudgetInput` (contracts); `Budget`, `isActiveOn`, `Money`, `RateTable`, `CurrencyRegistry` (domain); `useRates`, `useDisplayCurrency`, `MoneyText`, `todayIso`; `useCurrencies`, `useCurrencyRegistry`.
- Produces (public `@/modules/budgets`): `useBudgets(): { budgets: ComputedRef<Budget[]>; dtos: ComputedRef<BudgetDto[]>; isLoading }`, `useCreateBudget()`, `useUpdateBudget()`, `useDeleteBudget()`, `toBudget(dto, registry)`, `summariseBudgets(...)`, `BUDGETS_KEY`, `BudgetsSegment` (sync), `BudgetFormPage` (async). Test ids: `budget-row-<id>`, `budgets-total`, `budgets-empty`, `budget-form`, `budget-name`, `budget-limit`, `budget-submit`, `budget-end`, `budget-delete`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/budgets-api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { budgetsApi } from '../src/modules/budgets/infrastructure/budgets-api.js';

const dto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Groceries',
  icon: null,
  monthlyLimit: '1000',
  currency: 'EUR',
  activeFrom: '2026-01-01',
  activeTo: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('budgetsApi', () => {
  it('lists, creates, patches and deletes through the contract', async () => {
    const fetch = vi.fn(async (_p: string, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json(init?.method ? dto : [dto]),
    );
    const api = budgetsApi({ fetch });
    expect((await api.list())[0]?.name).toBe('Groceries');
    await api.create({
      name: 'Groceries',
      monthlyLimit: '1000',
      currency: 'EUR',
      activeFrom: '2026-01-01',
    });
    await api.update(dto.id, { monthlyLimit: '900' });
    await api.remove(dto.id);
    expect(fetch.mock.calls.map(([p, i]) => `${(i as RequestInit).method} ${p}`)).toEqual([
      'GET /budgets',
      'POST /budgets',
      `PATCH /budgets/${dto.id}`,
      `DELETE /budgets/${dto.id}`,
    ]);
  });
});
```

`apps/web/test/budget-summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, Decimal, RateTable } from '@magermoney/domain';
import type { BudgetDto } from '@magermoney/contracts';
import { summariseBudgets } from '../src/modules/budgets/application/budget-summary.js';

const reg = CurrencyRegistry.default();
const table = new RateTable(
  '2026-09-17',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.2'), date: '2026-09-17', source: 'api' }],
  reg,
);
const b = (over: Partial<BudgetDto>): BudgetDto => ({
  id: 'b',
  name: 'Groceries',
  icon: null,
  monthlyLimit: '1000',
  currency: 'EUR',
  activeFrom: '2026-01-01',
  activeTo: null,
  ...over,
});

describe('summariseBudgets', () => {
  it('totals active limits in the display currency and sets ended budgets aside', () => {
    const s = summariseBudgets(
      [
        b({ id: 'a' }),
        b({ id: 'c', name: 'Taxi', monthlyLimit: '50', currency: 'USD' }),
        b({ id: 'd', activeTo: '2026-02-01' }),
      ],
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(s.active.map((x) => x.id)).toEqual(['a', 'c']);
    expect(s.total.round().toString()).toBe('1250');
    expect(s.ended.map((x) => x.id)).toEqual(['d']);
  });
  it('lists unconvertible budgets and is undefined without rates', () => {
    expect(
      summariseBudgets([b({ currency: 'BTC' })], table, reg, 'USD', '2026-09-17')!.unconvertible,
    ).toHaveLength(1);
    expect(summariseBudgets([], undefined, reg, 'USD', '2026-09-17')).toBeUndefined();
  });
});
```

Run: `bun run --filter @magermoney/web test -- budgets-api budget-summary` — Expected: FAIL (modules missing).

- [ ] **Step 2: Data layer**

`infrastructure/budgets-api.ts`:

```ts
import {
  BudgetDtoSchema,
  type BudgetDto,
  type BudgetInput,
  type UpdateBudgetInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const list = listOf(BudgetDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const budgetsApi = (client: ApiClient) => ({
  list: async (): Promise<BudgetDto[]> =>
    parse(await client.fetch('/budgets', { method: 'GET' }), list),
  create: async (input: BudgetInput): Promise<BudgetDto> =>
    parse(
      await client.fetch('/budgets', { method: 'POST', body: JSON.stringify(input) }),
      BudgetDtoSchema,
    ),
  update: async (id: string, input: UpdateBudgetInput): Promise<BudgetDto> =>
    parse(
      await client.fetch(`/budgets/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      BudgetDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/budgets/${id}`, { method: 'DELETE' }), noContent),
});
```

`domain/mappers.ts`:

```ts
import type { BudgetDto } from '@magermoney/contracts';
import { Money, type Budget, type Currency, type CurrencyRegistry } from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

export function toBudget(dto: BudgetDto, registry: CurrencyRegistry): Budget {
  const currency = registry.get(dto.currency).unwrapOr(fallback(dto.currency));
  return {
    id: dto.id,
    name: dto.name,
    icon: dto.icon,
    monthlyLimit: Money.of(dto.monthlyLimit, currency),
    activeFrom: dto.activeFrom,
    activeTo: dto.activeTo,
  };
}
```

`application/use-budgets.ts`:

```ts
import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { BudgetDto } from '@magermoney/contracts';
import type { Budget } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toBudget } from '../domain/mappers';
import { budgetsApi } from '../infrastructure/budgets-api';

export const BUDGETS_KEY = ['budgets'] as const;

export function useBudgets(): {
  budgets: ComputedRef<Budget[]>;
  dtos: ComputedRef<BudgetDto[]>;
  isLoading: ComputedRef<boolean>;
} {
  const api = budgetsApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: BUDGETS_KEY, queryFn: api.list });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    budgets: computed(() => dtos.value.map((d) => toBudget(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
  };
}
```

`application/use-budget-mutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { BudgetInput, UpdateBudgetInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { budgetsApi } from '../infrastructure/budgets-api';
import { BUDGETS_KEY } from './use-budgets';

export function useCreateBudget() {
  const api = budgetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.create,
    onSettled: () => qc.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
  return { create: (input: BudgetInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateBudget() {
  const api = budgetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) => api.update(id, input),
    onSettled: () => qc.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
  return {
    update: (id: string, input: UpdateBudgetInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useDeleteBudget() {
  const api = budgetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.remove,
    onSettled: () => qc.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
```

`application/budget-summary.ts`:

```ts
import type { BudgetDto } from '@magermoney/contracts';
import {
  isActiveOn,
  Money,
  type Budget,
  type CurrencyRegistry,
  type IsoDate,
  type RateTable,
} from '@magermoney/domain';
import { toBudget } from '../domain/mappers';

export interface BudgetSummary {
  active: Budget[];
  ended: Budget[];
  /** Sum of active monthly limits in the display currency. */
  total: Money;
  unconvertible: Budget[];
}

/** Pure: the Budgets segment. Undefined while rates or the display currency are missing. */
export function summariseBudgets(
  dtos: readonly BudgetDto[],
  table: RateTable | undefined,
  registry: CurrencyRegistry,
  display: string,
  today: IsoDate,
): BudgetSummary | undefined {
  const currency = registry.get(display);
  if (!table || currency.isErr()) return undefined;
  const all = dtos.map((d) => toBudget(d, registry));
  const active = all
    .filter((b) => isActiveOn(b, today))
    .sort((a, b) => a.name.localeCompare(b.name));
  let total = Money.zero(currency.value);
  const unconvertible: Budget[] = [];
  for (const b of active) {
    const c = table.convert(b.monthlyLimit, display);
    if (c.isErr()) unconvertible.push(b);
    else total = total.add(c.value)._unsafeUnwrap();
  }
  return {
    active,
    ended: all.filter((b) => b.activeTo !== null && b.activeTo < today),
    total,
    unconvertible,
  };
}
```

Run: `bun run --filter @magermoney/web test -- budgets-api budget-summary` — Expected: PASS.

- [ ] **Step 3: Copy** (both locale files; then `/humanize-text:humanize-text` on RU)

| key                        | RU                                                                                   | EN                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `budgets.title`            | Бюджеты                                                                              | Budgets                                                                            |
| `budgets.add`              | Добавить бюджет                                                                      | Add budget                                                                         |
| `budgets.perMonth`         | / мес                                                                                | / mo                                                                               |
| `budgets.total`            | Всего лимитов в месяц                                                                | Limits per month                                                                   |
| `budgets.unconvertible`    | Нет курса для: {names}. Они не вошли в итог.                                         | No rate for: {names}. Left out of the total.                                       |
| `budgets.ended.show`       | Завершённые ({n})                                                                    | Ended ({n})                                                                        |
| `budgets.ended.hide`       | Скрыть завершённые                                                                   | Hide ended                                                                         |
| `budgets.empty.title`      | Пока ни одного бюджета                                                               | No budgets yet                                                                     |
| `budgets.empty.body`       | Продукты, рестораны, такси — траты, у которых есть предел, а не фиксированная сумма. | Groceries, restaurants, taxis — spending with a ceiling rather than a fixed price. |
| `budgets.form.createTitle` | Новый бюджет                                                                         | New budget                                                                         |
| `budgets.form.editTitle`   | Бюджет                                                                               | Budget                                                                             |
| `budgets.form.name`        | Название                                                                             | Name                                                                               |
| `budgets.form.limit`       | Лимит в месяц                                                                        | Monthly limit                                                                      |
| `budgets.form.currency`    | Валюта                                                                               | Currency                                                                           |
| `budgets.form.activeFrom`  | Действует с                                                                          | Active from                                                                        |
| `budgets.form.activeTo`    | По (необязательно)                                                                   | Until (optional)                                                                   |
| `budgets.form.create`      | Создать                                                                              | Create                                                                             |
| `budgets.form.save`        | Сохранить                                                                            | Save                                                                               |
| `budgets.form.endToday`    | Завершить сегодня                                                                    | End today                                                                          |
| `budgets.form.delete`      | Удалить                                                                              | Delete                                                                             |
| `budgets.form.deleteTitle` | Удалить бюджет?                                                                      | Delete this budget?                                                                |
| `budgets.form.deleteBody`  | Он исчезнет из плана месяца.                                                         | It leaves the month plan.                                                          |
| `budgets.form.cancel`      | Отмена                                                                               | Cancel                                                                             |
| `budgets.form.saveFailed`  | Не получилось сохранить                                                              | Could not save                                                                     |

- [ ] **Step 4: Design pass**

Run `/frontend-design`: same ledger language as the Expenses segment — one hairline list, name left, own-currency limit right in tabular mono with "/ мес" and the display conversion beneath, one total row at the bottom. No progress bars: a Budget has no Spend until phase 5, so nothing is drawn that would imply tracking. Keep the test ids.

- [ ] **Step 5: Write the failing component tests**

`apps/web/test/BudgetsSegment.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import BudgetsSegment from '../src/modules/budgets/ui/BudgetsSegment.vue';

const profile = {
  id: 'u',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
const currencies = [
  { code: 'USD', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
  { code: 'EUR', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
];
const rates = [{ base: 'EUR', quote: 'USD', value: '1.2', date: '2026-09-17', source: 'api' }];
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const budget = (id: string, over: object) => ({
  id,
  name: id,
  icon: null,
  monthlyLimit: '100',
  currency: 'USD',
  activeFrom: '2020-01-01',
  activeTo: null,
  ...over,
});

function mountSegment(budgets: unknown[]) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json(currencies);
    if (path.startsWith('/rates')) return json(rates);
    return json(budgets);
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: BudgetsSegment },
      { path: '/plan/budgets/new', name: 'budget-new', component: { template: '<div />' } },
      { path: '/plan/budgets/:id/edit', name: 'budget-edit', component: { template: '<div />' } },
    ],
  });
  return mount(BudgetsSegment, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
        createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
      stubs: { Motion: { template: '<div><slot /></div>' } },
    },
  });
}

describe('BudgetsSegment', () => {
  it('lists active budgets and totals their limits in the display currency', async () => {
    const w = mountSegment([
      budget('11111111-1111-4111-8111-111111111111', { monthlyLimit: '1000', currency: 'EUR' }),
      budget('22222222-2222-4222-8222-222222222222', {}),
      budget('33333333-3333-4333-8333-333333333333', { activeTo: '2021-01-01' }),
    ]);
    await flushPromises();
    expect(w.findAll('[data-testid^="budget-row-"]')).toHaveLength(2);
    expect(w.get('[data-testid="budgets-total"]').text()).toContain('1');
    expect(w.get('[data-testid="budgets-total"]').text()).toContain('300');
  });
  it('shows the empty state', async () => {
    const w = mountSegment([]);
    await flushPromises();
    expect(w.find('[data-testid="budgets-empty"]').exists()).toBe(true);
  });
});
```

`apps/web/test/BudgetFormPage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import BudgetFormPage from '../src/modules/budgets/ui/BudgetFormPage.vue';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const dto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Groceries',
  icon: null,
  monthlyLimit: '1000',
  currency: 'EUR',
  activeFrom: '2026-01-01',
  activeTo: null,
};

describe('BudgetFormPage', () => {
  it('creates a budget and returns to the budgets segment', async () => {
    let body: unknown;
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/currencies')
        return json([
          {
            code: 'EUR',
            kind: 'fiat',
            scale: 2,
            symbol: null,
            nameRu: null,
            nameEn: null,
            icon: null,
          },
        ]);
      if (init?.method === 'POST') {
        body = JSON.parse(String(init.body));
        return json(dto, 201);
      }
      return json([]);
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/plan', name: 'plan', component: { template: '<div />' } },
        { path: '/plan/budgets/new', name: 'budget-new', component: BudgetFormPage },
      ],
    });
    await router.push('/plan/budgets/new');
    const w = mount(BudgetFormPage, {
      global: {
        plugins: [
          [
            VueQueryPlugin,
            {
              queryClient: new QueryClient({
                defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
              }),
            },
          ],
          createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
          router,
        ],
        provide: { [API_KEY as unknown as string]: { fetch } },
      },
      attachTo: document.body,
    });
    await flushPromises();
    await w.get('[data-testid="budget-name"]').setValue('Groceries');
    await w.get('[data-testid="budget-limit"]').setValue('1000');
    await w.get('[data-testid="budget-form"]').trigger('submit');
    await flushPromises();
    expect(body).toMatchObject({ name: 'Groceries', monthlyLimit: '1000', currency: 'EUR' });
    expect(router.currentRoute.value.fullPath).toBe('/plan?tab=budgets');
  });
});
```

Run: `bun run --filter @magermoney/web test -- BudgetsSegment BudgetFormPage` — Expected: FAIL.

- [ ] **Step 6: The segment and the form**

`ui/BudgetsSegment.vue`:

```vue
<script setup lang="ts">
/** Variable categories and their ceilings. Limits only: what was actually spent arrives with month close (phase 5). */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, Skeleton } from '@magermoney/ui';
import { useCurrencyRegistry } from '@/modules/currencies';
import { MoneyText, todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { summariseBudgets } from '../application/budget-summary';
import { useBudgets } from '../application/use-budgets';

const { t } = useI18n();
const { dtos, isLoading } = useBudgets();
const rates = useRates();
const registry = useCurrencyRegistry();
const { current } = useDisplayCurrency();
const showEnded = ref(false);
const model = computed(() =>
  summariseBudgets(dtos.value, rates.table.value, registry.value, current.value, todayIso()),
);
const isEmpty = computed(
  () => !isLoading.value && model.value !== undefined && dtos.value.length === 0,
);
const unconvertibleNames = computed(() => model.value?.unconvertible.map((b) => b.name).join(', '));
</script>

<template>
  <section class="pb-8">
    <h2 class="sr-only">{{ t('budgets.title') }}</h2>
    <Skeleton v-if="!model" class="h-24 w-full" />

    <div v-else-if="isEmpty" class="mt-10 text-center" data-testid="budgets-empty">
      <p class="text-lg font-semibold">{{ t('budgets.empty.title') }}</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('budgets.empty.body') }}</p>
      <Button class="mt-4" @click="$router.push({ name: 'budget-new' })">{{
        t('budgets.add')
      }}</Button>
    </div>

    <template v-else>
      <ul class="mt-5 divide-y divide-border/60 border-t border-border">
        <li v-for="b in model.active" :key="b.id">
          <RouterLink
            :to="{ name: 'budget-edit', params: { id: b.id } }"
            :data-testid="`budget-row-${b.id}`"
            class="flex min-h-13 items-center gap-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span class="min-w-0 flex-1 truncate text-[15px]">{{ b.name }}</span>
            <span class="text-right">
              <span class="block font-mono text-[15px] tabular-nums"
                >{{ b.monthlyLimit.round().toString() }} {{ b.monthlyLimit.currency.code }}
                <span class="text-xs text-muted-foreground">{{ t('budgets.perMonth') }}</span></span
              >
              <MoneyText
                class="text-xs text-muted-foreground"
                :amount="b.monthlyLimit.toString()"
                :currency="b.monthlyLimit.currency.code"
              />
            </span>
          </RouterLink>
        </li>
      </ul>

      <div class="mt-6 flex items-baseline justify-between border-t border-border pt-3 text-sm">
        <span>{{ t('budgets.total') }}</span>
        <MoneyText
          data-testid="budgets-total"
          :amount="model.total.toString()"
          :currency="model.total.currency.code"
        />
      </div>
      <p v-if="model.unconvertible.length > 0" class="mt-3 text-xs text-muted-foreground">
        {{ t('budgets.unconvertible', { names: unconvertibleNames }) }}
      </p>

      <div v-if="model.ended.length > 0" class="mt-8">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-9 pointer-coarse:min-h-11"
          :aria-expanded="showEnded"
          aria-controls="ended-budgets"
          @click="showEnded = !showEnded"
        >
          {{
            showEnded ? t('budgets.ended.hide') : t('budgets.ended.show', { n: model.ended.length })
          }}
        </Button>
        <ul v-if="showEnded" id="ended-budgets" class="mt-2 divide-y divide-border/60">
          <li v-for="b in model.ended" :key="b.id">
            <RouterLink
              :to="{ name: 'budget-edit', params: { id: b.id } }"
              :data-testid="`budget-row-${b.id}`"
              class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-muted-foreground"
            >
              <span class="truncate">{{ b.name }}</span>
              <span class="font-mono tabular-nums"
                >{{ b.monthlyLimit.round().toString() }} {{ b.monthlyLimit.currency.code }}</span
              >
            </RouterLink>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
```

`ui/BudgetFormPage.vue`:

```vue
<script setup lang="ts">
/** Create or edit a Budget: a name and a monthly ceiling. Ending is a PATCH of `activeTo`. */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import {
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from '../application/use-budget-mutations';
import { useBudgets } from '../application/use-budgets';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { dtos } = useBudgets();
const { create, isPending: creating } = useCreateBudget();
const { update, isPending: updating } = useUpdateBudget();
const { remove } = useDeleteBudget();

const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = computed(() => dtos.value.find((b) => b.id === editingId.value));
const confirmDelete = ref(false);
const form = reactive({
  name: '',
  monthlyLimit: '',
  currency: 'EUR',
  activeFrom: todayIso(),
  activeTo: '',
});
watch(
  existing,
  (b) => {
    if (!b) return;
    Object.assign(form, {
      name: b.name,
      monthlyLimit: b.monthlyLimit,
      currency: b.currency,
      activeFrom: b.activeFrom,
      activeTo: b.activeTo ?? '',
    });
  },
  { immediate: true },
);
const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const busy = computed(() => creating.value || updating.value);
const uiLocale = computed(() => locale.value as DateLocale);
const back = () => router.replace({ name: 'plan', query: { tab: 'budgets' } });
const payload = () => ({
  name: form.name.trim(),
  monthlyLimit: form.monthlyLimit,
  currency: form.currency,
  activeFrom: form.activeFrom,
  activeTo: form.activeTo || null,
});

async function run(action: () => Promise<unknown>) {
  try {
    await action();
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'budgets.form.saveFailed')));
  }
}
const submit = () =>
  run(() => (editingId.value ? update(editingId.value, payload()) : create(payload())));
const endToday = () => run(() => update(editingId.value!, { activeTo: todayIso() }));
const del = () => run(() => remove(editingId.value!));
</script>

<template>
  <form class="space-y-5 pb-8" data-testid="budget-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('budgets.form.editTitle') : t('budgets.form.createTitle') }}
    </h1>
    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('budgets.form.name') }}</span>
      <Input v-model="form.name" required data-testid="budget-name" class="mt-1" />
    </label>
    <label class="block">
      <span class="text-xs font-medium text-muted-foreground"
        >{{ t('budgets.form.limit') }} · {{ form.currency }}</span
      >
      <MoneyInput
        v-model="form.monthlyLimit"
        :scale="scale"
        :locale="uiLocale"
        data-testid="budget-limit"
        class="mt-1"
      />
    </label>
    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('budgets.form.currency')
      }}</span>
      <Select v-model="form.currency">
        <SelectTrigger class="mt-1 w-full" data-testid="budget-currency"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">{{
            c.code
          }}</SelectItem>
        </SelectContent>
      </Select>
    </label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('budgets.form.activeFrom')
        }}</span>
        <Input v-model="form.activeFrom" type="date" required class="mt-1" />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('budgets.form.activeTo')
        }}</span>
        <Input v-model="form.activeTo" type="date" :min="form.activeFrom" class="mt-1" />
      </label>
    </div>
    <Button type="submit" size="lg" class="w-full" :disabled="busy" data-testid="budget-submit">
      {{ editingId ? t('budgets.form.save') : t('budgets.form.create') }}
    </Button>

    <div v-if="editingId" class="grid gap-2 border-t border-border pt-4">
      <Button
        v-if="!existing?.activeTo"
        type="button"
        variant="outline"
        class="min-h-9 pointer-coarse:min-h-11"
        data-testid="budget-end"
        @click="endToday"
      >
        {{ t('budgets.form.endToday') }}
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="min-h-9 text-destructive pointer-coarse:min-h-11"
        data-testid="budget-delete"
        @click="confirmDelete = true"
      >
        {{ t('budgets.form.delete') }}
      </Button>
    </div>
    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('budgets.form.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('budgets.form.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('budgets.form.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="del">{{ t('budgets.form.delete') }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </form>
</template>
```

Replace the whole of `apps/web/src/modules/budgets/index.ts` (the Task 19 stub); `BudgetFormPage` keeps its name:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the budgets module: variable categories with a monthly limit. */
export { toBudget } from './domain/mappers';
export { BUDGETS_KEY, useBudgets } from './application/use-budgets';
export {
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from './application/use-budget-mutations';
export { summariseBudgets, type BudgetSummary } from './application/budget-summary';
export { default as BudgetsSegment } from './ui/BudgetsSegment.vue';
export const BudgetFormPage = routeComponent(() => import('./ui/BudgetFormPage.vue'));
```

Then remove the stand-in screen, which no barrel points at any more:

```bash
git rm apps/web/src/shared/layout/PendingPage.vue
grep -rn "PendingPage\|pending-page" apps/web/src apps/web/test apps/web/e2e
```

Expected: the grep prints nothing. If it still names the income or expenses barrel, Task 21 or 23 has not landed — stop and finish that task first instead of keeping the file.

- [ ] **Step 7: Run, polish, verify**

Run: `bun run --filter @magermoney/web test -- budgets-api budget-summary BudgetsSegment BudgetFormPage locales` — Expected: PASS. Then `/animate` (no new motion expected; confirm), `/impeccable` on both screens, re-run tests, `bun run lint && bun run typecheck`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/modules/budgets apps/web/src/shared/layout apps/web/src/locales apps/web/test/budgets-api.test.ts apps/web/test/budget-summary.test.ts apps/web/test/BudgetsSegment.test.ts apps/web/test/BudgetFormPage.test.ts
git commit -m "feat(web): add the budgets module"
```

Trailers as in Global Constraints.

---

### Task 25: Web — `plan` module: the Plan screen

**Assumes**: Task 19 created `apps/web/src/modules/plan/{index.ts, ui/PlanPage.vue}` as a placeholder and the route `{ path: '/plan', name: 'plan' }`; `SegmentedControl` from `@magermoney/ui` takes `v-model` (string) and `options: { value: string; label: string }[]`; `IncomeSegment` is a sync export of `@/modules/income` (Task 21); route names `income-source-new`, `expense-new`, `budget-new` exist. This task **replaces** the placeholder page; it adds no routes.

**Files:**

- Modify (replace content): `apps/web/src/modules/plan/ui/PlanPage.vue`
- Verify only: `apps/web/src/modules/plan/index.ts` (must export `PlanPage` via `routeComponent`), `apps/web/src/app/router.ts`
- Modify: `apps/web/src/locales/ru.json`, `en.json`
- Test: `apps/web/test/PlanPage.test.ts`

**Interfaces:**

- Consumes: `IncomeSegment` (`@/modules/income`), `ExpensesSegment` (`@/modules/expenses`), `BudgetsSegment` (`@/modules/budgets`), `SegmentedControl`, `Button`.
- Produces: `PlanPage` at `/plan?tab=income|expenses|budgets` (default `income`; an unknown value falls back to `income`). Test ids: `plan-tabs`, `plan-add`, `plan-segment-<tab>`.

`plan` owns no data and no domain: it is a screen module that composes three sibling modules, the same way `dashboard` does. (Ledger ruling: module added beyond the spec's list so no data module has to import its siblings.)

- [ ] **Step 1: Write the failing test**

`apps/web/test/PlanPage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';

vi.mock('@/modules/income', () => ({
  IncomeSegment: { template: '<div data-testid="seg-income" />' },
}));
vi.mock('@/modules/expenses', () => ({
  ExpensesSegment: { template: '<div data-testid="seg-expenses" />' },
}));
vi.mock('@/modules/budgets', () => ({
  BudgetsSegment: { template: '<div data-testid="seg-budgets" />' },
}));

import PlanPage from '../src/modules/plan/ui/PlanPage.vue';

async function mountAt(path: string) {
  const blank = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/plan', name: 'plan', component: PlanPage },
      { path: '/plan/income/new', name: 'income-source-new', component: blank },
      { path: '/plan/expenses/new', name: 'expense-new', component: blank },
      { path: '/plan/budgets/new', name: 'budget-new', component: blank },
    ],
  });
  await router.push(path);
  const w = mount(PlanPage, {
    global: { plugins: [createI18n({ legacy: false, locale: 'ru', messages: { ru } }), router] },
  });
  await flushPromises();
  return { w, router };
}

describe('PlanPage', () => {
  it('opens on income by default and on the segment named in the query', async () => {
    expect((await mountAt('/plan')).w.find('[data-testid="seg-income"]').exists()).toBe(true);
    expect(
      (await mountAt('/plan?tab=budgets')).w.find('[data-testid="seg-budgets"]').exists(),
    ).toBe(true);
    expect(
      (await mountAt('/plan?tab=nonsense')).w.find('[data-testid="seg-income"]').exists(),
    ).toBe(true);
  });

  it('writes the chosen segment to the query and points "+" at that segment\'s form', async () => {
    const { w, router } = await mountAt('/plan');
    await w.get('[data-testid="plan-tabs"] [data-value="expenses"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.tab).toBe('expenses');
    expect(w.find('[data-testid="seg-expenses"]').exists()).toBe(true);
    await w.get('[data-testid="plan-add"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('expense-new');
  });
});
```

The test clicks `[data-value="<value>"]` inside the control; if Task 18's `SegmentedControl` marks its options differently, adjust the selector in the test, not the component contract.

Run: `bun run --filter @magermoney/web test -- PlanPage` — Expected: FAIL (placeholder renders no segments).

- [ ] **Step 2: Copy**

`plan.title` is already present from Task 19; extend the existing `plan` object in both locale files with:

| key                  | RU                       | EN                |
| -------------------- | ------------------------ | ----------------- |
| `plan.tabs.income`   | Доходы                   | Income            |
| `plan.tabs.expenses` | Расходы                  | Expenses          |
| `plan.tabs.budgets`  | Бюджеты                  | Budgets           |
| `plan.add.income`    | Добавить источник дохода | Add income source |
| `plan.add.expenses`  | Добавить расход          | Add expense       |
| `plan.add.budgets`   | Добавить бюджет          | Add budget        |

- [ ] **Step 3: Design pass**

`/frontend-design`: title row "План" with a compact "+" button on the right whose accessible name changes with the segment; the `SegmentedControl` full-width beneath; the segment fills the rest. The URL is the state, so back/forward and a deep link from a dashboard empty state land on the right segment.

- [ ] **Step 4: Implement**

`ui/PlanPage.vue`:

```vue
<script setup lang="ts">
/** What is planned to come in and go out. One screen, three ledgers; the URL remembers which. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Button, SegmentedControl } from '@magermoney/ui';
import { BudgetsSegment } from '@/modules/budgets';
import { ExpensesSegment } from '@/modules/expenses';
import { IncomeSegment } from '@/modules/income';

const TABS = ['income', 'expenses', 'budgets'] as const;
type Tab = (typeof TABS)[number];
const ADD_ROUTE: Record<Tab, string> = {
  income: 'income-source-new',
  expenses: 'expense-new',
  budgets: 'budget-new',
};

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const isTab = (v: string): v is Tab => (TABS as readonly string[]).includes(v);
const tab = computed<Tab>(() => {
  const q = String(route.query.tab ?? '');
  return isTab(q) ? q : 'income';
});
/** `SegmentedControl` emits a plain string; anything that is not a tab is ignored. */
function selectTab(value: string) {
  if (isTab(value)) void router.replace({ name: 'plan', query: { tab: value } });
}
const options = computed(() => TABS.map((value) => ({ value, label: t(`plan.tabs.${value}`) })));
</script>

<template>
  <section>
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-[-0.01em]">{{ t('plan.title') }}</h1>
      <Button
        size="icon"
        variant="outline"
        class="pointer-coarse:size-11"
        :aria-label="t(`plan.add.${tab}`)"
        :title="t(`plan.add.${tab}`)"
        data-testid="plan-add"
        @click="router.push({ name: ADD_ROUTE[tab] })"
      >
        +
      </Button>
    </header>

    <SegmentedControl
      :model-value="tab"
      :options="options"
      :aria-label="t('plan.title')"
      class="mt-4 w-full"
      data-testid="plan-tabs"
      @update:model-value="selectTab"
    />

    <div class="mt-2" :data-testid="`plan-segment-${tab}`">
      <IncomeSegment v-if="tab === 'income'" />
      <ExpensesSegment v-else-if="tab === 'expenses'" />
      <BudgetsSegment v-else />
    </div>
  </section>
</template>
```

Confirm `modules/plan/index.ts` reads:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';
/** A screen module: composes income, expenses and budgets. Owns no data. */
export const PlanPage = routeComponent(() => import('./ui/PlanPage.vue'));
```

and that `bun run lint` accepts `plan` importing the three barrels (module → module through `index.ts` is the allowed edge).

- [ ] **Step 5: Run, polish**

Run: `bun run --filter @magermoney/web test -- PlanPage locales` — Expected: PASS. `/animate`: the segment swap may use the existing `fadeUp` preset keyed by `tab` (no slide between tabs, no spring); `/impeccable`; `/humanize-text:humanize-text`. `bun run lint && bun run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/plan apps/web/src/locales apps/web/test/PlanPage.test.ts
git commit -m "feat(web): build the Plan screen from the income, expenses and budgets segments"
```

Trailers as in Global Constraints.

---

### Task 26: Web — `dashboard` module: `useDashboard` and the home screen

**Assumes**: Task 19 created `apps/web/src/modules/dashboard/{index.ts, ui/DashboardPage.vue}` as a placeholder and the route `{ path: '/', name: 'home' }`; `/accounts` is the accounts list (`name: 'accounts'`). From `@/modules/income` (Tasks 20–22): `useIncomeSources()` → `{ sources, dtos, isLoading }`, `useInflows(params)` → `{ inflows, dtos, isLoading }` with `params: MaybeRefOrGetter<{ from?; to?; sourceId? }>`, `InflowSheet` with `v-model:open` and an optional `source-id` prop, route `income-source` (`/plan/income/:id`). From `@magermoney/ui`: `ProgressRule` with props `value: number` and `max: number` (both plain ratios for drawing only — never amounts used in arithmetic). From `@magermoney/domain` (Tasks 1–5): `monthPlan`, `upcomingEvents`, `inflowsVsPlan`, `nextPayday`, `daysToPayday`, `perDay`, `firstOfMonth`, `lastOfMonth`, `parseIso`, `isActiveOn`. This task **replaces** the placeholder page; it adds no routes.

**Files:**

- Create: `apps/web/src/modules/dashboard/application/build-dashboard.ts`, `application/use-dashboard.ts`, `ui/CapitalBlock.vue`, `ui/UntilPaydayBlock.vue`, `ui/MonthPlanBlock.vue`, `ui/MonthInflowsBlock.vue`, `ui/UpcomingBlock.vue`
- Modify (replace content): `apps/web/src/modules/dashboard/ui/DashboardPage.vue` (the Task 19 placeholder)
- Modify: `apps/web/src/modules/dashboard/index.ts` (the Task 19 barrel already exports `DashboardPage` via `routeComponent`; keep that line and add the new exports)
- Modify: `apps/web/src/locales/ru.json`, `en.json`
- Test: `apps/web/test/build-dashboard.test.ts`, `apps/web/test/DashboardPage.test.ts`

**Interfaces:**

- Consumes: `useCapitalSummary`, `type CapitalSummary` (`@/modules/accounts`); `useIncomeSources`, `useInflows`, `InflowSheet` (`@/modules/income`); `useExpenses` (`@/modules/expenses`); `useBudgets` (`@/modules/budgets`); `useRates`, `useDisplayCurrency`, `MoneyText`, `todayIso` (`@/modules/rates`); `useCurrencyRegistry`; the domain read models above.
- Produces (public `@/modules/dashboard`): `useDashboard(): { model: ComputedRef<DashboardModel | undefined>; isLoading: ComputedRef<boolean>; rateDate: ComputedRef<string> }`, `buildDashboard(input): DashboardModel | undefined`, `DashboardPage` (async). Test ids: `dash-capital`, `capital-total` (kept from phase 2 so the smoke test's first assertion still holds), `dash-available`, `dash-days`, `dash-per-day`, `dash-payday-setup`, `dash-net-income`, `dash-outgo`, `dash-essential`, `dash-remainder` (with `data-sign="positive|negative|zero"`), `dash-plan-empty`, `dash-inflow-row-<sourceId>`, `dash-record-inflow`, `dash-inflows-empty`, `dash-upcoming-day-<date>`, `dash-upcoming-undated`, `dash-upcoming-empty`, `dash-unconvertible`.

- [ ] **Step 1: Write the failing test for the pure builder**

`apps/web/test/build-dashboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  type Budget,
  type Expense,
  type IncomeSource,
  type Inflow,
} from '@magermoney/domain';
import { buildDashboard } from '../src/modules/dashboard/application/build-dashboard.js';

const reg = CurrencyRegistry.default();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const table = new RateTable(
  '2026-09-17',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.2'), date: '2026-09-17', source: 'api' }],
  reg,
);
const source = (over: Partial<IncomeSource> = {}): IncomeSource => ({
  id: 's1',
  name: 'Job',
  grossAmount: Money.of('3000', USD),
  taxRate: new Decimal(0),
  commissionRate: new Decimal(0),
  payDays: [10, 25],
  isPrimary: true,
  defaultAccountId: null,
  activeFrom: '2026-01-01',
  activeTo: null,
  ...over,
});
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  categoryId: 'c',
  name: 'Rent',
  amount: Money.of('1000', EUR),
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2026-01-01',
  activeTo: null,
  ...over,
});
const budget: Budget = {
  id: 'b1',
  name: 'Groceries',
  icon: null,
  monthlyLimit: Money.of('300', USD),
  activeFrom: '2026-01-01',
  activeTo: null,
};
const inflow: Inflow = {
  id: 'i1',
  incomeSourceId: 's1',
  amount: Money.of('1500', USD),
  receivedOn: '2026-09-10',
  realisedRateToUsd: null,
  accountId: null,
  creditedAmount: null,
  note: null,
};
const capital = {
  total: Money.of('5000', USD),
  availableUntilPayday: Money.of('800', USD),
  unconvertible: [],
  groups: [],
  archived: [],
};
const input = (over: object = {}) => ({
  capital,
  sources: [source()],
  expenses: [
    expense(),
    expense({
      id: 'e2',
      name: 'Gym',
      amount: Money.of('30', USD),
      billingDay: null,
      isEssential: false,
    }),
  ],
  budgets: [budget],
  inflows: [inflow],
  table,
  registry: reg,
  display: 'USD',
  today: '2026-09-17',
  ...over,
});

describe('buildDashboard', () => {
  it('counts the days to the primary source payday and what that leaves per day', () => {
    const d = buildDashboard(input())!;
    expect(d.payday.date).toBe('2026-09-25');
    expect(d.payday.days).toBe(8);
    expect(d.payday.perDay?.toString()).toBe('100');
  });

  it('has no payday without a primary source with pay days', () => {
    const d = buildDashboard(input({ sources: [source({ payDays: [] })] }))!;
    expect(d.payday).toEqual({ date: null, days: null, perDay: null });
  });

  it('plans the month in the display currency', () => {
    const d = buildDashboard(input())!;
    expect(d.plan.netIncome.round().toString()).toBe('3000');
    expect(d.plan.plannedOutgo.round().toString()).toBe('1530');
    expect(d.plan.essential.round().toString()).toBe('1200');
    expect(d.plan.remainder.round().toString()).toBe('1470');
  });

  it('sets received against expected for the current month', () => {
    const row = buildDashboard(input())!.inflows.rows[0]!;
    expect(row.received.round().toString()).toBe('1500');
    expect(row.expected.round().toString()).toBe('3000');
  });

  it('groups upcoming events by date and counts expenses that have no date', () => {
    const d = buildDashboard(input())!;
    expect(d.upcoming[0]?.date).toBe('2026-09-25');
    expect(d.upcoming[0]?.events[0]?.kind).toBe('payout');
    expect(
      d.upcoming.some((g) => g.date === '2026-10-05' && g.events.some((e) => e.name === 'Rent')),
    ).toBe(true);
    expect([...d.upcoming.map((g) => g.date)]).toEqual([...d.upcoming.map((g) => g.date)].sort());
    expect(d.undatedExpenses).toBe(1);
  });

  it('says what is missing, so each block can show its empty state', () => {
    const d = buildDashboard(input({ sources: [], expenses: [], budgets: [], inflows: [] }))!;
    expect(d.has).toEqual({ sources: false, outgo: false });
    expect(d.upcoming).toEqual([]);
  });

  it('is undefined until capital, rates and the display currency exist', () => {
    expect(buildDashboard(input({ capital: undefined }))).toBeUndefined();
    expect(buildDashboard(input({ table: undefined }))).toBeUndefined();
    expect(buildDashboard(input({ display: 'XXX' }))).toBeUndefined();
  });
});
```

Run: `bun run --filter @magermoney/web test -- build-dashboard` — Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Implement the builder and the composable**

`application/build-dashboard.ts`:

```ts
import {
  daysToPayday,
  inflowsVsPlan,
  isActiveOn,
  monthPlan,
  nextPayday,
  parseIso,
  perDay,
  upcomingEvents,
  type Budget,
  type CurrencyRegistry,
  type Expense,
  type IncomeSource,
  type Inflow,
  type InflowsVsPlan,
  type IsoDate,
  type Money,
  type MonthPlan,
  type RateTable,
  type UpcomingEvent,
} from '@magermoney/domain';
import type { CapitalSummary } from '@/modules/accounts';

export const UPCOMING_DAYS = 30;

export interface DashboardInput {
  capital: CapitalSummary | undefined;
  sources: readonly IncomeSource[];
  expenses: readonly Expense[];
  budgets: readonly Budget[];
  /** Inflows of the current month only. */
  inflows: readonly Inflow[];
  table: RateTable | undefined;
  registry: CurrencyRegistry;
  display: string;
  today: IsoDate;
}
export interface UpcomingDay {
  date: IsoDate;
  events: UpcomingEvent[];
}
export interface DashboardModel {
  capital: CapitalSummary;
  payday: { date: IsoDate | null; days: number | null; perDay: Money | null };
  plan: MonthPlan;
  inflows: InflowsVsPlan;
  upcoming: UpcomingDay[];
  /** Active expenses the Upcoming list cannot place: no billing day, or yearly without a month. */
  undatedExpenses: number;
  has: { sources: boolean; outgo: boolean };
}

const isUndated = (e: Expense) =>
  e.billingDay === null || (e.period === 'yearly' && e.billingMonth === null);

/** Pure: the whole home screen. Undefined while capital, rates or the display currency are missing. */
export function buildDashboard(input: DashboardInput): DashboardModel | undefined {
  const { capital, sources, expenses, budgets, inflows, table, registry, today } = input;
  const display = registry.get(input.display);
  if (!capital || !table || display.isErr()) return undefined;

  const days = daysToPayday(sources, today);
  const { year, month } = parseIso(today);
  const byDate = new Map<IsoDate, UpcomingEvent[]>();
  for (const e of upcomingEvents({ sources, expenses, today, days: UPCOMING_DAYS }))
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const activeExpenses = expenses.filter((e) => isActiveOn(e, today));
  return {
    capital,
    payday: {
      date: nextPayday(sources, today),
      days,
      perDay: days === null ? null : perDay(capital.availableUntilPayday, days),
    },
    plan: monthPlan({ sources, expenses, budgets, table, display: display.value, today }),
    inflows: inflowsVsPlan({
      sources,
      inflows,
      month: { year, month },
      table,
      display: display.value,
    }),
    upcoming: [...byDate.entries()].map(([date, events]) => ({ date, events })),
    undatedExpenses: activeExpenses.filter(isUndated).length,
    has: {
      sources: sources.some((s) => isActiveOn(s, today)),
      outgo: activeExpenses.length > 0 || budgets.some((b) => isActiveOn(b, today)),
    },
  };
}
```

`application/use-dashboard.ts`:

```ts
import { computed, type ComputedRef } from 'vue';
import { firstOfMonth, lastOfMonth } from '@magermoney/domain';
import { useCapitalSummary } from '@/modules/accounts';
import { useBudgets } from '@/modules/budgets';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useExpenses } from '@/modules/expenses';
import { useIncomeSources, useInflows } from '@/modules/income';
import { todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { buildDashboard, type DashboardModel } from './build-dashboard';

/** The home screen has no data of its own (CONTEXT.md, Dashboard): it composes what the other modules already hold. */
export function useDashboard(): {
  model: ComputedRef<DashboardModel | undefined>;
  isLoading: ComputedRef<boolean>;
  rateDate: ComputedRef<string>;
} {
  const today = todayIso();
  const capital = useCapitalSummary();
  const sources = useIncomeSources();
  const expenses = useExpenses();
  const budgets = useBudgets();
  const inflows = useInflows(() => ({ from: firstOfMonth(today), to: lastOfMonth(today) }));
  const rates = useRates();
  const registry = useCurrencyRegistry();
  const { current } = useDisplayCurrency();

  return {
    model: computed(() =>
      buildDashboard({
        capital: capital.summary.value,
        sources: sources.sources.value,
        expenses: expenses.expenses.value,
        budgets: budgets.budgets.value,
        inflows: inflows.inflows.value,
        table: rates.table.value,
        registry: registry.value,
        display: current.value,
        today,
      }),
    ),
    isLoading: computed(
      () =>
        capital.isLoading.value ||
        sources.isLoading.value ||
        expenses.isLoading.value ||
        budgets.isLoading.value ||
        inflows.isLoading.value,
    ),
    rateDate: capital.rateDate,
  };
}
```

Run: `bun run --filter @magermoney/web test -- build-dashboard` — Expected: PASS (7 tests).

- [ ] **Step 3: Copy** (both locale files; `/humanize-text:humanize-text` on RU afterwards)

Extend the existing `dashboard` object (Task 19 put `dashboard.title` there):

| key                           | RU                                                                  | EN                                                          |
| ----------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `dashboard.capital.total`     | Всего денег                                                         | Total money                                                 |
| `dashboard.capital.rateDate`  | по курсу на {date}                                                  | at the rates of {date}                                      |
| `dashboard.capital.open`      | Открыть счета                                                       | Open accounts                                               |
| `dashboard.unconvertible`     | Нет курса для: {codes}. Эти суммы не вошли в итог.                  | No rate for: {codes}. Left out of the total.                |
| `dashboard.payday.available`  | Доступно до зарплаты                                                | Available until payday                                      |
| `dashboard.payday.today`      | Сегодня зарплата                                                    | Payday today                                                |
| `dashboard.payday.days`       | {n} день до зарплаты \| {n} дня до зарплаты \| {n} дней до зарплаты | {n} day to payday \| {n} days to payday                     |
| `dashboard.payday.perDay`     | в день                                                              | per day                                                     |
| `dashboard.payday.setup`      | Отметьте основной источник и дни выплат — появится счётчик дней     | Mark a primary source and its pay days to see the countdown |
| `dashboard.plan.title`        | План месяца                                                         | Month plan                                                  |
| `dashboard.plan.netIncome`    | Чистый доход                                                        | Net income                                                  |
| `dashboard.plan.outgo`        | Плановые траты                                                      | Planned outgo                                               |
| `dashboard.plan.essential`    | из них обязательные                                                 | of which essential                                          |
| `dashboard.plan.remainder`    | Остаётся                                                            | Remainder                                                   |
| `dashboard.plan.empty`        | Добавьте доходы и расходы — здесь появится план месяца              | Add income and expenses to see the month plan               |
| `dashboard.plan.emptyCta`     | Открыть план                                                        | Open the plan                                               |
| `dashboard.inflows.title`     | Поступления месяца                                                  | Inflows this month                                          |
| `dashboard.inflows.of`        | из                                                                  | of                                                          |
| `dashboard.inflows.record`    | Записать поступление                                                | Record inflow                                               |
| `dashboard.inflows.empty`     | Пока нет источников дохода                                          | No income sources yet                                       |
| `dashboard.inflows.emptyCta`  | Добавить источник                                                   | Add a source                                                |
| `dashboard.upcoming.title`    | Ближайшие 30 дней                                                   | Next 30 days                                                |
| `dashboard.upcoming.payout`   | выплата                                                             | payout                                                      |
| `dashboard.upcoming.expense`  | списание                                                            | charge                                                      |
| `dashboard.upcoming.undated`  | ещё {n} без даты                                                    | {n} more without a date                                     |
| `dashboard.upcoming.empty`    | Укажите дни выплат и дни списания — события появятся здесь          | Set pay days and billing days to see what is coming         |
| `dashboard.upcoming.emptyCta` | К расходам                                                          | To expenses                                                 |

`nav.home` and `dashboard.title` are already present from Task 19 — do not add them again. Russian plural note: `dashboard.payday.days` is written in the three forms (one · few · many) that `ruPlural` from `@/app/i18n` (Task 19, wired as `pluralRules.ru`) selects; zero days has its own key because a three-form message has no slot for it. Do not redefine `ruPlural` here. The EN message has two forms, which vue-i18n's default rule handles.

- [ ] **Step 4: Design pass**

Run `/frontend-design` with this brief: the home screen answers, top to bottom, "how much, how long will it last, does the month add up, did the money arrive, what is next" (`docs/design/direction.md`). (1) Capital: the 40px amount lockup, the whole block a link to Accounts; (2) until payday: one hairline row group — available amount, then "N дней до зарплаты" and "X в день" as mono-labelled secondary figures; (3) month plan: three ledger rows, the remainder the **only** coloured number on the screen (`text-positive` / `text-negative`), essential as a muted sub-line under outgo; (4) inflows: one row per source, "received из expected" with a 2px `ProgressRule` beneath in ink, never green; a quiet outline button "Записать поступление"; (5) upcoming: mono date headers, rows with own-currency amount large and display conversion small; payouts are marked by the word, not by colour. Blocks are separated by hairlines and whitespace, not cards. Keep every `data-testid`.

- [ ] **Step 5: Write the failing page test**

`apps/web/test/DashboardPage.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { ruPlural } from '../src/app/i18n.js';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import DashboardPage from '../src/modules/dashboard/ui/DashboardPage.vue';

const SRC = '11111111-1111-4111-8111-111111111111';
const profile = {
  id: 'u',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
const currencies = [
  { code: 'USD', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
  { code: 'EUR', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
];
const rates = [{ base: 'EUR', quote: 'USD', value: '1.2', date: '2026-09-17', source: 'api' }];
const account = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Card',
  bank: 'Bank',
  country: 'PT',
  currency: 'USD',
  kind: 'cash',
  cardType: null,
  isSpending: true,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '800',
  balanceRecordedAt: null,
};
const sourceDto = {
  id: SRC,
  name: 'Job',
  grossAmount: '3000',
  currency: 'USD',
  taxRate: '0',
  commissionRate: '0',
  payDays: [10, 25],
  isPrimary: true,
  activeFrom: '2026-01-01',
  activeTo: null,
  defaultAccountId: null,
  netMonthly: '3000',
};
const inflowDto = {
  id: '33333333-3333-4333-8333-333333333333',
  incomeSourceId: SRC,
  amount: '1500',
  currency: 'USD',
  receivedOn: '2026-09-10',
  realisedRateToUsd: null,
  accountId: null,
  creditedAmount: null,
  realisedRate: null,
  note: null,
};
const expenseDto = {
  id: '44444444-4444-4444-8444-444444444444',
  categoryId: '55555555-5555-4555-8555-555555555555',
  name: 'Rent',
  amount: '1000',
  currency: 'EUR',
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2026-01-01',
  activeTo: null,
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function mountPage(data: { sources: unknown[]; inflows: unknown[]; expenses: unknown[] }) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json(currencies);
    if (path.startsWith('/rates')) return json(rates);
    if (path === '/accounts') return json([account]);
    if (path.startsWith('/income-sources')) return json(data.sources);
    if (path.startsWith('/inflows')) return json(data.inflows);
    if (path === '/expenses') return json(data.expenses);
    return json([]); // budgets, expense-categories
  });
  const blank = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: DashboardPage },
      { path: '/accounts', name: 'accounts', component: blank },
      { path: '/plan', name: 'plan', component: blank },
      { path: '/plan/income/:id', name: 'income-source', component: blank },
    ],
  });
  return mount(DashboardPage, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
        createI18n({
          legacy: false,
          locale: 'ru',
          messages: { ru },
          pluralRules: { ru: ruPlural },
        }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
      stubs: {
        Motion: { template: '<div><slot /></div>' },
        InflowSheet: {
          props: ['open'],
          template: '<div data-testid="inflow-sheet" :data-open="String(open)" />',
        },
      },
    },
  });
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-17T09:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('shows capital, days to payday, the month plan, inflows and what is coming', async () => {
    const w = mountPage({ sources: [sourceDto], inflows: [inflowDto], expenses: [expenseDto] });
    await flushPromises();
    expect(w.get('[data-testid="capital-total"]').text()).toContain('800');
    expect(w.get('[data-testid="dash-days"]').text()).toContain('8 дней');
    expect(w.get('[data-testid="dash-per-day"]').text()).toContain('100');
    expect(w.get('[data-testid="dash-net-income"]').text()).toContain('3');
    expect(w.get('[data-testid="dash-remainder"]').attributes('data-sign')).toBe('positive');
    expect(w.get(`[data-testid="dash-inflow-row-${SRC}"]`).text()).toContain('из');
    expect(w.find('[data-testid="dash-upcoming-day-2026-09-25"]').exists()).toBe(true);
    expect(w.find('[data-testid="dash-upcoming-day-2026-10-05"]').exists()).toBe(true);
  });

  it('opens the inflow sheet from the inflows block', async () => {
    const w = mountPage({ sources: [sourceDto], inflows: [], expenses: [] });
    await flushPromises();
    expect(w.get('[data-testid="inflow-sheet"]').attributes('data-open')).toBe('false');
    await w.get('[data-testid="dash-record-inflow"]').trigger('click');
    expect(w.get('[data-testid="inflow-sheet"]').attributes('data-open')).toBe('true');
  });

  it('leads to the matching Plan segment from each empty state', async () => {
    const w = mountPage({ sources: [], inflows: [], expenses: [] });
    await flushPromises();
    expect(w.get('[data-testid="dash-payday-setup"]').attributes('href')).toBe('/plan?tab=income');
    expect(w.get('[data-testid="dash-plan-empty"] a').attributes('href')).toBe('/plan?tab=income');
    expect(w.get('[data-testid="dash-inflows-empty"] a').attributes('href')).toBe(
      '/plan?tab=income',
    );
    expect(w.get('[data-testid="dash-upcoming-empty"] a').attributes('href')).toBe(
      '/plan?tab=expenses',
    );
  });
});
```

Run: `bun run --filter @magermoney/web test -- DashboardPage` — Expected: FAIL (placeholder has none of the test ids).

- [ ] **Step 6: The five blocks**

`ui/CapitalBlock.vue`:

```vue
<script setup lang="ts">
/** The one number. The whole block is the way into Accounts. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CapitalSummary } from '@/modules/accounts';
import { MoneyText } from '@/modules/rates';

const { capital, rateDate } = defineProps<{ capital: CapitalSummary; rateDate: string }>();
const { t } = useI18n();
const codes = computed(() =>
  [...new Set(capital.unconvertible.map((a) => a.balance.currency.code))].join(', '),
);
</script>

<template>
  <section data-testid="dash-capital">
    <RouterLink
      :to="{ name: 'accounts' }"
      :aria-label="t('dashboard.capital.open')"
      class="block pt-1 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <p class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('dashboard.capital.total') }}
      </p>
      <MoneyText
        data-testid="capital-total"
        class="mt-1 text-[40px] font-semibold tracking-[-0.01em]"
        :amount="capital.total.toString()"
        :currency="capital.total.currency.code"
      />
      <p class="mt-1 text-xs text-muted-foreground">
        {{ t('dashboard.capital.rateDate', { date: rateDate }) }}
      </p>
    </RouterLink>
    <p
      v-if="capital.unconvertible.length > 0"
      class="mt-3 text-xs text-muted-foreground"
      data-testid="dash-unconvertible"
    >
      {{ t('dashboard.unconvertible', { codes }) }}
    </p>
  </section>
</template>
```

`ui/UntilPaydayBlock.vue`:

```vue
<script setup lang="ts">
/** How much can be spent, for how long, and what that comes to per day. */
import { useI18n } from 'vue-i18n';
import type { Money } from '@magermoney/domain';
import { MoneyText } from '@/modules/rates';

defineProps<{ available: Money; days: number | null; perDay: Money | null }>();
const { t } = useI18n();
</script>

<template>
  <section class="mt-5 border-t border-border pt-3">
    <div class="flex items-baseline justify-between gap-3">
      <span class="text-sm text-muted-foreground">{{ t('dashboard.payday.available') }}</span>
      <MoneyText
        data-testid="dash-available"
        class="text-base"
        :amount="available.toString()"
        :currency="available.currency.code"
      />
    </div>
    <div
      v-if="days !== null && perDay"
      class="mt-1 flex items-baseline justify-between gap-3 text-sm"
    >
      <span data-testid="dash-days" class="text-muted-foreground">{{
        days === 0 ? t('dashboard.payday.today') : t('dashboard.payday.days', { n: days }, days)
      }}</span>
      <span data-testid="dash-per-day">
        <MoneyText :amount="perDay.toString()" :currency="perDay.currency.code" />
        <span class="text-xs text-muted-foreground"> {{ t('dashboard.payday.perDay') }}</span>
      </span>
    </div>
    <RouterLink
      v-else
      :to="{ name: 'plan', query: { tab: 'income' } }"
      data-testid="dash-payday-setup"
      class="mt-1 block text-xs text-primary underline-offset-4 hover:underline"
    >
      {{ t('dashboard.payday.setup') }}
    </RouterLink>
  </section>
</template>
```

`ui/MonthPlanBlock.vue`:

```vue
<script setup lang="ts">
/** Does the month add up. The remainder is the only number on the home screen allowed a colour. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MonthPlan } from '@magermoney/domain';
import { MoneyText } from '@/modules/rates';

const { plan, empty } = defineProps<{ plan: MonthPlan; empty: boolean }>();
const { t } = useI18n();
const sign = computed(() =>
  plan.remainder.isZero() ? 'zero' : plan.remainder.isNegative() ? 'negative' : 'positive',
);
const names = computed(() => plan.unconvertible.map((r) => r.name).join(', '));
</script>

<template>
  <section class="mt-8 border-t border-border pt-3">
    <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('dashboard.plan.title') }}
    </h2>
    <div v-if="empty" class="mt-3 text-sm text-muted-foreground" data-testid="dash-plan-empty">
      <p>{{ t('dashboard.plan.empty') }}</p>
      <RouterLink
        :to="{ name: 'plan', query: { tab: 'income' } }"
        class="mt-1 inline-block text-primary underline-offset-4 hover:underline"
      >
        {{ t('dashboard.plan.emptyCta') }}
      </RouterLink>
    </div>
    <dl v-else class="mt-2 text-sm">
      <div class="flex items-baseline justify-between py-1">
        <dt>{{ t('dashboard.plan.netIncome') }}</dt>
        <dd data-testid="dash-net-income">
          <MoneyText :amount="plan.netIncome.toString()" :currency="plan.netIncome.currency.code" />
        </dd>
      </div>
      <div class="flex items-baseline justify-between py-1">
        <dt>{{ t('dashboard.plan.outgo') }}</dt>
        <dd data-testid="dash-outgo">
          <MoneyText
            :amount="plan.plannedOutgo.toString()"
            :currency="plan.plannedOutgo.currency.code"
          />
        </dd>
      </div>
      <div class="flex items-baseline justify-between pb-1 text-xs text-muted-foreground">
        <dt>{{ t('dashboard.plan.essential') }}</dt>
        <dd data-testid="dash-essential">
          <MoneyText :amount="plan.essential.toString()" :currency="plan.essential.currency.code" />
        </dd>
      </div>
      <div class="flex items-baseline justify-between border-t border-border/60 py-2 text-base">
        <dt>{{ t('dashboard.plan.remainder') }}</dt>
        <dd
          data-testid="dash-remainder"
          :data-sign="sign"
          :class="{ 'text-positive': sign === 'positive', 'text-negative': sign === 'negative' }"
        >
          <MoneyText :amount="plan.remainder.toString()" :currency="plan.remainder.currency.code" />
        </dd>
      </div>
    </dl>
    <p v-if="!empty && plan.unconvertible.length > 0" class="mt-1 text-xs text-muted-foreground">
      {{ t('dashboard.unconvertible', { codes: names }) }}
    </p>
  </section>
</template>
```

`ui/MonthInflowsBlock.vue`:

```vue
<script setup lang="ts">
/** Did the money arrive: received of expected, per source, this month. */
import { useI18n } from 'vue-i18n';
import type { InflowsVsPlan, InflowsVsPlanRow } from '@magermoney/domain';
import { Button, ProgressRule } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';

defineProps<{ inflows: InflowsVsPlan; empty: boolean }>();
const emit = defineEmits<{ record: [] }>();
const { t } = useI18n();
/** Drawing only: the bar's length. Amounts stay decimal everywhere else (ADR 0001). */
const ratio = (r: InflowsVsPlanRow) => ({
  value: r.received.amount.toNumber(),
  max: Math.max(r.expected.amount.toNumber(), r.received.amount.toNumber(), 1),
});
</script>

<template>
  <section class="mt-8 border-t border-border pt-3">
    <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('dashboard.inflows.title') }}
    </h2>
    <div v-if="empty" class="mt-3 text-sm text-muted-foreground" data-testid="dash-inflows-empty">
      <p>{{ t('dashboard.inflows.empty') }}</p>
      <RouterLink
        :to="{ name: 'plan', query: { tab: 'income' } }"
        class="mt-1 inline-block text-primary underline-offset-4 hover:underline"
      >
        {{ t('dashboard.inflows.emptyCta') }}
      </RouterLink>
    </div>
    <template v-else>
      <ul class="divide-y divide-border/60">
        <li v-for="r in inflows.rows" :key="r.sourceId">
          <RouterLink
            :to="{ name: 'income-source', params: { id: r.sourceId } }"
            :data-testid="`dash-inflow-row-${r.sourceId}`"
            class="block min-h-13 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span class="flex items-baseline justify-between gap-3">
              <span class="min-w-0 truncate text-[15px]">{{ r.name }}</span>
              <span class="text-sm">
                <MoneyText :amount="r.received.toString()" :currency="r.received.currency.code" />
                <span class="text-xs text-muted-foreground"> {{ t('dashboard.inflows.of') }} </span>
                <MoneyText
                  class="text-muted-foreground"
                  :amount="r.expected.toString()"
                  :currency="r.expected.currency.code"
                />
              </span>
            </span>
            <ProgressRule class="mt-2" v-bind="ratio(r)" />
          </RouterLink>
        </li>
      </ul>
      <Button
        variant="outline"
        class="mt-3 min-h-9 w-full pointer-coarse:min-h-11"
        data-testid="dash-record-inflow"
        @click="emit('record')"
      >
        {{ t('dashboard.inflows.record') }}
      </Button>
    </template>
  </section>
</template>
```

`ui/UpcomingBlock.vue`:

```vue
<script setup lang="ts">
/** What is next: payouts and charges for thirty days, in their own currency first. */
import { useI18n } from 'vue-i18n';
import { MoneyText } from '@/modules/rates';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import type { UpcomingDay } from '../application/build-dashboard';

defineProps<{ days: UpcomingDay[]; undated: number }>();
const { t, locale } = useI18n();
/** `formatDay` (Task 21) formats a calendar date at local noon, so no zone moves it a day back. */
const day = (iso: string) => formatDay(iso, locale.value as DateLocale);
</script>

<template>
  <section class="mt-8 border-t border-border pt-3">
    <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('dashboard.upcoming.title') }}
    </h2>
    <div
      v-if="days.length === 0"
      class="mt-3 text-sm text-muted-foreground"
      data-testid="dash-upcoming-empty"
    >
      <p>{{ t('dashboard.upcoming.empty') }}</p>
      <RouterLink
        :to="{ name: 'plan', query: { tab: 'expenses' } }"
        class="mt-1 inline-block text-primary underline-offset-4 hover:underline"
      >
        {{ t('dashboard.upcoming.emptyCta') }}
      </RouterLink>
    </div>
    <div v-for="d in days" :key="d.date" class="mt-3" :data-testid="`dash-upcoming-day-${d.date}`">
      <h3 class="font-mono text-xs tabular-nums text-muted-foreground">{{ day(d.date) }}</h3>
      <ul class="divide-y divide-border/60">
        <li
          v-for="e in d.events"
          :key="`${e.kind}-${e.refId}`"
          class="flex min-h-13 items-center gap-3 py-2"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[15px]">{{ e.name }}</span>
            <span class="block text-xs text-muted-foreground">{{
              t(`dashboard.upcoming.${e.kind}`)
            }}</span>
          </span>
          <span class="text-right">
            <span class="block font-mono text-[15px] tabular-nums"
              >{{ e.kind === 'payout' ? '+' : '−' }}{{ e.amount.round().toString() }}
              {{ e.amount.currency.code }}</span
            >
            <MoneyText
              class="text-xs text-muted-foreground"
              :amount="e.amount.toString()"
              :currency="e.amount.currency.code"
            />
          </span>
        </li>
      </ul>
    </div>
    <p
      v-if="undated > 0 && days.length > 0"
      class="mt-3 text-xs text-muted-foreground"
      data-testid="dash-upcoming-undated"
    >
      {{ t('dashboard.upcoming.undated', { n: undated }) }}
    </p>
  </section>
</template>
```

- [ ] **Step 7: The page and the barrel**

`ui/DashboardPage.vue`:

```vue
<script setup lang="ts">
/**
 * Home. A read model and nothing else (CONTEXT.md, Dashboard): every number is
 * derived on the client from what the other modules hold (ADR 0003).
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Skeleton } from '@magermoney/ui';
import { InflowSheet } from '@/modules/income';
import { useDashboard } from '../application/use-dashboard';
import CapitalBlock from './CapitalBlock.vue';
import MonthInflowsBlock from './MonthInflowsBlock.vue';
import MonthPlanBlock from './MonthPlanBlock.vue';
import UntilPaydayBlock from './UntilPaydayBlock.vue';
import UpcomingBlock from './UpcomingBlock.vue';

const { t } = useI18n();
const { model, rateDate } = useDashboard();
const inflowOpen = ref(false);
</script>

<template>
  <section class="pb-8">
    <h1 class="sr-only">{{ t('dashboard.title') }}</h1>
    <div v-if="!model" class="space-y-4 pt-1">
      <Skeleton class="h-10 w-48" />
      <Skeleton class="h-5 w-full" />
      <Skeleton class="h-24 w-full" />
    </div>
    <template v-else>
      <CapitalBlock :capital="model.capital" :rate-date="rateDate" />
      <UntilPaydayBlock
        :available="model.capital.availableUntilPayday"
        :days="model.payday.days"
        :per-day="model.payday.perDay"
      />
      <MonthPlanBlock :plan="model.plan" :empty="!model.has.sources && !model.has.outgo" />
      <MonthInflowsBlock
        :inflows="model.inflows"
        :empty="model.inflows.rows.length === 0"
        @record="inflowOpen = true"
      />
      <UpcomingBlock :days="model.upcoming" :undated="model.undatedExpenses" />
    </template>
    <InflowSheet v-model:open="inflowOpen" />
  </section>
</template>
```

Confirm `modules/dashboard/index.ts` reads:

```ts
import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the dashboard module. It owns no data: a read model over the other modules. */
export { useDashboard } from './application/use-dashboard';
export {
  buildDashboard,
  type DashboardModel,
  type DashboardInput,
} from './application/build-dashboard';
export const DashboardPage = routeComponent(() => import('./ui/DashboardPage.vue'));
```

If `InflowSheet` is exported async by Task 22 rather than sync, the test stub still matches by name; nothing changes here.

- [ ] **Step 8: Run, polish, verify**

Run: `bun run --filter @magermoney/web test -- build-dashboard DashboardPage locales shell` — Expected: PASS.
Then `/animate`: blocks may enter with `listStagger(index)`; `MoneyText` already cross-fades on a currency switch; nothing counts up, nothing bounces. `/impeccable` at 390 px and desktop, light and dark, with (a) full data, (b) a brand-new account (every empty state), (c) a negative remainder. `/humanize-text:humanize-text` on the RU strings. Finish with `bun run lint && bun run typecheck && bun run --filter @magermoney/web test && bun run --filter @magermoney/web build`, and check in the build output that `DashboardPage` and the form pages are separate chunks, not in the entry chunk.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/modules/dashboard apps/web/src/app/i18n.ts apps/web/src/locales apps/web/test/build-dashboard.test.ts apps/web/test/DashboardPage.test.ts
git commit -m "feat(web): make the dashboard the home screen"
```

Trailers as in Global Constraints.

---

### Task 27: E2E scenario, docs, ledger, final verification and the pull request

**Assumes** (test ids produced by Tasks 21–22; if they differ, change the selectors below, not the components): income source form — `source-name`, `source-gross`, `source-currency` (a native `<select>`), `source-submit`; inflow sheet — `inflow-source` (a `<select>` whose options are labelled with the source name), `inflow-amount`, `inflow-account` (a `<select>` labelled "<name> · <balance> <currency>", like `transfer-from`), `inflow-save`; quick actions — `fab`, `quick-inflow`. Dashboard ids come from Task 26.

**Files:**

- Modify: `apps/web/e2e/smoke.spec.ts`, `CONTEXT.md`, `docs/discovery/decisions-log.md`, `README.md`, `AGENTS.md`, `docs/db/schema.dbml` (final check only)
- Create or complete: `docs/discovery/phase-3-execution-ledger.md`

**Interfaces:**

- Consumes: everything. Produces: a green branch `feat/phase-3-income-expenses` and an open PR to `main`. **Nothing is merged by the executor.**

- [ ] **Step 1: Extend the smoke scenario**

In `apps/web/e2e/smoke.spec.ts`, hoist `selectAccountByName` above its first use and rename it `selectByText` (same body). After the phase 2 assertion `await expect(page.getByTestId('capital-total')).toContainText('110');` and **before** the final switch back to EUR, insert:

```ts
// Phase 3: an income source, then an inflow credited to Beta.
await page.goto('/plan/income/new');
await page.getByTestId('source-name').fill('Job');
await page.getByTestId('source-gross').fill('3000');
await page.getByTestId('source-currency').selectOption('USD');
await page.getByTestId('source-submit').click();
await expect(page).toHaveURL(/\/plan/);

await page.goto('/');
await page.getByTestId('dash-record-inflow').click();
await selectByText(page.getByTestId('inflow-source'), 'Job');
await page.getByTestId('inflow-amount').fill('1000');
await selectByText(page.getByTestId('inflow-account'), 'Beta');
await page.getByTestId('inflow-save').click();

// The dashboard shows it against the plan, and total capital grew by the credit: 110 → 1110.
await expect(page.locator('[data-testid^="dash-inflow-row-"]').first()).toContainText('1');
await expect(page.locator('[data-testid^="dash-inflow-row-"]').first()).toContainText('000');
await expect(page.getByTestId('capital-total')).toContainText('1');
await expect(page.getByTestId('capital-total')).toContainText('110');

// And the Account's own balance grew: Beta held 50.
await page.goto('/accounts');
await page.getByText('Beta', { exact: true }).first().click();
await expect(page.getByTestId('account-balance')).toContainText('1050');
await page.goto('/');
```

State of the file when this step starts: Task 19 already repointed the two phase 2 `await page.goto('/')` calls that precede a `capital-total` assertion to `/accounts`. Change them back to `await page.goto('/')` now — home is the real Dashboard again, `CapitalBlock` carries the same `capital-total` test id, and the currency switch lives in the shell, so the phase 2 assertions (`110`, then `€` after the switch back to EUR) hold on the Dashboard unchanged and the scenario checks the screen a person actually lands on. The account-creation loop and the transfer steps are untouched (they navigate by URL). The source's currency is selected explicitly so the numbers above do not depend on the form's default.

The test stays gated by `E2E_ENABLED`. Run it once locally and record the outcome in the ledger under "Not run" or in a ruling:

```bash
supabase start && supabase db reset
cd apps/web && E2E_BASE_URL=http://localhost:5173 \
  E2E_SUPABASE_URL=http://127.0.0.1:54321 \
  E2E_SUPABASE_ANON_KEY=<anon key from `supabase status -o env`> \
  E2E_SUPABASE_SERVICE_ROLE_KEY=<service role key from the same output> \
  bun run test:e2e
```

(with `bun run dev` running in `apps/api` and `apps/web`). Expected: 1 passed.

- [ ] **Step 2: `CONTEXT.md`**

Replace the four entries below; leave everything else as is.

**Income source** becomes:

```md
**Income source**:
A recurring origin of income with a monthly gross amount, tax rate, commission rate, a pay schedule (days of month) and an active period. Net is derived, never stored: gross × (1 − tax) × (1 − commission). One source is marked primary. A source with no pay days is irregular: it counts in the month plan with its expected amount (which may be zero) and never appears among upcoming events. One-off receipts belong to such a source ("Other"), so every Inflow has a source.
_Avoid_: Salary, job
```

**Pay schedule** becomes:

```md
**Pay schedule**:
The days of the month on which an Income source is expected to pay. The monthly net is split evenly across them; the last payout of the month absorbs the rounding remainder. A pay day beyond the month's length falls on the month's last day. "Days to payday" counts to the primary source's next pay day; payday today is zero.
```

**Inflow** becomes:

```md
**Inflow**:
An actual dated receipt of money from an Income source, in its own currency, optionally with the USD rate realised that day. May be credited to an Account, producing one Balance entry (new balance = latest balance + credited amount). When the Account's currency differs, both amounts are declared — the Inflow amount and the credited amount — and the realised rate is derived, exactly as for a cross-currency Transfer; nothing is converted automatically. A credited Inflow must be the newest entry on its Account when recorded, and can be edited or deleted only while it still is.
_Avoid_: Поступление as a separate concept from Inflow, transaction
```

**Dashboard** becomes:

```md
**Dashboard**:
The home screen: a read model assembled from Accounts, Income sources, Inflows, Expenses, Budgets and Rates (Goals from phase 4). Shows total capital, what is available until payday and per day, the month plan (net income − Planned monthly outgo = remainder), this month's Inflows against the expected net per source, and the payouts and charges of the next 30 days. Has no data of its own.
```

Also in **Balance entry**, append the sentence: `An entry made by a Transfer or an Inflow is changed only through that Transfer or Inflow.`

- [ ] **Step 3: Decisions log**

Append to `docs/discovery/decisions-log.md`:

```md
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

Execution rulings that changed owner-visible behaviour: see `docs/discovery/phase-3-execution-ledger.md`; copy here, one line each, every ruling from its "Rulings" section that changes what the owner sees or what the API answers.
```

The last paragraph is an instruction to the executor: replace it with the actual list before committing (the phase 2 section is the model).

- [ ] **Step 4: `README.md` and `AGENTS.md`**

`README.md`, section "Import from the spreadsheet" — Task 17 already replaced it (flags `--income-sources`, `--expenses`, `--inflows`, `--currency-of`, `--fallback-currency`, `--as-budget`, `--only`, `--dry-run`, `--force`, `--user`; the production line `bun --env-file=.env.prod.local scripts/import-sheet.ts …`). Do not rewrite it: read it once against `parseArgs` in `apps/api/scripts/import/run.ts` and fix any flag that drifted during execution. Its examples must use placeholder names only (`"Groceries"`, `"Deposit=RUB"`), never a name from the owner's sheets.

Also update the package table row for `packages/domain` to mention "pay schedule, plan read models".

`AGENTS.md`:

- Under **Layout → `apps/web`**, append: `Two modules own no data and only compose siblings through their barrels: \`dashboard\` (the home read model, \`buildDashboard\` is the pure core) and \`plan\` (the Plan screen with the income / expenses / budgets segments). A data module never imports another data module's screens; put a composed screen in one of these or add a new screen module.`
- Under **Layout → `apps/api`**, append: `A credited Inflow writes its \`origin = 'inflow'\` Balance entry inside the same \`deps.uow\` that holds the Account lock (\`modules/inflows/application/credit.ts\`), the same rule Transfers follow.`
- Under **Rules**, add: `Calendar dates are \`IsoDate\` strings; date arithmetic lives only in \`packages/domain/src/calendar.ts\`.`
- Under **Scripts**: Task 17 already rewrote the import line to name the phase 3 tables and mappers; only verify it.

- [ ] **Step 5: The execution ledger**

`docs/discovery/phase-3-execution-ledger.md` should already exist (Global Constraints: every ruling is appended in the commit it concerns). If it does not, create it now with this content; if it does, make sure these pre-made rulings are in it and the section skeleton matches:

```md
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

## Deferred minors

(grouped by task as they arise)

## Plan errata

(defects found in the plan's code or expected values, with the correction)

## Not run

(anything the plan asked to run that could not be run here, and why)

## Known follow-ups after the final review

- Spends and month close, Snapshots, Goals, Assets, the yearly-history import: phases 4–5.
- Offline parking covers record-balance, create-transfer and create-inflow only; edits and deletes still wait for the network (carried from phase 2).
- Idempotency keys for replayed writes (carried from phase 2): a lost response can make a replayed inflow appear twice.
- "Received this month" converts past Inflows with today's rates; historical-rate conversion belongs to phase 5 analytics.
```

- [ ] **Step 6: Full verification**

From the repo root, in order; every command must be green before the next:

```bash
bun install --frozen-lockfile
bun run lint && bun run typecheck && bun run test && bun run build
bun run lint:boundaries-check
supabase start && supabase db reset          # applies 0001–0011 from scratch + seed
bun run --filter @magermoney/api test:integration
supabase db lint
```

Expected: turbo reports every task successful; `packages/domain` coverage 100 %; `db reset` ends with "Finished supabase db reset"; the integration run includes `pg-inflow-credit-concurrency`, `pg-income-source-primary`, `pg-phase3-rls`, `pg-phase3-repositories`. Then check `docs/db/schema.dbml` against the five migrations one last time (`credited_amount`, the three checks on `inflows`, `pay_days` default, `inflow_id` no longer marked "later", `expense_categories` unique name).

Dry-run the import against the local database with the owner's files (they are on this machine, git-ignored; never print their rows into the ledger, the PR or a commit):

```bash
cd apps/api && bun run import -- --user <owner email> \
  --income-sources ../../imports/income-sources.csv --inflows ../../imports/inflows.csv \
  --expenses ../../imports/expenses.csv --dry-run
```

Expected: three tables and a totals line, exit code 0, nothing written. If it stops with a list of problems instead (typically a source known only from inflows whose currency it cannot tell), add the `--currency-of "<name>=<CODE>"` flags the messages name and run it again. Record only the counts, the number of `ambiguous` rows and the number of flags that were needed in the ledger — never a name or an amount.

- [ ] **Step 7: Definition of done — evidence**

Write this table into the PR body (Step 9), filled in:

| Spec §9                                                                                  | Evidence                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Migrations 0007–0011; `schema.dbml`, `CONTEXT.md` updated                             | `supabase db reset` green locally; production apply is the owner's step after merge (`db.yml`, `production` environment). Docs: commits of Tasks 7 and 27.    |
| 2. Home is the Dashboard; four tabs; Rates from Settings                                 | `DashboardPage.test.ts`, `shell.test.ts`, the e2e scenario; screenshots at 390 px attached.                                                                   |
| 3. Owner's data in production; net income matches the sheet                              | Owner's step after merge: import commands below. Local dry-run counts recorded in the ledger.                                                                 |
| 4. Credited Inflow (same and cross currency) updates the balance; offline Inflow replays | `inflows-credit.test.ts`, `pg-inflow-credit-concurrency.test.ts`, `InflowSheet` tests, `offline-mutations.test.ts`, e2e scenario. Phone check is the owner's. |
| 5. Days to payday and per-day appear once the primary source has pay days                | `build-dashboard.test.ts`, `DashboardPage.test.ts` (both the countdown and the setup link).                                                                   |
| 6. CI green; ledger committed                                                            | PR checks; `docs/discovery/phase-3-execution-ledger.md`.                                                                                                      |

- [ ] **Step 8: Commit**

```bash
git add apps/web/e2e CONTEXT.md README.md AGENTS.md docs/discovery docs/db/schema.dbml
git commit -m "docs: record phase 3 decisions and extend the smoke scenario"
```

Trailers as in Global Constraints. `git status` must be clean afterwards, and `git check-ignore imports/inflows.csv` must still print the path.

- [ ] **Step 9: Push and open the pull request — do not merge**

```bash
git push -u origin feat/phase-3-income-expenses
gh pr create --base main --head feat/phase-3-income-expenses \
  --title "feat: phase 3 — income, inflows, expenses, budgets, dashboard" \
  --body-file "$CLAUDE_JOB_DIR/tmp/pr-body.md"
```

with `pr-body.md`:

```md
## What

Phase 3 of the delivery plan (decisions log item 26): what comes in and what goes out.

- **Domain**: calendar arithmetic, pay schedule (`netMonthly`, `payoutsBetween`, `daysToPayday`, `perDay`), inflow credit (`deriveInflowCredit`, `applyInflow`), expenses and budgets, and the read models `monthPlan`, `upcomingEvents`, `inflowsVsPlan`. 100 % coverage, fast-check properties.
- **Database**: migrations 0007–0011 — `income_sources`, `inflows` (+ `credited_amount`), `balance_entries.inflow_id`, `expense_categories` + `expenses`, `budgets`; owner-only RLS on all of them.
- **API**: modules `income-sources`, `inflows`, `expenses` (with categories), `budgets`. A credited Inflow writes its Balance entry under the account lock; it must be the account's latest entry to be created (400 `credit_not_latest`) and to be edited or deleted (409 `inflow_not_latest`). `DELETE /accounts/:id` gains 409 `account_has_inflows`.
- **Web**: the Dashboard is the home screen (capital, until payday, month plan, inflows of the month, next 30 days); tabs Home · Accounts · Plan · Settings; Plan with Income / Expenses / Budgets; inflow sheet with offline parking; Rates under Settings; loading and error fallbacks for routed screens (closes a phase 2 follow-up).
- **Import**: `--income-sources`, `--inflows`, `--expenses`, `--currency-of`, `--fallback-currency`, `--as-budget`, `--only`; per-kind idempotency.

Spec: `docs/superpowers/specs/2026-09-17-phase-3-income-expenses-design.md`. Plan: `docs/superpowers/plans/2026-09-17-phase-3-income-expenses.md`. Every ruling made during execution: `docs/discovery/phase-3-execution-ledger.md`.

## Definition of done

<the table from Step 7>

## After merge (owner)

1. Approve the `production` environment so `db.yml` applies migrations 0007–0011.
2. In `apps/api`, dry-run the import against production, read the tables, fix `ambiguous` rows with `--currency-of`, then run it for real:

       bun --env-file=.env.prod.local scripts/import-sheet.ts --user <you> \
         --income-sources ../../imports/income-sources.csv \
         --inflows ../../imports/inflows.csv \
         --expenses ../../imports/expenses.csv \
         --as-budget "<the groceries row name>" --currency-of "<source name>=<CODE>" --dry-run

   and the same command without `--dry-run`.

3. In the app: mark the primary source and set pay days; set essential marks and billing days on expenses; check the Dashboard on the phone, record one inflow credited to an account, and one offline.

## Not in this PR

Spends and month close, Snapshots, Goals, Assets, history imports, idempotency keys, offline parking for edits and deletes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_019B6aJSMTmThLwoi9JirPBm
```

Then `gh pr checks --watch`. If a check fails, fix it on the branch with a new commit (never amend, never force-push) and record the cause in the ledger. **Stop when the checks are green: the owner reviews and merges.** Report the PR URL, the ledger path, and the three "After merge" steps.
