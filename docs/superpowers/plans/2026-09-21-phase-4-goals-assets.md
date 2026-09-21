# Magermoney Phase 4: Goals and Assets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Goals become the fifth tab — a target amount funded by linked Accounts, with a forecast measured from the balance journal — an Account can fund at most one Goal, and Assets with a valuation history join the capital on the Home screen when their owner marks them.

**Architecture:** Three pure read models in `packages/domain` (`goalProgress`, `goalForecast`, `assetsTotal`); zod DTOs in `packages/contracts`; two new Hono modules (`goals`, `assets`) on the existing unit of work, with archiving a Goal releasing its Accounts inside one `deps.uow`; two new web data modules (`goals`, `assets`) plus a thin `savings` screen module that owns the tab and composes their segments; `dashboard` gains Assets as an input to its capital.

**Tech Stack:** bun 1.3, Node 24, Turborepo 2, TypeScript 5, Vue 3.5, Vite 7, vue-router 5, vue-i18n 11, @tanstack/vue-query 5, Tailwind 4, shadcn-vue 2 / reka-ui 2, motion-v 2, Hono 4 + @hono/zod-openapi 1, zod 4, decimal.js 10, neverthrow 8, postgres 3, Vitest 5, fast-check 4, Playwright 1.63, Supabase CLI 2.117.

**Spec:** `docs/superpowers/specs/2026-09-21-phase-4-goals-assets-design.md`. Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/0001`–`0005`, `docs/discovery/decisions-log.md` (§ Phase 4). Full schema: `docs/db/schema.dbml`. Phase 3 plan (patterns to copy): `docs/superpowers/plans/2026-09-17-phase-3-income-expenses.md`. Agent guide: `AGENTS.md`.

## Global Constraints

- Node `24`; bun is the package manager and script runner. Run `bun install` after editing any `package.json`.
- Money is `numeric` in Postgres, `DecimalString` in JSON, `Money`/`Decimal` in code. Never `number` for an amount. (ADR 0001)
- Calendar dates are `IsoDate` (`YYYY-MM-DD`) end to end; "today" comes from `Clock.today()`; date arithmetic lives only in `packages/domain/src/calendar.ts`.
- Every user table has `user_id`, RLS enabled (`user_id = auth.uid()`), and every use case and every SQL statement filters by `userId`. (spec §3, §4)
- An Asset's current value is the last row of its valuation journal — never a column beside it. (ADR 0002, spec §1.10)
- The funded amount of a Goal is **not** served by the API. It is computed on the client from Accounts and rates. (ADR 0003, spec §4)
- Every aggregate returns `unconvertible` beside its total, as `totalCapital` does: a currency today's rates cannot price is listed, never counted as zero.
- Multi-table writes go through `deps.uow(async (repos) => …)`. Archiving a Goal stamps it and nulls `goal_id` on its Accounts in one transaction. (spec §4)
- Domain errors are typed classes; use cases return `Result<T, E>` from neverthrow; HTTP mapping lives only in `apps/api/src/shared/errors/http.ts`.
- No ORM. Hand-written SQL in `supabase/migrations`; postgres.js with `transform: postgres.camel` and `numeric` as string.
- Dependency direction: `domain` ← `contracts` ← `api`, `web`; `ui` imports only Vue/Tailwind. A web module is imported only through its `index.ts` (`@/modules/<name>`) or, from `app/` only, its `offline.ts`. A data module never imports another data module's screens.
- Logs never contain amounts, emails or tokens.
- UI copy through i18n keys in `apps/web/src/locales/ru.json` and `en.json` (both files always carry the same keys); run `/humanize-text:humanize-text` on new copy. RU is the default.
- Any new screen or component: `/frontend-design` before markup, `/impeccable` after; motion only via presets in `packages/ui/src/motion` and `/animate`; shadcn-vue primitives enter `packages/ui` only through the shadcn-vue CLI/MCP. Touch targets `min-h-11` under `pointer-coarse:`.
- Web modules follow `/vue-ddd-architecture`; routed screens are exported from the barrel as async components via `routeComponent`.
- Tests: TDD, failing test first. `packages/domain` keeps 100 % coverage. API use cases are tested on in-memory repositories via `createApp(testDeps(...))` and `app.request()`; pg repositories only in `test/integration/**`. Web component tests mount inside `AppShell`.
- Full check before every commit: `bun run lint && bun run typecheck && bun run test`.
- Commits via the `/git-commit` skill (Conventional Commits, English), ending with the trailers `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01PsZ4iTXyPNnBXWsKhrefzK`.
- Each backlog task gets its own branch (`task-031`, `task-032`, `task-033`); never commit on `main`.
- Every ruling made on the owner's behalf during execution is appended to `docs/discovery/phase-4-execution-ledger.md` in the same commit as the code it concerns.

---

## File map

```
packages/domain/src/{goal.ts, asset.ts, index.ts}
packages/domain/test/{goal.test.ts, goal.property.test.ts, asset.test.ts, asset.property.test.ts}
packages/contracts/src/{goal.ts, asset.ts, account.ts (+goalId), index.ts}
supabase/migrations/{20260921000020_goals.sql, 20260921000021_accounts_goal_id.sql, 20260921000022_assets.sql}
docs/db/schema.dbml
apps/api/src/modules/goals/{application/{goal-repository.ts, dto.ts, goals.ts}, infrastructure/{memory-goal-repository.ts, pg-goal-repository.ts}, http/routes.ts}
apps/api/src/modules/assets/{application/{asset-repository.ts, valuation-repository.ts, dto.ts, assets.ts, valuations.ts}, infrastructure/{memory-asset-repository.ts, memory-valuation-repository.ts, pg-asset-repository.ts, pg-valuation-repository.ts}, http/routes.ts}
apps/api/src/modules/accounts/{application/{account-repository.ts (+goalId), dto.ts, update-account.ts}, infrastructure/*}
apps/api/src/{app.ts (Repos +3, routes +2), shared/db/pg-unit-of-work.ts}
apps/api/test/{goals.test.ts, assets.test.ts, accounts-goal-link.test.ts, helpers/deps.ts}
apps/api/test/integration/{pg-goal-archive.test.ts, pg-phase4-rls.test.ts}
apps/web/src/modules/goals/{domain/mappers.ts, application/{use-goals.ts, use-goal-mutations.ts, use-goal-progress.ts, mutation-defaults.ts}, infrastructure/goals-api.ts, ui/{GoalsSegment.vue, GoalCard.vue, GoalPage.vue, GoalFormSheet.vue, LinkAccountSheet.vue}, index.ts, offline.ts}
apps/web/src/modules/assets/{domain/mappers.ts, application/{use-assets.ts, use-asset-mutations.ts, use-valuations.ts, mutation-defaults.ts}, infrastructure/assets-api.ts, ui/{AssetsSegment.vue, AssetRow.vue, AssetPage.vue, AssetFormSheet.vue, ValuationSheet.vue}, index.ts, offline.ts}
apps/web/src/modules/savings/{ui/SavingsPage.vue, index.ts}
apps/web/src/modules/dashboard/{application/build-dashboard.ts (+assets), ui/*}
apps/web/src/{shared/layout/nav.ts, app/{router.ts, offline.ts}, locales/{ru.json, en.json}}
apps/web/test/{NavFiveTabs.test.ts, SavingsPage.test.ts, GoalsSegment.test.ts, GoalPage.test.ts, LinkAccountSheet.test.ts, use-goal-progress.test.ts, AssetsSegment.test.ts, AssetPage.test.ts, capital-with-assets.test.ts, fixtures/{goals.ts, assets.ts}, fixtures/income-mount.ts (+ phase 4 routes)}
apps/web/e2e/goals.spec.ts
docs/discovery/phase-4-execution-ledger.md
```

## Task index

| #   | Task                                                       | Backlog          |
| --- | ---------------------------------------------------------- | ---------------- |
| 1   | Domain — goal progress                                     | TASK-031         |
| 2   | Domain — goal forecast                                     | TASK-031         |
| 3   | Domain — assets                                            | TASK-033         |
| 4   | Contracts — Goal, Asset, Valuation DTOs, `accounts.goalId` | TASK-031/032/033 |
| 5   | Database — three migrations and `schema.dbml`              | TASK-031/032/033 |
| 6   | API — goals module                                         | TASK-031         |
| 7   | API — archiving releases the Accounts (uow)                | TASK-031         |
| 8   | API — `goalId` on `PATCH /accounts/{id}`                   | TASK-032         |
| 9   | API — assets and the valuation journal                     | TASK-033         |
| 10  | API — pg integration tests for phase 4                     | TASK-031/033     |
| 11  | Web — the fifth tab, `savings`, routes                     | TASK-031         |
| 12  | Web — `goals` data layer and offline entry                 | TASK-031         |
| 13  | Web — Goals segment, Goal page, Goal form                  | TASK-031         |
| 14  | Web — linking an Account from the Goal's screen            | TASK-032         |
| 15  | Web — `assets` data layer, segment, page, valuations       | TASK-033         |
| 16  | Web — capital on Home includes Assets; smoke test; ledger  | TASK-033         |

## Shared interfaces

Every task's **Interfaces** block refers to these exact names.

### `packages/domain` (Tasks 1–3)

```ts
export interface Goal {
  id: string;
  name: string;
  icon: string | null;
  target: Money;
  targetDate: IsoDate | null;
  achievedAt: string | null;
  archivedAt: string | null;
  sortOrder: number;
}

export interface GoalProgress {
  funded: Money; // in the goal's currency
  remaining: Money; // never negative; zero once funded reaches target
  ratio: number; // 0..1, clamped
  unconvertible: Account[];
}

export type GoalForecast =
  | { kind: 'date'; on: IsoDate; monthlyRate: Money }
  | { kind: 'none'; reason: 'not_enough_history' | 'not_advancing' | 'achieved' };

export interface Asset {
  id: string;
  name: string;
  value: Money | null; // the latest valuation, null when never valued
  valuedOn: IsoDate | null;
  countsInTotal: boolean;
  acquiredOn: IsoDate | null;
  purchasePrice: Money | null;
  archived: boolean;
}

export interface Valuation {
  id: string;
  value: Money;
  valuedOn: IsoDate;
}

export function goalProgress(
  goal: Goal,
  linked: readonly Account[],
  table: RateTable,
): GoalProgress;

export function goalForecast(
  goal: Goal,
  progress: GoalProgress,
  history: readonly MonthlyBalance[],
  today: IsoDate,
): GoalForecast;

/** One linked Account's total at the end of a month, already in the goal's currency. */
export interface MonthlyBalance {
  month: YearMonth;
  total: Money;
}

export function assetValue(valuations: readonly Valuation[]): Valuation | null;
/**
 * Not `Aggregate`: that one's `unconvertible` is `Account[]`. An Asset is not an
 * Account, so it reports its own kind, and Task 16 flattens both into the one
 * shape the Home screen prints.
 */
export function assetsTotal(
  assets: readonly Asset[],
  table: RateTable,
  display: Currency,
): { total: Money; unconvertible: Asset[] };

export const FORECAST_WINDOW_MONTHS = 6;
export const FORECAST_MIN_MONTHS = 2;
```

### `packages/contracts` (Task 4)

```ts
(GoalDtoSchema, GoalInputSchema, UpdateGoalInputSchema);
(AssetDtoSchema, AssetInputSchema, UpdateAssetInputSchema);
(ValuationDtoSchema, ValuationInputSchema, UpdateValuationInputSchema);
AccountDtoSchema; // + goalId: z.uuid().nullable()
UpdateAccountInputSchema; // + goalId: z.uuid().nullable().optional()
```

### `apps/api` (Tasks 6–9)

```ts
Repos { …, goals: GoalRepository, assets: AssetRepository, valuations: ValuationRepository }
listGoals(deps)(userId): Promise<GoalDto[]>
createGoal(deps)(userId, input): Promise<Result<GoalDto, GoalFailure>>
updateGoal(deps)(userId, id, input): Promise<Result<GoalDto, GoalFailure>>
deleteGoal(deps)(userId, id): Promise<Result<void, NotFoundError>>
listAssets(deps)(userId): Promise<AssetDto[]>
createAsset / updateAsset / deleteAsset  — same shape
listValuations(deps)(userId, assetId, cursor): Promise<ValuationDto[]>
addValuation / updateValuation / deleteValuation — same shape
```

### `apps/web` (Tasks 11–16)

```ts
// modules/goals
GOALS_KEY = ['goals']
useGoals(): { goals, dtos, isLoading, isError, refetch }
useGoalProgress(goal): ComputedRef<GoalProgress>
/** Fetches the linked Accounts' journals and folds them into monthly closing totals. */
useGoalForecast(goal, progress): ComputedRef<GoalForecast>
useCreateGoal / useUpdateGoal / useDeleteGoal / useArchiveGoal
GoalsSegment, GoalPage (async), GoalFormPage (async)
// modules/assets
ASSETS_KEY = ['assets'], valuationsKey(assetId)
useAssets(), useValuations(assetId), useAssetMutations…
AssetsSegment, AssetPage (async)
// modules/savings
SavingsPage (async)
```

---

### Task 1: Domain — goal progress

**Files:**

- Create: `packages/domain/src/goal.ts`
- Create: `packages/domain/test/goal.test.ts`
- Create: `packages/domain/test/goal.property.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**

- Consumes: `Money`, `Account`, `RateTable`, `Aggregate` from the existing domain.
- Produces: `Goal`, `GoalProgress`, `goalProgress` (signatures above).

- [ ] **Step 1: Write the failing test**

`packages/domain/test/goal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  CurrencyRegistry,
  Money,
  RateTable,
  SAMPLE_CURRENCIES,
  goalProgress,
} from '../src/index.js';
import type { Account, Goal } from '../src/index.js';

const registry = new CurrencyRegistry(SAMPLE_CURRENCIES);
const EUR = registry.get('EUR')._unsafeUnwrap();
const USD = registry.get('USD')._unsafeUnwrap();
const table = new RateTable(
  '2026-09-21',
  [{ base: 'EUR', quote: 'USD', value: new Decimal(1.1) }],
  registry,
);

const account = (over: Partial<Account> & { balance: Money }): Account => ({
  id: 'a',
  name: 'A',
  bank: 'B',
  country: 'DE',
  kind: 'bank_account',
  cardType: null,
  isSpending: false,
  isPinned: false,
  sortOrder: 0,
  archived: false,
  ...over,
});

const goal: Goal = {
  id: 'g',
  name: 'Car',
  icon: null,
  target: Money.of(new Decimal(10_000), EUR),
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
};

describe('goalProgress', () => {
  it('sums the linked accounts in the goal currency', () => {
    const p = goalProgress(
      goal,
      [
        account({ balance: Money.of(new Decimal(2_000), EUR) }),
        account({ id: 'b', balance: Money.of(new Decimal(1_100), USD) }), // = 1000 EUR
      ],
      table,
    );
    expect(p.funded.amount.toString()).toBe('3000');
    expect(p.remaining.amount.toString()).toBe('7000');
    expect(p.ratio).toBeCloseTo(0.3);
    expect(p.unconvertible).toEqual([]);
  });

  it('lists an account it cannot price instead of counting it as zero', () => {
    const btc = account({
      id: 'c',
      balance: Money.of(new Decimal(1), registry.get('BTC')._unsafeUnwrap()),
    });
    const p = goalProgress(goal, [btc], table);
    expect(p.funded.amount.toString()).toBe('0');
    expect(p.unconvertible.map((a) => a.id)).toEqual(['c']);
  });

  it('clamps an overfunded goal at zero remaining and ratio 1', () => {
    const p = goalProgress(goal, [account({ balance: Money.of(new Decimal(12_000), EUR) })], table);
    expect(p.remaining.amount.toString()).toBe('0');
    expect(p.ratio).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/domain test -- goal.test.ts`
Expected: FAIL — `goalProgress` is not exported from `../src/index.js`.

- [ ] **Step 3: Write minimal implementation**

`packages/domain/src/goal.ts`:

```ts
import type { Account } from './account.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';
import type { RateTable } from './rate-table.js';

export interface Goal {
  id: string;
  name: string;
  icon: string | null;
  /** The amount to reach, in the goal's own currency. */
  target: Money;
  targetDate: IsoDate | null;
  achievedAt: string | null;
  archivedAt: string | null;
  sortOrder: number;
}

export interface GoalProgress {
  funded: Money;
  /** Never negative: an overfunded goal needs nothing more. */
  remaining: Money;
  /** 0..1, clamped, for a progress bar. */
  ratio: number;
  /** Linked accounts today's rates cannot price. Listed, never counted as zero. */
  unconvertible: Account[];
}

/**
 * What a Goal holds: the balances of the Accounts linked to it, converted into
 * the Goal's currency. The conversion can fail for a currency with no rate
 * today — that Account is reported rather than silently dropped, exactly as
 * `totalCapital` reports it.
 */
export function goalProgress(
  goal: Goal,
  linked: readonly Account[],
  table: RateTable,
): GoalProgress {
  const currency = goal.target.currency;
  let funded = Money.zero(currency);
  const unconvertible: Account[] = [];
  for (const a of linked) {
    const converted = table.convert(a.balance, currency.code);
    if (converted.isErr()) {
      unconvertible.push(a);
      continue;
    }
    funded = funded.add(converted.value)._unsafeUnwrap();
  }
  const short = goal.target.amount.minus(funded.amount);
  const remaining = Money.of(short.isPositive() ? short : funded.amount.times(0), currency);
  const ratio = goal.target.amount.isZero()
    ? 1
    : Math.min(1, funded.amount.div(goal.target.amount).toNumber());
  return { funded, remaining, ratio: Math.max(0, ratio), unconvertible };
}
```

Add `export * from './goal.js';` to `packages/domain/src/index.ts`, after `./account.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @magermoney/domain test -- goal.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the property test**

`packages/domain/test/goal.property.test.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  CurrencyRegistry,
  Money,
  RateTable,
  SAMPLE_CURRENCIES,
  goalProgress,
} from '../src/index.js';
import type { Account, Goal } from '../src/index.js';

const registry = new CurrencyRegistry(SAMPLE_CURRENCIES);
const EUR = registry.get('EUR')._unsafeUnwrap();
const table = new RateTable('2026-09-21', [], registry);
const amounts = fc.array(fc.integer({ min: 0, max: 100_000 }), { maxLength: 8 });

const accountsOf = (xs: number[]): Account[] =>
  xs.map((n, i) => ({
    id: `a${i}`,
    name: 'A',
    bank: 'B',
    country: 'DE',
    kind: 'bank_account',
    cardType: null,
    isSpending: false,
    isPinned: false,
    sortOrder: 0,
    archived: false,
    balance: Money.of(new Decimal(n), EUR),
  }));

const goalOf = (target: number): Goal => ({
  id: 'g',
  name: 'G',
  icon: null,
  target: Money.of(new Decimal(target), EUR),
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
});

describe('goalProgress properties', () => {
  it('is never negative and never above its target ratio of 1', () => {
    fc.assert(
      fc.property(amounts, fc.integer({ min: 1, max: 100_000 }), (xs, target) => {
        const p = goalProgress(goalOf(target), accountsOf(xs), table);
        expect(p.funded.amount.isNegative()).toBe(false);
        expect(p.remaining.amount.isNegative()).toBe(false);
        expect(p.ratio).toBeGreaterThanOrEqual(0);
        expect(p.ratio).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('does not depend on the order of the accounts', () => {
    fc.assert(
      fc.property(amounts, fc.integer({ min: 1, max: 100_000 }), (xs, target) => {
        const forward = goalProgress(goalOf(target), accountsOf(xs), table);
        const backward = goalProgress(goalOf(target), accountsOf([...xs].reverse()), table);
        expect(forward.funded.amount.toString()).toBe(backward.funded.amount.toString());
      }),
    );
  });

  it('has zero remaining exactly when funded has reached the target', () => {
    fc.assert(
      fc.property(amounts, fc.integer({ min: 1, max: 100_000 }), (xs, target) => {
        const p = goalProgress(goalOf(target), accountsOf(xs), table);
        const reached = p.funded.amount.gte(target);
        expect(p.remaining.amount.isZero()).toBe(reached);
      }),
    );
  });
});
```

- [ ] **Step 6: Run the property test**

Run: `bun run --filter @magermoney/domain test -- goal.property.test.ts`
Expected: PASS, 3 properties.

- [ ] **Step 7: Check coverage and commit**

Run: `bun run --filter @magermoney/domain test -- --coverage` — `src/goal.ts` at 100 %.
Then `bun run lint && bun run typecheck`.

```bash
git add packages/domain/src/goal.ts packages/domain/src/index.ts packages/domain/test/goal.test.ts packages/domain/test/goal.property.test.ts
git commit -m "feat(domain): tell a goal how much of it is funded"
```

---

### Task 2: Domain — goal forecast

**Files:**

- Modify: `packages/domain/src/goal.ts`
- Modify: `packages/domain/test/goal.test.ts`
- Modify: `packages/domain/test/goal.property.test.ts`

**Interfaces:**

- Consumes: `Goal`, `GoalProgress` (Task 1), `YearMonth`, `monthsTouching`, `lastOfMonth`, `addDays` from `calendar.ts`.
- Produces: `MonthlyBalance`, `GoalForecast`, `goalForecast`, `FORECAST_WINDOW_MONTHS`, `FORECAST_MIN_MONTHS`.

The caller builds `MonthlyBalance[]` from the linked Accounts' balance journal: one entry per month, the linked total at the end of that month, already converted into the Goal's currency. The domain is handed the series, not the journal — the conversion needs a rate table per month, which is the client's business.

- [ ] **Step 1: Write the failing test**

Append to `packages/domain/test/goal.test.ts`:

```ts
import { goalForecast, FORECAST_MIN_MONTHS } from '../src/index.js';
import type { MonthlyBalance } from '../src/index.js';

const series = (...totals: number[]): MonthlyBalance[] =>
  totals.map((n, i) => ({
    month: { year: 2026, month: i + 1 },
    total: Money.of(new Decimal(n), EUR),
  }));

describe('goalForecast', () => {
  const progressOf = (funded: number) =>
    goalProgress(goal, [account({ balance: Money.of(new Decimal(funded), EUR) })], table);

  it('divides what is left by the average monthly growth', () => {
    // 1000 → 3000 over two steps = 1000 a month; 7000 left = 7 months from today.
    const f = goalForecast(goal, progressOf(3_000), series(1_000, 2_000, 3_000), '2026-03-15');
    expect(f).toEqual({ kind: 'date', on: '2026-10-15', monthlyRate: expect.anything() });
    if (f.kind === 'date') expect(f.monthlyRate.amount.toString()).toBe('1000');
  });

  it('says nothing when there is less than two months of history', () => {
    expect(goalForecast(goal, progressOf(1_000), series(1_000), '2026-01-15')).toEqual({
      kind: 'none',
      reason: 'not_enough_history',
    });
    expect(FORECAST_MIN_MONTHS).toBe(2);
  });

  it('says nothing when the balance is not advancing', () => {
    expect(
      goalForecast(goal, progressOf(2_000), series(3_000, 2_500, 2_000), '2026-03-15'),
    ).toEqual({ kind: 'none', reason: 'not_advancing' });
  });

  it('says nothing for a goal already reached', () => {
    expect(
      goalForecast(goal, progressOf(10_000), series(1_000, 5_000, 10_000), '2026-03-15'),
    ).toEqual({ kind: 'none', reason: 'achieved' });
  });

  it('reads at most the last six months', () => {
    // Nine months of history; only the last six (5000 → 8000, 600 a month) count.
    const f = goalForecast(
      goal,
      progressOf(8_000),
      series(100, 200, 300, 5_000, 5_600, 6_200, 6_800, 7_400, 8_000),
      '2026-09-15',
    );
    if (f.kind !== 'date') throw new Error('expected a date');
    expect(f.monthlyRate.amount.toString()).toBe('600');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/domain test -- goal.test.ts`
Expected: FAIL — `goalForecast` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `packages/domain/src/goal.ts`:

```ts
import { addDays, type YearMonth } from './calendar.js';

/** One month's closing total across the linked Accounts, in the Goal's currency. */
export interface MonthlyBalance {
  month: YearMonth;
  total: Money;
}

export type GoalForecast =
  | { kind: 'date'; on: IsoDate; monthlyRate: Money }
  | { kind: 'none'; reason: 'not_enough_history' | 'not_advancing' | 'achieved' };

/** The window the rate is measured over, and the least history that may be measured. */
export const FORECAST_WINDOW_MONTHS = 6;
export const FORECAST_MIN_MONTHS = 2;

const DAYS_IN_MONTH = 30;

/**
 * When the Goal is reached if the last months repeat themselves. The rate is
 * measured, not declared: the average monthly growth of the linked Accounts
 * across the last six closing totals.
 *
 * It answers with a reason rather than a date whenever the answer would be
 * invented — too little history to average, a balance going nowhere or
 * backwards, a Goal already reached. A screen can say any of those plainly; it
 * cannot say "infinity".
 */
export function goalForecast(
  goal: Goal,
  progress: GoalProgress,
  history: readonly MonthlyBalance[],
  today: IsoDate,
): GoalForecast {
  if (progress.remaining.amount.isZero()) return { kind: 'none', reason: 'achieved' };
  const window = history.slice(-FORECAST_WINDOW_MONTHS);
  if (window.length < FORECAST_MIN_MONTHS) return { kind: 'none', reason: 'not_enough_history' };

  const first = window[0]!.total.amount;
  const last = window[window.length - 1]!.total.amount;
  const steps = window.length - 1;
  const rate = last.minus(first).div(steps);
  if (!rate.isPositive()) return { kind: 'none', reason: 'not_advancing' };

  const months = progress.remaining.amount.div(rate);
  const days = months.times(DAYS_IN_MONTH).ceil().toNumber();
  return {
    kind: 'date',
    on: addDays(today, days),
    monthlyRate: Money.of(rate, goal.target.currency),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @magermoney/domain test -- goal.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the properties**

Append to `packages/domain/test/goal.property.test.ts`:

```ts
import { goalForecast } from '../src/index.js';

describe('goalForecast properties', () => {
  const rising = fc.array(fc.integer({ min: 1, max: 5_000 }), { minLength: 2, maxLength: 9 });

  it('never forecasts a date in the past', () => {
    fc.assert(
      fc.property(rising, (steps) => {
        let running = 0;
        const history = steps.map((s, i) => {
          running += s;
          return {
            month: { year: 2026, month: i + 1 },
            total: Money.of(new Decimal(running), EUR),
          };
        });
        const p = goalProgress(goalOf(1_000_000), accountsOf([running]), table);
        const f = goalForecast(goalOf(1_000_000), p, history, '2026-09-21');
        if (f.kind === 'date') expect(f.on >= '2026-09-21').toBe(true);
      }),
    );
  });

  it('never forecasts a date when the rate is not positive', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 5_000 }), { minLength: 2, maxLength: 9 }),
        (xs) => {
          const falling = [...xs].sort((a, b) => b - a);
          const history = falling.map((n, i) => ({
            month: { year: 2026, month: i + 1 },
            total: Money.of(new Decimal(n), EUR),
          }));
          const p = goalProgress(goalOf(1_000_000), accountsOf([falling.at(-1)!]), table);
          const f = goalForecast(goalOf(1_000_000), p, history, '2026-09-21');
          if (falling[0]! > falling.at(-1)!)
            expect(f).toEqual({ kind: 'none', reason: 'not_advancing' });
        },
      ),
    );
  });
});
```

- [ ] **Step 6: Run the property test**

Run: `bun run --filter @magermoney/domain test -- goal.property.test.ts`
Expected: PASS, 5 properties.

- [ ] **Step 7: Commit**

Run: `bun run --filter @magermoney/domain test -- --coverage`, then `bun run lint && bun run typecheck`.

```bash
git add packages/domain/src/goal.ts packages/domain/test/goal.test.ts packages/domain/test/goal.property.test.ts
git commit -m "feat(domain): forecast a goal from the rate it is actually funded at"
```

---

### Task 3: Domain — assets

**Files:**

- Create: `packages/domain/src/asset.ts`
- Create: `packages/domain/test/asset.test.ts`
- Create: `packages/domain/test/asset.property.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**

- Consumes: `Money`, `RateTable`, `Currency`, `Aggregate` from `read-models.ts`.
- Produces: `Asset`, `Valuation`, `assetValue`, `assetsTotal`.

- [ ] **Step 1: Write the failing test**

`packages/domain/test/asset.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  CurrencyRegistry,
  Money,
  RateTable,
  SAMPLE_CURRENCIES,
  assetValue,
  assetsTotal,
} from '../src/index.js';
import type { Asset, Valuation } from '../src/index.js';

const registry = new CurrencyRegistry(SAMPLE_CURRENCIES);
const EUR = registry.get('EUR')._unsafeUnwrap();
const USD = registry.get('USD')._unsafeUnwrap();
const table = new RateTable(
  '2026-09-21',
  [{ base: 'EUR', quote: 'USD', value: new Decimal(1.1) }],
  registry,
);

const valuation = (value: number, valuedOn: string): Valuation => ({
  id: valuedOn,
  value: Money.of(new Decimal(value), EUR),
  valuedOn,
});

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: 'x',
  name: 'Car',
  value: Money.of(new Decimal(30_000), EUR),
  valuedOn: '2026-09-01',
  countsInTotal: true,
  acquiredOn: null,
  purchasePrice: null,
  archived: false,
  ...over,
});

describe('assetValue', () => {
  it('takes the latest valuation whatever order they arrive in', () => {
    const latest = assetValue([
      valuation(28_000, '2026-01-01'),
      valuation(30_000, '2026-09-01'),
      valuation(29_000, '2026-05-01'),
    ]);
    expect(latest?.valuedOn).toBe('2026-09-01');
  });

  it('has no value before the first valuation', () => {
    expect(assetValue([])).toBeNull();
  });
});

describe('assetsTotal', () => {
  it('counts only the assets marked for the capital', () => {
    const total = assetsTotal(
      [asset(), asset({ id: 'y', countsInTotal: false, value: Money.of(new Decimal(9_000), EUR) })],
      table,
      EUR,
    );
    expect(total.total.amount.toString()).toBe('30000');
    expect(total.unconvertible).toEqual([]);
  });

  it('converts into the display currency', () => {
    const total = assetsTotal([asset()], table, USD);
    expect(total.total.amount.toString()).toBe('33000');
  });

  it('ignores an archived asset and one never valued', () => {
    const total = assetsTotal(
      [asset({ archived: true }), asset({ id: 'z', value: null, valuedOn: null })],
      table,
      EUR,
    );
    expect(total.total.amount.toString()).toBe('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/domain test -- asset.test.ts`
Expected: FAIL — `assetValue` is not exported.

- [ ] **Step 3: Write minimal implementation**

`packages/domain/src/asset.ts`:

```ts
import type { Currency } from './currency.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';
import type { RateTable } from './rate-table.js';

/** One entry of an Asset's valuation journal. */
export interface Valuation {
  id: string;
  value: Money;
  valuedOn: IsoDate;
}

/**
 * Something owned that is worth money but is not money: a car, a watch. Its
 * worth is an opinion with a date, so it is kept as a journal and the current
 * value is simply the last entry — never a second copy of the number.
 */
export interface Asset {
  id: string;
  name: string;
  /** The latest valuation, or null while the Asset has never been valued. */
  value: Money | null;
  valuedOn: IsoDate | null;
  /** Whether this Asset is part of the capital on the Home screen. */
  countsInTotal: boolean;
  acquiredOn: IsoDate | null;
  purchasePrice: Money | null;
  archived: boolean;
}

/** An Asset carrying a value: what `assetsTotal` is allowed to add up. */
interface ValuedAsset extends Asset {
  value: Money;
}

const isValued = (a: Asset): a is ValuedAsset => a.value !== null;

export function assetValue(valuations: readonly Valuation[]): Valuation | null {
  let latest: Valuation | null = null;
  for (const v of valuations) if (!latest || v.valuedOn > latest.valuedOn) latest = v;
  return latest;
}

/**
 * What the owned things add to the capital: the Assets marked for it, in the
 * display currency. An Asset whose currency today's rates cannot price is
 * listed rather than counted as zero, as `totalCapital` lists an Account —
 * but there is no Account to list, so it is reported by its own id.
 */
export function assetsTotal(
  assets: readonly Asset[],
  table: RateTable,
  display: Currency,
): { total: Money; unconvertible: Asset[] } {
  let total = Money.zero(display);
  const unconvertible: Asset[] = [];
  for (const a of assets.filter((x) => !x.archived && x.countsInTotal).filter(isValued)) {
    const converted = table.convert(a.value, display.code);
    if (converted.isErr()) {
      unconvertible.push(a);
      continue;
    }
    total = total.add(converted.value)._unsafeUnwrap();
  }
  return { total, unconvertible };
}
```

Add `export * from './asset.js';` to `packages/domain/src/index.ts`, after `./goal.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @magermoney/domain test -- asset.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the property test**

`packages/domain/test/asset.property.test.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  CurrencyRegistry,
  Money,
  RateTable,
  SAMPLE_CURRENCIES,
  assetValue,
  assetsTotal,
} from '../src/index.js';
import type { Asset } from '../src/index.js';

const registry = new CurrencyRegistry(SAMPLE_CURRENCIES);
const EUR = registry.get('EUR')._unsafeUnwrap();
const table = new RateTable('2026-09-21', [], registry);

const assets = fc.array(
  fc.record({ n: fc.integer({ min: 0, max: 100_000 }), counts: fc.boolean() }),
  { maxLength: 10 },
);
const build = (xs: { n: number; counts: boolean }[]): Asset[] =>
  xs.map((x, i) => ({
    id: `a${i}`,
    name: 'A',
    value: Money.of(new Decimal(x.n), EUR),
    valuedOn: '2026-01-01',
    countsInTotal: x.counts,
    acquiredOn: null,
    purchasePrice: null,
    archived: false,
  }));

describe('assetsTotal properties', () => {
  it('equals the sum of the assets marked for the capital, and ignores the rest', () => {
    fc.assert(
      fc.property(assets, (xs) => {
        const expected = xs.filter((x) => x.counts).reduce((s, x) => s + x.n, 0);
        expect(assetsTotal(build(xs), table, EUR).total.amount.toString()).toBe(String(expected));
      }),
    );
  });

  it('does not depend on the order of the assets', () => {
    fc.assert(
      fc.property(assets, (xs) => {
        const a = assetsTotal(build(xs), table, EUR).total.amount.toString();
        const b = assetsTotal(build([...xs].reverse()), table, EUR).total.amount.toString();
        expect(a).toBe(b);
      }),
    );
  });

  it('picks a valuation that no other valuation is later than', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.date({
            min: new Date('2020-01-01'),
            max: new Date('2030-01-01'),
            noInvalidDate: true,
          }),
          { minLength: 1, maxLength: 12 },
        ),
        (dates) => {
          const vs = dates.map((d, i) => ({
            id: `v${i}`,
            value: Money.of(new Decimal(i), EUR),
            valuedOn: d.toISOString().slice(0, 10),
          }));
          const latest = assetValue(vs)!;
          expect(vs.every((v) => v.valuedOn <= latest.valuedOn)).toBe(true);
        },
      ),
    );
  });
});
```

- [ ] **Step 6: Run the property test**

Run: `bun run --filter @magermoney/domain test -- asset.property.test.ts`
Expected: PASS, 3 properties.

- [ ] **Step 7: Commit**

Run: `bun run --filter @magermoney/domain test -- --coverage` — `src/asset.ts` at 100 %; then `bun run lint && bun run typecheck`.

```bash
git add packages/domain/src/asset.ts packages/domain/src/index.ts packages/domain/test/asset.test.ts packages/domain/test/asset.property.test.ts
git commit -m "feat(domain): value an asset from its journal and add it to the capital"
```

---

### Task 4: Contracts — Goal, Asset and Valuation DTOs

**Files:**

- Create: `packages/contracts/src/goal.ts`
- Create: `packages/contracts/src/asset.ts`
- Modify: `packages/contracts/src/account.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/phase4.test.ts`

**Interfaces:**

- Consumes: `DecimalString`, `NonNegativeDecimalString`, `PositiveDecimalString`, `IsoDateSchema`, `CurrencyCodeSchema` from `common.ts`.
- Produces: the schema names listed under "Shared interfaces".

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/phase4.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  GoalInputSchema,
  AssetInputSchema,
  ValuationInputSchema,
  UpdateAccountInputSchema,
} from '../src/index.js';

describe('phase 4 contracts', () => {
  it('refuses a target that is not positive', () => {
    expect(
      GoalInputSchema.safeParse({ name: 'Car', targetAmount: '0', currency: 'EUR' }).success,
    ).toBe(false);
    expect(
      GoalInputSchema.safeParse({ name: 'Car', targetAmount: '-1', currency: 'EUR' }).success,
    ).toBe(false);
    expect(
      GoalInputSchema.safeParse({ name: 'Car', targetAmount: '10000.00', currency: 'EUR' }).success,
    ).toBe(true);
  });

  it('takes an optional target date and no status fields', () => {
    const parsed = GoalInputSchema.parse({
      name: 'Car',
      targetAmount: '1',
      currency: 'EUR',
      targetDate: '2027-03-01',
    });
    expect(parsed.targetDate).toBe('2027-03-01');
    expect('achievedAt' in parsed).toBe(false);
  });

  it('refuses a valuation that is not positive and requires its date', () => {
    expect(ValuationInputSchema.safeParse({ value: '-5' }).success).toBe(false);
    expect(ValuationInputSchema.safeParse({ value: '30000', valuedOn: '2026-09-01' }).success).toBe(
      true,
    );
  });

  it('defaults an asset out of the capital', () => {
    expect(AssetInputSchema.parse({ name: 'Car', currency: 'EUR' }).countsInTotal).toBe(false);
  });

  it('lets an account be linked to a goal or released from one', () => {
    expect(UpdateAccountInputSchema.parse({ goalId: null }).goalId).toBeNull();
    expect(UpdateAccountInputSchema.safeParse({ goalId: 'not-a-uuid' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/contracts test`
Expected: FAIL — `GoalInputSchema` is not exported.

- [ ] **Step 3: Write minimal implementation**

`packages/contracts/src/goal.ts`:

```ts
import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  PositiveDecimalString,
} from './common.js';

export const GoalDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    icon: z.string().nullable(),
    targetAmount: DecimalString,
    currency: CurrencyCodeSchema,
    targetDate: IsoDateSchema.nullable(),
    /** Stamped by the server when the goal is first funded; never sent by the client. */
    achievedAt: z.iso.datetime().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    sortOrder: z.number().int(),
  })
  .openapi('Goal');
export type GoalDto = z.infer<typeof GoalDtoSchema>;

const goalFields = {
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(80).nullable().optional(),
  targetAmount: PositiveDecimalString,
  currency: CurrencyCodeSchema,
  targetDate: IsoDateSchema.nullable().optional(),
};

export const GoalInputSchema = z.object(goalFields).openapi('GoalInput');
export type GoalInput = z.infer<typeof GoalInputSchema>;

/**
 * `achievedAt` is here only so a goal can be re-opened by hand — the server
 * stamps it, and a falling rate never clears it.
 */
export const UpdateGoalInputSchema = z
  .object({
    ...goalFields,
    achievedAt: z.iso.datetime().nullable(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .partial()
  .openapi('UpdateGoalInput');
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;
```

`packages/contracts/src/asset.ts`:

```ts
import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  PositiveDecimalString,
} from './common.js';

export const AssetDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    currency: CurrencyCodeSchema,
    countsInTotal: z.boolean(),
    acquiredOn: IsoDateSchema.nullable(),
    purchasePrice: DecimalString.nullable(),
    archivedAt: z.iso.datetime().nullable(),
    /** The latest valuation; null until the asset has been valued once. */
    value: DecimalString.nullable(),
    valuedOn: IsoDateSchema.nullable(),
  })
  .openapi('Asset');
export type AssetDto = z.infer<typeof AssetDtoSchema>;

const assetFields = {
  name: z.string().trim().min(1).max(60),
  currency: CurrencyCodeSchema,
  countsInTotal: z.boolean().default(false),
  acquiredOn: IsoDateSchema.nullable().optional(),
  purchasePrice: PositiveDecimalString.nullable().optional(),
};

export const AssetInputSchema = z.object(assetFields).openapi('AssetInput');
export type AssetInput = z.infer<typeof AssetInputSchema>;
export const UpdateAssetInputSchema = z
  .object({ ...assetFields, archivedAt: z.iso.datetime().nullable() })
  .partial()
  .openapi('UpdateAssetInput');
export type UpdateAssetInput = z.infer<typeof UpdateAssetInputSchema>;

export const ValuationDtoSchema = z
  .object({
    id: z.uuid(),
    assetId: z.uuid(),
    value: DecimalString,
    valuedOn: IsoDateSchema,
  })
  .openapi('Valuation');
export type ValuationDto = z.infer<typeof ValuationDtoSchema>;

export const ValuationInputSchema = z
  .object({
    value: PositiveDecimalString,
    /** Defaults to today in the use case. */
    valuedOn: IsoDateSchema.optional(),
  })
  .openapi('ValuationInput');
export type ValuationInput = z.infer<typeof ValuationInputSchema>;
export const UpdateValuationInputSchema =
  ValuationInputSchema.partial().openapi('UpdateValuationInput');
export type UpdateValuationInput = z.infer<typeof UpdateValuationInputSchema>;
```

In `packages/contracts/src/account.ts`, add `goalId: z.uuid().nullable()` to `AccountDtoSchema` and `goalId: z.uuid().nullable().optional()` to the update input's fields, with the comment:

```ts
/** The Goal this Account funds, or null. An Account funds at most one. */
```

Add both new files to `packages/contracts/src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @magermoney/contracts test`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

Run: `bun run lint && bun run typecheck`.

```bash
git add packages/contracts/src packages/contracts/test/phase4.test.ts
git commit -m "feat(contracts): describe goals, assets and their valuations"
```

---

### Task 5: Database — three migrations and `schema.dbml`

**Files:**

- Create: `supabase/migrations/20260921000020_goals.sql`
- Create: `supabase/migrations/20260921000021_accounts_goal_id.sql`
- Create: `supabase/migrations/20260921000022_assets.sql`
- Modify: `docs/db/schema.dbml`

**Interfaces:**

- Consumes: `profiles`, `currencies`, `accounts` from earlier phases.
- Produces: the tables Tasks 6–10 read and write.

Three migrations rather than one: `accounts.goal_id` cannot exist before `goals`, and Assets are an independent subject that TASK-033 ships on its own branch.

- [ ] **Step 1: Write the goals migration**

`supabase/migrations/20260921000020_goals.sql`:

```sql
-- A Goal is a target amount and the Accounts that fund it. What it holds is not
-- stored: it is the sum of those Accounts, which the client computes at today's
-- rates (ADR 0003). Only the two stamps below are state.
--
-- `achieved_at` is written once, by the server, when the funded amount first
-- reaches the target, and is never cleared by a rate moving back down — a goal
-- that blinks between reached and not reached is worse than one that is
-- generous. `archived_at` is the owner's own decision and releases the Accounts.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  icon text,
  target_amount numeric not null check (target_amount > 0),
  currency text not null references public.currencies (code),
  target_date date,
  achieved_at timestamptz,
  archived_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_idx on public.goals (user_id, archived_at, sort_order);

alter table public.goals enable row level security;

create policy goals_owner on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();
```

Check the exact name of the `updated_at` trigger function in an earlier migration (`grep -rn "updated_at" supabase/migrations | head`) and use that name.

- [ ] **Step 2: Write the link migration**

`supabase/migrations/20260921000021_accounts_goal_id.sql`:

```sql
-- An Account funds at most one Goal, which is what a single-valued column says;
-- no constraint is needed to enforce it. Deleting a Goal releases its Accounts
-- rather than taking them with it — the money did not go anywhere.
alter table public.accounts
  add column goal_id uuid references public.goals (id) on delete set null;

create index accounts_goal_idx on public.accounts (goal_id) where goal_id is not null;
```

- [ ] **Step 3: Write the assets migration**

`supabase/migrations/20260921000022_assets.sql`:

```sql
-- Something owned that is worth money but is not money. Its worth is an opinion
-- with a date, so it is a journal and the current value is its last row — the
-- same rule balances follow (ADR 0002). A valuation outside its asset means
-- nothing, so it goes with it.
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  currency text not null references public.currencies (code),
  counts_in_total bool not null default false,
  acquired_on date,
  purchase_price numeric check (purchase_price > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.asset_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  value numeric not null check (value > 0),
  valued_on date not null,
  created_at timestamptz not null default now(),
  unique (asset_id, valued_on)
);

create index assets_user_idx on public.assets (user_id, archived_at);
create index asset_valuations_latest_idx on public.asset_valuations (asset_id, valued_on desc);

alter table public.assets enable row level security;
alter table public.asset_valuations enable row level security;

create policy assets_owner on public.assets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy asset_valuations_owner on public.asset_valuations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger assets_updated_at before update on public.assets
  for each row execute function public.set_updated_at();
```

- [ ] **Step 4: Run the migrations**

Run: `supabase db reset`
Expected: all migrations apply, seed runs, no error.

- [ ] **Step 5: Verify the constraints by hand**

Run `supabase db reset` then, in `psql`, confirm: inserting a goal with `target_amount = 0` is refused; deleting a goal leaves its account with `goal_id is null`; deleting an asset removes its valuations; a second valuation on the same `(asset_id, valued_on)` is refused.

- [ ] **Step 6: Update `schema.dbml`**

Move the three tables out of "phase 4: where it is going" into the numbered phase sections; drop `monthly_share` and `income_source_id` from `goals`; add `archived_at` to `goals` and `assets`; leave the phase 5 snapshot tables where they are and keep their note.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations docs/db/schema.dbml
git commit -m "feat(db): add goals, the account link and the asset journal"
```

---

### Task 6: API — goals module

**Files:**

- Create: `apps/api/src/modules/goals/application/{goal-repository.ts, dto.ts, goals.ts}`
- Create: `apps/api/src/modules/goals/infrastructure/{memory-goal-repository.ts, pg-goal-repository.ts}`
- Create: `apps/api/src/modules/goals/http/routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/shared/db/pg-unit-of-work.ts`, `apps/api/test/helpers/deps.ts`
- Create: `apps/api/test/goals.test.ts`

**Interfaces:**

- Consumes: `GoalDto`, `GoalInput`, `UpdateGoalInput` (Task 4); `Repos`, `NotFoundError`, `ValidationError`, `UnknownCurrencyError`.
- Produces: `listGoals`, `createGoal`, `updateGoal`, `deleteGoal`, `GoalRepository`, `Repos.goals`.

Copy the shape of `modules/budgets` exactly: `GoalRepository` with `list / findById / insert / update / delete`, `PgGoalRepository` with a `COLS` string reading `target_amount::text` and `to_char(target_date, 'YYYY-MM-DD')`, `MemoryGoalRepository` over an array.

- [ ] **Step 1: Write the failing test**

`apps/api/test/goals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { testDeps, authHeader, USER } from './helpers/deps.js';

const app = () => createApp(testDeps());
const body = (o: unknown) => ({
  method: 'POST',
  headers: { ...authHeader(USER), 'content-type': 'application/json' },
  body: JSON.stringify(o),
});

describe('goals', () => {
  it('creates a goal and lists it', async () => {
    const a = app();
    const created = await a.request(
      '/goals',
      body({ name: 'Car', targetAmount: '10000', currency: 'EUR' }),
    );
    expect(created.status).toBe(201);
    const dto = await created.json();
    expect(dto).toMatchObject({
      name: 'Car',
      targetAmount: '10000',
      achievedAt: null,
      archivedAt: null,
    });

    const listed = await a.request('/goals', { headers: authHeader(USER) });
    expect(await listed.json()).toHaveLength(1);
  });

  it('refuses a target that is not positive', async () => {
    const res = await app().request(
      '/goals',
      body({ name: 'Car', targetAmount: '0', currency: 'EUR' }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses a currency the catalogue does not know', async () => {
    const res = await app().request(
      '/goals',
      body({ name: 'Car', targetAmount: '1', currency: 'ZZZ' }),
    );
    expect(res.status).toBe(400);
  });

  it('does not serve another user their neighbour goals', async () => {
    const a = app();
    await a.request('/goals', body({ name: 'Car', targetAmount: '1', currency: 'EUR' }));
    const other = await a.request('/goals', { headers: authHeader('other-user-id') });
    expect(await other.json()).toEqual([]);
  });

  it('404s an unknown goal', async () => {
    const res = await app().request('/goals/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      headers: { ...authHeader(USER), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Other' }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/api test -- goals.test.ts`
Expected: FAIL — 404 on `/goals`, the route does not exist.

- [ ] **Step 3: Write the repository and the use cases**

`apps/api/src/modules/goals/application/goal-repository.ts` — mirror `budget-repository.ts`:

```ts
export interface GoalRow {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  targetAmount: string;
  currency: string;
  targetDate: string | null;
  achievedAt: string | null;
  archivedAt: string | null;
  sortOrder: number;
}
export type NewGoal = Omit<GoalRow, 'id' | 'userId'>;
export type GoalPatch = Partial<NewGoal>;

export interface GoalRepository {
  list(userId: string): Promise<GoalRow[]>;
  findById(userId: string, id: string): Promise<GoalRow | null>;
  insert(userId: string, data: NewGoal): Promise<GoalRow>;
  update(userId: string, id: string, patch: GoalPatch): Promise<GoalRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
```

`apps/api/src/modules/goals/application/goals.ts` — the same four use cases as `budgets.ts`, with `checkShape` refusing a non-positive `targetAmount` (`non_positive_amount`) and an unknown currency, and `createGoal` defaulting `icon`, `targetDate`, both stamps to null and `sortOrder` to 0.

- [ ] **Step 4: Wire the module**

Add `goals: GoalRepository` to `Repos` in `app.ts`, `app.route('/', goalRoutes(deps))` after the budgets route, `PgGoalRepository` to `pg-unit-of-work.ts`, and `MemoryGoalRepository` to `test/helpers/deps.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @magermoney/api test -- goals.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

Run: `bun run lint && bun run typecheck && bun run test`.

```bash
git add apps/api/src/modules/goals apps/api/src/app.ts apps/api/src/shared/db/pg-unit-of-work.ts apps/api/test
git commit -m "feat(api): serve goals"
```

---

### Task 7: API — archiving releases the Accounts

**Files:**

- Modify: `apps/api/src/modules/goals/application/goals.ts`
- Modify: `apps/api/test/goals.test.ts`

**Interfaces:**

- Consumes: `deps.uow`, `Repos.accounts` (`listByGoal`, `setGoal`).
- Produces: `updateGoal` archiving inside one transaction; `stampAchieved`.

`AccountRepository` gains two methods, implemented in both the memory and the pg repository:

```ts
listByGoal(userId: string, goalId: string): Promise<AccountRow[]>;
/** Sets or clears the goal on one account; returns the row, or null when it is not the user's. */
setGoal(userId: string, accountId: string, goalId: string | null): Promise<AccountRow | null>;
/** Clears the goal on every account that funds it; returns how many were released. */
clearGoal(userId: string, goalId: string): Promise<number>;
```

- [ ] **Step 1: Write the failing test**

Append to `apps/api/test/goals.test.ts`:

```ts
it('releases the accounts it held when it is archived, in one transaction', async () => {
  const a = app();
  const goal = await (
    await a.request('/goals', body({ name: 'Car', targetAmount: '10000', currency: 'EUR' }))
  ).json();
  const account = await (
    await a.request(
      '/accounts',
      body({
        name: 'Savings',
        bank: 'N26',
        country: 'DE',
        currency: 'EUR',
        kind: 'bank_account',
      }),
    )
  ).json();
  await a.request(`/accounts/${account.id}`, {
    method: 'PATCH',
    headers: { ...authHeader(USER), 'content-type': 'application/json' },
    body: JSON.stringify({ goalId: goal.id }),
  });

  const archived = await a.request(`/goals/${goal.id}`, {
    method: 'PATCH',
    headers: { ...authHeader(USER), 'content-type': 'application/json' },
    body: JSON.stringify({ archivedAt: '2026-09-21T10:00:00.000Z' }),
  });
  expect(archived.status).toBe(200);

  const after = await (
    await a.request(`/accounts/${account.id}`, { headers: authHeader(USER) })
  ).json();
  expect(after.goalId).toBeNull();
});

it('stamps achievedAt once and does not clear it when the balance falls back', async () => {
  const a = app();
  const goal = await (
    await a.request('/goals', body({ name: 'Phone', targetAmount: '1000', currency: 'EUR' }))
  ).json();
  const account = await (
    await a.request(
      '/accounts',
      body({
        name: 'Savings',
        bank: 'N26',
        country: 'DE',
        currency: 'EUR',
        kind: 'bank_account',
        openingBalance: { amount: '1200' },
      }),
    )
  ).json();
  const link = async (goalId: string | null) =>
    a.request(`/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { ...authHeader(USER), 'content-type': 'application/json' },
      body: JSON.stringify({ goalId }),
    });

  await link(goal.id);
  const reached = await (
    await a.request(`/goals/${goal.id}`, { headers: authHeader(USER) })
  ).json();
  expect(reached.achievedAt).not.toBeNull();

  await link(null); // the money leaves; the stamp stays
  const still = await (await a.request(`/goals/${goal.id}`, { headers: authHeader(USER) })).json();
  expect(still.achievedAt).toBe(reached.achievedAt);
});
```

The second test requires `GET /goals/{id}`; add that route alongside the list.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/api test -- goals.test.ts`
Expected: FAIL — the account still carries `goalId` after the goal is archived.

- [ ] **Step 3: Write the implementation**

In `goals.ts`:

```ts
/**
 * Archiving is the one place a Goal writes outside its own table. The stamp and
 * the release belong to one decision, so they belong to one transaction: split
 * across two, an interrupted request leaves an archived Goal whose Accounts
 * still believe they are taken, and they never appear in the "free accounts"
 * list again.
 */
export const updateGoal =
  (deps: GoalDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateGoalInput,
  ): Promise<Result<GoalDto, GoalFailure>> => {
    const current = await deps.repos.goals.findById(userId, id);
    if (!current) return err(new NotFoundError('goal'));
    const patch = toPatch(input);
    const checked = checkShape(deps, { ...current, ...patch });
    if (checked.isErr()) return err(checked.error);

    const isArchiving = patch.archivedAt != null && current.archivedAt === null;
    if (!isArchiving) {
      const row = await deps.repos.goals.update(userId, id, patch);
      return row ? ok(toGoalDto(row)) : err(new NotFoundError('goal'));
    }
    const row = await deps.uow(async (repos) => {
      const updated = await repos.goals.update(userId, id, patch);
      await repos.accounts.clearGoal(userId, id);
      return updated;
    });
    return row ? ok(toGoalDto(row)) : err(new NotFoundError('goal'));
  };

/**
 * Called after any write that can change what a Goal holds. It only ever writes
 * the stamp, and only when it is absent: a rate moving back down must not undo
 * a goal the owner has already celebrated.
 */
export const stampAchieved =
  (deps: GoalDeps) =>
  async (userId: string, goalId: string, funded: Decimal): Promise<void> => {
    const goal = await deps.repos.goals.findById(userId, goalId);
    if (!goal || goal.achievedAt !== null) return;
    if (funded.lt(new Decimal(goal.targetAmount))) return;
    await deps.repos.goals.update(userId, goalId, { achievedAt: deps.clock.now() });
  };
```

`stampAchieved` needs the funded amount in the Goal's currency. The API has no rate table in a request path, so the caller converts: in Task 8, linking an Account sums the linked Accounts whose currency **equals** the Goal's currency and stamps on that basis only. Record this in the execution ledger: a Goal funded entirely by Accounts in other currencies is stamped by the next same-currency write, or by the owner's own edit — the server never guesses a rate.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @magermoney/api test -- goals.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src apps/api/test docs/discovery/phase-4-execution-ledger.md
git commit -m "feat(api): release a goal's accounts when it is archived"
```

---

### Task 8: API — `goalId` on `PATCH /accounts/{id}`

**Files:**

- Modify: `apps/api/src/modules/accounts/application/{account-repository.ts, dto.ts, update-account.ts}`
- Modify: `apps/api/src/modules/accounts/infrastructure/{memory,pg}-account-repository.ts`
- Create: `apps/api/test/accounts-goal-link.test.ts`

**Interfaces:**

- Consumes: `UpdateAccountInputSchema.goalId` (Task 4), `Repos.goals`, `stampAchieved` (Task 7).
- Produces: `AccountDto.goalId`; the link and the release.

- [ ] **Step 1: Write the failing test**

`apps/api/test/accounts-goal-link.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { testDeps, authHeader, USER } from './helpers/deps.js';

const json = (o: unknown) => ({
  headers: { ...authHeader(USER), 'content-type': 'application/json' },
  body: JSON.stringify(o),
});

describe('linking an account to a goal', () => {
  const setup = async () => {
    const a = createApp(testDeps());
    const goal = await (
      await a.request('/goals', {
        method: 'POST',
        ...json({ name: 'Car', targetAmount: '10000', currency: 'EUR' }),
      })
    ).json();
    const account = await (
      await a.request('/accounts', {
        method: 'POST',
        ...json({ name: 'S', bank: 'N26', country: 'DE', currency: 'EUR', kind: 'bank_account' }),
      })
    ).json();
    return { a, goal, account };
  };

  it('links and releases', async () => {
    const { a, goal, account } = await setup();
    const linked = await (
      await a.request(`/accounts/${account.id}`, { method: 'PATCH', ...json({ goalId: goal.id }) })
    ).json();
    expect(linked.goalId).toBe(goal.id);
    const released = await (
      await a.request(`/accounts/${account.id}`, { method: 'PATCH', ...json({ goalId: null }) })
    ).json();
    expect(released.goalId).toBeNull();
  });

  it('refuses a goal that belongs to somebody else', async () => {
    const { a, account } = await setup();
    const res = await a.request(`/accounts/${account.id}`, {
      method: 'PATCH',
      ...json({ goalId: '00000000-0000-0000-0000-000000000000' }),
    });
    expect(res.status).toBe(404);
  });

  it('refuses an account another goal already holds', async () => {
    const { a, goal, account } = await setup();
    await a.request(`/accounts/${account.id}`, { method: 'PATCH', ...json({ goalId: goal.id }) });
    const other = await (
      await a.request('/goals', {
        method: 'POST',
        ...json({ name: 'Bike', targetAmount: '500', currency: 'EUR' }),
      })
    ).json();
    const res = await a.request(`/accounts/${account.id}`, {
      method: 'PATCH',
      ...json({ goalId: other.id }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('account_already_linked');
  });

  it('refuses an archived goal', async () => {
    const { a, goal, account } = await setup();
    await a.request(`/goals/${goal.id}`, {
      method: 'PATCH',
      ...json({ archivedAt: '2026-09-21T10:00:00.000Z' }),
    });
    const res = await a.request(`/accounts/${account.id}`, {
      method: 'PATCH',
      ...json({ goalId: goal.id }),
    });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/api test -- accounts-goal-link.test.ts`
Expected: FAIL — `goalId` is absent from the response.

- [ ] **Step 3: Write the implementation**

Add `goal_id` to the account repositories' `COLS` and patch mapping, `goalId` to `toAccountDto`, and to `updateAccount`:

```ts
if (input.goalId !== undefined) {
  if (input.goalId !== null) {
    const goal = await deps.repos.goals.findById(userId, input.goalId);
    if (!goal) return err(new NotFoundError('goal'));
    if (goal.archivedAt !== null)
      return err(new ConflictError('That goal is archived', 'goal_archived'));
    if (current.goalId !== null && current.goalId !== input.goalId)
      return err(
        new ConflictError('That account already funds another goal', 'account_already_linked'),
      );
  }
  patch.goalId = input.goalId;
}
```

After the write, when a Goal is involved, call `stampAchieved` with the sum of that Goal's Accounts **in the Goal's own currency** (see Task 7's ledger note).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @magermoney/api test -- accounts-goal-link.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/accounts apps/api/test/accounts-goal-link.test.ts
git commit -m "feat(api): let an account say which goal it funds"
```

---

### Task 9: API — assets and the valuation journal

**Files:**

- Create: `apps/api/src/modules/assets/**` (repositories, dto, use cases, routes)
- Modify: `apps/api/src/app.ts`, `apps/api/src/shared/db/pg-unit-of-work.ts`, `apps/api/test/helpers/deps.ts`
- Create: `apps/api/test/assets.test.ts`

**Interfaces:**

- Consumes: `AssetDto`, `AssetInput`, `ValuationDto`, `ValuationInput` (Task 4); `CursorQuerySchema` from the balance journal.
- Produces: `Repos.assets`, `Repos.valuations`, the eight use cases listed in "Shared interfaces".

`AssetRow` carries `value` and `valuedOn` read from the journal by the repository — a lateral join in pg, a lookup in memory — so the DTO never stores a second copy:

```sql
left join lateral (
  select value::text as value, to_char(valued_on, 'YYYY-MM-DD') as valued_on
  from asset_valuations v where v.asset_id = a.id
  order by v.valued_on desc limit 1
) latest on true
```

- [ ] **Step 1: Write the failing test**

`apps/api/test/assets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { testDeps, authHeader, USER } from './helpers/deps.js';

const json = (o: unknown) => ({
  headers: { ...authHeader(USER), 'content-type': 'application/json' },
  body: JSON.stringify(o),
});

describe('assets', () => {
  const newAsset = async (a: ReturnType<typeof createApp>) =>
    (
      await a.request('/assets', {
        method: 'POST',
        ...json({ name: 'BMW 530e', currency: 'EUR', countsInTotal: true }),
      })
    ).json();

  it('starts with no value and takes the latest valuation afterwards', async () => {
    const a = createApp(testDeps());
    const asset = await newAsset(a);
    expect(asset).toMatchObject({ value: null, valuedOn: null, countsInTotal: true });

    await a.request(`/assets/${asset.id}/valuations`, {
      method: 'POST',
      ...json({ value: '28000', valuedOn: '2026-01-01' }),
    });
    await a.request(`/assets/${asset.id}/valuations`, {
      method: 'POST',
      ...json({ value: '30000', valuedOn: '2026-09-01' }),
    });

    const [listed] = await (await a.request('/assets', { headers: authHeader(USER) })).json();
    expect(listed).toMatchObject({ value: '30000', valuedOn: '2026-09-01' });
  });

  it('serves the journal newest first', async () => {
    const a = createApp(testDeps());
    const asset = await newAsset(a);
    await a.request(`/assets/${asset.id}/valuations`, {
      method: 'POST',
      ...json({ value: '28000', valuedOn: '2026-01-01' }),
    });
    await a.request(`/assets/${asset.id}/valuations`, {
      method: 'POST',
      ...json({ value: '30000', valuedOn: '2026-09-01' }),
    });
    const journal = await (
      await a.request(`/assets/${asset.id}/valuations`, { headers: authHeader(USER) })
    ).json();
    expect(journal.map((v: { valuedOn: string }) => v.valuedOn)).toEqual([
      '2026-09-01',
      '2026-01-01',
    ]);
  });

  it('refuses a second valuation on a date the asset already has', async () => {
    const a = createApp(testDeps());
    const asset = await newAsset(a);
    await a.request(`/assets/${asset.id}/valuations`, {
      method: 'POST',
      ...json({ value: '28000', valuedOn: '2026-01-01' }),
    });
    const res = await a.request(`/assets/${asset.id}/valuations`, {
      method: 'POST',
      ...json({ value: '29000', valuedOn: '2026-01-01' }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('valuation_exists');
  });

  it('refuses a valuation that is not positive', async () => {
    const a = createApp(testDeps());
    const asset = await newAsset(a);
    const res = await a.request(`/assets/${asset.id}/valuations`, {
      method: 'POST',
      ...json({ value: '0' }),
    });
    expect(res.status).toBe(400);
  });

  it('dates a valuation today when none is given', async () => {
    const a = createApp(testDeps());
    const asset = await newAsset(a);
    const v = await (
      await a.request(`/assets/${asset.id}/valuations`, {
        method: 'POST',
        ...json({ value: '30000' }),
      })
    ).json();
    expect(v.valuedOn).toBe(testDeps().clock.today());
  });

  it('takes the valuations with the asset', async () => {
    const a = createApp(testDeps());
    const asset = await newAsset(a);
    await a.request(`/assets/${asset.id}/valuations`, {
      method: 'POST',
      ...json({ value: '30000' }),
    });
    await a.request(`/assets/${asset.id}`, { method: 'DELETE', headers: authHeader(USER) });
    const res = await a.request(`/assets/${asset.id}/valuations`, { headers: authHeader(USER) });
    expect(res.status).toBe(404);
  });

  it('does not serve another user their neighbour assets', async () => {
    const a = createApp(testDeps());
    await newAsset(a);
    expect(
      await (await a.request('/assets', { headers: authHeader('other-user-id') })).json(),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/api test -- assets.test.ts`
Expected: FAIL — 404 on `/assets`.

- [ ] **Step 3: Write the module**

Two repositories, two use-case files, one routes file, following `budgets` and the balance journal. `addValuation` defaults `valuedOn` to `deps.clock.today()` and maps the unique violation to `ConflictError('valuation_exists')`; `listValuations` 404s when the Asset is not the user's, and orders by `valued_on desc, id desc` with the balance journal's cursor.

- [ ] **Step 4: Wire the module**

`Repos` gains `assets` and `valuations`; `app.route('/', assetRoutes(deps))`; memory repositories into `test/helpers/deps.ts`; pg repositories into `pg-unit-of-work.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @magermoney/api test -- assets.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/assets apps/api/src/app.ts apps/api/src/shared/db/pg-unit-of-work.ts apps/api/test
git commit -m "feat(api): serve assets and their valuation journal"
```

---

### Task 10: API — pg integration tests for phase 4

**Files:**

- Create: `apps/api/test/integration/pg-goal-archive.test.ts`
- Create: `apps/api/test/integration/pg-phase4-rls.test.ts`

**Interfaces:**

- Consumes: the migrations (Task 5), the pg repositories (Tasks 6–9), the integration harness in `test/integration/`.
- Produces: nothing other tasks import.

The memory repositories cannot prove a transaction or a policy. These two tests are the only place the real behaviour of `deps.uow` and RLS is checked.

- [ ] **Step 1: Write the archive transaction test**

`apps/api/test/integration/pg-goal-archive.test.ts`, following the existing integration tests' setup:

```ts
it('archives a goal and releases its accounts in one transaction', async () => {
  const { goal, account } = await seedLinkedGoal(sql);
  await updateGoal(deps)(USER, goal.id, { archivedAt: '2026-09-21T10:00:00.000Z' });
  const [row] = await sql`select goal_id from accounts where id = ${account.id}`;
  expect(row.goalId).toBeNull();
});

it('leaves both untouched when the release fails', async () => {
  const { goal, account } = await seedLinkedGoal(sql);
  const failing = { ...deps, uow: makeFailingUow(sql, 'accounts.clearGoal') };
  await expect(
    updateGoal(failing)(USER, goal.id, { archivedAt: '2026-09-21T10:00:00.000Z' }),
  ).rejects.toThrow();
  const [g] = await sql`select archived_at from goals where id = ${goal.id}`;
  const [a] = await sql`select goal_id from accounts where id = ${account.id}`;
  expect(g.archivedAt).toBeNull();
  expect(a.goalId).toBe(goal.id);
});
```

- [ ] **Step 2: Write the RLS test**

`apps/api/test/integration/pg-phase4-rls.test.ts` — with the anon role and a JWT for user A, assert that selecting, updating and deleting user B's rows in `goals`, `assets` and `asset_valuations` all return nothing or are refused, and that inserting a row carrying B's `user_id` is refused by the `with check`.

- [ ] **Step 3: Run the integration tests**

Run: `supabase start && bun run --filter @magermoney/api test:integration`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/integration
git commit -m "test(api): prove the goal archive transaction and phase 4 row policies"
```

---

### Task 11: Web — the fifth tab, `savings`, routes

**Files:**

- Modify: `apps/web/src/shared/layout/nav.ts`
- Create: `apps/web/src/modules/savings/{ui/SavingsPage.vue, index.ts}`
- Modify: `apps/web/src/app/router.ts`, `apps/web/src/locales/{ru,en}.json`
- Create: `apps/web/test/NavFiveTabs.test.ts`, `apps/web/test/SavingsPage.test.ts`
- Modify: `apps/web/test/fixtures/income-mount.ts` — the router there lists every path a mounted screen may link to, and a missing one makes `router-link` throw. Add `/goals`, `/goals/new`, `/goals/:id`, `/goals/:id/edit`, `/assets/new`, `/assets/:id`, `/assets/:id/edit` before any phase 4 screen is mounted.

**Interfaces:**

- Consumes: `NAV`, `isCurrent`, `isRoot`, `backTarget`; `usePageTitle`, `usePageAction`.
- Produces: the `/goals` route and `SavingsPage`; the segments are filled in Tasks 13 and 15.

Run `/frontend-design` before the markup and `/impeccable` after, per the global constraints.

- [ ] **Step 1: Write the failing test**

`apps/web/test/NavFiveTabs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NAV, isCurrent, backTarget } from '@/shared/layout/nav';

describe('the fifth tab', () => {
  it('sits between Plan and Settings', () => {
    expect(NAV.map((i) => i.key)).toEqual(['home', 'accounts', 'plan', 'goals', 'settings']);
  });

  it('stays lit on a goal and on an asset', () => {
    const goals = NAV.find((i) => i.key === 'goals')!;
    expect(isCurrent(goals, '/goals')).toBe(true);
    expect(isCurrent(goals, '/goals/abc')).toBe(true);
    expect(isCurrent(goals, '/assets/abc')).toBe(true);
    expect(isCurrent(goals, '/plan')).toBe(false);
  });

  it('sends the back button of an asset screen to the tab', () => {
    expect(backTarget('/assets/abc')).toBe('/goals');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/web test -- NavFiveTabs.test.ts`
Expected: FAIL — four keys, no `goals`.

- [ ] **Step 3: Add the tab**

In `nav.ts`, import `TargetIcon` from `@lucide/vue` and insert before `settings`:

```ts
{ key: 'goals', to: '/goals', label: 'nav.goals', icon: TargetIcon, owns: ['/goals', '/assets'] },
```

Add `nav.goals` to both locale files.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @magermoney/web test -- NavFiveTabs.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the screen test**

`apps/web/test/SavingsPage.test.ts` — the fifth argument of `mountAt` is what puts the screen inside `AppShell`; without it there is nowhere for a bar title to land:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import SavingsPage from '../src/modules/savings/ui/SavingsPage.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const mountSavings = () =>
  mountAt(
    SavingsPage,
    '/goals',
    apiOf((p) => (p === '/goals' || p === '/assets' ? json([]) : undefined)),
    {},
    true,
  );

describe('SavingsPage', () => {
  it('names itself in the top bar and keeps its own heading for wide windows', async () => {
    const { wrapper } = await mountSavings();
    await flushPromises();
    expect(wrapper.get('[data-testid="page-title"]').text()).toBe('Цели');
    expect(wrapper.get('h1').classes()).toEqual(
      expect.arrayContaining(['sr-only', 'md:not-sr-only']),
    );
    wrapper.unmount();
  });

  it('opens on the goals segment and swaps the panel when the other is chosen', async () => {
    const { wrapper } = await mountSavings();
    await flushPromises();
    expect(wrapper.find('[data-testid="segment-goals"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="segment-assets"]').exists()).toBe(false);
    await wrapper.get('[data-testid="savings-tab-assets"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="segment-goals"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="segment-assets"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('hands the bar action to whichever segment is showing', async () => {
    const { wrapper } = await mountSavings();
    await flushPromises();
    expect(wrapper.get('[data-testid="page-action"]').text()).toBe('Новая цель');
    await wrapper.get('[data-testid="savings-tab-assets"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="page-action"]').text()).toBe('Новый актив');
    wrapper.unmount();
  });
});
```

Confirm the two `data-testid`s the bar already uses (`page-title`, `page-action`) against `AppHeader.vue` before writing this, and use whatever names are there.

- [ ] **Step 6: Build the screen**

`SavingsPage.vue` with the Plan screen's segmented control, two panels, `usePageTitle`, and `usePageAction` delegated to whichever segment is showing — Goals declares "New goal", Assets declares "New asset". Route `/goals` in `router.ts`, with `/assets/:id` and `/goals/:id` registered in Tasks 13 and 15.

- [ ] **Step 7: Verify the pill at five tabs**

Run the app at 320 px, 390 px and 430 px wide. Confirm the capsule lands under the active tab, no label truncates, every target is at least 44 px, and re-run the glass contrast proof (`packages/ui/test/glass-panel.test.ts`) — the geometry assumed four tabs. If a label does not fit at 320 px, shorten the copy rather than the target.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/shared/layout/nav.ts apps/web/src/modules/savings apps/web/src/app/router.ts apps/web/src/locales apps/web/test
git commit -m "feat(web): give goals and assets the fifth tab"
```

---

### Task 12: Web — `goals` data layer and offline entry

**Files:**

- Create: `apps/web/src/modules/goals/{domain/{mappers.ts, monthly-balances.ts}, application/{use-goals.ts, use-goal-progress.ts, use-goal-forecast.ts, use-goal-mutations.ts, mutation-defaults.ts}, infrastructure/goals-api.ts, index.ts, offline.ts}`
- Modify: `apps/web/src/app/offline.ts`
- Create: `apps/web/test/use-goal-progress.test.ts`, `apps/web/test/monthly-balances.test.ts`, `apps/web/test/fixtures/goals.ts`

**Interfaces:**

- Consumes: `GoalDto` (Task 4), `goalProgress`, `goalForecast` (Tasks 1–2), `useAccounts` from `@/modules/accounts`, `useRateTable` from `@/modules/rates`.
- Produces: `GOALS_KEY`, `useGoals`, `useGoalProgress`, the four mutations, `registerGoalMutations`.

Copy `modules/budgets` for the api client, mappers, query and mutations, and `modules/income/offline.ts` for the second entry.

- [ ] **Step 1: Write the fixture**

`apps/web/test/fixtures/goals.ts`:

```ts
import type { GoalDto } from '@magermoney/contracts';

export const goalDto: GoalDto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Машина',
  icon: null,
  targetAmount: '10000',
  currency: 'EUR',
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
};
```

- [ ] **Step 2: Write the failing test**

`apps/web/test/use-goal-progress.test.ts` — a probe component, so the composable is exercised the way a screen exercises it:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { useGoalProgress } from '../src/modules/goals/application/use-goal-progress.js';
import { toGoal } from '../src/modules/goals/domain/mappers.js';
import { useCurrencyRegistry } from '../src/modules/currencies/index.js';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';
import { goalDto } from './fixtures/goals.js';

const LINKED = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const FREE = '44444444-4444-4444-8444-444444444444';

const Probe = defineComponent({
  setup() {
    const registry = useCurrencyRegistry();
    const progress = useGoalProgress(ref(toGoal(goalDto, registry.value)));
    return { progress };
  },
  template: `<i data-testid="funded">{{ progress.funded.amount.toString() }}</i>
             <i data-testid="ratio">{{ progress.ratio }}</i>
             <i data-testid="unconvertible">{{ progress.unconvertible.length }}</i>`,
});

const accounts = [
  acc(LINKED, 'EUR', { balance: '2000', goalId: goalDto.id }),
  acc(OTHER, 'EUR', { balance: '5000', goalId: '99999999-9999-4999-8999-999999999999' }),
  acc(FREE, 'EUR', { balance: '9000', goalId: null }),
];

describe('useGoalProgress', () => {
  it('counts the accounts linked to this goal and nothing else', async () => {
    const { wrapper } = await mountAt(
      Probe,
      '/goals',
      apiOf((p) => (p === '/accounts' ? json(accounts) : undefined)),
    );
    await flushPromises();
    expect(wrapper.get('[data-testid="funded"]').text()).toBe('2000');
    expect(Number(wrapper.get('[data-testid="ratio"]').text())).toBeCloseTo(0.2);
    wrapper.unmount();
  });

  it('reports an account it cannot price instead of counting it as zero', async () => {
    const unpriced = [acc(LINKED, 'BTC', { balance: '1', goalId: goalDto.id })];
    const { wrapper } = await mountAt(
      Probe,
      '/goals',
      apiOf((p) => (p === '/accounts' ? json(unpriced) : undefined)),
    );
    await flushPromises();
    expect(wrapper.get('[data-testid="funded"]').text()).toBe('0');
    expect(wrapper.get('[data-testid="unconvertible"]').text()).toBe('1');
    wrapper.unmount();
  });

  it('is zero while the accounts have not arrived', async () => {
    const { wrapper } = await mountAt(
      Probe,
      '/goals',
      apiOf(() => undefined),
    );
    expect(wrapper.get('[data-testid="funded"]').text()).toBe('0');
    wrapper.unmount();
  });
});
```

`acc` in the fixture predates `goalId`; add it there with a `null` default in the same step, or every existing mount breaks on the new field.

Then `apps/web/test/monthly-balances.test.ts`, which is the half of the forecast with no Vue in it:

```ts
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { CurrencyRegistry, Money, RateTable, SAMPLE_CURRENCIES } from '@magermoney/domain';
import { monthlyBalances } from '../src/modules/goals/domain/monthly-balances.js';

const registry = new CurrencyRegistry(SAMPLE_CURRENCIES);
const EUR = registry.get('EUR')._unsafeUnwrap();
const table = new RateTable('2026-09-21', [], registry);
const account = { id: 'a', balance: Money.of(new Decimal(3_000), EUR) } as never;

const entry = (amount: string, recordedAt: string) => ({
  id: recordedAt,
  accountId: 'a',
  amount,
  recordedAt,
  origin: 'manual',
  transferId: null,
  inflowId: null,
  note: null,
});

describe('monthlyBalances', () => {
  it('closes a month on its last entry', () => {
    const journals = new Map([
      [
        'a',
        [
          entry('1000', '2026-07-05T00:00:00.000Z'),
          entry('1500', '2026-07-28T00:00:00.000Z'),
          entry('2000', '2026-08-10T00:00:00.000Z'),
        ],
      ],
    ]);
    const series = monthlyBalances(journals, [account], table, EUR, '2026-08-20', 2);
    expect(series.map((m) => m.total.amount.toString())).toEqual(['1500', '2000']);
  });

  it('carries the last known balance through a month with no entry', () => {
    const journals = new Map([['a', [entry('1000', '2026-06-05T00:00:00.000Z')]]]);
    const series = monthlyBalances(journals, [account], table, EUR, '2026-08-20', 3);
    expect(series.map((m) => m.total.amount.toString())).toEqual(['1000', '1000', '1000']);
  });

  it('is zero for the months before the account had any entry', () => {
    const journals = new Map([['a', [entry('1000', '2026-08-05T00:00:00.000Z')]]]);
    const series = monthlyBalances(journals, [account], table, EUR, '2026-08-20', 3);
    expect(series.map((m) => m.total.amount.toString())).toEqual(['0', '0', '1000']);
  });

  it('adds the accounts together month by month', () => {
    const b = { id: 'b', balance: Money.of(new Decimal(500), EUR) } as never;
    const journals = new Map([
      ['a', [entry('1000', '2026-08-05T00:00:00.000Z')]],
      ['b', [{ ...entry('500', '2026-08-06T00:00:00.000Z'), accountId: 'b', id: 'b1' }]],
    ]);
    const series = monthlyBalances(journals, [account, b], table, EUR, '2026-08-20', 1);
    expect(series[0]!.total.amount.toString()).toBe('1500');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run --filter @magermoney/web test -- use-goal-progress.test.ts monthly-balances.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 4: Write the data layer**

`use-goals.ts` mirrors `use-budgets.ts` exactly (`GOALS_KEY`, `dtos`, mapped `goals`, `isLoading`, `isError`, `refetch`). `use-goal-progress.ts` composes the domain:

```ts
/**
 * A Goal's progress is a read model, not a field: the API never serves the
 * funded amount, because it would be stale the moment a rate moved. Here it is
 * recomputed from the Accounts the client already holds.
 */
export function useGoalProgress(goal: Ref<Goal>) {
  const { accounts } = useAccounts();
  const table = useRateTable();
  const linked = computed(() => accounts.value.filter((a) => a.goalId === goal.value.id));
  return computed(() => goalProgress(goal.value, linked.value, table.value));
}
```

`domain/monthly-balances.ts` is the pure half of the forecast — the part that turns journals into the series the domain wants. It lives in the module, not in `packages/domain`, because it reads a DTO:

```ts
/**
 * The closing total of the linked Accounts for each of the last `months`
 * months. A month with no entry on an Account carries that Account's last
 * known balance forward — silence in a journal means nothing moved, not that
 * the money vanished.
 *
 * Every Account is converted at today's rates rather than at the rate of its
 * month: the forecast is about how fast money arrives, and re-pricing history
 * every month would make a currency's move look like saving.
 */
export function monthlyBalances(
  journals: ReadonlyMap<string, BalanceEntryDto[]>,
  accounts: readonly Account[],
  table: RateTable,
  into: Currency,
  today: IsoDate,
  months = FORECAST_WINDOW_MONTHS,
): MonthlyBalance[];
```

`use-goal-forecast.ts` fetches one journal per linked Account (`useQueries` over `balanceEntriesKey(accountId)`), folds them with `monthlyBalances` and calls `goalForecast`. While any journal is still loading it returns `{ kind: 'none', reason: 'not_enough_history' }`, so the screen shows the honest line rather than a forecast built from half the accounts.

`offline.ts` exports `GOALS_KEY`, `CREATE_GOAL_KEY` and `registerGoalMutations`; `app/offline.ts` calls it.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --filter @magermoney/web test -- use-goal-progress.test.ts monthly-balances.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/goals apps/web/src/app/offline.ts apps/web/test
git commit -m "feat(web): load goals and recompute their progress on the client"
```

---

### Task 13: Web — Goals segment, Goal page, Goal form

**Files:**

- Create: `apps/web/src/modules/goals/ui/{GoalsSegment.vue, GoalCard.vue, GoalPage.vue, GoalFormSheet.vue}`
- Modify: `apps/web/src/modules/goals/index.ts`, `apps/web/src/app/router.ts`, `apps/web/src/locales/{ru,en}.json`
- Create: `apps/web/test/GoalsSegment.test.ts`, `apps/web/test/GoalPage.test.ts`

**Interfaces:**

- Consumes: Task 12's composables; `AmountLockup`, the progress rule and the sheet from `packages/ui`.
- Produces: `GoalsSegment`, `GoalPage` (async), `GoalFormPage` (async) on the barrel.

`/frontend-design` before the markup; `/impeccable` after; `/animate` for the progress bar's motion; `/humanize-text:humanize-text` on every new string — especially the missing-forecast line.

- [ ] **Step 1: Write the failing test**

`apps/web/test/GoalsSegment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import GoalsSegment from '../src/modules/goals/ui/GoalsSegment.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';
import { goalDto } from './fixtures/goals.js';

const achieved = {
  ...goalDto,
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Ноутбук',
  achievedAt: '2026-08-01T00:00:00.000Z',
};
const archived = {
  ...goalDto,
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Старое',
  archivedAt: '2026-08-01T00:00:00.000Z',
};
const linked = acc('22222222-2222-4222-8222-222222222222', 'EUR', {
  balance: '2000',
  goalId: goalDto.id,
});

/** Two closes a month apart: enough history for a rate, so a date is expected. */
const journal = [
  {
    id: 'e1',
    accountId: linked.id,
    amount: '1000',
    recordedAt: '2026-07-20T00:00:00.000Z',
    origin: 'manual',
    transferId: null,
    inflowId: null,
    note: null,
  },
  {
    id: 'e2',
    accountId: linked.id,
    amount: '2000',
    recordedAt: '2026-08-20T00:00:00.000Z',
    origin: 'manual',
    transferId: null,
    inflowId: null,
    note: null,
  },
];

const mountSegment = (
  goals: unknown[],
  opts: { accounts?: unknown[]; entries?: unknown[]; fail?: boolean } = {},
) =>
  mountAt(
    GoalsSegment,
    '/goals',
    apiOf((p) => {
      if (p === '/goals')
        return opts.fail ? json({ code: 'INTERNAL', message: 'boom' }, 500) : json(goals);
      if (p === '/accounts') return json(opts.accounts ?? [linked]);
      if (p.includes('/balance-entries')) return json(opts.entries ?? journal);
      return undefined;
    }),
    {},
    true,
  );

describe('GoalsSegment', () => {
  it('shows what is funded, what is left and when it will be reached', async () => {
    const { wrapper } = await mountSegment([goalDto]);
    await flushPromises();
    const card = wrapper.get(`[data-testid="goal-card-${goalDto.id}"]`);
    expect(card.text()).toContain('Машина');
    expect(card.text()).toContain('2000');
    expect(wrapper.get(`[data-testid="goal-forecast-${goalDto.id}"]`).text()).toMatch(/\d{4}/);
    wrapper.unmount();
  });

  it('says why there is no forecast rather than leaving the line blank', async () => {
    const { wrapper } = await mountSegment([goalDto], { entries: [journal[0]] });
    await flushPromises();
    const line = wrapper.get(`[data-testid="goal-forecast-${goalDto.id}"]`);
    expect(line.text().trim().length).toBeGreaterThan(0);
    expect(line.text()).not.toContain('∞');
    expect(line.text()).toContain('Пока не из чего считать');
    wrapper.unmount();
  });

  it('puts achieved goals below the active ones and leaves archived ones out', async () => {
    const { wrapper } = await mountSegment([goalDto, achieved, archived]);
    await flushPromises();
    expect(wrapper.get('[data-testid="goals-achieved"]').text()).toContain('Ноутбук');
    expect(wrapper.find(`[data-testid="goal-card-${archived.id}"]`).exists()).toBe(false);
    const html = wrapper.html();
    expect(html.indexOf(goalDto.id)).toBeLessThan(html.indexOf(achieved.id));
    wrapper.unmount();
  });

  it('shows the failure, not an empty list, when the goals do not load', async () => {
    const { wrapper } = await mountSegment([], { fail: true });
    await flushPromises();
    expect(wrapper.find('[data-testid="route-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="goals-empty"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('invites the first goal when there is none', async () => {
    const { wrapper } = await mountSegment([]);
    await flushPromises();
    expect(wrapper.find('[data-testid="goals-empty"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
```

`apps/web/test/GoalPage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import GoalPage from '../src/modules/goals/ui/GoalPage.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';
import { goalDto } from './fixtures/goals.js';

const linked = acc('22222222-2222-4222-8222-222222222222', 'EUR', {
  balance: '2000',
  goalId: goalDto.id,
});
const free = acc('44444444-4444-4444-8444-444444444444', 'EUR', { balance: '9000', goalId: null });

const mountPage = (accounts = [linked, free]) =>
  mountAt(
    GoalPage,
    `/goals/${goalDto.id}`,
    apiOf((p) => {
      if (p === '/goals') return json([goalDto]);
      if (p === `/goals/${goalDto.id}`) return json(goalDto);
      if (p === '/accounts') return json(accounts);
      if (p.includes('/balance-entries')) return json([]);
      return undefined;
    }),
    {},
    true,
  );

describe('GoalPage', () => {
  it('names itself in the top bar and offers editing there', async () => {
    const { wrapper } = await mountPage();
    await flushPromises();
    expect(wrapper.get('[data-testid="page-title"]').text()).toBe('Машина');
    expect(wrapper.get('[data-testid="page-action"]').text()).toBe('Изменить');
    wrapper.unmount();
  });

  it('lists the accounts that fund it, and only those', async () => {
    const { wrapper } = await mountPage();
    await flushPromises();
    expect(wrapper.get(`[data-testid="goal-account-${linked.id}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-testid="goal-account-${free.id}"]`).exists()).toBe(false);
    wrapper.unmount();
  });

  it('asks for an account when none funds it yet', async () => {
    const { wrapper } = await mountPage([free]);
    await flushPromises();
    expect(wrapper.get('[data-testid="goal-accounts-empty"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="goal-add-account"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/web test -- GoalsSegment.test.ts GoalPage.test.ts`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Build the segment and the card**

`GoalCard.vue`: name and icon, `AmountLockup` of funded against target, the progress rule, one forecast line. `GoalsSegment.vue`: active goals, then an "achieved" block; `RouteError` on `isError`; the empty state; `usePageAction` declaring "New goal".

- [ ] **Step 4: Build the goal page and the form**

`GoalPage.vue` at `/goals/:id`: progress, forecast, target date, the linked Accounts as rows, an "Add account" button (filled in Task 14), `usePageAction` "Edit". `GoalFormSheet.vue`: name, icon, amount, currency, optional date, plus archive and delete.

- [ ] **Step 5: Run the tests**

Run: `bun run --filter @magermoney/web test -- GoalsSegment.test.ts GoalPage.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/goals apps/web/src/app/router.ts apps/web/src/locales apps/web/test
git commit -m "feat(web): show goals, their progress and when they will be reached"
```

---

### Task 14: Web — linking an Account from the Goal's screen

**Files:**

- Create: `apps/web/src/modules/goals/ui/LinkAccountSheet.vue`
- Modify: `apps/web/src/modules/goals/ui/GoalPage.vue`, `apps/web/src/modules/accounts` (a `useLinkAccountToGoal` mutation)
- Create: `apps/web/test/LinkAccountSheet.test.ts`

**Interfaces:**

- Consumes: `PATCH /accounts/{id}` with `goalId` (Task 8); `useAccounts`.
- Produces: `LinkAccountSheet`; the linked rows on `GoalPage`.

The mutation belongs to the `accounts` module — it writes an Account — and `goals` reaches it through that module's barrel.

- [ ] **Step 1: Write the failing test**

`apps/web/test/LinkAccountSheet.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import LinkAccountSheet from '../src/modules/goals/ui/LinkAccountSheet.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';
import { goalDto } from './fixtures/goals.js';

const mine = acc('22222222-2222-4222-8222-222222222222', 'EUR', {
  balance: '2000',
  goalId: goalDto.id,
});
const taken = acc('33333333-3333-4333-8333-333333333333', 'EUR', {
  balance: '5000',
  goalId: '99999999-9999-4999-8999-999999999999',
});
const free = acc('44444444-4444-4444-8444-444444444444', 'EUR', { balance: '9000', goalId: null });
const gone = acc('55555555-5555-4555-8555-555555555555', 'EUR', {
  balance: '1',
  goalId: null,
  archivedAt: '2026-01-01T00:00:00.000Z',
});

const mountSheet = (accounts: unknown[]) => {
  const patched: { path: string; body: unknown }[] = [];
  const fetch = apiOf((p, init) => {
    if (p === '/accounts' && (!init || init.method === undefined)) return json(accounts);
    if (init?.method === 'PATCH') {
      patched.push({ path: p, body: JSON.parse(String(init.body)) });
      return json({ ...free, goalId: goalDto.id });
    }
    return undefined;
  });
  return mountAt(LinkAccountSheet, `/goals/${goalDto.id}`, fetch, {
    props: { goalId: goalDto.id, open: true },
  }).then((m) => ({ ...m, patched }));
};

describe('LinkAccountSheet', () => {
  it('offers only the accounts no goal holds', async () => {
    const { wrapper } = await mountSheet([mine, taken, free]);
    await flushPromises();
    const rows = wrapper.findAll('[data-testid^="link-account-"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attributes('data-testid')).toBe(`link-account-${free.id}`);
    wrapper.unmount();
  });

  it('does not offer an archived account', async () => {
    const { wrapper } = await mountSheet([gone]);
    await flushPromises();
    expect(wrapper.find(`[data-testid="link-account-${gone.id}"]`).exists()).toBe(false);
    wrapper.unmount();
  });

  it('links the account it is given', async () => {
    const { wrapper, patched } = await mountSheet([free]);
    await flushPromises();
    await wrapper.get(`[data-testid="link-account-${free.id}"]`).trigger('click');
    await flushPromises();
    expect(patched).toEqual([{ path: `/accounts/${free.id}`, body: { goalId: goalDto.id } }]);
    wrapper.unmount();
  });

  it('says why the list is empty when every account is already taken', async () => {
    const { wrapper } = await mountSheet([mine, taken]);
    await flushPromises();
    expect(wrapper.get('[data-testid="link-account-empty"]').text()).toContain(
      'Все счета уже закреплены',
    );
    wrapper.unmount();
  });
});
```

The release path belongs to `GoalPage`; add one case there asserting the row's action sends `{ goalId: null }` to the same endpoint.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/web test -- LinkAccountSheet.test.ts`
Expected: FAIL — `LinkAccountSheet` does not exist.

- [ ] **Step 3: Build the sheet**

The list is `accounts.filter((a) => a.goalId === null && !a.archived)`. Picking one calls the mutation and closes the sheet; the optimistic update sets `goalId` locally so the progress bar moves before the response lands.

- [ ] **Step 4: Run the test**

Run: `bun run --filter @magermoney/web test -- LinkAccountSheet.test.ts GoalPage.test.ts`
Expected: PASS, 4 + 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules apps/web/test apps/web/src/locales
git commit -m "feat(web): fund a goal by linking an account to it"
```

---

### Task 15: Web — `assets` data layer, segment, page, valuations

**Files:**

- Create: `apps/web/src/modules/assets/**` (mirrors `goals`, plus `use-valuations.ts`)
- Modify: `apps/web/src/app/{router.ts, offline.ts}`, `apps/web/src/modules/savings/ui/SavingsPage.vue`, `apps/web/src/locales/{ru,en}.json`
- Create: `apps/web/test/AssetsSegment.test.ts`, `apps/web/test/AssetPage.test.ts`, `apps/web/test/fixtures/assets.ts`

**Interfaces:**

- Consumes: `AssetDto`, `ValuationDto` (Task 4); `assetValue`, `assetsTotal` (Task 3).
- Produces: `ASSETS_KEY`, `valuationsKey`, `useAssets`, `useValuations`, the mutations, `AssetsSegment`, `AssetPage` (async).

- [ ] **Step 1: Write the fixture and the failing tests**

`apps/web/test/fixtures/assets.ts`:

```ts
import type { AssetDto, ValuationDto } from '@magermoney/contracts';

export const assetDto: AssetDto = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'BMW 530e',
  currency: 'EUR',
  countsInTotal: true,
  acquiredOn: '2023-05-01',
  purchasePrice: '25000',
  archivedAt: null,
  value: '30000',
  valuedOn: '2026-09-01',
};

export const valuationDto: ValuationDto = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  assetId: assetDto.id,
  value: '30000',
  valuedOn: '2026-09-01',
};
```

`apps/web/test/AssetsSegment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import AssetsSegment from '../src/modules/assets/ui/AssetsSegment.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';
import { assetDto } from './fixtures/assets.js';

const outside = {
  ...assetDto,
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'Часы',
  countsInTotal: false,
  value: '4000',
};
const unvalued = {
  ...assetDto,
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  name: 'Гитара',
  value: null,
  valuedOn: null,
};

const mountSegment = (assets: unknown[], fail = false) =>
  mountAt(
    AssetsSegment,
    '/goals',
    apiOf((p) =>
      p === '/assets'
        ? fail
          ? json({ code: 'INTERNAL', message: 'boom' }, 500)
          : json(assets)
        : undefined,
    ),
    {},
    true,
  );

describe('AssetsSegment', () => {
  it('totals only the assets that count towards the capital', async () => {
    const { wrapper } = await mountSegment([assetDto, outside]);
    await flushPromises();
    const total = wrapper.get('[data-testid="assets-total"]').text();
    expect(total).toContain('30');
    expect(total).not.toContain('34');
    wrapper.unmount();
  });

  it('marks the ones outside the capital without hiding them', async () => {
    const { wrapper } = await mountSegment([assetDto, outside]);
    await flushPromises();
    expect(wrapper.get(`[data-testid="asset-row-${outside.id}"]`).text()).toContain(
      'Не в капитале',
    );
    expect(wrapper.get(`[data-testid="asset-row-${assetDto.id}"]`).text()).not.toContain(
      'Не в капитале',
    );
    wrapper.unmount();
  });

  it('does not pretend an unvalued asset is worth zero', async () => {
    const { wrapper } = await mountSegment([unvalued]);
    await flushPromises();
    const row = wrapper.get(`[data-testid="asset-row-${unvalued.id}"]`);
    expect(row.text()).toContain('Ещё не оценён');
    expect(row.text()).not.toMatch(/\b0[.,]00\b/);
    wrapper.unmount();
  });

  it('shows the failure, not an empty list, when the assets do not load', async () => {
    const { wrapper } = await mountSegment([], true);
    await flushPromises();
    expect(wrapper.find('[data-testid="route-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assets-empty"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
```

`apps/web/test/AssetPage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import AssetPage from '../src/modules/assets/ui/AssetPage.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';
import { assetDto, valuationDto } from './fixtures/assets.js';

const older = {
  ...valuationDto,
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  value: '28000',
  valuedOn: '2026-01-01',
};

const mountPage = (asset = assetDto, valuations = [valuationDto, older]) =>
  mountAt(
    AssetPage,
    `/assets/${asset.id}`,
    apiOf((p) => {
      if (p === '/assets') return json([asset]);
      if (p === `/assets/${asset.id}`) return json(asset);
      if (p.startsWith(`/assets/${asset.id}/valuations`)) return json(valuations);
      return undefined;
    }),
    {},
    true,
  );

describe('AssetPage', () => {
  it('shows the change against the purchase price', async () => {
    const { wrapper } = await mountPage();
    await flushPromises();
    expect(wrapper.get('[data-testid="asset-change"]').text()).toContain('5000');
    wrapper.unmount();
  });

  it('shows no change when nothing says what it cost', async () => {
    const { wrapper } = await mountPage({ ...assetDto, purchasePrice: null });
    await flushPromises();
    expect(wrapper.find('[data-testid="asset-change"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('lists the journal newest first', async () => {
    const { wrapper } = await mountPage();
    await flushPromises();
    const dates = wrapper.findAll('[data-testid^="valuation-row-"]').map((r) => r.text());
    expect(dates[0]).toContain('2026');
    expect(wrapper.html().indexOf(valuationDto.id)).toBeLessThan(wrapper.html().indexOf(older.id));
    wrapper.unmount();
  });

  it('offers a new valuation from the top bar', async () => {
    const { wrapper } = await mountPage();
    await flushPromises();
    expect(wrapper.get('[data-testid="page-action"]').text()).toBe('Добавить оценку');
    wrapper.unmount();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @magermoney/web test -- AssetsSegment.test.ts AssetPage.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Build the data layer**

Mirror Task 12: `assets-api.ts`, `mappers.ts`, `use-assets.ts`, `use-valuations.ts` (infinite query on the cursor), `use-asset-mutations.ts`, `offline.ts`.

- [ ] **Step 4: Build the segment and the page**

`AssetsSegment.vue`: the total on top, a row per Asset, the muted mark on those outside the capital, `RouteError` on `isError`, `usePageAction` "New asset". `AssetPage.vue` at `/assets/:id`: current value, the change against the purchase price, the journal, `usePageAction` "Add valuation". `AssetFormSheet.vue` and `ValuationSheet.vue`.

- [ ] **Step 5: Wire the segment into the tab**

`SavingsPage.vue` renders `AssetsSegment` in its second panel and forwards its page action.

- [ ] **Step 6: Run the tests**

Run: `bun run --filter @magermoney/web test -- AssetsSegment.test.ts AssetPage.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/assets apps/web/src/modules/savings apps/web/src/app apps/web/src/locales apps/web/test
git commit -m "feat(web): show assets and the history of what they are worth"
```

---

### Task 16: Web — capital on Home, smoke test, ledger

**Files:**

- Modify: `apps/web/src/modules/dashboard/application/build-dashboard.ts` and its screen
- Create: `apps/web/e2e/goals.spec.ts`
- Modify: `docs/discovery/phase-4-execution-ledger.md`
- Create: `apps/web/test/capital-with-assets.test.ts`

**Interfaces:**

- Consumes: `assetsTotal` (Task 3), `useAssets` (Task 15) through the `assets` barrel.
- Produces: the capital figure including Assets.

- [ ] **Step 1: Write the failing test**

`apps/web/test/capital-with-assets.test.ts`. Read `apps/web/test/build-dashboard.test.ts` first and reuse its `base` input verbatim — this test adds one field to it and asserts nothing else moved:

```ts
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { CurrencyRegistry, Money, RateTable, SAMPLE_CURRENCIES } from '@magermoney/domain';
import type { Asset } from '@magermoney/domain';
import { buildDashboard } from '../src/modules/dashboard/application/build-dashboard.js';
import { base } from './build-dashboard.test.js'; // export it there if it is local

const registry = new CurrencyRegistry(SAMPLE_CURRENCIES);
const EUR = registry.get('EUR')._unsafeUnwrap();
const table = new RateTable('2026-09-21', [], registry);

const car: Asset = {
  id: 'car',
  name: 'BMW 530e',
  value: Money.of(new Decimal(30_000), EUR),
  valuedOn: '2026-09-01',
  countsInTotal: true,
  acquiredOn: null,
  purchasePrice: null,
  archived: false,
};
const watch: Asset = {
  ...car,
  id: 'watch',
  name: 'Часы',
  countsInTotal: false,
  value: Money.of(new Decimal(4_000), EUR),
};
const btc: Asset = {
  ...car,
  id: 'btc',
  name: 'Слиток',
  value: Money.of(new Decimal(1), registry.get('BTC')._unsafeUnwrap()),
};

describe('capital with assets', () => {
  it('adds the assets marked for the capital', () => {
    const withoutAssets = buildDashboard({ ...base, assets: [] });
    const withCar = buildDashboard({ ...base, assets: [car] });
    expect(withCar.capital.total.amount.minus(withoutAssets.capital.total.amount).toString()).toBe(
      '30000',
    );
  });

  it('leaves out an asset that is not marked', () => {
    const a = buildDashboard({ ...base, assets: [car] });
    const b = buildDashboard({ ...base, assets: [car, watch] });
    expect(a.capital.total.amount.toString()).toBe(b.capital.total.amount.toString());
  });

  it('lists an asset it cannot price instead of counting it as zero', () => {
    const d = buildDashboard({ ...base, assets: [btc], table });
    expect(d.capital.unconvertible.map((x) => x.id)).toContain('btc');
  });

  it('leaves every phase 3 number alone when there are no assets', () => {
    const before = buildDashboard(base as never);
    const after = buildDashboard({ ...base, assets: [] });
    expect(after.capital.total.amount.toString()).toBe(before.capital.total.amount.toString());
    expect(after.monthPlan).toEqual(before.monthPlan);
  });
});
```

`capital.unconvertible` now holds two kinds of thing. Give it a discriminated shape (`{ kind: 'account' | 'asset'; id: string; name: string }`) rather than a union of two domain types, and update the Home screen's list accordingly — the screen only ever prints a name.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter @magermoney/web test -- capital-with-assets.test.ts`
Expected: FAIL — `buildDashboard` takes no `assets`.

- [ ] **Step 3: Write the implementation**

`buildDashboard` gains an `assets` input, adds `assetsTotal(...)` into the capital and concatenates the two `unconvertible` lists. The Home screen passes `useAssets().assets`; the `dashboard` module imports `@/modules/assets`, never a screen of it.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter @magermoney/web test -- capital-with-assets.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the smoke test**

`apps/web/e2e/goals.spec.ts`: sign in, open the fifth tab, create a Goal, link an Account, see the progress move off zero.

Run: `bun run --filter @magermoney/web test:e2e -- goals.spec.ts`

- [ ] **Step 6: Close the ledger and the backlog**

Append every ruling made during execution to `docs/discovery/phase-4-execution-ledger.md`. Read `backlog instructions task-finalization` before checking any acceptance criterion.

- [ ] **Step 7: Commit**

Run the full check: `bun run lint && bun run typecheck && bun run test && bun run build`.

```bash
git add apps/web docs/discovery/phase-4-execution-ledger.md
git commit -m "feat(web): count the owned things in the capital"
```

---

## Verification before hand-off

- `bun run lint && bun run typecheck && bun run test && bun run build` green.
- `packages/domain` coverage at 100 %.
- `supabase db reset` applies all three migrations from empty.
- The pill proven at 320 px with five tabs, and the glass contrast proof re-run.
- Every new string present in both `ru.json` and `en.json`.
