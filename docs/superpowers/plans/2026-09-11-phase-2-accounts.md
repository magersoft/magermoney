# Magermoney Phase 2: Accounts, Balance Journal, Transfers, Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Account from the owner's spreadsheet lives in the app with a journal of declared balances, Transfers between Accounts produce paired journal entries, the home screen shows total capital and the grouped Account list in the Display currency, a Rates screen edits manual rates, and one local CLI imports the "Счета" sheet and the yearly rates.

**Architecture:** Pure transfer arithmetic and read models in `packages/domain`; zod DTOs in `packages/contracts`; two new Hono modules (`accounts` incl. balances, `transfers`) behind a unit-of-work that wraps postgres.js transactions; two new web modules (`accounts`, `transfers`) on TanStack Query with optimistic balance updates; `MoneyInput` and a few shadcn-vue primitives added to `packages/ui`; a pure CSV parser + mapper under `apps/api/scripts/import/` driven by `import-sheet.ts`.

**Tech Stack:** bun 1.3, Node 24, Turborepo 2, TypeScript 5, Vue 3.5, Vite 7, vue-router 5, vue-i18n 11, @tanstack/vue-query 5, Tailwind 4, shadcn-vue 2 / reka-ui 2, motion-v 2, Hono 4 + @hono/zod-openapi 1, zod 4, decimal.js 10, neverthrow 8, postgres 3, Vitest 5, fast-check 4, Playwright 1.63, Supabase CLI 2.117.

**Spec:** `docs/superpowers/specs/2026-09-11-phase-2-accounts-design.md`. Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/0001`–`0005`, `docs/discovery/decisions-log.md`. Full schema: `docs/db/schema.dbml`. Phase 1 plan (patterns to copy): `docs/superpowers/plans/2026-09-11-phase-1-foundation.md`.

## Global Constraints

- Node `24`; bun is the package manager and script runner. Run `bun install` after editing any `package.json`.
- Money and rates are `numeric` in Postgres, decimal strings (`DecimalString`) in JSON, `Money`/`Decimal` in code. Never `number` for amounts. (ADR 0001)
- Every user table has `user_id`, RLS enabled (`user_id = auth.uid()`), and every use case and every SQL statement filters by `userId`. (spec §3, §4)
- Balances are declared, never summed from transactions. Current balance = latest entry by `(recorded_at desc, created_at desc)`. Only the latest manual entry is editable; a Transfer is editable only while both of its entries are latest. (ADR 0002, spec §1.3)
- Aggregates (total capital, available until payday, grouping) are pure functions in `packages/domain` run on the client; the server only returns the latest entry per Account. (ADR 0003, spec §1.6)
- Dependency direction: `domain` ← `contracts` ← `api`, `web`; `ui` imports only Vue/Tailwind. Enforced by `eslint-plugin-boundaries`; a web module is imported only through its `index.ts` (`@/modules/<name>`), never a file inside it.
- No ORM. Hand-written SQL in `supabase/migrations`; postgres.js in the API with `transform: postgres.camel` and `numeric` as string.
- Domain errors are typed classes; use cases return `Result<T, E>` from neverthrow; HTTP mapping lives only in `apps/api/src/shared/errors/http.ts`.
- Logs never contain amounts, emails, or tokens. No real spreadsheet data in the repo: import tests use the synthetic CSV in this plan only.
- Commits via the `/git-commit` skill (Conventional Commits, English). Every commit ends with the trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01UCv8iYJ3pLQek4T7wRDebA`.
- UI copy through i18n keys in `apps/web/src/locales/ru.json` and `en.json` (both files always carry the same keys; `@` inside a message is written `{'@'}`); run `/humanize-text:humanize-text` on new copy. RU is the default; EN may be a plain draft.
- Any new screen or component: `/frontend-design` before markup, `/impeccable` after; motion only via presets in `packages/ui/src/motion` and `/animate`; components enter `packages/ui` only through the shadcn-vue CLI/MCP, and their `@/` imports are rewritten to relative paths. Touch targets `min-h-11` under `pointer-coarse:`.
- Web modules follow `/vue-ddd-architecture`: `modules/<name>/{domain,application,infrastructure,ui}` with one public `index.ts`; UI and application layers never import TanStack Query types directly from a component.
- Tests: TDD (failing test first). `packages/domain` keeps 100 % coverage. API use cases are tested on in-memory repositories via `createApp(testDeps(...))` and `app.request()`; pg repositories only in `test/integration/**`.
- Run commands from the repo root as `bun run --filter @magermoney/<pkg> <script>` or inside the package directory. Full check before every commit: `bun run lint && bun run typecheck && bun run test` (turbo).

---

## File map

```
packages/domain/src/{account.ts, transfer.ts, read-models.ts, errors.ts (+3 classes), money.ts (+zero), index.ts}
packages/domain/test/{transfer.test.ts, transfer.property.test.ts, read-models.test.ts}
packages/contracts/src/{account.ts, balance-entry.ts, transfer.ts, rate.ts (+DeleteManualRateQuerySchema), index.ts}
packages/contracts/test/phase2.test.ts
supabase/migrations/{20260912000004_accounts.sql, 20260912000005_transfers.sql, 20260912000006_balance_entries.sql}
supabase/test/rls.test.ts (+accounts cases)
docs/db/schema.dbml  CONTEXT.md  docs/discovery/decisions-log.md
apps/api/src/shared/errors/http.ts (+ConflictError, 409)
apps/api/src/shared/db/unit-of-work.ts
apps/api/src/modules/accounts/application/{account-repository.ts, balance-repository.ts, list-accounts.ts, create-account.ts, update-account.ts, archive-account.ts, delete-account.ts, reorder-accounts.ts, list-balances.ts, record-balance.ts, edit-balance.ts, delete-balance.ts, dto.ts}
apps/api/src/modules/accounts/infrastructure/{memory-account-repository.ts, memory-balance-repository.ts, pg-account-repository.ts, pg-balance-repository.ts}
apps/api/src/modules/accounts/http/routes.ts
apps/api/src/modules/transfers/application/{transfer-repository.ts, transfer-math.ts, create-transfer.ts, update-transfer.ts, delete-transfer.ts, list-transfers.ts, dto.ts}
apps/api/src/modules/transfers/infrastructure/{memory-transfer-repository.ts, pg-transfer-repository.ts}
apps/api/src/modules/transfers/http/routes.ts
apps/api/src/modules/rates/application/remove-manual-rate.ts (+repo method, +route)
apps/api/src/app.ts  apps/api/src/bootstrap.ts  apps/api/test/helpers/deps.ts
apps/api/test/{accounts.test.ts, balances.test.ts, transfers.test.ts, remove-manual-rate.test.ts}
apps/api/test/integration/{pg-account-repository.test.ts, pg-transfer-concurrency.test.ts}
apps/api/scripts/import/{csv.ts, numbers.ts, accounts-mapper.ts, rates-mapper.ts, run.ts}  apps/api/scripts/import-sheet.ts
apps/api/test/import/{csv.test.ts, accounts-mapper.test.ts, rates-mapper.test.ts}
packages/ui/src/components/ui/{badge, separator, dropdown-menu, alert-dialog}/**  packages/ui/src/components/money-input/{MoneyInput.vue, parse.ts}  packages/ui/test/money-input.test.ts  packages/ui/src/index.ts
apps/web/src/modules/accounts/{domain/{mappers.ts, labels.ts}, application/{use-accounts.ts, use-account-mutations.ts, use-record-balance.ts, use-account-balances.ts, use-capital-summary.ts}, infrastructure/accounts-api.ts, ui/{AccountsPage.vue, AccountRow.vue, ProviderGroup.vue, AccountDetailPage.vue, AccountFormSheet.vue, RecordBalanceSheet.vue, BalanceTimeline.vue}, index.ts}
apps/web/src/modules/transfers/{application/{use-transfers.ts, use-transfer-mutations.ts}, infrastructure/transfers-api.ts, ui/{TransferSheet.vue, TransfersPage.vue}, index.ts}
apps/web/src/modules/rates/{application/use-manual-rate.ts, infrastructure/rates-api.ts, ui/{RatesPage.vue, ManualRateSheet.vue}, index.ts}  (HomePage.vue deleted)
apps/web/src/app/{router.ts, App.vue, QuickActions.vue}  apps/web/src/shared/layout/AppShell.vue
apps/web/src/locales/{ru.json, en.json}
apps/web/test/{accounts-api.test.ts, use-record-balance.test.ts, use-capital-summary.test.ts, TransferSheet.test.ts, AccountsPage.test.ts}
apps/web/e2e/smoke.spec.ts  README.md  .gitignore (+imports/)
```

---

### Task 1: Domain — account types and transfer arithmetic

**Files:**

- Create: `packages/domain/src/account.ts`, `packages/domain/src/transfer.ts`
- Modify: `packages/domain/src/errors.ts`, `packages/domain/src/money.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/test/transfer.test.ts`, `packages/domain/test/transfer.property.test.ts`

**Interfaces:**

- Consumes: `Money`, `Currency`, `CurrencyMismatchError`, `Decimal` from phase 1.
- Produces: `AccountKind`, `CardType`, `Account`, `Money.zero(currency)`, `TransferError`, `InsufficientFundsError`, `deriveTransfer(input): Result<TransferDerivation, TransferError | CurrencyMismatchError>`, `applyTransfer(input): Result<{ fromAfter: Money; toAfter: Money }, InsufficientFundsError | CurrencyMismatchError>`, `RATE_SIGNIFICANT_DIGITS = 10`.

- [ ] **Step 1: Write the failing tests**

`packages/domain/test/transfer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  InsufficientFundsError,
  Money,
  TransferError,
  applyTransfer,
  deriveTransfer,
  CurrencyMismatchError,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const c = (code: string) => reg.get(code)._unsafeUnwrap();
const m = (amount: string, code: string) => Money.of(amount, c(code));

describe('deriveTransfer', () => {
  it('same currency: fee is the difference and there is no rate', () => {
    const d = deriveTransfer({
      amountSent: m('100', 'USD'),
      amountReceived: m('98.5', 'USD'),
    })._unsafeUnwrap();
    expect(d.fee?.toString()).toBe('1.5');
    expect(d.realisedRate).toBeNull();
  });
  it('same currency: a received amount above the sent one is a negative fee', () => {
    const e = deriveTransfer({
      amountSent: m('100', 'USD'),
      amountReceived: m('101', 'USD'),
    })._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(TransferError);
    expect((e as TransferError).reason).toBe('negative_fee');
  });
  it('cross currency: the realised rate is received / sent to 10 significant digits, no fee', () => {
    const d = deriveTransfer({
      amountSent: m('15931.21', 'USD'),
      amountReceived: m('13723.27', 'EUR'),
    })._unsafeUnwrap();
    expect(d.realisedRate?.toString()).toBe('0.8614076412');
    expect(d.fee).toBeNull();
  });
  it('rejects a zero sent amount', () => {
    const e = deriveTransfer({
      amountSent: m('0', 'USD'),
      amountReceived: m('0', 'EUR'),
    })._unsafeUnwrapErr();
    expect((e as TransferError).reason).toBe('non_positive_amount');
  });
});

describe('applyTransfer', () => {
  const debit = { kind: 'card', cardType: 'debit' } as const;
  const credit = { kind: 'card', cardType: 'credit' } as const;
  it('moves money between two balances', () => {
    const r = applyTransfer({
      from: { balance: m('1000', 'USD'), ...debit },
      toBalance: m('50', 'EUR'),
      amountSent: m('100', 'USD'),
      amountReceived: m('86.14', 'EUR'),
    })._unsafeUnwrap();
    expect(r.fromAfter.toString()).toBe('900');
    expect(r.toAfter.toString()).toBe('136.14');
  });
  it('refuses to overdraw a debit account', () => {
    const e = applyTransfer({
      from: { balance: m('10', 'USD'), ...debit },
      toBalance: m('0', 'USD'),
      amountSent: m('11', 'USD'),
      amountReceived: m('11', 'USD'),
    })._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(InsufficientFundsError);
  });
  it('lets a credit card go negative', () => {
    const r = applyTransfer({
      from: { balance: m('10', 'USD'), ...credit },
      toBalance: m('0', 'USD'),
      amountSent: m('11', 'USD'),
      amountReceived: m('11', 'USD'),
    })._unsafeUnwrap();
    expect(r.fromAfter.toString()).toBe('-1');
  });
  it('rejects a sent amount in another currency than the source balance', () => {
    const e = applyTransfer({
      from: { balance: m('10', 'USD'), ...debit },
      toBalance: m('0', 'EUR'),
      amountSent: m('1', 'EUR'),
      amountReceived: m('1', 'EUR'),
    })._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(CurrencyMismatchError);
  });
  it('a missing balance is zero', () => {
    expect(Money.zero(c('EUR')).toString()).toBe('0');
    expect(Money.zero(c('EUR')).currency.code).toBe('EUR');
  });
});
```

`packages/domain/test/transfer.property.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CurrencyRegistry, Money, applyTransfer, deriveTransfer } from '../src/index.js';

const reg = CurrencyRegistry.default();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const cents = fc
  .integer({ min: 1, max: 10_000_000_00 })
  .map((n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`);

describe('transfer properties', () => {
  it('same currency: capital drops by exactly the fee', () => {
    fc.assert(
      fc.property(cents, cents, cents, (bal, sent, feeRaw) => {
        const sentM = Money.of(sent, USD);
        const fee = Money.of(feeRaw, USD);
        if (fee.compare(sentM)._unsafeUnwrap() > 0) return;
        const balance = Money.of(bal, USD).add(sentM)._unsafeUnwrap();
        const received = sentM.subtract(fee)._unsafeUnwrap();
        const d = deriveTransfer({ amountSent: sentM, amountReceived: received })._unsafeUnwrap();
        const r = applyTransfer({
          from: { balance, kind: 'bank_account', cardType: null },
          toBalance: Money.zero(USD),
          amountSent: sentM,
          amountReceived: received,
        })._unsafeUnwrap();
        const before = balance;
        const after = r.fromAfter.add(r.toAfter)._unsafeUnwrap();
        expect(before.subtract(after)._unsafeUnwrap().toString()).toBe(d.fee!.toString());
      }),
    );
  });
  it('cross currency: sent × realisedRate rounds back to received', () => {
    fc.assert(
      fc.property(cents, cents, (sent, received) => {
        const d = deriveTransfer({
          amountSent: Money.of(sent, USD),
          amountReceived: Money.of(received, EUR),
        })._unsafeUnwrap();
        const back = Money.of(sent, USD).multiply(d.realisedRate!);
        expect(Money.of(back.amount, EUR).round().toString()).toBe(
          Money.of(received, EUR).round().toString(),
        );
      }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/domain && bun run test`
Expected: FAIL — `deriveTransfer`, `applyTransfer`, `TransferError`, `InsufficientFundsError`, `Money.zero` are not exported.

- [ ] **Step 3: Implement**

Append to `packages/domain/src/errors.ts`:

```ts
export type TransferErrorReason = 'negative_fee' | 'non_positive_amount' | 'same_account';
export class TransferError extends DomainError {
  readonly code = 'TRANSFER_INVALID';
  constructor(readonly reason: TransferErrorReason) {
    super(`Transfer invalid: ${reason}`);
  }
}
export class InsufficientFundsError extends DomainError {
  readonly code = 'INSUFFICIENT_FUNDS';
  constructor(
    readonly account: string,
    readonly shortBy: string,
  ) {
    super(`Insufficient funds on ${account}: short by ${shortBy}`);
  }
}
```

Add to `Money` in `packages/domain/src/money.ts`, right after `static of(...)`:

```ts
  static zero(currency: Currency): Money {
    return new Money(new D(0), currency);
  }
```

`packages/domain/src/account.ts`:

```ts
import type { Money } from './money.js';

export const ACCOUNT_KINDS = [
  'bank_account',
  'card',
  'deposit',
  'broker',
  'crypto_wallet',
  'cash',
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const CARD_TYPES = ['debit', 'credit'] as const;
export type CardType = (typeof CARD_TYPES)[number];

/**
 * What the read models need to know about an Account. Presentation details
 * (card number, note, network) stay in the DTO; the domain only carries what
 * changes a number: the currency (through `balance`), whether it is a spending
 * account, and whether it may go negative.
 */
export interface Account {
  id: string;
  name: string;
  bank: string;
  country: string;
  kind: AccountKind;
  cardType: CardType | null;
  isSpending: boolean;
  sortOrder: number;
  archived: boolean;
  /** The latest Balance entry, or zero in the account's currency when there is none. */
  balance: Money;
}

/** Only a credit card may owe money; everything else stops at zero. */
export function mayGoNegative(a: Pick<Account, 'kind' | 'cardType'>): boolean {
  return a.kind === 'card' && a.cardType === 'credit';
}
```

`packages/domain/src/transfer.ts`:

```ts
import Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import { mayGoNegative, type Account } from './account.js';
import { CurrencyMismatchError, InsufficientFundsError, TransferError } from './errors.js';
import { Money } from './money.js';

/** Realised rates are quoted like the rates table: ten significant digits. */
export const RATE_SIGNIFICANT_DIGITS = 10;

export interface TransferDerivation {
  /** received / sent when currencies differ; null for a same-currency transfer. */
  realisedRate: Decimal | null;
  /** sent − received when currencies match; null when they differ (fee and spread cannot be separated). */
  fee: Money | null;
}

export function deriveTransfer(input: {
  amountSent: Money;
  amountReceived: Money;
}): Result<TransferDerivation, TransferError | CurrencyMismatchError> {
  const { amountSent, amountReceived } = input;
  if (!amountSent.amount.isPositive() || !amountReceived.amount.isPositive())
    return err(new TransferError('non_positive_amount'));
  if (amountSent.currency.code === amountReceived.currency.code) {
    return amountSent
      .subtract(amountReceived)
      .andThen((fee) =>
        fee.isNegative() ? err(new TransferError('negative_fee')) : ok({ realisedRate: null, fee }),
      );
  }
  const rate = amountReceived.amount
    .div(amountSent.amount)
    .toSignificantDigits(RATE_SIGNIFICANT_DIGITS);
  return ok({ realisedRate: rate, fee: null });
}

export function applyTransfer(input: {
  from: Pick<Account, 'kind' | 'cardType'> & { balance: Money };
  toBalance: Money;
  amountSent: Money;
  amountReceived: Money;
}): Result<{ fromAfter: Money; toAfter: Money }, InsufficientFundsError | CurrencyMismatchError> {
  const { from, toBalance, amountSent, amountReceived } = input;
  return from.balance.subtract(amountSent).andThen((fromAfter) => {
    if (fromAfter.isNegative() && !mayGoNegative(from))
      return err(
        new InsufficientFundsError(from.balance.currency.code, fromAfter.amount.abs().toFixed()),
      );
    return toBalance.add(amountReceived).map((toAfter) => ({ fromAfter, toAfter }));
  });
}
```

Add to `packages/domain/src/index.ts`:

```ts
export * from './account.js';
export * from './transfer.js';
```

- [ ] **Step 4: Run the tests and coverage**

Run: `cd packages/domain && bun run test`
Expected: PASS, coverage 100 % (the `mayGoNegative` false branch and `InsufficientFundsError` are both exercised).

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): add account kinds and transfer arithmetic"
```

---

### Task 2: Domain — read models (total capital, available until payday, provider groups)

**Files:**

- Create: `packages/domain/src/read-models.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/read-models.test.ts`

**Interfaces:**

- Consumes: `Account` (Task 1), `RateTable`, `Money`, `Currency`.
- Produces: `Aggregate { total: Money; unconvertible: Account[] }`, `totalCapital(accounts, table, display): Aggregate`, `availableUntilPayday(accounts, table, display): Aggregate`, `ProviderGroup { bank; country; accounts: Account[] }`, `groupByProvider(accounts): ProviderGroup[]`, `activeAccounts(accounts)`.

- [ ] **Step 1: Write the failing test**

`packages/domain/test/read-models.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  availableUntilPayday,
  groupByProvider,
  totalCapital,
  type Account,
  type Rate,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const c = (code: string) => reg.get(code)._unsafeUnwrap();
const rate = (base: string, value: string): Rate => ({
  base,
  quote: 'USD',
  value: new Decimal(value),
  date: '2026-09-11',
  source: 'api',
});
const table = new RateTable('2026-09-11', [rate('EUR', '1.16'), rate('RUB', '0.0119')], reg);

const acc = (over: Partial<Account> & { balance: Money }): Account => ({
  id: over.balance.currency.code + (over.name ?? ''),
  name: 'A',
  bank: 'Bank',
  country: 'RU',
  kind: 'bank_account',
  cardType: null,
  isSpending: false,
  sortOrder: 0,
  archived: false,
  ...over,
});

describe('totalCapital', () => {
  it('sums every active account in the display currency', () => {
    const r = totalCapital(
      [acc({ balance: Money.of('100', c('USD')) }), acc({ balance: Money.of('100', c('EUR')) })],
      table,
      c('USD'),
    );
    expect(r.total.round().toString()).toBe('216');
    expect(r.unconvertible).toEqual([]);
  });
  it('skips archived accounts and lists the ones it cannot convert', () => {
    const noRate = acc({ name: 'x', balance: Money.of('1', c('BTC')) });
    const r = totalCapital(
      [
        acc({ balance: Money.of('5', c('USD')), archived: true }),
        noRate,
        acc({ balance: Money.of('7', c('USD')) }),
      ],
      table,
      c('USD'),
    );
    expect(r.total.toString()).toBe('7');
    expect(r.unconvertible).toEqual([noRate]);
  });
});

describe('availableUntilPayday', () => {
  it('sums only spending accounts', () => {
    const r = availableUntilPayday(
      [
        acc({ balance: Money.of('30', c('USD')), isSpending: true }),
        acc({ balance: Money.of('1000', c('USD')) }),
      ],
      table,
      c('USD'),
    );
    expect(r.total.toString()).toBe('30');
  });
});

describe('groupByProvider', () => {
  it('groups active accounts by bank, ordered by the first sortOrder, accounts by sortOrder then name', () => {
    const groups = groupByProvider([
      acc({ name: 'b', bank: 'Binance', sortOrder: 5, balance: Money.of('1', c('BTC')) }),
      acc({ name: 'z', bank: 'Alfa', sortOrder: 2, balance: Money.of('1', c('RUB')) }),
      acc({ name: 'a', bank: 'Binance', sortOrder: 5, balance: Money.of('1', c('ETH')) }),
      acc({
        name: 'old',
        bank: 'Alfa',
        sortOrder: 0,
        archived: true,
        balance: Money.of('1', c('RUB')),
      }),
    ]);
    expect(groups.map((g) => g.bank)).toEqual(['Alfa', 'Binance']);
    expect(groups[1]?.accounts.map((a) => a.name)).toEqual(['a', 'b']);
    expect(groups[0]?.accounts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/domain && bun run test`
Expected: FAIL — `totalCapital` is not exported.

- [ ] **Step 3: Implement**

`packages/domain/src/read-models.ts`:

```ts
import type { Account } from './account.js';
import type { Currency } from './currency.js';
import { Money } from './money.js';
import type { RateTable } from './rate-table.js';

export interface Aggregate {
  total: Money;
  /** Accounts whose currency has no rate for the display currency. Listed, never silently dropped. */
  unconvertible: Account[];
}

export interface ProviderGroup {
  bank: string;
  country: string;
  accounts: Account[];
}

export const activeAccounts = (accounts: readonly Account[]): Account[] =>
  accounts.filter((a) => !a.archived);

function sum(accounts: readonly Account[], table: RateTable, display: Currency): Aggregate {
  let total = Money.zero(display);
  const unconvertible: Account[] = [];
  for (const a of accounts) {
    const converted = table.convert(a.balance, display.code);
    if (converted.isErr()) {
      unconvertible.push(a);
      continue;
    }
    total = total.add(converted.value)._unsafeUnwrap();
  }
  return { total, unconvertible };
}

/** Everything the person owns as Money, in the display currency. */
export function totalCapital(
  accounts: readonly Account[],
  table: RateTable,
  display: Currency,
): Aggregate {
  return sum(activeAccounts(accounts), table, display);
}

/** What can be spent before the next payday: the Spending accounts only. */
export function availableUntilPayday(
  accounts: readonly Account[],
  table: RateTable,
  display: Currency,
): Aggregate {
  return sum(
    activeAccounts(accounts).filter((a) => a.isSpending),
    table,
    display,
  );
}

const byOrderThenName = (a: Account, b: Account) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/** Accounts of one provider side by side, so Binance reads as a wallet with coins. */
export function groupByProvider(accounts: readonly Account[]): ProviderGroup[] {
  const groups = new Map<string, ProviderGroup>();
  for (const a of [...activeAccounts(accounts)].sort(byOrderThenName)) {
    const g = groups.get(a.bank) ?? { bank: a.bank, country: a.country, accounts: [] };
    g.accounts.push(a);
    groups.set(a.bank, g);
  }
  return [...groups.values()];
}
```

Add `export * from './read-models.js';` to `packages/domain/src/index.ts`.

- [ ] **Step 4: Run the tests**

Run: `cd packages/domain && bun run test`
Expected: PASS, 100 % coverage.

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): add capital, payday and provider read models"
```

---

### Task 3: Contracts — account, balance entry and transfer schemas

**Files:**

- Create: `packages/contracts/src/account.ts`, `packages/contracts/src/balance-entry.ts`, `packages/contracts/src/transfer.ts`
- Modify: `packages/contracts/src/rate.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/phase2.test.ts`

**Interfaces:**

- Produces (all exported from `@magermoney/contracts`): `AccountKindSchema`, `CardTypeSchema`, `AccountDtoSchema`/`AccountDto`, `CreateAccountInputSchema`/`CreateAccountInput`, `UpdateAccountInputSchema`/`UpdateAccountInput`, `ReorderAccountsInputSchema`, `BalanceEntryDtoSchema`/`BalanceEntryDto`, `RecordBalanceInputSchema`/`RecordBalanceInput`, `UpdateBalanceInputSchema`/`UpdateBalanceInput`, `CursorQuerySchema`, `TransferDtoSchema`/`TransferDto`, `CreateTransferInputSchema`/`CreateTransferInput`, `UpdateTransferInputSchema`/`UpdateTransferInput`, `TransfersQuerySchema`, `DeleteManualRateQuerySchema`, `IdParamSchema`.

- [ ] **Step 1: Write the failing test**

`packages/contracts/test/phase2.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CreateAccountInputSchema,
  CreateTransferInputSchema,
  CursorQuerySchema,
  UpdateAccountInputSchema,
} from '../src/index.js';

const base = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'bank_account',
  isSpending: true,
};

describe('account contracts', () => {
  it('accepts a plain account with an opening balance', () => {
    expect(
      CreateAccountInputSchema.safeParse({ ...base, openingBalance: { amount: '14577.45' } })
        .success,
    ).toBe(true);
  });
  it('rejects card fields on a non-card', () => {
    const r = CreateAccountInputSchema.safeParse({ ...base, cardLast4: '5520' });
    expect(r.success).toBe(false);
  });
  it('accepts card fields on a card and lower-case country is rejected', () => {
    expect(
      CreateAccountInputSchema.safeParse({
        ...base,
        kind: 'card',
        cardType: 'debit',
        cardLast4: '5520',
        cardExpires: '2027-07-31',
      }).success,
    ).toBe(true);
    expect(CreateAccountInputSchema.safeParse({ ...base, country: 'ru' }).success).toBe(false);
  });
  it('a partial update may carry card fields only together with kind=card', () => {
    expect(UpdateAccountInputSchema.safeParse({ name: 'New' }).success).toBe(true);
    expect(UpdateAccountInputSchema.safeParse({ cardLast4: '1234' }).success).toBe(false);
    expect(UpdateAccountInputSchema.safeParse({ kind: 'card', cardLast4: '1234' }).success).toBe(
      true,
    );
  });
  it('coerces the list limit and caps it', () => {
    expect(CursorQuerySchema.parse({}).limit).toBe(50);
    expect(CursorQuerySchema.parse({ limit: '20' }).limit).toBe(20);
    expect(CursorQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('transfer contracts', () => {
  const ids = {
    fromAccountId: '11111111-1111-4111-8111-111111111111',
    toAccountId: '22222222-2222-4222-8222-222222222222',
  };
  it('accepts sent only (same currency decided server-side)', () => {
    expect(CreateTransferInputSchema.safeParse({ ...ids, amountSent: '100' }).success).toBe(true);
  });
  it('rejects non-decimal amounts', () => {
    expect(CreateTransferInputSchema.safeParse({ ...ids, amountSent: '1,5' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/contracts && bun run test`
Expected: FAIL — modules not exported.

- [ ] **Step 3: Implement**

`packages/contracts/src/account.ts`:

```ts
import { z } from '@hono/zod-openapi';
import { ACCOUNT_KINDS, CARD_TYPES } from '@magermoney/domain';
import { CurrencyCodeSchema, DecimalString, IsoDateSchema } from './common.js';

export const AccountKindSchema = z.enum(ACCOUNT_KINDS);
export const CardTypeSchema = z.enum(CARD_TYPES);
export const IdParamSchema = z.object({ id: z.uuid() });

export const AccountDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    bank: z.string(),
    country: z.string(),
    currency: CurrencyCodeSchema,
    kind: AccountKindSchema,
    cardType: CardTypeSchema.nullable(),
    isSpending: z.boolean(),
    cardLast4: z.string().nullable(),
    cardNetwork: z.string().nullable(),
    cardTier: z.string().nullable(),
    cardExpires: IsoDateSchema.nullable(),
    note: z.string().nullable(),
    sortOrder: z.number().int(),
    archivedAt: z.iso.datetime().nullable(),
    balance: DecimalString.nullable(),
    balanceRecordedAt: z.iso.datetime().nullable(),
  })
  .openapi('Account');
export type AccountDto = z.infer<typeof AccountDtoSchema>;

const CARD_FIELDS = ['cardType', 'cardLast4', 'cardNetwork', 'cardTier', 'cardExpires'] as const;
const cardFieldsOnlyOnCards = (
  v: { kind?: string | undefined } & Partial<Record<(typeof CARD_FIELDS)[number], unknown>>,
) => v.kind === 'card' || CARD_FIELDS.every((f) => v[f] === undefined || v[f] === null);
const CARD_MESSAGE = { message: 'card fields require kind=card', path: ['kind'] };

const accountFields = {
  name: z.string().trim().min(1).max(80),
  bank: z.string().trim().min(1).max(80),
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: CurrencyCodeSchema,
  kind: AccountKindSchema,
  cardType: CardTypeSchema.nullable().optional(),
  isSpending: z.boolean().default(false),
  cardLast4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  cardNetwork: z.string().trim().max(40).nullable().optional(),
  cardTier: z.string().trim().max(40).nullable().optional(),
  cardExpires: IsoDateSchema.nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
};

export const OpeningBalanceSchema = z.object({
  amount: DecimalString,
  recordedAt: z.iso.datetime().optional(),
});

export const CreateAccountInputSchema = z
  .object({ ...accountFields, openingBalance: OpeningBalanceSchema.optional() })
  .refine(cardFieldsOnlyOnCards, CARD_MESSAGE)
  .openapi('CreateAccountInput');
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

export const UpdateAccountInputSchema = z
  .object(accountFields)
  .partial()
  .refine(cardFieldsOnlyOnCards, CARD_MESSAGE)
  .openapi('UpdateAccountInput');
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

export const ReorderAccountsInputSchema = z
  .object({ ids: z.array(z.uuid()).min(1) })
  .openapi('ReorderAccountsInput');
export type ReorderAccountsInput = z.infer<typeof ReorderAccountsInputSchema>;
```

`packages/contracts/src/balance-entry.ts`:

```ts
import { z } from '@hono/zod-openapi';
import { DecimalString } from './common.js';

export const BalanceEntryOriginSchema = z.enum(['manual', 'transfer', 'inflow']);

export const BalanceEntryDtoSchema = z
  .object({
    id: z.uuid(),
    accountId: z.uuid(),
    amount: DecimalString,
    recordedAt: z.iso.datetime(),
    origin: BalanceEntryOriginSchema,
    transferId: z.uuid().nullable(),
    note: z.string().nullable(),
  })
  .openapi('BalanceEntry');
export type BalanceEntryDto = z.infer<typeof BalanceEntryDtoSchema>;

export const RecordBalanceInputSchema = z
  .object({
    amount: DecimalString,
    recordedAt: z.iso.datetime().optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .openapi('RecordBalanceInput');
export type RecordBalanceInput = z.infer<typeof RecordBalanceInputSchema>;

export const UpdateBalanceInputSchema =
  RecordBalanceInputSchema.partial().openapi('UpdateBalanceInput');
export type UpdateBalanceInput = z.infer<typeof UpdateBalanceInputSchema>;

/** Cursor = `${isoTimestamp}|${id}` of the last row seen; rows strictly before it are returned. */
export const CursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/)
    .optional(),
});
export type CursorQuery = z.infer<typeof CursorQuerySchema>;
```

`packages/contracts/src/transfer.ts`:

```ts
import { z } from '@hono/zod-openapi';
import { DecimalString } from './common.js';
import { CursorQuerySchema } from './balance-entry.js';

export const TransferDtoSchema = z
  .object({
    id: z.uuid(),
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    amountSent: DecimalString,
    amountReceived: DecimalString,
    occurredAt: z.iso.datetime(),
    note: z.string().nullable(),
    /** received / sent when currencies differ, else null. */
    realisedRate: DecimalString.nullable(),
    /** sent − received when currencies match, else null. */
    fee: DecimalString.nullable(),
  })
  .openapi('Transfer');
export type TransferDto = z.infer<typeof TransferDtoSchema>;

export const CreateTransferInputSchema = z
  .object({
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    amountSent: DecimalString,
    amountReceived: DecimalString.optional(),
    occurredAt: z.iso.datetime().optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .openapi('CreateTransferInput');
export type CreateTransferInput = z.infer<typeof CreateTransferInputSchema>;

export const UpdateTransferInputSchema =
  CreateTransferInputSchema.partial().openapi('UpdateTransferInput');
export type UpdateTransferInput = z.infer<typeof UpdateTransferInputSchema>;

export const TransfersQuerySchema = CursorQuerySchema.extend({ accountId: z.uuid().optional() });
export type TransfersQuery = z.infer<typeof TransfersQuerySchema>;
```

Append to `packages/contracts/src/rate.ts`:

```ts
export const DeleteManualRateQuerySchema = z.object({
  base: CurrencyCodeSchema,
  date: IsoDateSchema,
});
export type DeleteManualRateQuery = z.infer<typeof DeleteManualRateQuerySchema>;
```

`packages/contracts/src/index.ts` — add:

```ts
export * from './account.js';
export * from './balance-entry.js';
export * from './transfer.js';
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd packages/contracts && bun run test && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): add account, balance entry and transfer schemas"
```

---

### Task 4: Migrations, schema docs and RLS tests

**Files:**

- Create: `supabase/migrations/20260912000004_accounts.sql`, `supabase/migrations/20260912000005_transfers.sql`, `supabase/migrations/20260912000006_balance_entries.sql`
- Modify: `supabase/test/rls.test.ts`, `docs/db/schema.dbml`, `CONTEXT.md`
- Test: `supabase/test/rls.test.ts` (runs in the API integration job)

**Interfaces:**

- Produces: tables `accounts`, `transfers`, `balance_entries`; enums `account_kind`, `card_type`, `balance_entry_origin`; the "latest entry" ordering `(recorded_at desc, created_at desc)`.

- [ ] **Step 1: Write the failing RLS test**

Append inside `describe('RLS', …)` in `supabase/test/rls.test.ts`:

```ts
it('isolates accounts and balance entries between users', async () => {
  const { data: acc, error } = await a.c
    .from('accounts')
    .insert({
      user_id: a.id,
      name: 'Alfa',
      bank: 'Alfa',
      country: 'RU',
      currency: 'RUB',
      kind: 'bank_account',
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  await a.c
    .from('balance_entries')
    .insert({
      user_id: a.id,
      account_id: acc!.id,
      amount: '10',
      recorded_at: new Date().toISOString(),
      origin: 'manual',
    });
  expect((await b.c.from('accounts').select('id').eq('id', acc!.id)).data).toHaveLength(0);
  expect(
    (await b.c.from('balance_entries').select('id').eq('account_id', acc!.id)).data,
  ).toHaveLength(0);
  const forged = await b.c
    .from('accounts')
    .insert({ user_id: a.id, name: 'X', bank: 'X', country: 'RU', currency: 'RUB', kind: 'cash' });
  expect(forged.error).not.toBeNull();
});

it('refuses card fields on a non-card and a transfer to the same account', async () => {
  const bad = await a.c
    .from('accounts')
    .insert({
      user_id: a.id,
      name: 'C',
      bank: 'C',
      country: 'RU',
      currency: 'RUB',
      kind: 'cash',
      card_last4: '1234',
    });
  expect(bad.error).not.toBeNull();
  const { data: acc } = await a.c
    .from('accounts')
    .insert({ user_id: a.id, name: 'S', bank: 'S', country: 'RU', currency: 'RUB', kind: 'cash' })
    .select('id')
    .single();
  const same = await a.c
    .from('transfers')
    .insert({
      user_id: a.id,
      from_account_id: acc!.id,
      to_account_id: acc!.id,
      amount_sent: '1',
      amount_received: '1',
      occurred_at: new Date().toISOString(),
    });
  expect(same.error).not.toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run (local Supabase must be running: `supabase start`): `cd apps/api && eval "$(supabase status -o env)" && DATABASE_URL="$DB_URL" SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_JWT_SECRET="$JWT_SECRET" CRON_SECRET=ci-cron bun run test:integration`
Expected: FAIL — relation `accounts` does not exist.

- [ ] **Step 3: Write the migrations**

`supabase/migrations/20260912000004_accounts.sql`:

```sql
create type public.account_kind as enum ('bank_account', 'card', 'deposit', 'broker', 'crypto_wallet', 'cash');
create type public.card_type as enum ('debit', 'credit');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  bank text not null check (length(bank) between 1 and 80),
  country text not null check (country ~ '^[A-Z]{2}$'),
  currency text not null references public.currencies(code),
  kind public.account_kind not null,
  card_type public.card_type,
  is_spending boolean not null default false,
  card_last4 text check (card_last4 ~ '^\d{4}$'),
  card_network text,
  card_tier text,
  card_expires date,
  note text,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_card_fields_only_on_cards check (
    kind = 'card' or (card_type is null and card_last4 is null and card_network is null and card_tier is null and card_expires is null)
  )
);

create index accounts_user_idx on public.accounts (user_id, archived_at, sort_order);
create trigger accounts_updated_at before update on public.accounts for each row execute procedure public.set_updated_at();

alter table public.accounts enable row level security;
create policy "accounts: owner select" on public.accounts for select to authenticated using (user_id = auth.uid());
create policy "accounts: owner insert" on public.accounts for insert to authenticated with check (user_id = auth.uid());
create policy "accounts: owner update" on public.accounts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "accounts: owner delete" on public.accounts for delete to authenticated using (user_id = auth.uid());
```

`supabase/migrations/20260912000005_transfers.sql`:

```sql
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid not null references public.accounts(id) on delete restrict,
  amount_sent numeric not null check (amount_sent > 0),
  amount_received numeric not null check (amount_received > 0),
  occurred_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id)
);

create index transfers_user_idx on public.transfers (user_id, occurred_at desc, id desc);
create index transfers_from_idx on public.transfers (from_account_id);
create index transfers_to_idx on public.transfers (to_account_id);
create trigger transfers_updated_at before update on public.transfers for each row execute procedure public.set_updated_at();

alter table public.transfers enable row level security;
create policy "transfers: owner select" on public.transfers for select to authenticated using (user_id = auth.uid());
create policy "transfers: owner insert" on public.transfers for insert to authenticated with check (user_id = auth.uid());
create policy "transfers: owner update" on public.transfers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transfers: owner delete" on public.transfers for delete to authenticated using (user_id = auth.uid());
```

`supabase/migrations/20260912000006_balance_entries.sql`:

```sql
create type public.balance_entry_origin as enum ('manual', 'transfer', 'inflow');

create table public.balance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric not null,
  recorded_at timestamptz not null,
  origin public.balance_entry_origin not null,
  transfer_id uuid references public.transfers(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  constraint balance_entries_transfer_origin check ((origin = 'transfer') = (transfer_id is not null))
);

-- "Latest entry" is (recorded_at desc, created_at desc): created_at breaks ties
-- between two entries declared for the same instant.
create index balance_entries_latest_idx on public.balance_entries (account_id, recorded_at desc, created_at desc);
create index balance_entries_transfer_idx on public.balance_entries (transfer_id) where transfer_id is not null;

alter table public.balance_entries enable row level security;
create policy "balance_entries: owner select" on public.balance_entries for select to authenticated using (user_id = auth.uid());
create policy "balance_entries: owner insert" on public.balance_entries for insert to authenticated with check (user_id = auth.uid());
create policy "balance_entries: owner update" on public.balance_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "balance_entries: owner delete" on public.balance_entries for delete to authenticated using (user_id = auth.uid());
```

- [ ] **Step 4: Apply and run the integration tests**

Run: `supabase db reset` (from the repo root), then the integration command from Step 2.
Expected: PASS, including the phase 1 RLS cases.

- [ ] **Step 5: Update the schema doc and the glossary**

In `docs/db/schema.dbml`:

- add `Enum card_type { debit credit }`;
- in `Table accounts`: add `card_type card_type [note: 'card only']`, change `goal_id` note to `'phase 4: added by a later migration'`, add note `'check: card fields only when kind = card'`;
- in `Table balance_entries`: change `inflow_id` note to `'phase 3: added by a later migration'`, replace the index with `(account_id, recorded_at, created_at)` and note `'latest = order by recorded_at desc, created_at desc'`;
- in `Table transfers`: add note `'checks: from <> to, both amounts > 0'` and index `(user_id, occurred_at)`.

In `CONTEXT.md`:

- delete the **Holding** entry;
- in **Account**, append: `An Account holds one currency, so a wallet with several coins is several Accounts sharing a Provider.`;
- add after **Account**:

```
**Provider**:
The bank, broker, exchange or wallet an Account belongs to (the `bank` field). Accounts are shown grouped by Provider.
_Avoid_: Institution, group

**Card type**:
Whether a card Account is debit or credit. Only a credit card may hold a negative balance.
```

- in **Balance entry**, append: `Only the newest entry of an Account may be edited or deleted; older ones are history.`
- in **Transfer**, append: `A Transfer can be edited or deleted only while both of its Balance entries are still the newest on their Accounts.`

- [ ] **Step 6: Commit**

```bash
git add supabase docs/db/schema.dbml CONTEXT.md
git commit -m "feat(db): add accounts, transfers and balance entries with RLS"
```

---

### Task 5: API — conflict errors, unit of work, repository contracts and in-memory repositories

**Files:**

- Modify: `apps/api/src/shared/errors/http.ts`
- Create: `apps/api/src/shared/db/unit-of-work.ts`, `apps/api/src/modules/accounts/application/account-repository.ts`, `apps/api/src/modules/accounts/application/balance-repository.ts`, `apps/api/src/modules/transfers/application/transfer-repository.ts`, `apps/api/src/modules/accounts/infrastructure/memory-account-repository.ts`, `apps/api/src/modules/accounts/infrastructure/memory-balance-repository.ts`, `apps/api/src/modules/transfers/infrastructure/memory-transfer-repository.ts`
- Modify: `apps/api/src/app.ts` (AppDeps only), `apps/api/test/helpers/deps.ts`
- Test: `apps/api/test/errors.test.ts` (extend), `apps/api/test/memory-repositories.test.ts`

**Interfaces:**

- Produces:
  - `ConflictError(code: string, message: string)` → HTTP 409 with `{ code, message }`; `toHttpError` also maps `TransferError`, `InsufficientFundsError` → 400.
  - `UnitOfWork<R> = <T>(fn: (repos: R) => Promise<T>) => Promise<T>`; `Repos = { accounts: AccountRepository; balances: BalanceRepository; transfers: TransferRepository }`; `AppDeps.repos: Repos`, `AppDeps.uow: UnitOfWork<Repos>`.
  - Row types and repository interfaces below (used verbatim by Tasks 6–9).

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/errors.test.ts`:

```ts
import { InsufficientFundsError, TransferError } from '@magermoney/domain';
import { ConflictError } from '../src/shared/errors/http.js';

it('maps conflicts to 409 with the given code, and transfer errors to 400', () => {
  expect(
    toHttpError(new ConflictError('entry_not_latest', 'Only the latest entry can change')),
  ).toEqual({
    status: 409,
    body: { code: 'entry_not_latest', message: 'Only the latest entry can change' },
  });
  expect(toHttpError(new TransferError('negative_fee')).status).toBe(400);
  expect(toHttpError(new InsufficientFundsError('USD', '1')).status).toBe(400);
});
```

(`toHttpError` is already imported at the top of that file.)

`apps/api/test/memory-repositories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MemoryAccountRepository } from '../src/modules/accounts/infrastructure/memory-account-repository.js';
import { MemoryBalanceRepository } from '../src/modules/accounts/infrastructure/memory-balance-repository.js';

const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const newAccount = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'bank_account' as const,
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
};

describe('memory repositories', () => {
  it('lists an account with its latest balance by recordedAt then createdAt', async () => {
    const balances = new MemoryBalanceRepository();
    const accounts = new MemoryAccountRepository(balances);
    const a = await accounts.create(uid, newAccount);
    await balances.insert(uid, {
      accountId: a.id,
      amount: '1',
      recordedAt: '2026-09-01T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    await balances.insert(uid, {
      accountId: a.id,
      amount: '2',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    await balances.insert(uid, {
      accountId: a.id,
      amount: '3',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const [row] = await accounts.list(uid);
    expect(row?.balance).toBe('3');
    expect(await accounts.list(other)).toEqual([]);
    expect(await accounts.findById(other, a.id)).toBeNull();
  });
  it('lists balances newest first with a cursor', async () => {
    const balances = new MemoryBalanceRepository();
    const accounts = new MemoryAccountRepository(balances);
    const a = await accounts.create(uid, newAccount);
    const e1 = await balances.insert(uid, {
      accountId: a.id,
      amount: '1',
      recordedAt: '2026-09-01T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const e2 = await balances.insert(uid, {
      accountId: a.id,
      amount: '2',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    expect((await balances.listByAccount(uid, a.id, 10)).map((e) => e.id)).toEqual([e2.id, e1.id]);
    expect(
      (await balances.listByAccount(uid, a.id, 10, `${e2.recordedAt}|${e2.id}`)).map((e) => e.id),
    ).toEqual([e1.id]);
  });
  it('delete reports transfers and cascades entries', async () => {
    const balances = new MemoryBalanceRepository();
    const accounts = new MemoryAccountRepository(balances);
    const a = await accounts.create(uid, newAccount, {
      amount: '5',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(await accounts.delete(uid, a.id)).toBe('deleted');
    expect(await balances.listByAccount(uid, a.id, 10)).toEqual([]);
    expect(await accounts.delete(uid, a.id)).toBe('not_found');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && bun run test`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement the shared pieces**

In `apps/api/src/shared/errors/http.ts` add the class and extend the mapping:

```ts
import { InsufficientFundsError, TransferError } from '@magermoney/domain'; // add to the existing import

/** A request that is well-formed but no longer applies: the entry is not the latest, the account has transfers. */
export class ConflictError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type AppError =
  DomainError | NotFoundError | UnauthorizedError | ValidationError | ConflictError;

export function toHttpError(e: AppError): {
  status: 400 | 401 | 404 | 409 | 422 | 500;
  body: ErrorDto;
} {
  if (e instanceof ConflictError)
    return { status: 409, body: { code: e.code, message: e.message } };
  // …existing branches…
  if (
    e instanceof UnknownCurrencyError ||
    e instanceof CurrencyMismatchError ||
    e instanceof InvalidAmountError ||
    e instanceof TransferError ||
    e instanceof InsufficientFundsError
  )
    return { status: 400, body: { code: e.code, message: e.message } };
  return { status: 500, body: { code: 'INTERNAL', message: 'Unexpected error' } };
}
```

`apps/api/src/shared/db/unit-of-work.ts`:

```ts
/**
 * Runs `fn` with a set of repositories bound to one transaction. The pg
 * implementation opens `sql.begin`; the in-memory one just hands over the same
 * repositories, which is enough for use-case tests.
 */
export type UnitOfWork<R> = <T>(fn: (repos: R) => Promise<T>) => Promise<T>;

export const memoryUnitOfWork =
  <R>(repos: R): UnitOfWork<R> =>
  (fn) =>
    fn(repos);
```

`apps/api/src/modules/accounts/application/account-repository.ts`:

```ts
import type { AccountKind, CardType } from '@magermoney/domain';

export interface AccountRow {
  id: string;
  userId: string;
  name: string;
  bank: string;
  country: string;
  currency: string;
  kind: AccountKind;
  cardType: CardType | null;
  isSpending: boolean;
  cardLast4: string | null;
  cardNetwork: string | null;
  cardTier: string | null;
  cardExpires: string | null; // YYYY-MM-DD
  note: string | null;
  sortOrder: number;
  archivedAt: string | null; // ISO
  /** Latest balance entry, joined. */
  balance: string | null;
  balanceRecordedAt: string | null;
}

export type NewAccount = Omit<
  AccountRow,
  'id' | 'userId' | 'archivedAt' | 'balance' | 'balanceRecordedAt'
>;
export type AccountPatch = Partial<NewAccount>;
export interface OpeningBalance {
  amount: string;
  recordedAt: string;
}

export interface AccountRepository {
  list(userId: string): Promise<AccountRow[]>;
  findById(userId: string, id: string): Promise<AccountRow | null>;
  /** Row locks for the duration of the unit of work (`for update` in pg). Returns the rows found. */
  lock(userId: string, ids: string[]): Promise<AccountRow[]>;
  create(userId: string, data: NewAccount, opening?: OpeningBalance): Promise<AccountRow>;
  update(userId: string, id: string, patch: AccountPatch): Promise<AccountRow | null>;
  setArchived(userId: string, id: string, archivedAt: string | null): Promise<AccountRow | null>;
  delete(userId: string, id: string): Promise<'deleted' | 'not_found' | 'has_transfers'>;
  /** Assigns sort_order 0..n-1 in the given order. False if any id is not the user's. */
  reorder(userId: string, ids: string[]): Promise<boolean>;
  countEntries(userId: string, id: string): Promise<number>;
}
```

`apps/api/src/modules/accounts/application/balance-repository.ts`:

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
  note: string | null;
  createdAt: string; // ISO
}
export type NewBalanceEntry = Omit<BalanceEntryRow, 'id' | 'userId' | 'createdAt'>;
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
  insert(userId: string, data: NewBalanceEntry): Promise<BalanceEntryRow>;
  update(userId: string, id: string, patch: BalanceEntryPatch): Promise<BalanceEntryRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
  deleteByTransfer(userId: string, transferId: string): Promise<number>;
}

/** The cursor is the last row seen; rows strictly older come next. */
export const parseCursor = (before: string): { recordedAt: string; id: string } => {
  const [recordedAt, id] = before.split('|') as [string, string];
  return { recordedAt, id };
};

/** Newest first: recordedAt desc, then createdAt desc, then id desc as a final tiebreak. */
export const newestFirst = (a: BalanceEntryRow, b: BalanceEntryRow): number =>
  b.recordedAt.localeCompare(a.recordedAt) ||
  b.createdAt.localeCompare(a.createdAt) ||
  b.id.localeCompare(a.id);
```

`apps/api/src/modules/transfers/application/transfer-repository.ts`:

```ts
export interface TransferRow {
  id: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amountSent: string;
  amountReceived: string;
  occurredAt: string; // ISO
  note: string | null;
}
export type NewTransfer = Omit<TransferRow, 'id' | 'userId'>;
export type TransferPatch = Partial<Omit<NewTransfer, 'fromAccountId' | 'toAccountId'>>;

export interface TransferRepository {
  list(userId: string, limit: number, before?: string, accountId?: string): Promise<TransferRow[]>;
  findById(userId: string, id: string): Promise<TransferRow | null>;
  insert(userId: string, data: NewTransfer): Promise<TransferRow>;
  update(userId: string, id: string, patch: TransferPatch): Promise<TransferRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
  countByAccount(userId: string, accountId: string): Promise<number>;
}
```

- [ ] **Step 4: Implement the in-memory repositories**

`apps/api/src/modules/accounts/infrastructure/memory-balance-repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import {
  newestFirst,
  parseCursor,
  type BalanceEntryPatch,
  type BalanceEntryRow,
  type BalanceRepository,
  type NewBalanceEntry,
} from '../application/balance-repository.js';

export class MemoryBalanceRepository implements BalanceRepository {
  constructor(public rows: BalanceEntryRow[] = []) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async listByAccount(userId: string, accountId: string, limit: number, before?: string) {
    let rows = this.mine(userId)
      .filter((r) => r.accountId === accountId)
      .sort(newestFirst);
    if (before) {
      const c = parseCursor(before);
      const idx = rows.findIndex((r) => r.recordedAt === c.recordedAt && r.id === c.id);
      rows = idx >= 0 ? rows.slice(idx + 1) : rows.filter((r) => r.recordedAt < c.recordedAt);
    }
    return rows.slice(0, limit);
  }
  async latest(userId: string, accountId: string) {
    return (await this.listByAccount(userId, accountId, 1))[0] ?? null;
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async findByTransfer(userId: string, transferId: string) {
    return this.mine(userId).filter((r) => r.transferId === transferId);
  }
  async insert(userId: string, data: NewBalanceEntry) {
    const row: BalanceEntryRow = {
      ...data,
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
  async update(userId: string, id: string, patch: BalanceEntryPatch) {
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
  async deleteByTransfer(userId: string, transferId: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.transferId === transferId));
    return before - this.rows.length;
  }
  /** Test helper: drop every entry of an account (the pg cascade). */
  dropAccount(accountId: string) {
    this.rows = this.rows.filter((r) => r.accountId !== accountId);
  }
}
```

`apps/api/src/modules/accounts/infrastructure/memory-account-repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type {
  AccountPatch,
  AccountRepository,
  AccountRow,
  NewAccount,
  OpeningBalance,
} from '../application/account-repository.js';
import type { MemoryBalanceRepository } from './memory-balance-repository.js';

type Stored = Omit<AccountRow, 'balance' | 'balanceRecordedAt'>;

export class MemoryAccountRepository implements AccountRepository {
  public rows: Stored[] = [];
  /** Transfer counts per account, set by MemoryTransferRepository. */
  public transferCounts = new Map<string, number>();
  constructor(private readonly balances: MemoryBalanceRepository) {}

  private async withBalance(row: Stored): Promise<AccountRow> {
    const latest = await this.balances.latest(row.userId, row.id);
    return {
      ...row,
      balance: latest?.amount ?? null,
      balanceRecordedAt: latest?.recordedAt ?? null,
    };
  }
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    const rows = [...this.mine(userId)].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    return Promise.all(rows.map((r) => this.withBalance(r)));
  }
  async findById(userId: string, id: string) {
    const row = this.mine(userId).find((r) => r.id === id);
    return row ? this.withBalance(row) : null;
  }
  async lock(userId: string, ids: string[]) {
    const rows = this.mine(userId).filter((r) => ids.includes(r.id));
    return Promise.all(rows.map((r) => this.withBalance(r)));
  }
  async create(userId: string, data: NewAccount, opening?: OpeningBalance) {
    const row: Stored = { ...data, id: randomUUID(), userId, archivedAt: null };
    this.rows.push(row);
    if (opening)
      await this.balances.insert(userId, {
        accountId: row.id,
        amount: opening.amount,
        recordedAt: opening.recordedAt,
        origin: 'manual',
        transferId: null,
        note: null,
      });
    return this.withBalance(row);
  }
  async update(userId: string, id: string, patch: AccountPatch) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return this.withBalance(row);
  }
  async setArchived(userId: string, id: string, archivedAt: string | null) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return null;
    row.archivedAt = archivedAt;
    return this.withBalance(row);
  }
  async delete(userId: string, id: string) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return 'not_found' as const;
    if ((this.transferCounts.get(id) ?? 0) > 0) return 'has_transfers' as const;
    this.rows = this.rows.filter((r) => r !== row);
    this.balances.dropAccount(id);
    return 'deleted' as const;
  }
  async reorder(userId: string, ids: string[]) {
    const mine = this.mine(userId);
    if (!ids.every((id) => mine.some((r) => r.id === id))) return false;
    ids.forEach((id, i) => {
      const row = mine.find((r) => r.id === id);
      if (row) row.sortOrder = i;
    });
    return true;
  }
  async countEntries(userId: string, id: string) {
    return (await this.balances.listByAccount(userId, id, Number.MAX_SAFE_INTEGER)).length;
  }
}
```

`apps/api/src/modules/transfers/infrastructure/memory-transfer-repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { MemoryAccountRepository } from '../../accounts/infrastructure/memory-account-repository.js';
import type {
  NewTransfer,
  TransferPatch,
  TransferRepository,
  TransferRow,
} from '../application/transfer-repository.js';

export class MemoryTransferRepository implements TransferRepository {
  public rows: TransferRow[] = [];
  constructor(private readonly accounts?: MemoryAccountRepository) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  private bump(row: TransferRow, delta: number) {
    if (!this.accounts) return;
    for (const id of [row.fromAccountId, row.toAccountId])
      this.accounts.transferCounts.set(id, (this.accounts.transferCounts.get(id) ?? 0) + delta);
  }
  async list(userId: string, limit: number, before?: string, accountId?: string) {
    let rows = this.mine(userId)
      .filter((r) => !accountId || r.fromAccountId === accountId || r.toAccountId === accountId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
    if (before) {
      const [occurredAt, id] = before.split('|') as [string, string];
      const idx = rows.findIndex((r) => r.occurredAt === occurredAt && r.id === id);
      rows = idx >= 0 ? rows.slice(idx + 1) : rows.filter((r) => r.occurredAt < occurredAt);
    }
    return rows.slice(0, limit);
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewTransfer) {
    const row: TransferRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    this.bump(row, 1);
    return row;
  }
  async update(userId: string, id: string, patch: TransferPatch) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const row = await this.findById(userId, id);
    if (!row) return false;
    this.rows = this.rows.filter((r) => r !== row);
    this.bump(row, -1);
    return true;
  }
  async countByAccount(userId: string, accountId: string) {
    return this.mine(userId).filter(
      (r) => r.fromAccountId === accountId || r.toAccountId === accountId,
    ).length;
  }
}
```

- [ ] **Step 5: Wire `AppDeps` and the test helper**

In `apps/api/src/app.ts` add to the imports and to `AppDeps` (routes are mounted in later tasks):

```ts
import type { UnitOfWork } from './shared/db/unit-of-work.js';
import type { AccountRepository } from './modules/accounts/application/account-repository.js';
import type { BalanceRepository } from './modules/accounts/application/balance-repository.js';
import type { TransferRepository } from './modules/transfers/application/transfer-repository.js';

export interface Repos {
  accounts: AccountRepository;
  balances: BalanceRepository;
  transfers: TransferRepository;
}
// inside AppDeps:
repos: Repos;
uow: UnitOfWork<Repos>;
```

In `apps/api/test/helpers/deps.ts`, build the trio and pass both:

```ts
import { memoryUnitOfWork } from '../../src/shared/db/unit-of-work.js';
import { MemoryAccountRepository } from '../../src/modules/accounts/infrastructure/memory-account-repository.js';
import { MemoryBalanceRepository } from '../../src/modules/accounts/infrastructure/memory-balance-repository.js';
import { MemoryTransferRepository } from '../../src/modules/transfers/infrastructure/memory-transfer-repository.js';

export function memoryRepos() {
  const balances = new MemoryBalanceRepository();
  const accounts = new MemoryAccountRepository(balances);
  const transfers = new MemoryTransferRepository(accounts);
  return { accounts, balances, transfers };
}

export function testDeps(over: Partial<AppDeps> = {}): AppDeps {
  const repos = memoryRepos();
  return {
    clock: new SystemClock() as Clock,
    jwtSecret: 'test-secret-test-secret-test-secret-1234',
    cronSecret: 'cron',
    profiles: new MemoryProfileRepository([]),
    registry: CurrencyRegistry.default(),
    rates: new MemoryRateRepository(),
    rateProviders: [],
    repos,
    uow: memoryUnitOfWork(repos),
    ...over,
  } as AppDeps;
}
```

`bootstrap.ts` does not compile until Task 9 adds the pg repositories; to keep `typecheck` green in this task, add a temporary throwing placeholder there:

```ts
    repos: undefined as unknown as Repos, // replaced in Task 9
    uow: async () => { throw new Error('pg unit of work arrives with the pg repositories'); },
```

(Task 9 removes both lines.)

- [ ] **Step 6: Run tests, lint, typecheck**

Run: `cd apps/api && bun run test && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): add repository contracts, unit of work and conflict errors"
```

---

### Task 6: API — accounts use cases and routes

**Files:**

- Create: `apps/api/src/modules/accounts/application/dto.ts`, `list-accounts.ts`, `create-account.ts`, `update-account.ts`, `archive-account.ts`, `delete-account.ts`, `reorder-accounts.ts`, `apps/api/src/modules/accounts/http/routes.ts`
- Modify: `apps/api/src/shared/errors/http.ts` (`ValidationError` gets an optional code), `apps/api/src/app.ts` (mount)
- Test: `apps/api/test/accounts.test.ts`, `apps/api/test/helpers/http.ts`

**Interfaces:**

- Consumes: `Repos`, `UnitOfWork`, row types (Task 5); `CreateAccountInput`, `UpdateAccountInput`, `AccountDto` (Task 3).
- Produces: `toAccountDto(row)`, `listAccounts(deps)(userId)`, `createAccount(deps)(userId, input)`, `updateAccount(deps)(userId, id, input)`, `setAccountArchived(deps)(userId, id, archived: boolean)`, `deleteAccount(deps)(userId, id)`, `reorderAccounts(deps)(userId, ids)`; routes `GET/POST /accounts`, `PATCH /accounts/order`, `PATCH /accounts/:id`, `POST /accounts/:id/archive|unarchive`, `DELETE /accounts/:id`; `ValidationError(message, code = 'VALIDATION')`; test helper `authed(app, method, path, body?)`.

- [ ] **Step 1: Write the test helper and the failing tests**

`apps/api/test/helpers/http.ts`:

```ts
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../src/app.js';
import { signTestToken } from './token.js';

export const UID = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';
export const SECRET = 'test-secret-test-secret-test-secret-1234';

export async function authed(
  app: OpenAPIHono<AppEnv>,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  uid = UID,
): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      authorization: `Bearer ${await signTestToken(uid, SECRET)}`,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
```

`apps/api/test/accounts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const alfa = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'bank_account',
  isSpending: true,
};
const mk = () => createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));

describe('accounts', () => {
  it('creates an account with an opening balance dated now and lists it', async () => {
    const app = mk();
    const created = await authed(app, 'POST', '/accounts', {
      ...alfa,
      openingBalance: { amount: '14577.45' },
    });
    expect(created.status).toBe(201);
    const dto = await created.json();
    expect(dto).toMatchObject({
      name: 'Alfa',
      balance: '14577.45',
      balanceRecordedAt: NOW.toISOString(),
      cardType: null,
      archivedAt: null,
    });
    const list = await (await authed(app, 'GET', '/accounts')).json();
    expect(list).toHaveLength(1);
    expect(await (await authed(app, 'GET', '/accounts', undefined, OTHER)).json()).toEqual([]);
  });
  it('rejects an unknown currency and a future opening balance', async () => {
    const app = mk();
    expect((await authed(app, 'POST', '/accounts', { ...alfa, currency: 'XYZ' })).status).toBe(400);
    const future = await authed(app, 'POST', '/accounts', {
      ...alfa,
      openingBalance: { amount: '1', recordedAt: '2027-01-01T00:00:00.000Z' },
    });
    expect(future.status).toBe(400);
    expect((await future.json()).code).toBe('recorded_in_future');
  });
  it('refuses to change the currency once there is history, allows it before', async () => {
    const app = mk();
    const fresh = await (await authed(app, 'POST', '/accounts', alfa)).json();
    expect((await authed(app, 'PATCH', `/accounts/${fresh.id}`, { currency: 'USD' })).status).toBe(
      200,
    );
    const withHistory = await (
      await authed(app, 'POST', '/accounts', { ...alfa, openingBalance: { amount: '1' } })
    ).json();
    const res = await authed(app, 'PATCH', `/accounts/${withHistory.id}`, { currency: 'USD' });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('account_has_history');
  });
  it('clears card fields when the kind stops being card', async () => {
    const app = mk();
    const card = await (
      await authed(app, 'POST', '/accounts', {
        ...alfa,
        kind: 'card',
        cardType: 'debit',
        cardLast4: '5520',
      })
    ).json();
    const changed = await (
      await authed(app, 'PATCH', `/accounts/${card.id}`, { kind: 'cash' })
    ).json();
    expect(changed).toMatchObject({ kind: 'cash', cardType: null, cardLast4: null });
  });
  it('archives, unarchives, and 404s for another user', async () => {
    const app = mk();
    const a = await (await authed(app, 'POST', '/accounts', alfa)).json();
    const archived = await (await authed(app, 'POST', `/accounts/${a.id}/archive`)).json();
    expect(archived.archivedAt).toBe(NOW.toISOString());
    const back = await (await authed(app, 'POST', `/accounts/${a.id}/unarchive`)).json();
    expect(back.archivedAt).toBeNull();
    expect((await authed(app, 'POST', `/accounts/${a.id}/archive`, undefined, OTHER)).status).toBe(
      404,
    );
  });
  it('deletes an account without transfers and reorders', async () => {
    const app = mk();
    const a = await (await authed(app, 'POST', '/accounts', alfa)).json();
    const b = await (await authed(app, 'POST', '/accounts', { ...alfa, name: 'Beta' })).json();
    expect((await authed(app, 'PATCH', '/accounts/order', { ids: [b.id, a.id] })).status).toBe(204);
    const list = await (await authed(app, 'GET', '/accounts')).json();
    expect(list.map((x: { name: string }) => x.name)).toEqual(['Beta', 'Alfa']);
    expect(
      (
        await authed(app, 'PATCH', '/accounts/order', {
          ids: [a.id, '33333333-3333-4333-8333-333333333333'],
        })
      ).status,
    ).toBe(400);
    expect((await authed(app, 'DELETE', `/accounts/${a.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/accounts/${a.id}`)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && bun run test`
Expected: FAIL — 404 `Route not found` for `/accounts`.

- [ ] **Step 3: Implement the use cases**

In `apps/api/src/shared/errors/http.ts` change `ValidationError` so a route can name what was wrong:

```ts
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly code: string = 'VALIDATION',
  ) {
    super(message);
  }
}
```

`apps/api/src/modules/accounts/application/dto.ts`:

```ts
import type { AccountDto, BalanceEntryDto } from '@magermoney/contracts';
import type { AccountRow } from './account-repository.js';
import type { BalanceEntryRow } from './balance-repository.js';

export const toAccountDto = ({ userId: _u, ...row }: AccountRow): AccountDto => row;
export const toBalanceDto = ({
  userId: _u,
  createdAt: _c,
  ...row
}: BalanceEntryRow): BalanceEntryDto => row;

/** Nothing may be dated after now: a balance "as of next week" is a guess, not a statement. */
export const notInFuture = (iso: string, now: Date): boolean =>
  new Date(iso).getTime() <= now.getTime();
```

`apps/api/src/modules/accounts/application/list-accounts.ts`:

```ts
import type { AccountDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { toAccountDto } from './dto.js';

export const listAccounts =
  (repos: Pick<Repos, 'accounts'>) =>
  async (userId: string): Promise<AccountDto[]> =>
    (await repos.accounts.list(userId)).map(toAccountDto);
```

`apps/api/src/modules/accounts/application/create-account.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError, type Clock, type CurrencyRegistry } from '@magermoney/domain';
import type { AccountDto, CreateAccountInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { ValidationError } from '../../../shared/errors/http.js';
import type { NewAccount } from './account-repository.js';
import { notInFuture, toAccountDto } from './dto.js';

export interface AccountDeps {
  repos: Pick<Repos, 'accounts' | 'balances' | 'transfers'>;
  registry: CurrencyRegistry;
  clock: Clock;
}

export const toNewAccount = (input: Omit<CreateAccountInput, 'openingBalance'>): NewAccount => ({
  name: input.name,
  bank: input.bank,
  country: input.country,
  currency: input.currency,
  kind: input.kind,
  cardType: input.kind === 'card' ? (input.cardType ?? null) : null,
  isSpending: input.isSpending,
  cardLast4: input.kind === 'card' ? (input.cardLast4 ?? null) : null,
  cardNetwork: input.kind === 'card' ? (input.cardNetwork ?? null) : null,
  cardTier: input.kind === 'card' ? (input.cardTier ?? null) : null,
  cardExpires: input.kind === 'card' ? (input.cardExpires ?? null) : null,
  note: input.note ?? null,
  sortOrder: input.sortOrder ?? 0,
});

export const createAccount =
  (deps: AccountDeps) =>
  async (
    userId: string,
    input: CreateAccountInput,
  ): Promise<Result<AccountDto, UnknownCurrencyError | ValidationError>> => {
    if (!deps.registry.has(input.currency)) return err(new UnknownCurrencyError(input.currency));
    const { openingBalance, ...fields } = input;
    const now = deps.clock.now();
    const recordedAt = openingBalance?.recordedAt ?? now.toISOString();
    if (openingBalance && !notInFuture(recordedAt, now))
      return err(
        new ValidationError('A balance cannot be dated in the future', 'recorded_in_future'),
      );
    const row = await deps.repos.accounts.create(
      userId,
      toNewAccount(fields),
      openingBalance ? { amount: openingBalance.amount, recordedAt } : undefined,
    );
    return ok(toAccountDto(row));
  };
```

`apps/api/src/modules/accounts/application/update-account.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError } from '@magermoney/domain';
import type { AccountDto, UpdateAccountInput } from '@magermoney/contracts';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountPatch } from './account-repository.js';
import type { AccountDeps } from './create-account.js';
import { toAccountDto } from './dto.js';

const CARD_NULLS: AccountPatch = {
  cardType: null,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
};

export const updateAccount =
  (deps: AccountDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateAccountInput,
  ): Promise<Result<AccountDto, NotFoundError | ConflictError | UnknownCurrencyError>> => {
    const current = await deps.repos.accounts.findById(userId, id);
    if (!current) return err(new NotFoundError('account'));
    if (input.currency !== undefined && !deps.registry.has(input.currency))
      return err(new UnknownCurrencyError(input.currency));
    if (
      input.currency !== undefined &&
      input.currency !== current.currency &&
      (await deps.repos.accounts.countEntries(userId, id)) > 0
    )
      return err(
        new ConflictError(
          'account_has_history',
          'The currency cannot change once balances are recorded',
        ),
      );
    const kind = input.kind ?? current.kind;
    const patch: AccountPatch = { ...input, ...(kind === 'card' ? {} : CARD_NULLS) };
    const row = await deps.repos.accounts.update(userId, id, patch);
    return row ? ok(toAccountDto(row)) : err(new NotFoundError('account'));
  };
```

`apps/api/src/modules/accounts/application/archive-account.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { AccountDto } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { toAccountDto } from './dto.js';

export const setAccountArchived =
  (deps: AccountDeps) =>
  async (
    userId: string,
    id: string,
    archived: boolean,
  ): Promise<Result<AccountDto, NotFoundError>> => {
    const row = await deps.repos.accounts.setArchived(
      userId,
      id,
      archived ? deps.clock.now().toISOString() : null,
    );
    return row ? ok(toAccountDto(row)) : err(new NotFoundError('account'));
  };
```

`apps/api/src/modules/accounts/application/delete-account.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';

export const deleteAccount =
  (deps: AccountDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> => {
    const outcome = await deps.repos.accounts.delete(userId, id);
    if (outcome === 'not_found') return err(new NotFoundError('account'));
    if (outcome === 'has_transfers')
      return err(
        new ConflictError('account_has_transfers', 'Archive the account instead: it has transfers'),
      );
    return ok(undefined);
  };
```

`apps/api/src/modules/accounts/application/reorder-accounts.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ValidationError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';

export const reorderAccounts =
  (deps: AccountDeps) =>
  async (userId: string, ids: string[]): Promise<Result<void, ValidationError>> =>
    (await deps.repos.accounts.reorder(userId, ids))
      ? ok(undefined)
      : err(new ValidationError('Every id must be one of your accounts', 'unknown_account'));
```

- [ ] **Step 4: Implement the routes**

`apps/api/src/modules/accounts/http/routes.ts` (balance routes are added to this same file in Task 7):

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  AccountDtoSchema,
  CreateAccountInputSchema,
  ErrorDtoSchema,
  IdParamSchema,
  ReorderAccountsInputSchema,
  UpdateAccountInputSchema,
} from '@magermoney/contracts';
import type { Context } from 'hono';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { toHttpError, type AppError } from '../../../shared/errors/http.js';
import { setAccountArchived } from '../application/archive-account.js';
import { createAccount, type AccountDeps } from '../application/create-account.js';
import { deleteAccount } from '../application/delete-account.js';
import { listAccounts } from '../application/list-accounts.js';
import { reorderAccounts } from '../application/reorder-accounts.js';
import { updateAccount } from '../application/update-account.js';

const errorContent = { content: { 'application/json': { schema: ErrorDtoSchema } } };
export const ERRORS = {
  400: { description: 'Bad request', ...errorContent },
  401: { description: 'Unauthorized', ...errorContent },
  404: { description: 'Not found', ...errorContent },
  409: { description: 'Conflict', ...errorContent },
};
const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

/** One place turns a use-case error into a response; the status is narrowed for hono's typed responses. */
export function fail(c: Context<AppEnv>, e: AppError) {
  const h = toHttpError(e);
  return c.json(h.body, h.status as 400);
}

export function accountRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: AccountDeps = { repos: deps.repos, registry: deps.registry, clock: deps.clock };
  r.use('/accounts', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/accounts/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/balances/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/accounts',
      security: [{ bearer: [] }],
      responses: {
        200: json(z.array(AccountDtoSchema), 'Accounts with their latest balance'),
        401: ERRORS[401],
      },
    }),
    async (c) => c.json(await listAccounts(deps.repos)(c.var.userId), 200),
  );

  r.openapi(
    createRoute({
      method: 'post',
      path: '/accounts',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: CreateAccountInputSchema } } } },
      responses: { 201: json(AccountDtoSchema, 'Created'), 400: ERRORS[400], 401: ERRORS[401] },
    }),
    async (c) =>
      (await createAccount(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );

  // Registered before `/accounts/:id` so "order" is never read as an id.
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/accounts/order',
      security: [{ bearer: [] }],
      request: {
        body: { content: { 'application/json': { schema: ReorderAccountsInputSchema } } },
      },
      responses: { 204: { description: 'Reordered' }, 400: ERRORS[400], 401: ERRORS[401] },
    }),
    async (c) =>
      (await reorderAccounts(uc)(c.var.userId, c.req.valid('json').ids)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );

  r.openapi(
    createRoute({
      method: 'patch',
      path: '/accounts/{id}',
      security: [{ bearer: [] }],
      request: {
        params: IdParamSchema,
        body: { content: { 'application/json': { schema: UpdateAccountInputSchema } } },
      },
      responses: { 200: json(AccountDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateAccount(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );

  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ] as const) {
    r.openapi(
      createRoute({
        method: 'post',
        path: `/accounts/{id}/${action}`,
        security: [{ bearer: [] }],
        request: { params: IdParamSchema },
        responses: { 200: json(AccountDtoSchema, action), 401: ERRORS[401], 404: ERRORS[404] },
      }),
      async (c) =>
        (await setAccountArchived(uc)(c.var.userId, c.req.valid('param').id, archived)).match(
          (dto) => c.json(dto, 200),
          (e) => fail(c, e),
        ),
    );
  }

  r.openapi(
    createRoute({
      method: 'delete',
      path: '/accounts/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: {
        204: { description: 'Deleted' },
        401: ERRORS[401],
        404: ERRORS[404],
        409: ERRORS[409],
      },
    }),
    async (c) =>
      (await deleteAccount(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );

  return r;
}
```

Mount in `apps/api/src/app.ts` after the rates routes:

```ts
import { accountRoutes } from './modules/accounts/http/routes.js';
// …
app.route('/', accountRoutes(deps));
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `cd apps/api && bun run test && bun run typecheck && bun run lint`
Expected: PASS. If hono's typed `c.json` complains about the 201/204 unions, keep the `as 400` narrowing inside `fail` only and return `c.body(null, 204)` for the empty responses.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): add account CRUD, archive and reorder routes"
```

---

### Task 7: API — balance journal use cases and routes

**Files:**

- Create: `apps/api/src/modules/accounts/application/list-balances.ts`, `record-balance.ts`, `edit-balance.ts`, `delete-balance.ts`
- Modify: `apps/api/src/modules/accounts/http/routes.ts`
- Test: `apps/api/test/balances.test.ts`

**Interfaces:**

- Consumes: Task 5 repositories, `toBalanceDto`, `notInFuture`, `AccountDeps`.
- Produces: `listBalances(deps)(userId, accountId, query)`, `recordBalance(deps)(userId, accountId, input)`, `editBalance(deps)(userId, entryId, input)`, `deleteBalance(deps)(userId, entryId)`, `assertEditable(repos, userId, entry)`; routes `GET/POST /accounts/:id/balances`, `PATCH/DELETE /balances/:id`.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/balances.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const alfa = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'cash',
  isSpending: false,
};

async function setup() {
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
  const acc = await (
    await authed(app, 'POST', '/accounts', {
      ...alfa,
      openingBalance: { amount: '100', recordedAt: '2026-09-01T00:00:00.000Z' },
    })
  ).json();
  return { app, acc };
}

describe('balances', () => {
  it('records a balance dated now, updates the account balance, and lists newest first', async () => {
    const { app, acc } = await setup();
    const res = await authed(app, 'POST', `/accounts/${acc.id}/balances`, {
      amount: '120.5',
      note: 'salary',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      amount: '120.5',
      recordedAt: NOW.toISOString(),
      origin: 'manual',
      transferId: null,
    });
    const [a] = await (await authed(app, 'GET', '/accounts')).json();
    expect(a.balance).toBe('120.5');
    const list = await (await authed(app, 'GET', `/accounts/${acc.id}/balances?limit=1`)).json();
    expect(list).toHaveLength(1);
    expect(list[0].amount).toBe('120.5');
    const older = await (
      await authed(
        app,
        'GET',
        `/accounts/${acc.id}/balances?limit=1&before=${encodeURIComponent(`${list[0].recordedAt}|${list[0].id}`)}`,
      )
    ).json();
    expect(older[0].amount).toBe('100');
  });
  it('a backdated entry keeps the current balance', async () => {
    const { app, acc } = await setup();
    await authed(app, 'POST', `/accounts/${acc.id}/balances`, {
      amount: '50',
      recordedAt: '2026-08-01T00:00:00.000Z',
    });
    const [a] = await (await authed(app, 'GET', '/accounts')).json();
    expect(a.balance).toBe('100');
  });
  it('rejects the future and other people', async () => {
    const { app, acc } = await setup();
    expect(
      (
        await (
          await authed(app, 'POST', `/accounts/${acc.id}/balances`, {
            amount: '1',
            recordedAt: '2027-01-01T00:00:00.000Z',
          })
        ).json()
      ).code,
    ).toBe('recorded_in_future');
    expect(
      (await authed(app, 'POST', `/accounts/${acc.id}/balances`, { amount: '1' }, OTHER)).status,
    ).toBe(404);
    expect(
      (await authed(app, 'GET', `/accounts/${acc.id}/balances`, undefined, OTHER)).status,
    ).toBe(404);
  });
  it('edits and deletes only the latest manual entry', async () => {
    const { app, acc } = await setup();
    const [first] = await (await authed(app, 'GET', `/accounts/${acc.id}/balances`)).json();
    const edited = await authed(app, 'PATCH', `/balances/${first.id}`, { amount: '101' });
    expect(edited.status).toBe(200);
    const second = await (
      await authed(app, 'POST', `/accounts/${acc.id}/balances`, { amount: '200' })
    ).json();
    const stale = await authed(app, 'PATCH', `/balances/${first.id}`, { amount: '102' });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('entry_not_latest');
    expect((await authed(app, 'DELETE', `/balances/${first.id}`)).status).toBe(409);
    expect((await authed(app, 'DELETE', `/balances/${second.id}`)).status).toBe(204);
    const [a] = await (await authed(app, 'GET', '/accounts')).json();
    expect(a.balance).toBe('101');
    expect((await authed(app, 'DELETE', `/balances/${second.id}`)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && bun run test`
Expected: FAIL — 404 on `/accounts/:id/balances`.

- [ ] **Step 3: Implement**

`apps/api/src/modules/accounts/application/list-balances.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { BalanceEntryDto, CursorQuery } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { toBalanceDto } from './dto.js';

export const listBalances =
  (deps: AccountDeps) =>
  async (
    userId: string,
    accountId: string,
    query: CursorQuery,
  ): Promise<Result<BalanceEntryDto[], NotFoundError>> => {
    if (!(await deps.repos.accounts.findById(userId, accountId)))
      return err(new NotFoundError('account'));
    const rows = await deps.repos.balances.listByAccount(
      userId,
      accountId,
      query.limit,
      query.before,
    );
    return ok(rows.map(toBalanceDto));
  };
```

`apps/api/src/modules/accounts/application/record-balance.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { BalanceEntryDto, RecordBalanceInput } from '@magermoney/contracts';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { notInFuture, toBalanceDto } from './dto.js';

export const recordBalance =
  (deps: AccountDeps) =>
  async (
    userId: string,
    accountId: string,
    input: RecordBalanceInput,
  ): Promise<Result<BalanceEntryDto, NotFoundError | ValidationError>> => {
    if (!(await deps.repos.accounts.findById(userId, accountId)))
      return err(new NotFoundError('account'));
    const now = deps.clock.now();
    const recordedAt = input.recordedAt ?? now.toISOString();
    if (!notInFuture(recordedAt, now))
      return err(
        new ValidationError('A balance cannot be dated in the future', 'recorded_in_future'),
      );
    const row = await deps.repos.balances.insert(userId, {
      accountId,
      amount: input.amount,
      recordedAt,
      origin: 'manual',
      transferId: null,
      note: input.note ?? null,
    });
    return ok(toBalanceDto(row));
  };
```

`apps/api/src/modules/accounts/application/edit-balance.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { BalanceEntryDto, UpdateBalanceInput } from '@magermoney/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { Repos } from '../../../app.js';
import type { BalanceEntryRow } from './balance-repository.js';
import type { AccountDeps } from './create-account.js';
import { notInFuture, toBalanceDto } from './dto.js';

/** A manual entry can change only while it is the newest one on its account. */
export async function assertEditable(
  repos: Pick<Repos, 'balances'>,
  userId: string,
  entry: BalanceEntryRow,
): Promise<Result<void, ConflictError>> {
  if (entry.origin !== 'manual')
    return err(new ConflictError('entry_not_manual', 'Change the transfer instead'));
  const latest = await repos.balances.latest(userId, entry.accountId);
  if (latest?.id !== entry.id)
    return err(
      new ConflictError(
        'entry_not_latest',
        'Only the latest entry can change; add a new one instead',
      ),
    );
  return ok(undefined);
}

export const editBalance =
  (deps: AccountDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateBalanceInput,
  ): Promise<Result<BalanceEntryDto, NotFoundError | ConflictError | ValidationError>> => {
    const entry = await deps.repos.balances.findById(userId, id);
    if (!entry) return err(new NotFoundError('balance entry'));
    const editable = await assertEditable(deps.repos, userId, entry);
    if (editable.isErr()) return err(editable.error);
    if (input.recordedAt !== undefined && !notInFuture(input.recordedAt, deps.clock.now()))
      return err(
        new ValidationError('A balance cannot be dated in the future', 'recorded_in_future'),
      );
    const row = await deps.repos.balances.update(userId, id, input);
    return row ? ok(toBalanceDto(row)) : err(new NotFoundError('balance entry'));
  };
```

`apps/api/src/modules/accounts/application/delete-balance.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { assertEditable } from './edit-balance.js';

export const deleteBalance =
  (deps: AccountDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> => {
    const entry = await deps.repos.balances.findById(userId, id);
    if (!entry) return err(new NotFoundError('balance entry'));
    const editable = await assertEditable(deps.repos, userId, entry);
    if (editable.isErr()) return err(editable.error);
    await deps.repos.balances.delete(userId, id);
    return ok(undefined);
  };
```

Add to `apps/api/src/modules/accounts/http/routes.ts` (imports: `BalanceEntryDtoSchema, CursorQuerySchema, RecordBalanceInputSchema, UpdateBalanceInputSchema` from contracts and the four use cases), inside `accountRoutes` before `return r`:

```ts
r.openapi(
  createRoute({
    method: 'get',
    path: '/accounts/{id}/balances',
    security: [{ bearer: [] }],
    request: { params: IdParamSchema, query: CursorQuerySchema },
    responses: {
      200: json(z.array(BalanceEntryDtoSchema), 'Newest first'),
      401: ERRORS[401],
      404: ERRORS[404],
    },
  }),
  async (c) =>
    (await listBalances(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('query'))).match(
      (rows) => c.json(rows, 200),
      (e) => fail(c, e),
    ),
);
r.openapi(
  createRoute({
    method: 'post',
    path: '/accounts/{id}/balances',
    security: [{ bearer: [] }],
    request: {
      params: IdParamSchema,
      body: { content: { 'application/json': { schema: RecordBalanceInputSchema } } },
    },
    responses: {
      201: json(BalanceEntryDtoSchema, 'Recorded'),
      400: ERRORS[400],
      401: ERRORS[401],
      404: ERRORS[404],
    },
  }),
  async (c) =>
    (await recordBalance(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
      (dto) => c.json(dto, 201),
      (e) => fail(c, e),
    ),
);
r.openapi(
  createRoute({
    method: 'patch',
    path: '/balances/{id}',
    security: [{ bearer: [] }],
    request: {
      params: IdParamSchema,
      body: { content: { 'application/json': { schema: UpdateBalanceInputSchema } } },
    },
    responses: { 200: json(BalanceEntryDtoSchema, 'Updated'), ...ERRORS },
  }),
  async (c) =>
    (await editBalance(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
      (dto) => c.json(dto, 200),
      (e) => fail(c, e),
    ),
);
r.openapi(
  createRoute({
    method: 'delete',
    path: '/balances/{id}',
    security: [{ bearer: [] }],
    request: { params: IdParamSchema },
    responses: {
      204: { description: 'Deleted' },
      401: ERRORS[401],
      404: ERRORS[404],
      409: ERRORS[409],
    },
  }),
  async (c) =>
    (await deleteBalance(uc)(c.var.userId, c.req.valid('param').id)).match(
      () => c.body(null, 204),
      (e) => fail(c, e),
    ),
);
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `cd apps/api && bun run test && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add the balance journal routes"
```

---

### Task 8: API — transfers use cases and routes

**Files:**

- Create: `apps/api/src/modules/transfers/application/dto.ts`, `create-transfer.ts`, `update-transfer.ts`, `delete-transfer.ts`, `list-transfers.ts`, `apps/api/src/modules/transfers/http/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/transfers.test.ts`

**Interfaces:**

- Consumes: `deriveTransfer`, `applyTransfer`, `Money`, `TransferError` (Task 1); repositories and `UnitOfWork` (Task 5); `fail`, `ERRORS` from the accounts routes.
- Produces: `toTransferDto(row, fromCurrency, toCurrency)`, `createTransfer(deps)`, `updateTransfer(deps)`, `deleteTransfer(deps)`, `listTransfers(deps)`; routes `GET/POST /transfers`, `PATCH/DELETE /transfers/:id`. `TransferDeps = { uow, repos, registry, clock }`.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/transfers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const base = { bank: 'Kapital', country: 'UZ', kind: 'bank_account', isSpending: false };

async function setup() {
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
  const mk = async (name: string, currency: string, amount: string, extra: object = {}) =>
    (
      await authed(app, 'POST', '/accounts', {
        ...base,
        name,
        currency,
        ...extra,
        openingBalance: { amount, recordedAt: '2026-09-01T00:00:00.000Z' },
      })
    ).json();
  const usd = await mk('USD acc', 'USD', '1000');
  const eur = await mk('EUR acc', 'EUR', '100');
  const usd2 = await mk('USD 2', 'USD', '0');
  return { app, usd, eur, usd2 };
}
const balances = async (app: ReturnType<typeof createApp>) =>
  Object.fromEntries(
    (
      (await (await authed(app, 'GET', '/accounts')).json()) as { id: string; balance: string }[]
    ).map((a) => [a.id, a.balance]),
  );

describe('transfers', () => {
  it('same currency: received defaults to sent, fee is derived, both balances move', async () => {
    const { app, usd, usd2 } = await setup();
    const res = await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: usd2.id,
      amountSent: '100',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      amountSent: '100',
      amountReceived: '100',
      fee: '0',
      realisedRate: null,
      occurredAt: NOW.toISOString(),
    });
    const b = await balances(app);
    expect(b[usd.id]).toBe('900');
    expect(b[usd2.id]).toBe('100');
  });
  it('cross currency requires received and derives the rate', async () => {
    const { app, usd, eur } = await setup();
    const missing = await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: eur.id,
      amountSent: '100',
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('amount_received_required');
    const ok = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: eur.id,
        amountSent: '100',
        amountReceived: '86.14',
      })
    ).json();
    expect(ok).toMatchObject({ realisedRate: '0.8614', fee: null });
    const b = await balances(app);
    expect(b[eur.id]).toBe('186.14');
  });
  it('refuses same account, overdraft, foreign accounts and the future', async () => {
    const { app, usd, usd2 } = await setup();
    expect(
      (
        await (
          await authed(app, 'POST', '/transfers', {
            fromAccountId: usd.id,
            toAccountId: usd.id,
            amountSent: '1',
          })
        ).json()
      ).code,
    ).toBe('TRANSFER_INVALID');
    expect(
      (
        await (
          await authed(app, 'POST', '/transfers', {
            fromAccountId: usd2.id,
            toAccountId: usd.id,
            amountSent: '1',
          })
        ).json()
      ).code,
    ).toBe('INSUFFICIENT_FUNDS');
    expect(
      (
        await authed(
          app,
          'POST',
          '/transfers',
          { fromAccountId: usd.id, toAccountId: usd2.id, amountSent: '1' },
          OTHER,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await (
          await authed(app, 'POST', '/transfers', {
            fromAccountId: usd.id,
            toAccountId: usd2.id,
            amountSent: '1',
            occurredAt: '2027-01-01T00:00:00.000Z',
          })
        ).json()
      ).code,
    ).toBe('recorded_in_future');
  });
  it('a credit card may overdraw', async () => {
    const { app, usd } = await setup();
    const credit = await (
      await authed(app, 'POST', '/accounts', {
        ...base,
        name: 'Credit',
        currency: 'USD',
        kind: 'card',
        cardType: 'credit',
      })
    ).json();
    const res = await authed(app, 'POST', '/transfers', {
      fromAccountId: credit.id,
      toAccountId: usd.id,
      amountSent: '10',
    });
    expect(res.status).toBe(201);
    expect((await balances(app))[credit.id]).toBe('-10');
  });
  it('edits and deletes a transfer only while both entries are latest', async () => {
    const { app, usd, usd2 } = await setup();
    const t = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '100',
      })
    ).json();
    const edited = await authed(app, 'PATCH', `/transfers/${t.id}`, {
      amountSent: '150',
      amountReceived: '149',
    });
    expect(edited.status).toBe(200);
    let b = await balances(app);
    expect(b[usd.id]).toBe('850');
    expect(b[usd2.id]).toBe('149');
    await authed(app, 'POST', `/accounts/${usd2.id}/balances`, { amount: '160' });
    const stale = await authed(app, 'PATCH', `/transfers/${t.id}`, { amountSent: '1' });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('transfer_not_latest');
    expect((await authed(app, 'DELETE', `/transfers/${t.id}`)).status).toBe(409);
    expect((await authed(app, 'DELETE', `/accounts/${usd2.id}`)).status).toBe(409);
    const t2 = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '50',
      })
    ).json();
    expect((await authed(app, 'DELETE', `/transfers/${t2.id}`)).status).toBe(204);
    b = await balances(app);
    expect(b[usd.id]).toBe('850');
    expect(b[usd2.id]).toBe('160');
  });
  it('lists newest first, optionally by account', async () => {
    const { app, usd, eur, usd2 } = await setup();
    await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: usd2.id,
      amountSent: '1',
      occurredAt: '2026-09-02T00:00:00.000Z',
    });
    await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: eur.id,
      amountSent: '2',
      amountReceived: '1.7',
      occurredAt: '2026-09-03T00:00:00.000Z',
    });
    const all = await (await authed(app, 'GET', '/transfers')).json();
    expect(all.map((t: { amountSent: string }) => t.amountSent)).toEqual(['2', '1']);
    const eurOnly = await (await authed(app, 'GET', `/transfers?accountId=${eur.id}`)).json();
    expect(eurOnly).toHaveLength(1);
    expect(await (await authed(app, 'GET', '/transfers', undefined, OTHER)).json()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && bun run test`
Expected: FAIL — 404 on `/transfers`.

- [ ] **Step 3: Implement**

`apps/api/src/modules/transfers/application/dto.ts`:

```ts
import { deriveTransfer, Money, type Currency } from '@magermoney/domain';
import type { TransferDto } from '@magermoney/contracts';
import type { TransferRow } from './transfer-repository.js';

export function toTransferDto(row: TransferRow, from: Currency, to: Currency): TransferDto {
  const derived = deriveTransfer({
    amountSent: Money.of(row.amountSent, from),
    amountReceived: Money.of(row.amountReceived, to),
  }).unwrapOr({ realisedRate: null, fee: null });
  const { userId: _u, ...rest } = row;
  return {
    ...rest,
    realisedRate: derived.realisedRate?.toFixed() ?? null,
    fee: derived.fee?.toString() ?? null,
  };
}
```

`apps/api/src/modules/transfers/application/create-transfer.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import {
  applyTransfer,
  deriveTransfer,
  Money,
  TransferError,
  type Clock,
  type CurrencyRegistry,
  type CurrencyMismatchError,
  type InsufficientFundsError,
  type UnknownCurrencyError,
} from '@magermoney/domain';
import type { CreateTransferInput, TransferDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { AccountRow } from '../../accounts/application/account-repository.js';
import { notInFuture } from '../../accounts/application/dto.js';
import { toTransferDto } from './dto.js';

export interface TransferDeps {
  uow: UnitOfWork<Repos>;
  repos: Repos;
  registry: CurrencyRegistry;
  clock: Clock;
}
export type TransferFailure =
  | NotFoundError
  | ValidationError
  | TransferError
  | InsufficientFundsError
  | CurrencyMismatchError
  | UnknownCurrencyError;

/** Locks both accounts and resolves their currencies; the same preamble serves create, update and delete. */
export async function lockPair(
  deps: TransferDeps,
  repos: Repos,
  userId: string,
  fromId: string,
  toId: string,
) {
  if (fromId === toId) return err(new TransferError('same_account'));
  const rows = await repos.accounts.lock(userId, [fromId, toId]);
  const from = rows.find((a) => a.id === fromId);
  const to = rows.find((a) => a.id === toId);
  if (!from || !to) return err(new NotFoundError('account'));
  return deps.registry
    .get(from.currency)
    .andThen((fromCur) =>
      deps.registry.get(to.currency).map((toCur) => ({ from, to, fromCur, toCur })),
    );
}

/** Balance as Money, zero when the account has no entry yet. */
export const balanceOf = (a: AccountRow, cur: Parameters<typeof Money.of>[1]) =>
  a.balance === null ? Money.zero(cur) : Money.of(a.balance, cur);

export function resolveAmounts(
  input: { amountSent: string; amountReceived?: string | undefined },
  pair: { fromCur: { code: string }; toCur: { code: string } },
): Result<{ amountReceived: string }, ValidationError> {
  if (pair.fromCur.code !== pair.toCur.code && input.amountReceived === undefined)
    return err(
      new ValidationError(
        'amountReceived is required when currencies differ',
        'amount_received_required',
      ),
    );
  return ok({ amountReceived: input.amountReceived ?? input.amountSent });
}

export const createTransfer =
  (deps: TransferDeps) =>
  (userId: string, input: CreateTransferInput): Promise<Result<TransferDto, TransferFailure>> =>
    deps.uow(async (repos) => {
      const pair = await lockPair(deps, repos, userId, input.fromAccountId, input.toAccountId);
      if (pair.isErr()) return err(pair.error);
      const { from, to, fromCur, toCur } = pair.value;
      const now = deps.clock.now();
      const occurredAt = input.occurredAt ?? now.toISOString();
      if (!notInFuture(occurredAt, now))
        return err(
          new ValidationError('A transfer cannot be dated in the future', 'recorded_in_future'),
        );
      const amounts = resolveAmounts(input, pair.value);
      if (amounts.isErr()) return err(amounts.error);
      const sent = Money.of(input.amountSent, fromCur);
      const received = Money.of(amounts.value.amountReceived, toCur);
      const derived = deriveTransfer({ amountSent: sent, amountReceived: received });
      if (derived.isErr()) return err(derived.error);
      const applied = applyTransfer({
        from: { kind: from.kind, cardType: from.cardType, balance: balanceOf(from, fromCur) },
        toBalance: balanceOf(to, toCur),
        amountSent: sent,
        amountReceived: received,
      });
      if (applied.isErr()) return err(applied.error);
      const row = await repos.transfers.insert(userId, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amountSent: sent.toString(),
        amountReceived: received.toString(),
        occurredAt,
        note: input.note ?? null,
      });
      await repos.balances.insert(userId, {
        accountId: from.id,
        amount: applied.value.fromAfter.toString(),
        recordedAt: occurredAt,
        origin: 'transfer',
        transferId: row.id,
        note: null,
      });
      await repos.balances.insert(userId, {
        accountId: to.id,
        amount: applied.value.toAfter.toString(),
        recordedAt: occurredAt,
        origin: 'transfer',
        transferId: row.id,
        note: null,
      });
      return ok(toTransferDto(row, fromCur, toCur));
    });
```

`apps/api/src/modules/transfers/application/update-transfer.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { applyTransfer, deriveTransfer, Money } from '@magermoney/domain';
import type { TransferDto, UpdateTransferInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import { notInFuture } from '../../accounts/application/dto.js';
import type { BalanceEntryRow } from '../../accounts/application/balance-repository.js';
import {
  balanceOf,
  lockPair,
  resolveAmounts,
  type TransferDeps,
  type TransferFailure,
} from './create-transfer.js';
import { toTransferDto } from './dto.js';
import type { TransferRow } from './transfer-repository.js';

/** The transfer's two entries must still be the newest on their accounts; otherwise later history depends on them. */
export async function latestEntriesOf(
  repos: Repos,
  userId: string,
  t: TransferRow,
): Promise<Result<{ fromEntry: BalanceEntryRow; toEntry: BalanceEntryRow }, ConflictError>> {
  const entries = await repos.balances.findByTransfer(userId, t.id);
  const fromEntry = entries.find((e) => e.accountId === t.fromAccountId);
  const toEntry = entries.find((e) => e.accountId === t.toAccountId);
  const [latestFrom, latestTo] = await Promise.all([
    repos.balances.latest(userId, t.fromAccountId),
    repos.balances.latest(userId, t.toAccountId),
  ]);
  if (!fromEntry || !toEntry || latestFrom?.id !== fromEntry.id || latestTo?.id !== toEntry.id)
    return err(
      new ConflictError(
        'transfer_not_latest',
        'Newer balances exist on one of the accounts; record a correcting transfer instead',
      ),
    );
  return ok({ fromEntry, toEntry });
}

export const updateTransfer =
  (deps: TransferDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateTransferInput,
  ): Promise<Result<TransferDto, TransferFailure | ConflictError>> =>
    deps.uow(async (repos) => {
      const current = await repos.transfers.findById(userId, id);
      if (!current) return err(new NotFoundError('transfer'));
      const pair = await lockPair(
        deps,
        repos,
        userId,
        input.fromAccountId ?? current.fromAccountId,
        input.toAccountId ?? current.toAccountId,
      );
      if (pair.isErr()) return err(pair.error);
      if (pair.value.from.id !== current.fromAccountId || pair.value.to.id !== current.toAccountId)
        return err(
          new ValidationError(
            'Accounts of a transfer cannot change; delete it and create a new one',
            'accounts_immutable',
          ),
        );
      const { from, to, fromCur, toCur } = pair.value;
      const latest = await latestEntriesOf(repos, userId, current);
      if (latest.isErr()) return err(latest.error);
      const now = deps.clock.now();
      const occurredAt = input.occurredAt ?? current.occurredAt;
      if (!notInFuture(occurredAt, now))
        return err(
          new ValidationError('A transfer cannot be dated in the future', 'recorded_in_future'),
        );
      const merged = {
        amountSent: input.amountSent ?? current.amountSent,
        amountReceived:
          input.amountReceived ??
          (input.amountSent !== undefined && fromCur.code === toCur.code
            ? undefined
            : current.amountReceived),
      };
      const amounts = resolveAmounts(merged, pair.value);
      if (amounts.isErr()) return err(amounts.error);
      const sent = Money.of(merged.amountSent, fromCur);
      const received = Money.of(amounts.value.amountReceived, toCur);
      const derived = deriveTransfer({ amountSent: sent, amountReceived: received });
      if (derived.isErr()) return err(derived.error);
      // Undo the old movement, then apply the new one to the balances as they were before this transfer.
      const fromBefore = balanceOf(from, fromCur)
        .add(Money.of(current.amountSent, fromCur))
        ._unsafeUnwrap();
      const toBefore = balanceOf(to, toCur)
        .subtract(Money.of(current.amountReceived, toCur))
        ._unsafeUnwrap();
      const applied = applyTransfer({
        from: { kind: from.kind, cardType: from.cardType, balance: fromBefore },
        toBalance: toBefore,
        amountSent: sent,
        amountReceived: received,
      });
      if (applied.isErr()) return err(applied.error);
      const row = await repos.transfers.update(userId, id, {
        amountSent: sent.toString(),
        amountReceived: received.toString(),
        occurredAt,
        note: input.note === undefined ? current.note : input.note,
      });
      await repos.balances.update(userId, latest.value.fromEntry.id, {
        amount: applied.value.fromAfter.toString(),
        recordedAt: occurredAt,
      });
      await repos.balances.update(userId, latest.value.toEntry.id, {
        amount: applied.value.toAfter.toString(),
        recordedAt: occurredAt,
      });
      return ok(toTransferDto(row!, fromCur, toCur));
    });
```

`apps/api/src/modules/transfers/application/delete-transfer.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { TransferDeps } from './create-transfer.js';
import { latestEntriesOf } from './update-transfer.js';

export const deleteTransfer =
  (deps: TransferDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    deps.uow(async (repos) => {
      const current = await repos.transfers.findById(userId, id);
      if (!current) return err(new NotFoundError('transfer'));
      await repos.accounts.lock(userId, [current.fromAccountId, current.toAccountId]);
      const latest = await latestEntriesOf(repos, userId, current);
      if (latest.isErr()) return err(latest.error);
      await repos.balances.deleteByTransfer(userId, id);
      await repos.transfers.delete(userId, id);
      return ok(undefined);
    });
```

`apps/api/src/modules/transfers/application/list-transfers.ts`:

```ts
import type { TransferDto, TransfersQuery } from '@magermoney/contracts';
import type { TransferDeps } from './create-transfer.js';
import { toTransferDto } from './dto.js';

export const listTransfers =
  (deps: TransferDeps) =>
  async (userId: string, query: TransfersQuery): Promise<TransferDto[]> => {
    const [rows, accounts] = await Promise.all([
      deps.repos.transfers.list(userId, query.limit, query.before, query.accountId),
      deps.repos.accounts.list(userId),
    ]);
    const currencyOf = (id: string) =>
      deps.registry
        .get(accounts.find((a) => a.id === id)?.currency ?? '')
        .unwrapOr({ code: '?', kind: 'fiat' as const, scale: 2 });
    return rows.map((r) =>
      toTransferDto(r, currencyOf(r.fromAccountId), currencyOf(r.toAccountId)),
    );
  };
```

`apps/api/src/modules/transfers/http/routes.ts`:

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  CreateTransferInputSchema,
  IdParamSchema,
  TransferDtoSchema,
  TransfersQuerySchema,
  UpdateTransferInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import { createTransfer, type TransferDeps } from '../application/create-transfer.js';
import { deleteTransfer } from '../application/delete-transfer.js';
import { listTransfers } from '../application/list-transfers.js';
import { updateTransfer } from '../application/update-transfer.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export function transferRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: TransferDeps = {
    uow: deps.uow,
    repos: deps.repos,
    registry: deps.registry,
    clock: deps.clock,
  };
  r.use('/transfers', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/transfers/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/transfers',
      security: [{ bearer: [] }],
      request: { query: TransfersQuerySchema },
      responses: { 200: json(z.array(TransferDtoSchema), 'Newest first'), 401: ERRORS[401] },
    }),
    async (c) => c.json(await listTransfers(uc)(c.var.userId, c.req.valid('query')), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/transfers',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: CreateTransferInputSchema } } } },
      responses: {
        201: json(TransferDtoSchema, 'Created'),
        400: ERRORS[400],
        401: ERRORS[401],
        404: ERRORS[404],
      },
    }),
    async (c) =>
      (await createTransfer(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/transfers/{id}',
      security: [{ bearer: [] }],
      request: {
        params: IdParamSchema,
        body: { content: { 'application/json': { schema: UpdateTransferInputSchema } } },
      },
      responses: { 200: json(TransferDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateTransfer(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/transfers/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: {
        204: { description: 'Deleted' },
        401: ERRORS[401],
        404: ERRORS[404],
        409: ERRORS[409],
      },
    }),
    async (c) =>
      (await deleteTransfer(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
```

Mount in `app.ts`: `app.route('/', transferRoutes(deps));`.

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `cd apps/api && bun run test && bun run typecheck && bun run lint`
Expected: PASS. Note the realised-rate expectation `'0.8614'`: `toSignificantDigits(10)` of `0.8614` is `0.8614`, and `toFixed()` prints it without exponent.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add transfers producing paired balance entries"
```

---

### Task 9: API — Postgres repositories, transactional unit of work, bootstrap

**Files:**

- Create: `apps/api/src/modules/accounts/infrastructure/pg-account-repository.ts`, `pg-balance-repository.ts`, `apps/api/src/modules/transfers/infrastructure/pg-transfer-repository.ts`, `apps/api/src/shared/db/pg-unit-of-work.ts`
- Modify: `apps/api/src/bootstrap.ts` (remove the Task 5 placeholders)
- Test: `apps/api/test/integration/pg-account-repository.test.ts`, `apps/api/test/integration/pg-transfer-concurrency.test.ts`

**Interfaces:**

- Consumes: `Sql` (`shared/db/client.ts`), repository interfaces (Task 5), `createTransfer` (Task 8).
- Produces: `PgAccountRepository(sql)`, `PgBalanceRepository(sql)`, `PgTransferRepository(sql)`, `pgRepos(sql): Repos`, `pgUnitOfWork(sql): UnitOfWork<Repos>`.

- [ ] **Step 1: Write the failing integration tests**

`apps/api/test/integration/pg-account-repository.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../src/shared/db/client.js';
import { pgRepos } from '../../src/shared/db/pg-unit-of-work.js';
import { createClient } from '@supabase/supabase-js';

const sql = createDb(process.env.DATABASE_URL!);
const repos = pgRepos(sql);
const newAccount = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'bank_account' as const,
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
};

async function newUser(): Promise<string> {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await admin.auth.admin.createUser({
    email: `pg-${Date.now()}-${Math.random()}@test.local`,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

describe('PgAccountRepository', () => {
  let uid: string;
  let other: string;
  beforeAll(async () => {
    uid = await newUser();
    other = await newUser();
  });

  it('creates with an opening balance and joins the latest entry (recorded_at desc, created_at desc)', async () => {
    const a = await repos.accounts.create(uid, newAccount, {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(a).toMatchObject({
      balance: '100',
      balanceRecordedAt: '2026-09-01T00:00:00.000Z',
      cardExpires: null,
      archivedAt: null,
    });
    await repos.balances.insert(uid, {
      accountId: a.id,
      amount: '2',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    await repos.balances.insert(uid, {
      accountId: a.id,
      amount: '3',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    expect((await repos.accounts.findById(uid, a.id))?.balance).toBe('3');
    expect(await repos.accounts.findById(other, a.id)).toBeNull();
    expect(await repos.accounts.countEntries(uid, a.id)).toBe(3);
  });

  it('paginates balances by cursor and round-trips a card date', async () => {
    const card = await repos.accounts.create(uid, {
      ...newAccount,
      name: 'Card',
      kind: 'card',
      cardType: 'debit',
      cardLast4: '5520',
      cardExpires: '2027-07-31',
    });
    expect(card.cardExpires).toBe('2027-07-31');
    const e1 = await repos.balances.insert(uid, {
      accountId: card.id,
      amount: '1',
      recordedAt: '2026-09-01T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const e2 = await repos.balances.insert(uid, {
      accountId: card.id,
      amount: '2',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const page1 = await repos.balances.listByAccount(uid, card.id, 1);
    expect(page1.map((e) => e.id)).toEqual([e2.id]);
    const page2 = await repos.balances.listByAccount(uid, card.id, 1, `${e2.recordedAt}|${e2.id}`);
    expect(page2.map((e) => e.id)).toEqual([e1.id]);
  });

  it('reorders, archives, refuses delete with transfers, cascades entries otherwise', async () => {
    const a = await repos.accounts.create(uid, { ...newAccount, name: 'A', currency: 'USD' });
    const b = await repos.accounts.create(uid, { ...newAccount, name: 'B', currency: 'USD' });
    expect(await repos.accounts.reorder(uid, [b.id, a.id])).toBe(true);
    expect(await repos.accounts.reorder(other, [b.id])).toBe(false);
    expect(
      (await repos.accounts.setArchived(uid, a.id, '2026-09-11T00:00:00.000Z'))?.archivedAt,
    ).toBe('2026-09-11T00:00:00.000Z');
    const t = await repos.transfers.insert(uid, {
      fromAccountId: a.id,
      toAccountId: b.id,
      amountSent: '1',
      amountReceived: '1',
      occurredAt: '2026-09-03T00:00:00.000Z',
      note: null,
    });
    expect(await repos.accounts.delete(uid, a.id)).toBe('has_transfers');
    expect(await repos.transfers.countByAccount(uid, a.id)).toBe(1);
    await repos.transfers.delete(uid, t.id);
    await repos.balances.insert(uid, {
      accountId: a.id,
      amount: '1',
      recordedAt: '2026-09-04T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    expect(await repos.accounts.delete(uid, a.id)).toBe('deleted');
    expect(await repos.balances.listByAccount(uid, a.id, 10)).toEqual([]);
    expect(await repos.accounts.delete(uid, a.id)).toBe('not_found');
  });
});
```

`apps/api/test/integration/pg-transfer-concurrency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';
import { pgRepos, pgUnitOfWork } from '../../src/shared/db/pg-unit-of-work.js';
import { createTransfer } from '../../src/modules/transfers/application/create-transfer.js';

const sql = createDb(process.env.DATABASE_URL!);
const deps = {
  uow: pgUnitOfWork(sql),
  repos: pgRepos(sql),
  registry: CurrencyRegistry.default(),
  clock: new SystemClock(),
};
const acc = (name: string) => ({
  name,
  bank: 'B',
  country: 'RU',
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

describe('transfers under concurrency', () => {
  it('two simultaneous transfers from one account never overdraw it', async () => {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.auth.admin.createUser({
      email: `cc-${Date.now()}@test.local`,
      email_confirm: true,
    });
    const uid = data.user!.id;
    const from = await deps.repos.accounts.create(uid, acc('from'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const to = await deps.repos.accounts.create(uid, acc('to'));
    const run = () =>
      createTransfer(deps)(uid, { fromAccountId: from.id, toAccountId: to.id, amountSent: '70' });
    const [r1, r2] = await Promise.all([run(), run()]);
    expect([r1.isOk(), r2.isOk()].filter(Boolean)).toHaveLength(1);
    const after = await deps.repos.accounts.findById(uid, from.id);
    expect(after?.balance).toBe('30');
    expect(await deps.repos.transfers.countByAccount(uid, from.id)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run the integration command from Task 4 Step 2.
Expected: FAIL — `pg-unit-of-work` module missing.

- [ ] **Step 3: Implement**

`apps/api/src/modules/accounts/infrastructure/pg-balance-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import {
  parseCursor,
  type BalanceEntryPatch,
  type BalanceEntryRow,
  type BalanceRepository,
  type NewBalanceEntry,
} from '../application/balance-repository.js';

type Raw = Omit<BalanceEntryRow, 'recordedAt' | 'createdAt'> & {
  recordedAt: Date;
  createdAt: Date;
};
const iso = (d: Date) => d.toISOString();
const fromRaw = (r: Raw): BalanceEntryRow => ({
  ...r,
  recordedAt: iso(r.recordedAt),
  createdAt: iso(r.createdAt),
});
const COLS =
  'id, user_id, account_id, amount::text as amount, recorded_at, origin, transfer_id, note, created_at';

export class PgBalanceRepository implements BalanceRepository {
  constructor(private readonly sql: Sql) {}
  async listByAccount(userId: string, accountId: string, limit: number, before?: string) {
    const c = before ? parseCursor(before) : null;
    const rows = await this.sql<Raw[]>`
      select ${this.sql.unsafe(COLS)} from balance_entries
      where user_id = ${userId} and account_id = ${accountId}
      ${c ? this.sql`and (recorded_at, created_at, id) < (${c.recordedAt}::timestamptz, (select created_at from balance_entries where id = ${c.id}), ${c.id}::uuid)` : this.sql``}
      order by recorded_at desc, created_at desc, id desc
      limit ${limit}`;
    return rows.map(fromRaw);
  }
  async latest(userId: string, accountId: string) {
    return (await this.listByAccount(userId, accountId, 1))[0] ?? null;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<
      Raw[]
    >`select ${this.sql.unsafe(COLS)} from balance_entries where user_id = ${userId} and id = ${id}`;
    return row ? fromRaw(row) : null;
  }
  async findByTransfer(userId: string, transferId: string) {
    const rows = await this.sql<
      Raw[]
    >`select ${this.sql.unsafe(COLS)} from balance_entries where user_id = ${userId} and transfer_id = ${transferId}`;
    return rows.map(fromRaw);
  }
  async insert(userId: string, data: NewBalanceEntry) {
    const [row] = await this.sql<Raw[]>`
      insert into balance_entries (user_id, account_id, amount, recorded_at, origin, transfer_id, note)
      values (${userId}, ${data.accountId}, ${data.amount}, ${data.recordedAt}, ${data.origin}, ${data.transferId}, ${data.note})
      returning ${this.sql.unsafe(COLS)}`;
    return fromRaw(row!);
  }
  async update(userId: string, id: string, patch: BalanceEntryPatch) {
    const data: Record<string, unknown> = {};
    if (patch.amount !== undefined) data.amount = patch.amount;
    if (patch.recordedAt !== undefined) data.recorded_at = patch.recordedAt;
    if (patch.note !== undefined) data.note = patch.note;
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<
      Raw[]
    >`update balance_entries set ${this.sql(data)} where user_id = ${userId} and id = ${id} returning ${this.sql.unsafe(COLS)}`;
    return row ? fromRaw(row) : null;
  }
  async delete(userId: string, id: string) {
    return (
      (await this.sql`delete from balance_entries where user_id = ${userId} and id = ${id}`).count >
      0
    );
  }
  async deleteByTransfer(userId: string, transferId: string) {
    return (
      await this
        .sql`delete from balance_entries where user_id = ${userId} and transfer_id = ${transferId}`
    ).count;
  }
}
```

`apps/api/src/modules/accounts/infrastructure/pg-account-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import type {
  AccountPatch,
  AccountRepository,
  AccountRow,
  NewAccount,
  OpeningBalance,
} from '../application/account-repository.js';

type Raw = Omit<AccountRow, 'archivedAt' | 'balanceRecordedAt'> & {
  archivedAt: Date | null;
  balanceRecordedAt: Date | null;
};
const fromRaw = (r: Raw): AccountRow => ({
  ...r,
  archivedAt: r.archivedAt?.toISOString() ?? null,
  balanceRecordedAt: r.balanceRecordedAt?.toISOString() ?? null,
});

/** `card_expires` is a `date`: read it as text so no timezone can shift the day. */
const SELECT = `
  select a.id, a.user_id, a.name, a.bank, a.country, a.currency, a.kind, a.card_type, a.is_spending,
         a.card_last4, a.card_network, a.card_tier, to_char(a.card_expires, 'YYYY-MM-DD') as card_expires,
         a.note, a.sort_order, a.archived_at,
         b.amount::text as balance, b.recorded_at as balance_recorded_at
  from accounts a
  left join lateral (
    select amount, recorded_at from balance_entries e
    where e.account_id = a.id
    order by e.recorded_at desc, e.created_at desc, e.id desc
    limit 1
  ) b on true`;

const toColumns = (p: AccountPatch): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  if (p.name !== undefined) d.name = p.name;
  if (p.bank !== undefined) d.bank = p.bank;
  if (p.country !== undefined) d.country = p.country;
  if (p.currency !== undefined) d.currency = p.currency;
  if (p.kind !== undefined) d.kind = p.kind;
  if (p.cardType !== undefined) d.card_type = p.cardType;
  if (p.isSpending !== undefined) d.is_spending = p.isSpending;
  if (p.cardLast4 !== undefined) d.card_last4 = p.cardLast4;
  if (p.cardNetwork !== undefined) d.card_network = p.cardNetwork;
  if (p.cardTier !== undefined) d.card_tier = p.cardTier;
  if (p.cardExpires !== undefined) d.card_expires = p.cardExpires;
  if (p.note !== undefined) d.note = p.note;
  if (p.sortOrder !== undefined) d.sort_order = p.sortOrder;
  return d;
};

export class PgAccountRepository implements AccountRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    const rows = await this.sql<
      Raw[]
    >`${this.sql.unsafe(SELECT)} where a.user_id = ${userId} order by a.sort_order, a.name`;
    return rows.map(fromRaw);
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<
      Raw[]
    >`${this.sql.unsafe(SELECT)} where a.user_id = ${userId} and a.id = ${id}`;
    return row ? fromRaw(row) : null;
  }
  async lock(userId: string, ids: string[]) {
    // Lock the account rows first (sorted, so two transfers over the same pair never deadlock), then read with balances.
    await this
      .sql`select id from accounts where user_id = ${userId} and id in ${this.sql(ids)} order by id for update`;
    const rows = await this.sql<
      Raw[]
    >`${this.sql.unsafe(SELECT)} where a.user_id = ${userId} and a.id in ${this.sql(ids)}`;
    return rows.map(fromRaw);
  }
  async create(userId: string, data: NewAccount, opening?: OpeningBalance) {
    const [created] = await this.sql<
      { id: string }[]
    >`insert into accounts ${this.sql({ ...toColumns(data), user_id: userId })} returning id`;
    if (opening)
      await this
        .sql`insert into balance_entries (user_id, account_id, amount, recorded_at, origin) values (${userId}, ${created!.id}, ${opening.amount}, ${opening.recordedAt}, 'manual')`;
    return (await this.findById(userId, created!.id))!;
  }
  async update(userId: string, id: string, patch: AccountPatch) {
    const data = toColumns(patch);
    if (Object.keys(data).length > 0)
      await this
        .sql`update accounts set ${this.sql(data)} where user_id = ${userId} and id = ${id}`;
    return this.findById(userId, id);
  }
  async setArchived(userId: string, id: string, archivedAt: string | null) {
    await this
      .sql`update accounts set archived_at = ${archivedAt} where user_id = ${userId} and id = ${id}`;
    return this.findById(userId, id);
  }
  async delete(userId: string, id: string) {
    const [t] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from transfers where user_id = ${userId} and (from_account_id = ${id} or to_account_id = ${id})`;
    if (t!.n > 0) return 'has_transfers' as const;
    const res = await this.sql`delete from accounts where user_id = ${userId} and id = ${id}`;
    return res.count > 0 ? ('deleted' as const) : ('not_found' as const);
  }
  async reorder(userId: string, ids: string[]) {
    const [owned] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from accounts where user_id = ${userId} and id in ${this.sql(ids)}`;
    if (owned!.n !== ids.length) return false;
    await this.sql`
      update accounts a set sort_order = v.ord
      from (select * from unnest(${this.sql.array(ids)}::uuid[]) with ordinality as t(id, ord)) v
      where a.id = v.id and a.user_id = ${userId}`;
    return true;
  }
  async countEntries(userId: string, id: string) {
    const [row] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from balance_entries where user_id = ${userId} and account_id = ${id}`;
    return row!.n;
  }
}
```

`apps/api/src/modules/transfers/infrastructure/pg-transfer-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import type {
  NewTransfer,
  TransferPatch,
  TransferRepository,
  TransferRow,
} from '../application/transfer-repository.js';

type Raw = Omit<TransferRow, 'occurredAt'> & { occurredAt: Date };
const fromRaw = (r: Raw): TransferRow => ({ ...r, occurredAt: r.occurredAt.toISOString() });
const COLS =
  'id, user_id, from_account_id, to_account_id, amount_sent::text as amount_sent, amount_received::text as amount_received, occurred_at, note';

export class PgTransferRepository implements TransferRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string, limit: number, before?: string, accountId?: string) {
    const [occurredAt, id] = before ? (before.split('|') as [string, string]) : [null, null];
    const rows = await this.sql<Raw[]>`
      select ${this.sql.unsafe(COLS)} from transfers
      where user_id = ${userId}
      ${accountId ? this.sql`and (from_account_id = ${accountId} or to_account_id = ${accountId})` : this.sql``}
      ${occurredAt ? this.sql`and (occurred_at, id) < (${occurredAt}::timestamptz, ${id}::uuid)` : this.sql``}
      order by occurred_at desc, id desc limit ${limit}`;
    return rows.map(fromRaw);
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<
      Raw[]
    >`select ${this.sql.unsafe(COLS)} from transfers where user_id = ${userId} and id = ${id}`;
    return row ? fromRaw(row) : null;
  }
  async insert(userId: string, d: NewTransfer) {
    const [row] = await this.sql<Raw[]>`
      insert into transfers (user_id, from_account_id, to_account_id, amount_sent, amount_received, occurred_at, note)
      values (${userId}, ${d.fromAccountId}, ${d.toAccountId}, ${d.amountSent}, ${d.amountReceived}, ${d.occurredAt}, ${d.note})
      returning ${this.sql.unsafe(COLS)}`;
    return fromRaw(row!);
  }
  async update(userId: string, id: string, p: TransferPatch) {
    const data: Record<string, unknown> = {};
    if (p.amountSent !== undefined) data.amount_sent = p.amountSent;
    if (p.amountReceived !== undefined) data.amount_received = p.amountReceived;
    if (p.occurredAt !== undefined) data.occurred_at = p.occurredAt;
    if (p.note !== undefined) data.note = p.note;
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<
      Raw[]
    >`update transfers set ${this.sql(data)} where user_id = ${userId} and id = ${id} returning ${this.sql.unsafe(COLS)}`;
    return row ? fromRaw(row) : null;
  }
  async delete(userId: string, id: string) {
    return (
      (await this.sql`delete from transfers where user_id = ${userId} and id = ${id}`).count > 0
    );
  }
  async countByAccount(userId: string, accountId: string) {
    const [row] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from transfers where user_id = ${userId} and (from_account_id = ${accountId} or to_account_id = ${accountId})`;
    return row!.n;
  }
}
```

`apps/api/src/shared/db/pg-unit-of-work.ts`:

```ts
import type { Repos } from '../../app.js';
import { PgAccountRepository } from '../../modules/accounts/infrastructure/pg-account-repository.js';
import { PgBalanceRepository } from '../../modules/accounts/infrastructure/pg-balance-repository.js';
import { PgTransferRepository } from '../../modules/transfers/infrastructure/pg-transfer-repository.js';
import type { Sql } from './client.js';
import type { UnitOfWork } from './unit-of-work.js';

export const pgRepos = (sql: Sql): Repos => ({
  accounts: new PgAccountRepository(sql),
  balances: new PgBalanceRepository(sql),
  transfers: new PgTransferRepository(sql),
});

/** One transaction per unit of work; the repositories inside see the same connection, so `for update` locks hold until commit. */
export const pgUnitOfWork =
  (sql: Sql): UnitOfWork<Repos> =>
  (fn) =>
    sql.begin((tx) => fn(pgRepos(tx as unknown as Sql))) as ReturnType<typeof fn>;
```

`bootstrap.ts`: replace the placeholders with

```ts
import { pgRepos, pgUnitOfWork } from './shared/db/pg-unit-of-work.js';
// …
    repos: pgRepos(sql),
    uow: pgUnitOfWork(sql),
```

- [ ] **Step 4: Run integration and unit suites, typecheck, lint**

Run: `supabase db reset` then the integration command from Task 4 Step 2; then `cd apps/api && bun run test && bun run typecheck && bun run lint`.
Expected: PASS. If `sql.begin`'s typing rejects the callback, cast the result with `as Promise<T>` inside a generic wrapper function instead of the arrow.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add Postgres repositories with a transactional unit of work"
```

---

### Task 10: API — remove a manual rate

**Files:**

- Create: `apps/api/src/modules/rates/application/remove-manual-rate.ts`
- Modify: `apps/api/src/modules/rates/application/rate-repository.ts`, `memory-rate-repository.ts`, `pg-rate-repository.ts`, `apps/api/src/modules/rates/http/routes.ts`
- Test: `apps/api/test/remove-manual-rate.test.ts`, `apps/api/test/integration/pg-rate-repository.test.ts` (one case)

**Interfaces:**

- Produces: `RateRepository.deleteManual(userId, base, date): Promise<boolean>`; `removeManualRate(repo)(userId, query)`; route `DELETE /rates/manual?base=&date=` → 204 / 404.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/remove-manual-rate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET, UID } from './helpers/http.js';

describe('DELETE /rates/manual', () => {
  it("removes only the caller's override", async () => {
    const rates = new MemoryRateRepository([
      {
        base: 'RUB',
        quote: 'USD',
        value: '0.01',
        date: '2026-01-01',
        source: 'manual',
        userId: UID,
      },
      { base: 'RUB', quote: 'USD', value: '0.02', date: '2026-01-01', source: 'api', userId: null },
    ]);
    const app = createApp(testDeps({ rates, jwtSecret: SECRET }));
    expect(
      (await authed(app, 'DELETE', '/rates/manual?base=RUB&date=2026-01-01', undefined, OTHER))
        .status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', '/rates/manual?base=RUB&date=2026-01-01')).status).toBe(
      204,
    );
    expect(rates.rows).toHaveLength(1);
    expect(rates.rows[0]?.source).toBe('api');
  });
});
```

Append to `apps/api/test/integration/pg-rate-repository.test.ts`:

```ts
it('deletes a manual override by user, base and date', async () => {
  await repo.upsertMany([
    { base: 'RUB', value: '0.01', date: '2026-01-01', source: 'manual', userId: anyUuid },
  ]);
  expect(await repo.deleteManual(anyUuid, 'RUB', '2026-01-01')).toBe(true);
  expect(await repo.deleteManual(anyUuid, 'RUB', '2026-01-01')).toBe(false);
});
```

(`anyUuid` there is the zero uuid; the `rates.user_id` FK requires a real profile, so in that test create a user as in Task 9's `newUser()` and use its id instead of `anyUuid`.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && bun run test`
Expected: FAIL — 404 `Route not found` (DELETE not registered).

- [ ] **Step 3: Implement**

`rate-repository.ts`: add `deleteManual(userId: string, base: string, date: string): Promise<boolean>;`

`memory-rate-repository.ts`:

```ts
  async deleteManual(userId: string, base: string, date: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.source === 'manual' && r.userId === userId && r.base === base && r.date === date));
    return this.rows.length < before;
  }
```

`pg-rate-repository.ts`:

```ts
  async deleteManual(userId: string, base: string, date: string) {
    const res = await this.sql`delete from rates where source = 'manual' and user_id = ${userId} and base = ${base} and date = ${date}`;
    return res.count > 0;
  }
```

`apps/api/src/modules/rates/application/remove-manual-rate.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { DeleteManualRateQuery } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { RateRepository } from './rate-repository.js';

export const removeManualRate =
  (repo: RateRepository) =>
  async (userId: string, q: DeleteManualRateQuery): Promise<Result<void, NotFoundError>> =>
    (await repo.deleteManual(userId, q.base, q.date))
      ? ok(undefined)
      : err(new NotFoundError('manual rate'));
```

In `rates/http/routes.ts` add (import `DeleteManualRateQuerySchema`, `removeManualRate`):

```ts
r.openapi(
  createRoute({
    method: 'delete',
    path: '/rates/manual',
    security: [{ bearer: [] }],
    request: { query: DeleteManualRateQuerySchema },
    responses: {
      204: { description: 'Removed' },
      404: {
        description: 'No override',
        content: { 'application/json': { schema: ErrorDtoSchema } },
      },
      ...errors,
    },
  }),
  async (c) =>
    (await removeManualRate(deps.rates)(c.var.userId, c.req.valid('query'))).match(
      () => c.body(null, 204),
      (e) => {
        const h = toHttpError(e);
        return c.json(h.body, h.status as 404);
      },
    ),
);
```

- [ ] **Step 4: Run unit + integration tests, typecheck, lint**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): allow removing a manual rate override"
```

---

### Task 11: Design system — MoneyInput and the primitives the new screens need

**Files:**

- Create: `packages/ui/src/components/money-input/parse.ts`, `packages/ui/src/components/money-input/MoneyInput.vue`, `packages/ui/src/components/ui/{badge,separator,dropdown-menu,alert-dialog}/**` (via the shadcn-vue CLI)
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/test/money-input.test.ts`

**Interfaces:**

- Produces from `@magermoney/ui`: `MoneyInput` (props `modelValue: string`, `scale: number`, `locale: 'ru' | 'en'`, `allowNegative?: boolean`, plus native attrs; emits `update:modelValue` with a normalised decimal string or `''`), `parseAmountInput(raw, scale, allowNegative): string | null`, `formatAmountInput(decimal, locale): string`, `Badge`, `Separator`, `DropdownMenu*`, `AlertDialog*`.

- [ ] **Step 1: Write the failing tests**

`packages/ui/test/money-input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { formatAmountInput, parseAmountInput } from '../src/components/money-input/parse';
import MoneyInput from '../src/components/money-input/MoneyInput.vue';

describe('parseAmountInput', () => {
  it('accepts locale separators and spaces, never a float', () => {
    expect(parseAmountInput('13 723,27', 2, false)).toBe('13723.27');
    expect(parseAmountInput('13 723.27', 2, false)).toBe('13723.27');
    expect(parseAmountInput('0,33', 8, false)).toBe('0.33');
    expect(parseAmountInput('', 2, false)).toBe('');
  });
  it('rejects junk, two separators, too many decimals, and negatives unless allowed', () => {
    expect(parseAmountInput('1.2.3', 2, false)).toBeNull();
    expect(parseAmountInput('abc', 2, false)).toBeNull();
    expect(parseAmountInput('1.234', 2, false)).toBeNull();
    expect(parseAmountInput('-5', 2, false)).toBeNull();
    expect(parseAmountInput('-5', 2, true)).toBe('-5');
  });
  it('formats for the locale without rounding', () => {
    expect(formatAmountInput('13723.27', 'ru')).toBe('13 723,27');
    expect(formatAmountInput('13723.27', 'en')).toBe('13,723.27');
    expect(formatAmountInput('0.00000001', 'en')).toBe('0.00000001');
  });
});

describe('MoneyInput', () => {
  it('emits the normalised decimal string and keeps invalid input unemitted', async () => {
    const w = mount(MoneyInput, { props: { modelValue: '', scale: 2, locale: 'ru' } });
    const input = w.get('input');
    await input.setValue('1 250,5');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['1250.5']);
    await input.setValue('1,2,3');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['1250.5']);
    expect(input.attributes('aria-invalid')).toBe('true');
  });
  it('uses the decimal keyboard', () => {
    const w = mount(MoneyInput, { props: { modelValue: '', scale: 2, locale: 'en' } });
    expect(w.get('input').attributes('inputmode')).toBe('decimal');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/ui && bun run test`
Expected: FAIL — files missing.

- [ ] **Step 3: Add the shadcn-vue primitives**

Run inside `packages/ui`: `bunx shadcn-vue@latest add badge separator dropdown-menu alert-dialog` (or the equivalent shadcn-vue MCP calls). Then rewrite every `@/lib/utils` import in the generated files to a relative path (`../../../lib/utils`) and `@/components/ui/...` to relative, exactly as the phase 1 components do. Add to `packages/ui/src/index.ts`:

```ts
export * from './components/ui/badge';
export * from './components/ui/separator';
export * from './components/ui/dropdown-menu';
export * from './components/ui/alert-dialog';
export { default as MoneyInput } from './components/money-input/MoneyInput.vue';
export { parseAmountInput, formatAmountInput } from './components/money-input/parse';
```

- [ ] **Step 4: Implement MoneyInput**

`packages/ui/src/components/money-input/parse.ts`:

```ts
/**
 * Text ↔ decimal string for amount fields. No `Number` anywhere: the value the
 * field emits is the exact string the domain's `Money.parse` accepts (ADR 0001).
 */
const SPACES = /[\s  ]/g;

export function parseAmountInput(
  raw: string,
  scale: number,
  allowNegative: boolean,
): string | null {
  const s = raw.replace(SPACES, '').replace(',', '.');
  if (s === '' || s === '-') return '';
  const m = /^(-)?(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const [, sign, int, frac = ''] = m;
  if (sign && !allowNegative) return null;
  if (frac.length > scale) return null;
  const normalisedInt = int!.replace(/^0+(?=\d)/, '');
  const value = frac.length > 0 ? `${normalisedInt}.${frac}` : normalisedInt;
  return sign ? `-${value}` : value;
}

/** Grouped digits with the locale's separators; the fraction is kept as typed, never rounded. */
export function formatAmountInput(decimal: string, locale: 'ru' | 'en'): string {
  if (decimal === '') return '';
  const [intPart, frac] = decimal.replace('-', '').split('.') as [string, string | undefined];
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'ru' ? ' ' : ',');
  const sep = locale === 'ru' ? ',' : '.';
  const sign = decimal.startsWith('-') ? '-' : '';
  return frac === undefined ? `${sign}${grouped}` : `${sign}${grouped}${sep}${frac}`;
}
```

`packages/ui/src/components/money-input/MoneyInput.vue`:

```vue
<script setup lang="ts">
/**
 * An amount field. Shows the number the way the locale writes it, emits the
 * exact decimal string, and never lets a float in between. Invalid text stays
 * in the field, marked invalid, and the last good value stays emitted — so a
 * half-typed number never becomes a wrong balance.
 */
import { ref, watch } from 'vue';
import { cn } from '../../lib/utils';
import { formatAmountInput, parseAmountInput } from './parse';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    scale: number;
    locale: 'ru' | 'en';
    allowNegative?: boolean;
    class?: string;
  }>(),
  { allowNegative: false, class: '' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const text = ref(formatAmountInput(props.modelValue, props.locale));
const invalid = ref(false);

watch(
  () => props.modelValue,
  (v) => {
    if (parseAmountInput(text.value, props.scale, props.allowNegative) !== v)
      text.value = formatAmountInput(v, props.locale);
  },
);

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  text.value = raw;
  const parsed = parseAmountInput(raw, props.scale, props.allowNegative);
  invalid.value = parsed === null;
  if (parsed !== null) emit('update:modelValue', parsed);
}

function onBlur() {
  if (!invalid.value) text.value = formatAmountInput(props.modelValue, props.locale);
}
</script>

<template>
  <input
    :value="text"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    :aria-invalid="invalid ? 'true' : undefined"
    data-slot="money-input"
    :class="
      cn(
        'h-12 w-full rounded-lg border border-border bg-background px-3 font-mono text-2xl tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        props.class,
      )
    "
    @input="onInput"
    @blur="onBlur"
  />
</template>
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `cd packages/ui && bun run test && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add MoneyInput and the badge, separator, menu and dialog primitives"
```

---

### Task 12: Web — accounts module: transport, mappers and composables

**Files:**

- Create: `apps/web/src/modules/accounts/domain/mappers.ts`, `domain/labels.ts`, `infrastructure/accounts-api.ts`, `application/use-accounts.ts`, `application/use-account-mutations.ts`, `application/use-record-balance.ts`, `application/use-account-balances.ts`, `application/use-capital-summary.ts`, `apps/web/src/modules/accounts/index.ts`
- Test: `apps/web/test/accounts-api.test.ts`, `apps/web/test/use-record-balance.test.ts`, `apps/web/test/use-capital-summary.test.ts`

**Interfaces:**

- Consumes: `AccountDto`, `BalanceEntryDto`, inputs (Task 3); `Account`, read models (Tasks 1–2); `useRates`, `useDisplayCurrency` from `@/modules/rates`; `useCurrencies`, `useCurrencyRegistry`, `toCurrency` from `@/modules/currencies`; `useApi`, `parse`, `listOf`.
- Produces (module index): `toAccount(dto, registry)`, `ACCOUNT_KIND_KEYS`, `useAccounts()`, `useAccount(id)`, `useCreateAccount()`, `useUpdateAccount()`, `useArchiveAccount()`, `useDeleteAccount()`, `useRecordBalance()`, `useEditBalance()`, `useDeleteBalance()`, `useAccountBalances(id)`, `useCapitalSummary()`; query keys `['accounts']`, `['accounts', id, 'balances']`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/accounts-api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { accountsApi } from '../src/modules/accounts/infrastructure/accounts-api.js';

const dto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
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
  balance: '10',
  balanceRecordedAt: '2026-09-11T00:00:00.000Z',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('accountsApi', () => {
  it('lists, records a balance, and encodes the cursor', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = accountsApi({
      fetch: async (path, init) => {
        calls.push([path, init]);
        return path.includes('/balances') ? json([]) : json([dto]);
      },
    });
    expect(await api.list()).toEqual([dto]);
    await api.balances(dto.id, `2026-09-11T00:00:00.000Z|${dto.id}`);
    expect(calls[1]?.[0]).toBe(
      `/accounts/${dto.id}/balances?limit=200&before=2026-09-11T00%3A00%3A00.000Z%7C${dto.id}`,
    );
    await api.recordBalance(dto.id, { amount: '12' }).catch(() => undefined);
    expect(calls[2]?.[1]?.method).toBe('POST');
    expect(calls[2]?.[1]?.body).toBe(JSON.stringify({ amount: '12' }));
  });
  it('throws a typed error on a 409', async () => {
    const api = accountsApi({
      fetch: async () => json({ code: 'entry_not_latest', message: 'no' }, 409),
    });
    await expect(api.editBalance('x', { amount: '1' })).rejects.toMatchObject({
      status: 409,
      code: 'entry_not_latest',
    });
  });
});
```

`apps/web/test/use-record-balance.test.ts` (same mounting pattern as `use-profile.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { AccountDto } from '@magermoney/contracts';
import { API_KEY } from '../src/shared/api/use-api.js';
import { useAccounts } from '../src/modules/accounts/application/use-accounts.js';
import { useRecordBalance } from '../src/modules/accounts/application/use-record-balance.js';

const acc: AccountDto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'cash',
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '10',
  balanceRecordedAt: '2026-09-01T00:00:00.000Z',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mountIt(fetchImpl: (path: string, init?: RequestInit) => Promise<Response>) {
  let accounts!: ReturnType<typeof useAccounts>;
  let record!: ReturnType<typeof useRecordBalance>;
  const Probe = defineComponent({
    setup() {
      accounts = useAccounts();
      record = useRecordBalance();
      return () => h('div');
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mount(Probe, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      provide: { [API_KEY as unknown as string]: { fetch: fetchImpl } },
    },
  });
  return { accounts: () => accounts, record: () => record };
}

describe('useRecordBalance', () => {
  it('patches the account balance before the POST answers and rolls back on failure', async () => {
    let fail = false;
    const { accounts, record } = mountIt(async (path, init) => {
      if (init?.method === 'POST')
        return fail
          ? json({ code: 'recorded_in_future', message: 'no' }, 400)
          : json(
              {
                id: 'e',
                accountId: acc.id,
                amount: '99',
                recordedAt: '2026-09-11T00:00:00.000Z',
                origin: 'manual',
                transferId: null,
                note: null,
              },
              201,
            );
      return json([acc]);
    });
    await flushPromises();
    const p = record().record(acc.id, { amount: '99' });
    await flushPromises();
    expect(accounts().accounts.value[0]?.balance).toBe('99');
    await p;
    fail = true;
    await record()
      .record(acc.id, { amount: '5' })
      .catch(() => undefined);
    await flushPromises();
    expect(accounts().accounts.value[0]?.balance).toBe('99');
  });
});
```

`apps/web/test/use-capital-summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';
import { CurrencyRegistry, Decimal, RateTable } from '@magermoney/domain';
import type { AccountDto } from '@magermoney/contracts';
import { summarise } from '../src/modules/accounts/application/use-capital-summary.js';

const reg = CurrencyRegistry.default();
const table = new RateTable(
  '2026-09-11',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.16'), date: '2026-09-11', source: 'api' }],
  reg,
);
const base: AccountDto = {
  id: 'a',
  name: 'A',
  bank: 'B',
  country: 'RU',
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
  balance: '100',
  balanceRecordedAt: null,
};

describe('summarise', () => {
  it('computes totals, payday money and provider groups in the display currency', () => {
    const s = summarise(
      [
        base,
        { ...base, id: 'b', bank: 'C', currency: 'EUR', isSpending: false, balance: '100' },
        { ...base, id: 'c', currency: 'BTC', balance: '1' },
      ],
      table,
      reg,
      'USD',
    );
    expect(s.total.round().toString()).toBe('216');
    expect(s.availableUntilPayday.toString()).toBe('100');
    expect(s.unconvertible.map((a) => a.id)).toEqual(['c']);
    expect(s.groups.map((g) => g.bank)).toEqual(['B', 'C']);
    expect(s.groups[0]?.total.toString()).toBe('100');
  });
  it('is undefined until rates and a display currency exist', () => {
    expect(summarise([base], undefined, reg, 'USD')).toBeUndefined();
    expect(summarise([base], table, reg, 'XXX')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && bun run test`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`apps/web/src/modules/accounts/domain/mappers.ts`:

```ts
import type { AccountDto } from '@magermoney/contracts';
import { Money, type Account, type Currency, type CurrencyRegistry } from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

/** DTO → domain. An unknown currency still gets a Money (scale 2) so the list renders; conversion then reports it as unconvertible. */
export function toAccount(dto: AccountDto, registry: CurrencyRegistry): Account {
  const currency = registry.get(dto.currency).unwrapOr(fallback(dto.currency));
  return {
    id: dto.id,
    name: dto.name,
    bank: dto.bank,
    country: dto.country,
    kind: dto.kind,
    cardType: dto.cardType,
    isSpending: dto.isSpending,
    sortOrder: dto.sortOrder,
    archived: dto.archivedAt !== null,
    balance: dto.balance === null ? Money.zero(currency) : Money.of(dto.balance, currency),
  };
}
```

`apps/web/src/modules/accounts/domain/labels.ts`:

```ts
import type { AccountKind } from '@magermoney/domain';

/** i18n keys for each kind, so a screen never switches on the enum itself. */
export const ACCOUNT_KIND_KEYS: Record<AccountKind, string> = {
  bank_account: 'accounts.kind.bank_account',
  card: 'accounts.kind.card',
  deposit: 'accounts.kind.deposit',
  broker: 'accounts.kind.broker',
  crypto_wallet: 'accounts.kind.crypto_wallet',
  cash: 'accounts.kind.cash',
};
```

`apps/web/src/modules/accounts/infrastructure/accounts-api.ts`:

```ts
import {
  AccountDtoSchema,
  BalanceEntryDtoSchema,
  type AccountDto,
  type BalanceEntryDto,
  type CreateAccountInput,
  type RecordBalanceInput,
  type UpdateAccountInput,
  type UpdateBalanceInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const accountList = listOf(AccountDtoSchema);
const entryList = listOf(BalanceEntryDtoSchema);
/** The whole history in one page; the API pages by cursor if this is ever not enough. */
export const BALANCES_PAGE = 200;
const noContent = { safeParse: (_: unknown) => ({ success: true as const, data: undefined }) };

export const accountsApi = (client: ApiClient) => ({
  list: async (): Promise<AccountDto[]> =>
    parse(await client.fetch('/accounts', { method: 'GET' }), accountList),
  create: async (input: CreateAccountInput): Promise<AccountDto> =>
    parse(
      await client.fetch('/accounts', { method: 'POST', body: JSON.stringify(input) }),
      AccountDtoSchema,
    ),
  update: async (id: string, input: UpdateAccountInput): Promise<AccountDto> =>
    parse(
      await client.fetch(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      AccountDtoSchema,
    ),
  archive: async (id: string, archived: boolean): Promise<AccountDto> =>
    parse(
      await client.fetch(`/accounts/${id}/${archived ? 'archive' : 'unarchive'}`, {
        method: 'POST',
      }),
      AccountDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/accounts/${id}`, { method: 'DELETE' }), noContent),
  balances: async (id: string, before?: string): Promise<BalanceEntryDto[]> => {
    const q = new URLSearchParams({ limit: String(BALANCES_PAGE), ...(before ? { before } : {}) });
    return parse(await client.fetch(`/accounts/${id}/balances?${q}`, { method: 'GET' }), entryList);
  },
  recordBalance: async (id: string, input: RecordBalanceInput): Promise<BalanceEntryDto> =>
    parse(
      await client.fetch(`/accounts/${id}/balances`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
      BalanceEntryDtoSchema,
    ),
  editBalance: async (entryId: string, input: UpdateBalanceInput): Promise<BalanceEntryDto> =>
    parse(
      await client.fetch(`/balances/${entryId}`, { method: 'PATCH', body: JSON.stringify(input) }),
      BalanceEntryDtoSchema,
    ),
  deleteBalance: async (entryId: string): Promise<void> =>
    parse(await client.fetch(`/balances/${entryId}`, { method: 'DELETE' }), noContent),
});
```

Note: `parse` calls `res.json()`; for a 204 the body is empty and `.catch(() => null)` yields `null`, which `noContent` accepts.

`apps/web/src/modules/accounts/application/use-accounts.ts`:

```ts
import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { AccountDto } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { accountsApi } from '../infrastructure/accounts-api';

export const ACCOUNTS_KEY = ['accounts'] as const;
export const balancesKey = (id: string) => ['accounts', id, 'balances'] as const;

/** Every account with its latest balance: one query, one cache entry, one thing to patch optimistically. */
export function useAccounts(): {
  accounts: ComputedRef<AccountDto[]>;
  isLoading: ComputedRef<boolean>;
} {
  const api = accountsApi(useApi());
  const query = useQuery({ queryKey: ACCOUNTS_KEY, queryFn: api.list });
  return {
    accounts: computed(() => query.data.value ?? []),
    isLoading: computed(() => query.isLoading.value),
  };
}

export function useAccount(id: MaybeRefOrGetter<string>): ComputedRef<AccountDto | undefined> {
  const { accounts } = useAccounts();
  return computed(() => accounts.value.find((a) => a.id === toValue(id)));
}
```

`apps/web/src/modules/accounts/application/use-account-mutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { AccountDto, CreateAccountInput, UpdateAccountInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { accountsApi } from '../infrastructure/accounts-api';
import { ACCOUNTS_KEY } from './use-accounts';

const replaceIn = (list: AccountDto[] | undefined, dto: AccountDto) =>
  (list ?? []).map((a) => (a.id === dto.id ? dto : a));

export function useCreateAccount() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.create,
    onSuccess: (dto) =>
      qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) => [...(list ?? []), dto]),
    onSettled: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  return { create: (input: CreateAccountInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateAccount() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) => api.update(id, input),
    onSuccess: (dto) => qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) => replaceIn(list, dto)),
    onSettled: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  return {
    update: (id: string, input: UpdateAccountInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useArchiveAccount() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => api.archive(id, archived),
    onSuccess: (dto) => qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) => replaceIn(list, dto)),
    onSettled: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  return {
    setArchived: (id: string, archived: boolean) => m.mutateAsync({ id, archived }),
    isPending: m.isPending,
  };
}

export function useDeleteAccount() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.remove,
    onSuccess: (_v, id) =>
      qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
        (list ?? []).filter((a) => a.id !== id),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
```

`apps/web/src/modules/accounts/application/use-record-balance.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { AccountDto, RecordBalanceInput, UpdateBalanceInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { accountsApi } from '../infrastructure/accounts-api';
import { ACCOUNTS_KEY, balancesKey } from './use-accounts';

/**
 * Recording a balance is the most frequent thing a person does here, so the
 * new number is shown before the POST answers and taken back if it fails.
 * A backdated entry does not touch the shown balance: the server decides
 * what is current, and the refetch after settle agrees with it.
 */
export function useRecordBalance() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecordBalanceInput }) =>
      api.recordBalance(id, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: ACCOUNTS_KEY });
      const prev = qc.getQueryData<AccountDto[]>(ACCOUNTS_KEY);
      const recordedAt = input.recordedAt ?? new Date().toISOString();
      qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
        (list ?? []).map((a) =>
          a.id === id && (a.balanceRecordedAt === null || recordedAt >= a.balanceRecordedAt)
            ? { ...a, balance: input.amount, balanceRecordedAt: recordedAt }
            : a,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ACCOUNTS_KEY, ctx.prev);
    },
    onSettled: (_d, _e, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
        qc.invalidateQueries({ queryKey: balancesKey(id) }),
      ]),
  });
  return {
    record: (id: string, input: RecordBalanceInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useEditBalance() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({
      entryId,
      input,
    }: {
      entryId: string;
      accountId: string;
      input: UpdateBalanceInput;
    }) => api.editBalance(entryId, input),
    onSettled: (_d, _e, { accountId }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
        qc.invalidateQueries({ queryKey: balancesKey(accountId) }),
      ]),
  });
  return {
    edit: (accountId: string, entryId: string, input: UpdateBalanceInput) =>
      m.mutateAsync({ accountId, entryId, input }),
    isPending: m.isPending,
  };
}

export function useDeleteBalance() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ entryId }: { entryId: string; accountId: string }) => api.deleteBalance(entryId),
    onSettled: (_d, _e, { accountId }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
        qc.invalidateQueries({ queryKey: balancesKey(accountId) }),
      ]),
  });
  return {
    remove: (accountId: string, entryId: string) => m.mutateAsync({ accountId, entryId }),
    isPending: m.isPending,
  };
}
```

`apps/web/src/modules/accounts/application/use-account-balances.ts`:

```ts
import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { BalanceEntryDto } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { accountsApi } from '../infrastructure/accounts-api';
import { balancesKey } from './use-accounts';

/** The account's journal, newest first. */
export function useAccountBalances(id: MaybeRefOrGetter<string>): {
  entries: ComputedRef<BalanceEntryDto[]>;
  isLoading: ComputedRef<boolean>;
} {
  const api = accountsApi(useApi());
  const query = useQuery({
    queryKey: computed(() => balancesKey(toValue(id))),
    queryFn: () => api.balances(toValue(id)),
  });
  return {
    entries: computed(() => query.data.value ?? []),
    isLoading: computed(() => query.isLoading.value),
  };
}
```

`apps/web/src/modules/accounts/application/use-capital-summary.ts`:

```ts
import { computed, type ComputedRef } from 'vue';
import type { AccountDto } from '@magermoney/contracts';
import {
  availableUntilPayday,
  groupByProvider,
  totalCapital,
  type Account,
  type CurrencyRegistry,
  type Money,
  type RateTable,
} from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useDisplayCurrency, useRates } from '@/modules/rates';
import { toAccount } from '../domain/mappers';
import { useAccounts } from './use-accounts';

export interface GroupSummary {
  bank: string;
  country: string;
  accounts: Account[];
  total: Money;
  unconvertible: Account[];
}
export interface CapitalSummary {
  total: Money;
  availableUntilPayday: Money;
  unconvertible: Account[];
  groups: GroupSummary[];
  archived: Account[];
}

/** Pure: the whole home screen from DTOs, a rate table and a display currency. Undefined while any input is missing. */
export function summarise(
  dtos: readonly AccountDto[],
  table: RateTable | undefined,
  registry: CurrencyRegistry,
  display: string,
): CapitalSummary | undefined {
  const currency = registry.get(display);
  if (!table || currency.isErr()) return undefined;
  const accounts = dtos.map((d) => toAccount(d, registry));
  const total = totalCapital(accounts, table, currency.value);
  const payday = availableUntilPayday(accounts, table, currency.value);
  const groups = groupByProvider(accounts).map((g) => {
    const t = totalCapital(g.accounts, table, currency.value);
    return { ...g, total: t.total, unconvertible: t.unconvertible };
  });
  return {
    total: total.total,
    availableUntilPayday: payday.total,
    unconvertible: total.unconvertible,
    groups,
    archived: accounts.filter((a) => a.archived),
  };
}

export function useCapitalSummary(): {
  summary: ComputedRef<CapitalSummary | undefined>;
  isLoading: ComputedRef<boolean>;
  rateDate: ComputedRef<string>;
} {
  const { accounts, isLoading } = useAccounts();
  const rates = useRates();
  const registry = useCurrencyRegistry();
  const { current } = useDisplayCurrency();
  return {
    summary: computed(() =>
      summarise(accounts.value, rates.table.value, registry.value, current.value),
    ),
    isLoading: computed(() => isLoading.value || rates.isLoading.value),
    rateDate: rates.date,
  };
}
```

`apps/web/src/modules/accounts/index.ts`:

```ts
/** Public API of the accounts module: the list, the journal, and the home screen built from them. */
export { toAccount } from './domain/mappers';
export { ACCOUNT_KIND_KEYS } from './domain/labels';
export { useAccounts, useAccount, ACCOUNTS_KEY } from './application/use-accounts';
export {
  useCreateAccount,
  useUpdateAccount,
  useArchiveAccount,
  useDeleteAccount,
} from './application/use-account-mutations';
export {
  useRecordBalance,
  useEditBalance,
  useDeleteBalance,
} from './application/use-record-balance';
export { useAccountBalances } from './application/use-account-balances';
export {
  useCapitalSummary,
  summarise,
  type CapitalSummary,
  type GroupSummary,
} from './application/use-capital-summary';
```

(Screens are exported from this index in Tasks 13–14.)

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `cd apps/web && bun run test && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): add the accounts module data layer"
```

---

### Task 13: Web — the home screen: accounts list, shell tabs, routes, copy

**Files:**

- Create: `apps/web/src/modules/accounts/ui/AccountsPage.vue`, `ui/ProviderGroup.vue`, `ui/AccountRow.vue`
- Modify: `apps/web/src/modules/accounts/index.ts`, `apps/web/src/app/router.ts`, `apps/web/src/shared/layout/AppShell.vue`, `apps/web/src/locales/ru.json`, `apps/web/src/locales/en.json`, `apps/web/e2e/smoke.spec.ts` (test ids only), `apps/web/test/shell.test.ts`
- Delete: `apps/web/src/modules/rates/ui/HomePage.vue` (and its export in `modules/rates/index.ts`)
- Test: `apps/web/test/AccountsPage.test.ts`

**Interfaces:**

- Consumes: `useCapitalSummary`, `MoneyText` (from `@/modules/rates`), `CurrencyIcon`, `listStagger`, `ACCOUNT_KIND_KEYS`.
- Produces: `AccountsPage` at `/` (test ids `capital-total`, `capital-payday`, `account-row-<id>`, `accounts-add`), `AppShell` nav with three tabs and a `#fab` slot; i18n namespaces `nav`, `accounts`.

- [ ] **Step 1: Design pass**

Run `/frontend-design` for the home screen with this brief: warm-paper neutrals and the amount lockup from `docs/design/direction.md`; top block = "Всего денег" as the one large number (MoneyText at 40px) with the rate date beneath, then a quieter "Доступно до зарплаты" row; provider groups as hairline-separated sections with a small provider header (country flag via `CurrencyIcon` of the account's currency is wrong here, use the group's first account `CurrencyIcon` only for crypto/cash and a plain text header otherwise) and account rows: name + kind label on the left, own-currency balance right-aligned in tabular figures with the display-currency conversion in 12px muted beneath. Archived accounts behind a disclosure at the bottom. No cards inside cards. The implementation below is the structure and the test ids; the design pass may refine classes but keeps every `data-testid`.

- [ ] **Step 2: Write the failing tests**

`apps/web/test/AccountsPage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import AccountsPage from '../src/modules/accounts/ui/AccountsPage.vue';

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
const rates = [{ base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api' }];
const acc = (id: string, over: object) => ({
  id,
  name: id,
  bank: 'Bank',
  country: 'RU',
  currency: 'USD',
  kind: 'cash',
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '100',
  balanceRecordedAt: null,
  ...over,
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('AccountsPage', () => {
  it('shows the total, the payday amount and one row per active account', async () => {
    resetDisplayCurrency();
    const fetch = vi.fn(async (path: string) => {
      if (path === '/me') return json(profile);
      if (path === '/currencies') return json(currencies);
      if (path.startsWith('/rates')) return json(rates);
      return json([
        acc('a', { isSpending: true }),
        acc('b', { currency: 'EUR', bank: 'Other' }),
        acc('old', { archivedAt: '2026-01-01T00:00:00.000Z' }),
      ]);
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: AccountsPage },
        { path: '/accounts/:id', component: { template: '<div />' } },
      ],
    });
    const w = mount(AccountsPage, {
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
    await flushPromises();
    expect(w.get('[data-testid="capital-total"]').text()).toContain('216');
    expect(w.get('[data-testid="capital-payday"]').text()).toContain('100');
    expect(w.findAll('[data-testid^="account-row-"]')).toHaveLength(2);
    expect(w.text()).toContain('Other');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/web && bun run test`
Expected: FAIL — `AccountsPage.vue` missing.

- [ ] **Step 4: Add copy (both locales)**

Add to `ru.json` (and the EN draft to `en.json` with the same keys; run `/humanize-text:humanize-text` over both):

```json
"nav": { "accounts": "Счета", "rates": "Курсы", "settings": "Настройки" },
"accounts": {
  "title": "Счета",
  "total": "Всего денег",
  "payday": "Доступно до зарплаты",
  "rateDate": "Курсы на {date}",
  "unconvertible": "Без курса: {codes}. Эти счета не вошли в сумму.",
  "empty": { "title": "Пока ни одного счёта", "body": "Добавьте первый счёт: банк, валюту и текущий остаток.", "cta": "Добавить счёт" },
  "add": "Добавить счёт",
  "archived": { "show": "Архив ({n})", "hide": "Скрыть архив" },
  "noBalance": "Остаток не указан",
  "kind": { "bank_account": "Счёт", "card": "Карта", "deposit": "Вклад", "broker": "Брокер", "crypto_wallet": "Кошелёк", "cash": "Наличные" },
  "cardType": { "debit": "дебетовая", "credit": "кредитная" },
  "spending": "Расходный"
}
```

Remove the `home` namespace and the `nav.home` key from both locale files (the placeholder home is gone). Keep the existing `nav.settings` value.

- [ ] **Step 5: Implement the screen**

`apps/web/src/modules/accounts/ui/AccountRow.vue`:

```vue
<script setup lang="ts">
/** One account: what it is on the left, what it holds on the right, in its own currency first. */
import { useI18n } from 'vue-i18n';
import type { Account } from '@magermoney/domain';
import { CurrencyIcon } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';

const { account } = defineProps<{ account: Account }>();
const { t } = useI18n();
</script>

<template>
  <RouterLink
    :to="`/accounts/${account.id}`"
    :data-testid="`account-row-${account.id}`"
    class="flex min-h-14 items-center gap-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
  >
    <CurrencyIcon
      :code="account.balance.currency.code"
      :kind="account.balance.currency.kind"
      :size="28"
    />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-[15px]">{{ account.name }}</span>
      <span class="block text-xs text-muted-foreground">
        {{ t(ACCOUNT_KIND_KEYS[account.kind])
        }}<template v-if="account.cardType">
          · {{ t(`accounts.cardType.${account.cardType}`) }}</template
        ><template v-if="account.isSpending"> · {{ t('accounts.spending') }}</template>
      </span>
    </span>
    <span class="text-right">
      <span class="block font-mono text-[15px] tabular-nums"
        >{{ account.balance.round().toString() }} {{ account.balance.currency.code }}</span
      >
      <MoneyText
        class="text-xs text-muted-foreground"
        :amount="account.balance.toString()"
        :currency="account.balance.currency.code"
      />
    </span>
  </RouterLink>
</template>
```

`apps/web/src/modules/accounts/ui/ProviderGroup.vue`:

```vue
<script setup lang="ts">
/** A provider and its accounts: a quiet header with the group total, then the rows. */
import { Motion } from 'motion-v';
import { listStagger } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import type { GroupSummary } from '../application/use-capital-summary';
import AccountRow from './AccountRow.vue';

const { group, index } = defineProps<{ group: GroupSummary; index: number }>();
</script>

<template>
  <Motion tag="section" v-bind="listStagger(index)" class="border-t border-border pt-3">
    <header class="flex items-baseline justify-between">
      <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ group.bank }}
      </h2>
      <MoneyText
        class="text-sm"
        :amount="group.total.toString()"
        :currency="group.total.currency.code"
      />
    </header>
    <ul class="divide-y divide-border/60">
      <li v-for="a in group.accounts" :key="a.id"><AccountRow :account="a" /></li>
    </ul>
  </Motion>
</template>
```

`apps/web/src/modules/accounts/ui/AccountsPage.vue`:

```vue
<script setup lang="ts">
/**
 * Home. The one number that matters, the one that matters until payday, and
 * where all of it is. Everything on this screen is derived on the client from
 * the account list and the day's rates (ADR 0003).
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, Skeleton } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import { useCapitalSummary } from '../application/use-capital-summary';
import AccountRow from './AccountRow.vue';
import ProviderGroup from './ProviderGroup.vue';

const { t } = useI18n();
const { summary, isLoading, rateDate } = useCapitalSummary();
const showArchived = ref(false);
const unconvertibleCodes = computed(() =>
  [...new Set(summary.value?.unconvertible.map((a) => a.balance.currency.code))].join(', '),
);
const isEmpty = computed(
  () =>
    !isLoading.value &&
    summary.value !== undefined &&
    summary.value.groups.length === 0 &&
    summary.value.archived.length === 0,
);
</script>

<template>
  <section class="pb-8">
    <h1 class="sr-only">{{ t('accounts.title') }}</h1>

    <div class="pt-2">
      <p class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('accounts.total') }}
      </p>
      <Skeleton v-if="!summary" class="mt-2 h-10 w-48" />
      <MoneyText
        v-else
        data-testid="capital-total"
        class="mt-1 text-[40px]"
        :amount="summary.total.toString()"
        :currency="summary.total.currency.code"
      />
      <p class="mt-1 text-xs text-muted-foreground">
        {{ t('accounts.rateDate', { date: rateDate }) }}
      </p>
    </div>

    <div class="mt-5 flex items-baseline justify-between border-t border-border pt-3">
      <span class="text-sm text-muted-foreground">{{ t('accounts.payday') }}</span>
      <Skeleton v-if="!summary" class="h-5 w-24" />
      <MoneyText
        v-else
        data-testid="capital-payday"
        class="text-base"
        :amount="summary.availableUntilPayday.toString()"
        :currency="summary.availableUntilPayday.currency.code"
      />
    </div>

    <p
      v-if="summary && summary.unconvertible.length > 0"
      class="mt-3 text-xs text-muted-foreground"
    >
      {{ t('accounts.unconvertible', { codes: unconvertibleCodes }) }}
    </p>

    <div v-if="isEmpty" class="mt-10 text-center">
      <p class="text-lg font-semibold">{{ t('accounts.empty.title') }}</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('accounts.empty.body') }}</p>
      <Button class="mt-4" data-testid="accounts-add" @click="$router.push('/accounts/new')">{{
        t('accounts.empty.cta')
      }}</Button>
    </div>

    <div v-else class="mt-6 space-y-6">
      <ProviderGroup v-for="(g, i) in summary?.groups ?? []" :key="g.bank" :group="g" :index="i" />
    </div>

    <div v-if="summary && summary.archived.length > 0" class="mt-8">
      <Button variant="ghost" size="sm" @click="showArchived = !showArchived">
        {{
          showArchived
            ? t('accounts.archived.hide')
            : t('accounts.archived.show', { n: summary.archived.length })
        }}
      </Button>
      <ul v-if="showArchived" class="mt-2 divide-y divide-border/60 opacity-70">
        <li v-for="a in summary.archived" :key="a.id"><AccountRow :account="a" /></li>
      </ul>
    </div>
  </section>
</template>
```

Export it: add `export { default as AccountsPage } from './ui/AccountsPage.vue';` to `modules/accounts/index.ts`. Delete `modules/rates/ui/HomePage.vue` and its export line; remove the `home` keys' usages (`MoneyText.test.ts` and `CurrencySwitch.test.ts` do not use HomePage; `shell.test.ts` checks nav labels — update it to expect three links).

- [ ] **Step 6: Routes and shell**

`apps/web/src/app/router.ts`: replace the `home` route with

```ts
  { path: '/', name: 'accounts', component: () => import('@/modules/accounts').then((m) => m.AccountsPage) },
  { path: '/accounts/new', name: 'account-new', component: () => import('@/modules/accounts').then((m) => m.AccountFormPage) },
  { path: '/accounts/:id', name: 'account', component: () => import('@/modules/accounts').then((m) => m.AccountDetailPage) },
  { path: '/accounts/:id/edit', name: 'account-edit', component: () => import('@/modules/accounts').then((m) => m.AccountFormPage) },
  { path: '/transfers', name: 'transfers', component: () => import('@/modules/transfers').then((m) => m.TransfersPage) },
  { path: '/rates', name: 'rates', component: () => import('@/modules/rates').then((m) => m.RatesPage) },
```

(`AccountFormPage`, `AccountDetailPage` arrive in Task 14, `TransfersPage` in 15, `RatesPage` in 16; until then export placeholder components `defineComponent({ template: '<div />' })`-style from each index so typecheck stays green — Task 14/15/16 replace them.)

`AppShell.vue`: change `NAV` to

```ts
const NAV = [
  { to: '/', label: 'nav.accounts' },
  { to: '/rates', label: 'nav.rates' },
  { to: '/settings', label: 'nav.settings' },
] as const;
```

and add a floating-action slot just before the bottom `<nav>`:

```vue
<div
  class="fixed bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] right-4 z-20 md:bottom-8 md:right-[max(1rem,calc(50%-24rem))]"
>
      <slot name="fab" />
    </div>
```

Update `apps/web/test/shell.test.ts` to expect the three labels (`Счета`, `Курсы`, `Настройки`). In `e2e/smoke.spec.ts` replace the `home-greeting`/`sample-amount` expectations with `capital-total` (Task 19 rewrites the scenario fully; here only keep it compiling).

- [ ] **Step 7: Polish and verify**

Run `/impeccable` on the three new components. Then: `cd apps/web && bun run test && bun run typecheck && bun run lint`.
Expected: PASS (including `locales.test.ts` key parity).

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): make the accounts list the home screen"
```

---

### Task 14: Web — account detail, account form, balance sheet and timeline

**Files:**

- Create: `apps/web/src/modules/accounts/ui/AccountDetailPage.vue`, `ui/AccountFormPage.vue`, `ui/RecordBalanceSheet.vue`, `ui/BalanceTimeline.vue`, `apps/web/src/shared/dates/format.ts`
- Modify: `apps/web/src/modules/accounts/index.ts`, `apps/web/src/locales/{ru,en}.json`
- Test: `apps/web/test/RecordBalanceSheet.test.ts`, `apps/web/test/date-format.test.ts`

**Ruling (deviation from spec §5):** create/edit is a routed page (`/accounts/new`, `/accounts/:id/edit`) rather than a sheet: a 12-field form on a phone needs the whole screen and the back gesture; the quick actions (record balance, transfer) stay sheets. Record this in the execution ledger.

**Interfaces:**

- Consumes: Task 12 composables, `MoneyInput`, `Sheet*`, `AlertDialog*`, `DropdownMenu*`, `Badge`, `useToast`, `ApiError`.
- Produces: `AccountDetailPage`, `AccountFormPage`, `RecordBalanceSheet` (props `accountId: string`, `entry?: BalanceEntryDto`, `open: boolean`; emits `update:open`), `formatDateTime(iso, locale)`, `formatDate(iso, locale)`.

- [ ] **Step 1: Design pass**

Run `/frontend-design` for the detail screen and the form: detail = name as title, kind/bank/country line, big own-currency balance with display conversion under it, actions row (Record balance · Transfer) as two equal buttons, then a "Details" block (card network · tier · last 4 · expires, note as rendered plain text with line breaks) and the timeline (date, amount, delta to the previous entry in muted text, origin badge for transfers). Form = grouped fields: identity (name, provider, country, currency, kind), flags (spending, card type when card), card block (appears when kind = card), note, opening balance (create only). Keep every `data-testid` below.

- [ ] **Step 2: Write the failing tests**

`apps/web/test/date-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from '../src/shared/dates/format.js';

describe('date formatting', () => {
  it('prints dates for the locale', () => {
    expect(formatDate('2026-09-11T12:00:00.000Z', 'ru')).toMatch(/11\.09\.2026/);
    expect(formatDate('2026-09-11T12:00:00.000Z', 'en')).toMatch(/Sep 11, 2026/);
    expect(formatDateTime('2026-09-11T12:00:00.000Z', 'en')).toMatch(/2026/);
  });
});
```

`apps/web/test/RecordBalanceSheet.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import RecordBalanceSheet from '../src/modules/accounts/ui/RecordBalanceSheet.vue';

const acc = {
  id: 'a',
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'cash',
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '10',
  balanceRecordedAt: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('RecordBalanceSheet', () => {
  it('posts the parsed amount for the account and closes', async () => {
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/currencies')
        return json([
          {
            code: 'RUB',
            kind: 'fiat',
            scale: 2,
            symbol: null,
            nameRu: null,
            nameEn: null,
            icon: null,
          },
        ]);
      if (init?.method === 'POST')
        return json(
          {
            id: 'e',
            accountId: 'a',
            amount: '1250.5',
            recordedAt: '2026-09-11T00:00:00.000Z',
            origin: 'manual',
            transferId: null,
            note: null,
          },
          201,
        );
      return json([acc]);
    });
    const w = mount(RecordBalanceSheet, {
      props: { accountId: 'a', open: true },
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
        ],
        provide: { [API_KEY as unknown as string]: { fetch } },
        stubs: { Teleport: true },
      },
      attachTo: document.body,
    });
    await flushPromises();
    await w.get('[data-testid="balance-amount"]').setValue('1 250,5');
    await w.get('form').trigger('submit');
    await flushPromises();
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/accounts/a/balances');
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({ amount: '1250.5' });
    expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd apps/web && bun run test`
Expected: FAIL — modules missing.

- [ ] **Step 4: Add copy**

Add to both locale files under `accounts` (EN drafted alongside):

```json
"detail": { "recordBalance": "Обновить остаток", "transfer": "Перевод", "transfers": "Переводы", "edit": "Изменить", "archive": "В архив", "unarchive": "Вернуть из архива", "delete": "Удалить", "deleteTitle": "Удалить счёт?", "deleteBody": "История остатков удалится вместе с ним. Если по счёту были переводы, удалить нельзя, только архивировать.", "deleteConfirm": "Удалить", "cancel": "Отмена", "details": "Детали", "card": "{network} {tier} · {last4}", "expires": "до {date}", "note": "Заметка", "history": "История остатков", "noHistory": "Остатков ещё нет", "sinceLast": "к предыдущему", "byTransfer": "перевод", "recordedAt": "Дата", "hasTransfers": "Есть переводы, удаление недоступно" },
"form": { "createTitle": "Новый счёт", "editTitle": "Изменить счёт", "name": "Название", "bank": "Банк или провайдер", "country": "Страна (код)", "currency": "Валюта", "currencyLocked": "Валюту нельзя менять: уже есть остатки", "kind": "Тип", "spending": "Расходный: считается доступным до зарплаты", "cardType": "Тип карты", "cardNetwork": "Платёжная система", "cardTier": "Уровень", "cardLast4": "Последние 4 цифры", "cardExpires": "Срок действия", "note": "Заметка", "openingBalance": "Текущий остаток", "save": "Сохранить", "create": "Создать", "saveFailed": "Не удалось сохранить. Попробуйте ещё раз." },
"balance": { "title": "Обновить остаток", "editTitle": "Изменить запись", "amount": "Сколько сейчас на счёте", "recordedAt": "Когда", "note": "Заметка", "save": "Записать", "delete": "Удалить запись", "notLatest": "Изменить можно только последнюю запись. Добавьте новую с верной суммой.", "failed": "Не удалось записать. Попробуйте ещё раз." }
```

- [ ] **Step 5: Implement the helpers and components**

`apps/web/src/shared/dates/format.ts`:

```ts
export type DateLocale = 'ru' | 'en';
const intl = (l: DateLocale) => (l === 'ru' ? 'ru-RU' : 'en-US');
export const formatDate = (iso: string, locale: DateLocale): string =>
  new Intl.DateTimeFormat(intl(locale), { dateStyle: 'medium' }).format(new Date(iso));
export const formatDateTime = (iso: string, locale: DateLocale): string =>
  new Intl.DateTimeFormat(intl(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
/** `datetime-local` wants local time without the zone. */
export const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (local: string): string => new Date(local).toISOString();
```

`apps/web/src/modules/accounts/ui/RecordBalanceSheet.vue`:

```vue
<script setup lang="ts">
/**
 * "How much is on it now." One big field, a date that defaults to now, an
 * optional note. Editing the latest entry reuses the same sheet.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BalanceEntryDto } from '@magermoney/contracts';
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
import { useCurrencies } from '@/modules/currencies';
import { ApiError } from '@/shared/api/client';
import { fromLocalInput, toLocalInput } from '@/shared/dates/format';
import { useAccount } from '../application/use-accounts';
import {
  useDeleteBalance,
  useEditBalance,
  useRecordBalance,
} from '../application/use-record-balance';

const props = defineProps<{ accountId: string; open: boolean; entry?: BalanceEntryDto }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const { t, locale } = useI18n();
const { toast } = useToast();
const account = useAccount(() => props.accountId);
const currencies = useCurrencies();
const scale = computed(
  () => currencies.value.find((c) => c.code === account.value?.currency)?.scale ?? 2,
);
const allowNegative = computed(
  () => account.value?.kind === 'card' && account.value.cardType === 'credit',
);

const amount = ref('');
const recordedAt = ref(toLocalInput(new Date().toISOString()));
const note = ref('');
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    amount.value = props.entry?.amount ?? '';
    recordedAt.value = toLocalInput(props.entry?.recordedAt ?? new Date().toISOString());
    note.value = props.entry?.note ?? '';
  },
);

const { record, isPending: recording } = useRecordBalance();
const { edit, isPending: editing } = useEditBalance();
const { remove } = useDeleteBalance();
const busy = computed(() => recording.value || editing.value);

async function submit() {
  if (amount.value === '') return;
  const input = {
    amount: amount.value,
    recordedAt: fromLocalInput(recordedAt.value),
    note: note.value.trim() || null,
  };
  try {
    if (props.entry) await edit(props.accountId, props.entry.id, input);
    else await record(props.accountId, input);
    emit('update:open', false);
  } catch (e) {
    toast(
      e instanceof ApiError && e.status === 409
        ? t('accounts.balance.notLatest')
        : t('accounts.balance.failed'),
    );
  }
}
async function del() {
  if (!props.entry) return;
  try {
    await remove(props.accountId, props.entry.id);
    emit('update:open', false);
  } catch {
    toast(t('accounts.balance.notLatest'));
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SheetHeader
        ><SheetTitle>{{
          entry ? t('accounts.balance.editTitle') : t('accounts.balance.title')
        }}</SheetTitle></SheetHeader
      >
      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs text-muted-foreground"
            >{{ t('accounts.balance.amount') }} · {{ account?.currency }}</span
          >
          <MoneyInput
            v-model="amount"
            data-testid="balance-amount"
            :scale="scale"
            :locale="locale as 'ru' | 'en'"
            :allow-negative="allowNegative"
            class="mt-1"
            autofocus
          />
        </label>
        <label class="block">
          <span class="text-xs text-muted-foreground">{{ t('accounts.balance.recordedAt') }}</span>
          <Input v-model="recordedAt" type="datetime-local" class="mt-1" />
        </label>
        <label class="block">
          <span class="text-xs text-muted-foreground">{{ t('accounts.balance.note') }}</span>
          <Input v-model="note" class="mt-1" />
        </label>
        <div class="flex gap-2">
          <Button
            type="submit"
            size="lg"
            class="flex-1"
            :disabled="busy || amount === ''"
            data-testid="balance-save"
            >{{ t('accounts.balance.save') }}</Button
          >
          <Button v-if="entry" type="button" size="lg" variant="destructive" @click="del">{{
            t('accounts.balance.delete')
          }}</Button>
        </div>
      </form>
    </SheetContent>
  </Sheet>
</template>
```

`apps/web/src/modules/accounts/ui/BalanceTimeline.vue`:

```vue
<script setup lang="ts">
/** The journal, newest first, each row with how much it moved since the entry before it. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BalanceEntryDto } from '@magermoney/contracts';
import { Decimal } from '@magermoney/domain';
import { Badge } from '@magermoney/ui';
import { formatDateTime } from '@/shared/dates/format';

const { entries, currency } = defineProps<{
  entries: BalanceEntryDto[];
  currency: string;
  editableId: string | null;
}>();
const emit = defineEmits<{ edit: [entry: BalanceEntryDto] }>();
const { t, locale } = useI18n();

const rows = computed(() =>
  entries.map((e, i) => {
    const prev = entries[i + 1];
    const delta = prev ? new Decimal(e.amount).minus(prev.amount) : null;
    return {
      e,
      delta: delta && !delta.isZero() ? `${delta.isPositive() ? '+' : ''}${delta.toFixed()}` : null,
    };
  }),
);
</script>

<template>
  <ul class="divide-y divide-border/60">
    <li v-for="{ e, delta } in rows" :key="e.id">
      <button
        type="button"
        class="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
        :disabled="e.id !== editableId"
        :data-testid="`balance-entry-${e.id}`"
        @click="emit('edit', e)"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-sm">{{
            formatDateTime(e.recordedAt, locale as 'ru' | 'en')
          }}</span>
          <span v-if="e.note" class="block truncate text-xs text-muted-foreground">{{
            e.note
          }}</span>
        </span>
        <Badge v-if="e.origin === 'transfer'" variant="secondary">{{
          t('accounts.detail.byTransfer')
        }}</Badge>
        <span class="text-right">
          <span class="block font-mono text-[15px] tabular-nums"
            >{{ e.amount }} {{ currency }}</span
          >
          <span v-if="delta" class="block text-xs text-muted-foreground"
            >{{ delta }} {{ t('accounts.detail.sinceLast') }}</span
          >
        </span>
      </button>
    </li>
  </ul>
</template>
```

`apps/web/src/modules/accounts/ui/AccountDetailPage.vue`:

```vue
<script setup lang="ts">
/** One account: what it holds, what it is, and everything it ever held. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { BalanceEntryDto } from '@magermoney/contracts';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  useToast,
} from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import { TransferSheet } from '@/modules/transfers';
import { ApiError } from '@/shared/api/client';
import { formatDate } from '@/shared/dates/format';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';
import { useAccount } from '../application/use-accounts';
import { useAccountBalances } from '../application/use-account-balances';
import { useArchiveAccount, useDeleteAccount } from '../application/use-account-mutations';
import BalanceTimeline from './BalanceTimeline.vue';
import RecordBalanceSheet from './RecordBalanceSheet.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const id = computed(() => String(route.params.id));
const account = useAccount(id);
const { entries, isLoading } = useAccountBalances(id);
const { setArchived } = useArchiveAccount();
const { remove } = useDeleteAccount();

const balanceOpen = ref(false);
const transferOpen = ref(false);
const editing = ref<BalanceEntryDto | undefined>();
const confirmDelete = ref(false);
const latestManualId = computed(() =>
  entries.value[0]?.origin === 'manual' ? entries.value[0].id : null,
);

function openRecord(entry?: BalanceEntryDto) {
  editing.value = entry;
  balanceOpen.value = true;
}
async function archive() {
  if (!account.value) return;
  await setArchived(account.value.id, account.value.archivedAt === null);
}
async function del() {
  if (!account.value) return;
  try {
    await remove(account.value.id);
    await router.replace('/');
  } catch (e) {
    toast(
      e instanceof ApiError && e.status === 409
        ? t('accounts.detail.hasTransfers')
        : t('accounts.form.saveFailed'),
    );
  }
}
</script>

<template>
  <section v-if="account" class="pb-8">
    <header class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-2xl font-semibold tracking-[-0.01em]" data-testid="account-name">
          {{ account.name }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t(ACCOUNT_KIND_KEYS[account.kind]) }} · {{ account.bank }} · {{ account.country }}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child
          ><Button
            variant="ghost"
            size="icon"
            :aria-label="t('accounts.detail.edit')"
            data-testid="account-menu"
            >⋯</Button
          ></DropdownMenuTrigger
        >
        <DropdownMenuContent align="end">
          <DropdownMenuItem @select="router.push(`/accounts/${account.id}/edit`)">{{
            t('accounts.detail.edit')
          }}</DropdownMenuItem>
          <DropdownMenuItem @select="archive">{{
            account.archivedAt ? t('accounts.detail.unarchive') : t('accounts.detail.archive')
          }}</DropdownMenuItem>
          <DropdownMenuItem
            @select="router.push({ path: '/transfers', query: { accountId: account.id } })"
            >{{ t('accounts.detail.transfers') }}</DropdownMenuItem
          >
          <DropdownMenuItem class="text-destructive" @select="confirmDelete = true">{{
            t('accounts.detail.delete')
          }}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <div class="mt-6">
      <p class="font-mono text-[32px] tabular-nums" data-testid="account-balance">
        {{ account.balance ?? '—' }} {{ account.currency }}
      </p>
      <MoneyText
        v-if="account.balance"
        class="text-sm text-muted-foreground"
        :amount="account.balance"
        :currency="account.currency"
      />
      <p v-else class="text-sm text-muted-foreground">{{ t('accounts.noBalance') }}</p>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-2">
      <Button size="lg" data-testid="account-record" @click="openRecord()">{{
        t('accounts.detail.recordBalance')
      }}</Button>
      <Button
        size="lg"
        variant="outline"
        data-testid="account-transfer"
        @click="transferOpen = true"
        >{{ t('accounts.detail.transfer') }}</Button
      >
    </div>

    <section v-if="account.kind === 'card' || account.note" class="mt-8">
      <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('accounts.detail.details') }}
      </h2>
      <p v-if="account.kind === 'card'" class="mt-2 text-sm">
        {{
          t('accounts.detail.card', {
            network: account.cardNetwork ?? '',
            tier: account.cardTier ?? '',
            last4: account.cardLast4 ? `•••• ${account.cardLast4}` : '',
          })
        }}
        <span v-if="account.cardExpires" class="text-muted-foreground">
          ·
          {{
            t('accounts.detail.expires', {
              date: formatDate(account.cardExpires, locale as 'ru' | 'en'),
            })
          }}</span
        >
      </p>
      <pre
        v-if="account.note"
        class="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground"
        >{{ account.note }}</pre>
    </section>

    <section class="mt-8">
      <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('accounts.detail.history') }}
      </h2>
      <Skeleton v-if="isLoading" class="mt-3 h-12 w-full" />
      <p v-else-if="entries.length === 0" class="mt-3 text-sm text-muted-foreground">
        {{ t('accounts.detail.noHistory') }}
      </p>
      <BalanceTimeline
        v-else
        class="mt-2"
        :entries="entries"
        :currency="account.currency"
        :editable-id="latestManualId"
        @edit="openRecord"
      />
    </section>

    <RecordBalanceSheet v-model:open="balanceOpen" :account-id="account.id" :entry="editing" />
    <TransferSheet v-model:open="transferOpen" :from-account-id="account.id" />

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('accounts.detail.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('accounts.detail.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('accounts.detail.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="del">{{
            t('accounts.detail.deleteConfirm')
          }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
  <Skeleton v-else class="h-24 w-full" />
</template>
```

`apps/web/src/modules/accounts/ui/AccountFormPage.vue`:

```vue
<script setup lang="ts">
/**
 * Create or edit an account. The card block appears only for cards; the
 * currency locks once the account has history (the API refuses anyway, the
 * form just says so first). Opening balance only when creating.
 */
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ACCOUNT_KINDS, CARD_TYPES } from '@magermoney/domain';
import {
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
import { ACCOUNT_KIND_KEYS } from '../domain/labels';
import { useAccount } from '../application/use-accounts';
import { useCreateAccount, useUpdateAccount } from '../application/use-account-mutations';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = useAccount(() => editingId.value ?? '');
const { create, isPending: creating } = useCreateAccount();
const { update, isPending: updating } = useUpdateAccount();

const form = reactive({
  name: '',
  bank: '',
  country: '',
  currency: 'USD',
  kind: 'bank_account' as (typeof ACCOUNT_KINDS)[number],
  isSpending: false,
  cardType: 'debit' as (typeof CARD_TYPES)[number],
  cardNetwork: '',
  cardTier: '',
  cardLast4: '',
  cardExpires: '',
  note: '',
  openingBalance: '',
});
watch(
  existing,
  (a) => {
    if (!a) return;
    Object.assign(form, {
      name: a.name,
      bank: a.bank,
      country: a.country,
      currency: a.currency,
      kind: a.kind,
      isSpending: a.isSpending,
      cardType: a.cardType ?? 'debit',
      cardNetwork: a.cardNetwork ?? '',
      cardTier: a.cardTier ?? '',
      cardLast4: a.cardLast4 ?? '',
      cardExpires: a.cardExpires ?? '',
      note: a.note ?? '',
    });
  },
  { immediate: true },
);

const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const currencyLocked = computed(
  () => existing.value?.balance !== null && existing.value !== undefined,
);
const isCard = computed(() => form.kind === 'card');
const busy = computed(() => creating.value || updating.value);

function payload() {
  const base = {
    name: form.name,
    bank: form.bank,
    country: form.country.toUpperCase(),
    currency: form.currency,
    kind: form.kind,
    isSpending: form.isSpending,
    note: form.note.trim() || null,
  };
  const card = isCard.value
    ? {
        cardType: form.cardType,
        cardNetwork: form.cardNetwork || null,
        cardTier: form.cardTier || null,
        cardLast4: form.cardLast4 || null,
        cardExpires: form.cardExpires || null,
      }
    : {};
  return { ...base, ...card };
}
async function submit() {
  try {
    if (editingId.value) {
      const { currency: _c, ...rest } = payload();
      await update(editingId.value, currencyLocked.value ? rest : payload());
      await router.replace(`/accounts/${editingId.value}`);
    } else {
      const created = await create({
        ...payload(),
        ...(form.openingBalance ? { openingBalance: { amount: form.openingBalance } } : {}),
      });
      await router.replace(`/accounts/${created.id}`);
    }
  } catch {
    toast(t('accounts.form.saveFailed'));
  }
}
</script>

<template>
  <form class="space-y-5 pb-8" data-testid="account-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('accounts.form.editTitle') : t('accounts.form.createTitle') }}
    </h1>

    <label class="block"
      ><span class="text-xs text-muted-foreground">{{ t('accounts.form.name') }}</span
      ><Input v-model="form.name" required data-testid="form-name" class="mt-1"
    /></label>
    <label class="block"
      ><span class="text-xs text-muted-foreground">{{ t('accounts.form.bank') }}</span
      ><Input v-model="form.bank" required data-testid="form-bank" class="mt-1"
    /></label>
    <label class="block"
      ><span class="text-xs text-muted-foreground">{{ t('accounts.form.country') }}</span
      ><Input
        v-model="form.country"
        required
        maxlength="2"
        pattern="[A-Za-z]{2}"
        data-testid="form-country"
        class="mt-1 uppercase"
    /></label>

    <label class="block">
      <span class="text-xs text-muted-foreground">{{ t('accounts.form.currency') }}</span>
      <Select v-model="form.currency" :disabled="currencyLocked">
        <SelectTrigger class="mt-1 w-full" data-testid="form-currency"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent
          ><SelectItem v-for="c in currencies" :key="c.code" :value="c.code">{{
            c.code
          }}</SelectItem></SelectContent
        >
      </Select>
      <span v-if="currencyLocked" class="text-xs text-muted-foreground">{{
        t('accounts.form.currencyLocked')
      }}</span>
    </label>

    <label class="block">
      <span class="text-xs text-muted-foreground">{{ t('accounts.form.kind') }}</span>
      <Select v-model="form.kind">
        <SelectTrigger class="mt-1 w-full" data-testid="form-kind"><SelectValue /></SelectTrigger>
        <SelectContent
          ><SelectItem v-for="k in ACCOUNT_KINDS" :key="k" :value="k">{{
            t(ACCOUNT_KIND_KEYS[k])
          }}</SelectItem></SelectContent
        >
      </Select>
    </label>

    <label class="flex min-h-11 items-center gap-3"
      ><input
        v-model="form.isSpending"
        type="checkbox"
        class="size-5"
        data-testid="form-spending"
      /><span class="text-sm">{{ t('accounts.form.spending') }}</span></label
    >

    <fieldset v-if="isCard" class="space-y-4 border-t border-border pt-4">
      <label class="block">
        <span class="text-xs text-muted-foreground">{{ t('accounts.form.cardType') }}</span>
        <Select v-model="form.cardType"
          ><SelectTrigger class="mt-1 w-full"><SelectValue /></SelectTrigger
          ><SelectContent
            ><SelectItem v-for="ct in CARD_TYPES" :key="ct" :value="ct">{{
              t(`accounts.cardType.${ct}`)
            }}</SelectItem></SelectContent
          ></Select
        >
      </label>
      <label class="block"
        ><span class="text-xs text-muted-foreground">{{ t('accounts.form.cardNetwork') }}</span
        ><Input v-model="form.cardNetwork" class="mt-1"
      /></label>
      <label class="block"
        ><span class="text-xs text-muted-foreground">{{ t('accounts.form.cardTier') }}</span
        ><Input v-model="form.cardTier" class="mt-1"
      /></label>
      <label class="block"
        ><span class="text-xs text-muted-foreground">{{ t('accounts.form.cardLast4') }}</span
        ><Input
          v-model="form.cardLast4"
          inputmode="numeric"
          maxlength="4"
          pattern="\d{4}"
          class="mt-1"
      /></label>
      <label class="block"
        ><span class="text-xs text-muted-foreground">{{ t('accounts.form.cardExpires') }}</span
        ><Input v-model="form.cardExpires" type="date" class="mt-1"
      /></label>
    </fieldset>

    <label class="block"
      ><span class="text-xs text-muted-foreground">{{ t('accounts.form.note') }}</span
      ><textarea
        v-model="form.note"
        rows="3"
        class="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
      />
    </label>

    <label v-if="!editingId" class="block">
      <span class="text-xs text-muted-foreground"
        >{{ t('accounts.form.openingBalance') }} · {{ form.currency }}</span
      >
      <MoneyInput
        v-model="form.openingBalance"
        :scale="scale"
        :locale="locale as 'ru' | 'en'"
        :allow-negative="isCard && form.cardType === 'credit'"
        data-testid="form-opening"
        class="mt-1"
      />
    </label>

    <Button type="submit" size="lg" class="w-full" :disabled="busy" data-testid="form-submit">{{
      editingId ? t('accounts.form.save') : t('accounts.form.create')
    }}</Button>
  </form>
</template>
```

Export from `modules/accounts/index.ts`:

```ts
export { default as AccountDetailPage } from './ui/AccountDetailPage.vue';
export { default as AccountFormPage } from './ui/AccountFormPage.vue';
export { default as RecordBalanceSheet } from './ui/RecordBalanceSheet.vue';
```

Until Task 15 lands, `@/modules/transfers` must export a placeholder `TransferSheet` (props `open`, `fromAccountId?`) so this compiles; Task 15 replaces it.

- [ ] **Step 6: Polish, test, typecheck, lint**

Run `/impeccable` on the four components; then `cd apps/web && bun run test && bun run typecheck && bun run lint`.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add account detail, form and balance journal screens"
```

---

### Task 15: Web — transfers module and quick actions

**Files:**

- Create: `apps/web/src/modules/transfers/infrastructure/transfers-api.ts`, `application/use-transfers.ts`, `application/use-transfer-mutations.ts`, `ui/TransferSheet.vue`, `ui/TransfersPage.vue`, `apps/web/src/modules/transfers/index.ts`, `apps/web/src/app/QuickActions.vue`
- Modify: `apps/web/src/app/App.vue`, `apps/web/src/locales/{ru,en}.json`
- Test: `apps/web/test/TransferSheet.test.ts`

**Interfaces:**

- Consumes: `TransferDto`, inputs (Task 3); `useAccounts`, `ACCOUNTS_KEY`, `RecordBalanceSheet` (accounts module); `useRates` (rates); `MoneyInput`.
- Produces: `useTransfers(accountId?)`, `useCreateTransfer()`, `useUpdateTransfer()`, `useDeleteTransfer()`, `TransferSheet` (props `open`, `fromAccountId?`, `transfer?`; emits `update:open`), `TransfersPage`; `QuickActions` in the shell's `#fab` slot with test ids `fab`, `quick-record`, `quick-transfer`.

- [ ] **Step 1: Design pass**

Run `/frontend-design`: the transfer sheet is two account pickers (Select showing name · balance · currency), a big sent amount, and, when currencies differ, a second amount "received" with a hint line "по курсу дня ≈ X" from the day's rate table and the derived realised rate once both are typed; with equal currencies a small optional fee field. The FAB is a 56px round primary button with a plus; tapping opens a bottom sheet with two full-width rows.

- [ ] **Step 2: Write the failing test**

`apps/web/test/TransferSheet.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import TransferSheet from '../src/modules/transfers/ui/TransferSheet.vue';

const acc = (id: string, currency: string) => ({
  id,
  name: id,
  bank: 'B',
  country: 'RU',
  currency,
  kind: 'cash',
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '100',
  balanceRecordedAt: null,
});
const cur = (code: string) => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: null,
  icon: null,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mountSheet(fetch: (path: string, init?: RequestInit) => Promise<Response>) {
  return mount(TransferSheet, {
    props: { open: true, fromAccountId: 'usd' },
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
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
      stubs: { Teleport: true },
    },
    attachTo: document.body,
  });
}

describe('TransferSheet', () => {
  it('shows the received field only when currencies differ and posts both amounts', async () => {
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/currencies') return json([cur('USD'), cur('EUR')]);
      if (path.startsWith('/rates'))
        return json([
          { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api' },
        ]);
      if (path === '/me')
        return json({
          id: 'u',
          displayName: null,
          locale: 'ru',
          defaultCurrency: 'USD',
          reportingCurrencies: ['USD'],
          onboardingCompletedAt: null,
        });
      if (init?.method === 'POST')
        return json(
          {
            id: 't',
            fromAccountId: 'usd',
            toAccountId: 'eur',
            amountSent: '100',
            amountReceived: '86',
            occurredAt: '2026-09-11T00:00:00.000Z',
            note: null,
            realisedRate: '0.86',
            fee: null,
          },
          201,
        );
      return json([acc('usd', 'USD'), acc('usd2', 'USD'), acc('eur', 'EUR')]);
    });
    const w = mountSheet(fetch);
    await flushPromises();
    await w.get('[data-testid="transfer-to"]').setValue('usd2');
    expect(w.find('[data-testid="transfer-received"]').exists()).toBe(false);
    await w.get('[data-testid="transfer-to"]').setValue('eur');
    expect(w.find('[data-testid="transfer-received"]').exists()).toBe(true);
    await w.get('[data-testid="transfer-sent"]').setValue('100');
    expect(w.get('[data-testid="transfer-hint"]').text()).toContain('86');
    await w.get('[data-testid="transfer-received"]').setValue('86');
    await w.get('form').trigger('submit');
    await flushPromises();
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({
      fromAccountId: 'usd',
      toAccountId: 'eur',
      amountSent: '100',
      amountReceived: '86',
    });
    expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
  });
});
```

The pickers are native `<select>` elements (`data-testid="transfer-from"`, `transfer-to`) so the test can `setValue` them; on the phone a native select is also the better control for a 48-item list.

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/web && bun run test`
Expected: FAIL — module missing.

- [ ] **Step 4: Add copy**

Both locales:

```json
"transfers": {
  "title": "Переводы",
  "sheetTitle": "Перевод",
  "editTitle": "Изменить перевод",
  "from": "Откуда",
  "to": "Куда",
  "sent": "Отправлено",
  "received": "Получено",
  "fee": "Комиссия (необязательно)",
  "hint": "По курсу дня ≈ {amount}",
  "rate": "Реальный курс: 1 {from} = {rate} {to}",
  "occurredAt": "Когда",
  "note": "Заметка",
  "save": "Перевести",
  "update": "Сохранить",
  "delete": "Удалить перевод",
  "empty": "Переводов ещё не было",
  "notLatest": "После перевода остатки уже менялись. Сделайте корректирующий перевод.",
  "insufficient": "На счёте не хватает денег.",
  "failed": "Не удалось перевести. Попробуйте ещё раз.",
  "option": "{name} · {balance} {currency}",
  "row": "{from} → {to}"
},
"quick": { "open": "Добавить", "record": "Обновить остаток", "transfer": "Перевод", "pickAccount": "Какой счёт?" }
```

- [ ] **Step 5: Implement**

`apps/web/src/modules/transfers/infrastructure/transfers-api.ts`:

```ts
import {
  TransferDtoSchema,
  type CreateTransferInput,
  type TransferDto,
  type UpdateTransferInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const list = listOf(TransferDtoSchema);
const noContent = { safeParse: (_: unknown) => ({ success: true as const, data: undefined }) };

export const transfersApi = (client: ApiClient) => ({
  list: async (accountId?: string): Promise<TransferDto[]> => {
    const q = new URLSearchParams({ limit: '200', ...(accountId ? { accountId } : {}) });
    return parse(await client.fetch(`/transfers?${q}`, { method: 'GET' }), list);
  },
  create: async (input: CreateTransferInput): Promise<TransferDto> =>
    parse(
      await client.fetch('/transfers', { method: 'POST', body: JSON.stringify(input) }),
      TransferDtoSchema,
    ),
  update: async (id: string, input: UpdateTransferInput): Promise<TransferDto> =>
    parse(
      await client.fetch(`/transfers/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      TransferDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/transfers/${id}`, { method: 'DELETE' }), noContent),
});
```

`apps/web/src/modules/transfers/application/use-transfers.ts`:

```ts
import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { TransferDto } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { transfersApi } from '../infrastructure/transfers-api';

export const transfersKey = (accountId?: string) => ['transfers', accountId ?? 'all'] as const;

export function useTransfers(accountId?: MaybeRefOrGetter<string | undefined>): {
  transfers: ComputedRef<TransferDto[]>;
  isLoading: ComputedRef<boolean>;
} {
  const api = transfersApi(useApi());
  const query = useQuery({
    queryKey: computed(() => transfersKey(toValue(accountId))),
    queryFn: () => api.list(toValue(accountId)),
  });
  return {
    transfers: computed(() => query.data.value ?? []),
    isLoading: computed(() => query.isLoading.value),
  };
}
```

`apps/web/src/modules/transfers/application/use-transfer-mutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { CreateTransferInput, UpdateTransferInput } from '@magermoney/contracts';
import { ACCOUNTS_KEY } from '@/modules/accounts';
import { useApi } from '@/shared/api/use-api';
import { transfersApi } from '../infrastructure/transfers-api';

/** A transfer changes two balances and two journals, so everything account-shaped is refetched. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
      qc.invalidateQueries({ queryKey: ['transfers'] }),
    ]);
}

export function useCreateTransfer() {
  const api = transfersApi(useApi());
  const invalidate = useInvalidateAll();
  const m = useMutation({ mutationFn: api.create, onSettled: invalidate });
  return { create: (input: CreateTransferInput) => m.mutateAsync(input), isPending: m.isPending };
}
export function useUpdateTransfer() {
  const api = transfersApi(useApi());
  const invalidate = useInvalidateAll();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTransferInput }) =>
      api.update(id, input),
    onSettled: invalidate,
  });
  return {
    update: (id: string, input: UpdateTransferInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}
export function useDeleteTransfer() {
  const api = transfersApi(useApi());
  const invalidate = useInvalidateAll();
  const m = useMutation({ mutationFn: api.remove, onSettled: invalidate });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
```

`apps/web/src/modules/transfers/ui/TransferSheet.vue`:

```vue
<script setup lang="ts">
/**
 * Money from one account to another. When currencies match the person types
 * one number; when they differ, two, with the day's rate as a hint and the
 * realised rate shown once both are in — the fee hides inside that rate.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TransferDto } from '@magermoney/contracts';
import { Money, deriveTransfer } from '@magermoney/domain';
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
import { toCurrency, useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { useRates } from '@/modules/rates';
import { ApiError } from '@/shared/api/client';
import { fromLocalInput, toLocalInput } from '@/shared/dates/format';
import {
  useCreateTransfer,
  useDeleteTransfer,
  useUpdateTransfer,
} from '../application/use-transfer-mutations';

const props = defineProps<{ open: boolean; fromAccountId?: string; transfer?: TransferDto }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();
const { t, locale } = useI18n();
const { toast } = useToast();
const { accounts } = useAccounts();
const currencies = useCurrencies();
const registry = useCurrencyRegistry();
const rates = useRates();
const { create, isPending: creating } = useCreateTransfer();
const { update, isPending: updating } = useUpdateTransfer();
const { remove } = useDeleteTransfer();

const from = ref('');
const to = ref('');
const sent = ref('');
const received = ref('');
const fee = ref('');
const occurredAt = ref(toLocalInput(new Date().toISOString()));
const note = ref('');
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    from.value = props.transfer?.fromAccountId ?? props.fromAccountId ?? '';
    to.value = props.transfer?.toAccountId ?? '';
    sent.value = props.transfer?.amountSent ?? '';
    received.value = props.transfer?.amountReceived ?? '';
    fee.value = props.transfer?.fee ?? '';
    occurredAt.value = toLocalInput(props.transfer?.occurredAt ?? new Date().toISOString());
    note.value = props.transfer?.note ?? '';
  },
  { immediate: true },
);

const active = computed(() => accounts.value.filter((a) => a.archivedAt === null));
const fromAcc = computed(() => accounts.value.find((a) => a.id === from.value));
const toAcc = computed(() => accounts.value.find((a) => a.id === to.value));
const scaleOf = (code: string | undefined) =>
  currencies.value.find((c) => c.code === code)?.scale ?? 2;
const cross = computed(() =>
  Boolean(fromAcc.value && toAcc.value && fromAcc.value.currency !== toAcc.value.currency),
);

const hint = computed(() => {
  if (!cross.value || !fromAcc.value || !toAcc.value || sent.value === '' || !rates.table.value)
    return null;
  const fromCur = registry.value.get(fromAcc.value.currency);
  if (fromCur.isErr()) return null;
  return rates.table.value.convert(Money.of(sent.value, fromCur.value), toAcc.value.currency).match(
    (m) => m.round().toString(),
    () => null,
  );
});
const realised = computed(() => {
  if (!cross.value || !fromAcc.value || !toAcc.value || sent.value === '' || received.value === '')
    return null;
  const f = registry.value.get(fromAcc.value.currency);
  const tc = registry.value.get(toAcc.value.currency);
  if (f.isErr() || tc.isErr()) return null;
  return deriveTransfer({
    amountSent: Money.of(sent.value, f.value),
    amountReceived: Money.of(received.value, tc.value),
  }).match(
    (d) => d.realisedRate?.toFixed() ?? null,
    () => null,
  );
});
const canSubmit = computed(
  () =>
    from.value &&
    to.value &&
    from.value !== to.value &&
    sent.value !== '' &&
    (!cross.value || received.value !== ''),
);

function amounts() {
  if (cross.value) return { amountSent: sent.value, amountReceived: received.value };
  if (fee.value === '' || fee.value === '0') return { amountSent: sent.value };
  const cur = registry.value
    .get(fromAcc.value!.currency)
    .unwrapOr({ code: 'X', kind: 'fiat' as const, scale: 2 });
  return {
    amountSent: sent.value,
    amountReceived: Money.of(sent.value, cur)
      .subtract(Money.of(fee.value, cur))
      .map((m) => m.toString())
      .unwrapOr(sent.value),
  };
}
async function submit() {
  if (!canSubmit.value) return;
  const input = {
    ...amounts(),
    occurredAt: fromLocalInput(occurredAt.value),
    note: note.value.trim() || null,
  };
  try {
    if (props.transfer) await update(props.transfer.id, input);
    else await create({ fromAccountId: from.value, toAccountId: to.value, ...input });
    emit('update:open', false);
  } catch (e) {
    const code = e instanceof ApiError ? e.code : '';
    toast(
      code === 'transfer_not_latest'
        ? t('transfers.notLatest')
        : code === 'INSUFFICIENT_FUNDS'
          ? t('transfers.insufficient')
          : t('transfers.failed'),
    );
  }
}
async function del() {
  if (!props.transfer) return;
  try {
    await remove(props.transfer.id);
    emit('update:open', false);
  } catch {
    toast(t('transfers.notLatest'));
  }
}
const label = (a: (typeof accounts.value)[number]) =>
  t('transfers.option', { name: a.name, balance: a.balance ?? '0', currency: a.currency });
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SheetHeader
        ><SheetTitle>{{
          transfer ? t('transfers.editTitle') : t('transfers.sheetTitle')
        }}</SheetTitle></SheetHeader
      >
      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs text-muted-foreground">{{ t('transfers.from') }}</span>
          <select
            v-model="from"
            data-testid="transfer-from"
            :disabled="Boolean(transfer)"
            class="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option v-for="a in active" :key="a.id" :value="a.id">{{ label(a) }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs text-muted-foreground">{{ t('transfers.to') }}</span>
          <select
            v-model="to"
            data-testid="transfer-to"
            :disabled="Boolean(transfer)"
            class="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option v-for="a in active.filter((x) => x.id !== from)" :key="a.id" :value="a.id">
              {{ label(a) }}
            </option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs text-muted-foreground"
            >{{ t('transfers.sent') }} · {{ fromAcc?.currency }}</span
          >
          <MoneyInput
            v-model="sent"
            data-testid="transfer-sent"
            :scale="scaleOf(fromAcc?.currency)"
            :locale="locale as 'ru' | 'en'"
            class="mt-1"
          />
        </label>
        <label v-if="cross" class="block">
          <span class="text-xs text-muted-foreground"
            >{{ t('transfers.received') }} · {{ toAcc?.currency }}</span
          >
          <MoneyInput
            v-model="received"
            data-testid="transfer-received"
            :scale="scaleOf(toAcc?.currency)"
            :locale="locale as 'ru' | 'en'"
            class="mt-1"
          />
          <span
            v-if="hint"
            data-testid="transfer-hint"
            class="mt-1 block text-xs text-muted-foreground"
            >{{ t('transfers.hint', { amount: `${hint} ${toAcc?.currency}` }) }}</span
          >
          <span v-if="realised" class="mt-1 block text-xs text-muted-foreground">{{
            t('transfers.rate', { from: fromAcc?.currency, to: toAcc?.currency, rate: realised })
          }}</span>
        </label>
        <label v-else class="block">
          <span class="text-xs text-muted-foreground">{{ t('transfers.fee') }}</span>
          <MoneyInput
            v-model="fee"
            data-testid="transfer-fee"
            :scale="scaleOf(fromAcc?.currency)"
            :locale="locale as 'ru' | 'en'"
            class="mt-1 h-10 text-base"
          />
        </label>
        <label class="block"
          ><span class="text-xs text-muted-foreground">{{ t('transfers.occurredAt') }}</span
          ><Input v-model="occurredAt" type="datetime-local" class="mt-1"
        /></label>
        <label class="block"
          ><span class="text-xs text-muted-foreground">{{ t('transfers.note') }}</span
          ><Input v-model="note" class="mt-1"
        /></label>
        <div class="flex gap-2">
          <Button
            type="submit"
            size="lg"
            class="flex-1"
            :disabled="!canSubmit || creating || updating"
            data-testid="transfer-save"
            >{{ transfer ? t('transfers.update') : t('transfers.save') }}</Button
          >
          <Button v-if="transfer" type="button" size="lg" variant="destructive" @click="del">{{
            t('transfers.delete')
          }}</Button>
        </div>
      </form>
    </SheetContent>
  </Sheet>
</template>
```

`apps/web/src/modules/transfers/ui/TransfersPage.vue`:

```vue
<script setup lang="ts">
/** Every transfer, newest first; tap one to change or remove it while it still can be. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import type { TransferDto } from '@magermoney/contracts';
import { Skeleton } from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { formatDateTime } from '@/shared/dates/format';
import { useTransfers } from '../application/use-transfers';
import TransferSheet from './TransferSheet.vue';

const route = useRoute();
const { t, locale } = useI18n();
const accountId = computed(() =>
  typeof route.query.accountId === 'string' ? route.query.accountId : undefined,
);
const { transfers, isLoading } = useTransfers(accountId);
const { accounts } = useAccounts();
const nameOf = (id: string) => accounts.value.find((a) => a.id === id)?.name ?? '?';
const currencyOf = (id: string) => accounts.value.find((a) => a.id === id)?.currency ?? '';
const open = ref(false);
const editing = ref<TransferDto | undefined>();
function edit(tr: TransferDto) {
  editing.value = tr;
  open.value = true;
}
</script>

<template>
  <section class="pb-8">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">{{ t('transfers.title') }}</h1>
    <Skeleton v-if="isLoading" class="mt-4 h-12 w-full" />
    <p v-else-if="transfers.length === 0" class="mt-4 text-sm text-muted-foreground">
      {{ t('transfers.empty') }}
    </p>
    <ul v-else class="mt-4 divide-y divide-border/60">
      <li v-for="tr in transfers" :key="tr.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 py-3 text-left"
          :data-testid="`transfer-${tr.id}`"
          @click="edit(tr)"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm">{{
              t('transfers.row', { from: nameOf(tr.fromAccountId), to: nameOf(tr.toAccountId) })
            }}</span>
            <span class="block text-xs text-muted-foreground"
              >{{ formatDateTime(tr.occurredAt, locale as 'ru' | 'en')
              }}<template v-if="tr.note"> · {{ tr.note }}</template></span
            >
          </span>
          <span class="text-right font-mono text-sm tabular-nums">
            <span class="block">−{{ tr.amountSent }} {{ currencyOf(tr.fromAccountId) }}</span>
            <span class="block text-muted-foreground"
              >+{{ tr.amountReceived }} {{ currencyOf(tr.toAccountId) }}</span
            >
          </span>
        </button>
      </li>
    </ul>
    <TransferSheet v-model:open="open" :transfer="editing" />
  </section>
</template>
```

`apps/web/src/modules/transfers/index.ts`:

```ts
/** Public API of the transfers module. */
export { useTransfers } from './application/use-transfers';
export {
  useCreateTransfer,
  useUpdateTransfer,
  useDeleteTransfer,
} from './application/use-transfer-mutations';
export { default as TransferSheet } from './ui/TransferSheet.vue';
export { default as TransfersPage } from './ui/TransfersPage.vue';
```

`apps/web/src/app/QuickActions.vue` (composition root: it needs both modules, and neither may import the other):

```vue
<script setup lang="ts">
/** The "+" on the accounts tab: record a balance (pick the account first) or make a transfer. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@magermoney/ui';
import { RecordBalanceSheet, useAccounts } from '@/modules/accounts';
import { TransferSheet } from '@/modules/transfers';

const { t } = useI18n();
const route = useRoute();
const { accounts } = useAccounts();
const menu = ref(false);
const pick = ref(false);
const record = ref(false);
const transfer = ref(false);
const chosen = ref('');
const active = computed(() => accounts.value.filter((a) => a.archivedAt === null));
const onHome = computed(() => route.path === '/');
function choose(id: string) {
  chosen.value = id;
  pick.value = false;
  record.value = true;
}
</script>

<template>
  <template v-if="onHome && accounts.length > 0">
    <Button
      size="icon-lg"
      class="size-14 rounded-full shadow-lg"
      :aria-label="t('quick.open')"
      data-testid="fab"
      @click="menu = true"
      >+</Button
    >
    <Sheet v-model:open="menu">
      <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader
          ><SheetTitle>{{ t('quick.open') }}</SheetTitle></SheetHeader
        >
        <div class="mt-4 grid gap-2">
          <Button
            size="lg"
            variant="outline"
            data-testid="quick-record"
            @click="
              menu = false;
              pick = true;
            "
            >{{ t('quick.record') }}</Button
          >
          <Button
            size="lg"
            variant="outline"
            data-testid="quick-transfer"
            @click="
              menu = false;
              transfer = true;
            "
            >{{ t('quick.transfer') }}</Button
          >
        </div>
      </SheetContent>
    </Sheet>
    <Sheet v-model:open="pick">
      <SheetContent
        side="bottom"
        class="max-h-[80dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader
          ><SheetTitle>{{ t('quick.pickAccount') }}</SheetTitle></SheetHeader
        >
        <ul class="mt-2 divide-y divide-border/60">
          <li v-for="a in active" :key="a.id">
            <button
              type="button"
              class="flex min-h-12 w-full items-center justify-between py-2 text-left text-sm"
              :data-testid="`pick-${a.id}`"
              @click="choose(a.id)"
            >
              <span>{{ a.name }}</span
              ><span class="font-mono text-muted-foreground"
                >{{ a.balance ?? '—' }} {{ a.currency }}</span
              >
            </button>
          </li>
        </ul>
      </SheetContent>
    </Sheet>
    <RecordBalanceSheet v-if="chosen" v-model:open="record" :account-id="chosen" />
    <TransferSheet v-model:open="transfer" />
  </template>
</template>
```

In `App.vue` add `import QuickActions from '@/app/QuickActions.vue';` and inside `<AppShell>`:

```vue
<template #fab><QuickActions /></template>
```

- [ ] **Step 6: Polish, test, typecheck, lint**

`/impeccable` on the sheet, the page and the quick actions; then `cd apps/web && bun run test && bun run typecheck && bun run lint`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add transfers and the quick-action button"
```

---

### Task 16: Web — rates screen with manual overrides

**Files:**

- Create: `apps/web/src/modules/rates/application/use-manual-rate.ts`, `ui/RatesPage.vue`, `ui/ManualRateSheet.vue`
- Modify: `apps/web/src/modules/rates/infrastructure/rates-api.ts`, `apps/web/src/modules/rates/index.ts`, locales
- Test: `apps/web/test/rates-api.test.ts`

**Interfaces:**

- Consumes: `useRates`, `useDisplayCurrency`, `useProfile` (reporting list), `useCurrencies`, `MoneyInput`.
- Produces: `ratesApi.setManual(input)`, `ratesApi.removeManual(base, date)`, `useManualRate()` → `{ set, remove }` (both invalidate `['rates']`), `RatesPage` (`/rates`, rows `data-testid="rate-row-<code>"`), `ManualRateSheet`.

- [ ] **Step 1: Write the failing test**

`apps/web/test/rates-api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ratesApi } from '../src/modules/rates/infrastructure/rates-api.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('ratesApi manual overrides', () => {
  it('PUTs a manual rate and DELETEs by query', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = ratesApi({
      fetch: async (p, i) => {
        calls.push([p, i]);
        return i?.method === 'DELETE'
          ? new Response(null, { status: 204 })
          : json({
              base: 'RUB',
              quote: 'USD',
              value: '0.012',
              date: '2026-01-01',
              source: 'manual',
            });
      },
    });
    await api.setManual({ base: 'RUB', date: '2026-01-01', value: '0.012' });
    await api.removeManual('RUB', '2026-01-01');
    expect(calls[0]).toMatchObject(['/rates/manual', { method: 'PUT' }]);
    expect(calls[1]?.[0]).toBe('/rates/manual?base=RUB&date=2026-01-01');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && bun run test`. Expected: FAIL — `setManual` is not a function.

- [ ] **Step 3: Copy**

```json
"rates": {
  "title": "Курсы",
  "asOf": "Курсы на {date}, в {code}",
  "manual": "вручную",
  "one": "1 {code}",
  "setManual": "Задать курс вручную",
  "sheetTitle": "Ручной курс",
  "currency": "Валюта",
  "date": "Дата",
  "value": "1 {code} в USD",
  "hint": "Курс хранится к доллару. Для {code} сегодня по API: {value}.",
  "save": "Сохранить",
  "remove": "Убрать ручной курс",
  "failed": "Не удалось сохранить курс.",
  "noRate": "нет курса"
}
```

- [ ] **Step 4: Implement**

Extend `rates-api.ts`:

```ts
import { ManualRateInputSchema, RateDtoSchema, type ManualRateInput, type RateDto } from '@magermoney/contracts';
// …
const noContent = { safeParse: (_: unknown) => ({ success: true as const, data: undefined }) };
export const ratesApi = (client: ApiClient) => ({
  list: /* unchanged */,
  setManual: async (input: ManualRateInput): Promise<RateDto> => parse(await client.fetch('/rates/manual', { method: 'PUT', body: JSON.stringify(ManualRateInputSchema.parse(input)) }), RateDtoSchema),
  removeManual: async (base: string, date: string): Promise<void> => parse(await client.fetch(`/rates/manual?${new URLSearchParams({ base, date })}`, { method: 'DELETE' }), noContent),
});
```

`use-manual-rate.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { ManualRateInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { ratesApi } from '../infrastructure/rates-api';

/** Every rate table on screen refetches after an override changes; there is no partial patch worth the risk. */
export function useManualRate() {
  const api = ratesApi(useApi());
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['rates'] });
  const set = useMutation({ mutationFn: api.setManual, onSettled: invalidate });
  const remove = useMutation({
    mutationFn: ({ base, date }: { base: string; date: string }) => api.removeManual(base, date),
    onSettled: invalidate,
  });
  return {
    set: (input: ManualRateInput) => set.mutateAsync(input),
    remove: (base: string, date: string) => remove.mutateAsync({ base, date }),
    isPending: set.isPending,
  };
}
```

`ui/ManualRateSheet.vue`:

```vue
<script setup lang="ts">
/** One override: a currency, a date, its USD price. The API hint keeps a typo from becoming a rate. */
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
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
import { useCurrencies } from '@/modules/currencies';
import { todayIso } from '../domain';
import { useManualRate } from '../application/use-manual-rate';
import { useRates } from '../application/use-rates';

const props = defineProps<{ open: boolean; base?: string }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { set, isPending } = useManualRate();
const base = ref(props.base ?? 'EUR');
const date = ref(todayIso());
const value = ref('');
watch(
  () => props.open,
  (o) => {
    if (o) {
      base.value = props.base ?? base.value;
      date.value = todayIso();
      value.value = '';
    }
  },
);
const { table } = useRates();
const apiValue = computed(
  () =>
    table.value?.rateOf(base.value).match(
      (v) => v.toSignificantDigits(6).toFixed(),
      () => null,
    ) ?? null,
);
async function submit() {
  if (value.value === '') return;
  try {
    await set({ base: base.value, date: date.value, value: value.value });
    emit('update:open', false);
  } catch {
    toast(t('rates.failed'));
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SheetHeader
        ><SheetTitle>{{ t('rates.sheetTitle') }}</SheetTitle></SheetHeader
      >
      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block"
          ><span class="text-xs text-muted-foreground">{{ t('rates.currency') }}</span>
          <select
            v-model="base"
            data-testid="manual-base"
            class="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option
              v-for="c in currencies.filter((x) => x.code !== 'USD')"
              :key="c.code"
              :value="c.code"
            >
              {{ c.code }}
            </option>
          </select>
        </label>
        <label class="block"
          ><span class="text-xs text-muted-foreground">{{ t('rates.date') }}</span
          ><Input v-model="date" type="date" class="mt-1" data-testid="manual-date"
        /></label>
        <label class="block"
          ><span class="text-xs text-muted-foreground">{{ t('rates.value', { code: base }) }}</span>
          <MoneyInput
            v-model="value"
            :scale="10"
            :locale="locale as 'ru' | 'en'"
            class="mt-1"
            data-testid="manual-value"
          />
          <span v-if="apiValue" class="mt-1 block text-xs text-muted-foreground">{{
            t('rates.hint', { code: base, value: apiValue })
          }}</span>
        </label>
        <Button
          type="submit"
          size="lg"
          class="w-full"
          :disabled="isPending || value === ''"
          data-testid="manual-save"
          >{{ t('rates.save') }}</Button
        >
      </form>
    </SheetContent>
  </Sheet>
</template>
```

`ui/RatesPage.vue`:

```vue
<script setup lang="ts">
/** What one unit of each reporting currency is worth in the display currency today, and which of those numbers were typed by hand. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Badge, Button, CurrencyIcon, Skeleton } from '@magermoney/ui';
import { toCurrency, useCurrencies } from '@/modules/currencies';
import { Money } from '@magermoney/domain';
import { useApi } from '@/shared/api/use-api';
import { useQuery } from '@tanstack/vue-query';
import { formatMoney, type MoneyLocale } from '@/shared/money/format';
import { useDisplayCurrency } from '../application/use-display-currency';
import { useRates } from '../application/use-rates';
import { useManualRate } from '../application/use-manual-rate';
import { ratesApi } from '../infrastructure/rates-api';
import ManualRateSheet from './ManualRateSheet.vue';

const { t, locale } = useI18n();
const currencies = useCurrencies();
const { current } = useDisplayCurrency();
const { table, date } = useRates();
const { remove } = useManualRate();
const api = ratesApi(useApi());
/** The raw rows again, to know which base has a manual source today. */
const raw = useQuery({ queryKey: ['rates', null], queryFn: () => api.list() });
const manualBases = computed(
  () => new Set((raw.data.value ?? []).filter((r) => r.source === 'manual').map((r) => r.base)),
);
const manualDate = (base: string) =>
  (raw.data.value ?? []).find((r) => r.base === base && r.source === 'manual')?.date;

const rows = computed(() =>
  currencies.value
    .filter((c) => c.code !== current.value)
    .map((c) => {
      const one = table.value?.convert(Money.of('1', toCurrency(c)), current.value);
      const target = currencies.value.find((x) => x.code === current.value);
      const text =
        one?.isOk() && target
          ? formatMoney(
              one.value.amount.toSignificantDigits(6).toFixed(),
              current.value,
              locale.value as MoneyLocale,
              { kind: target.kind, scale: Math.max(target.scale, 4), symbol: target.symbol },
            )
          : t('rates.noRate');
      return { code: c.code, kind: c.kind, text, manual: manualBases.value.has(c.code) };
    }),
);
const open = ref(false);
const base = ref<string | undefined>();
function edit(code: string) {
  base.value = code;
  open.value = true;
}
</script>

<template>
  <section class="pb-8">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">{{ t('rates.title') }}</h1>
    <p class="mt-1 text-xs text-muted-foreground">{{ t('rates.asOf', { date, code: current }) }}</p>
    <Skeleton v-if="!table" class="mt-4 h-12 w-full" />
    <ul v-else class="mt-4 divide-y divide-border/60">
      <li
        v-for="r in rows"
        :key="r.code"
        :data-testid="`rate-row-${r.code}`"
        class="flex min-h-12 items-center gap-3 py-2"
      >
        <CurrencyIcon :code="r.code" :kind="r.kind" :size="24" />
        <span class="flex-1 text-sm">{{ t('rates.one', { code: r.code }) }}</span>
        <Badge v-if="r.manual" variant="secondary">{{ t('rates.manual') }}</Badge>
        <button type="button" class="font-mono text-sm tabular-nums" @click="edit(r.code)">
          {{ r.text }}
        </button>
        <Button
          v-if="r.manual"
          variant="ghost"
          size="xs"
          :aria-label="t('rates.remove')"
          @click="remove(r.code, manualDate(r.code) ?? date)"
          >×</Button
        >
      </li>
    </ul>
    <Button
      class="mt-6 w-full"
      variant="outline"
      size="lg"
      data-testid="rates-set-manual"
      @click="edit(current === 'USD' ? 'EUR' : (rows[0]?.code ?? 'EUR'))"
      >{{ t('rates.setManual') }}</Button
    >
    <ManualRateSheet v-model:open="open" :base="base" />
  </section>
</template>
```

Export from `modules/rates/index.ts`: `RatesPage`, `ManualRateSheet`, `useManualRate`. Remove the `HomePage` export (done in Task 13).

- [ ] **Step 5: Polish, test, typecheck, lint**

`/impeccable` on both components; `cd apps/web && bun run test && bun run typecheck && bun run lint`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add the rates screen with manual overrides"
```

---

### Task 17: Import — CSV parser, number parsing and the two mappers (pure)

**Files:**

- Create: `apps/api/scripts/import/csv.ts`, `apps/api/scripts/import/numbers.ts`, `apps/api/scripts/import/accounts-mapper.ts`, `apps/api/scripts/import/rates-mapper.ts`
- Test: `apps/api/test/import/csv.test.ts`, `apps/api/test/import/accounts-mapper.test.ts`, `apps/api/test/import/rates-mapper.test.ts`

**Interfaces:**

- Produces: `parseCsv(text): string[][]`, `parseRuNumber(raw): string | null`, `mapAccounts(rows, opts): Result<MappedAccount[], ImportError>` where `MappedAccount = NewAccount & { balance: string }`, `mapRates(rows): Result<{ base: string; date: string; value: string }[], ImportError>`, `COUNTRY_BY_NAME`.
- Consumes: `NewAccount` (Task 5), `Decimal`.

The synthetic CSV below is the only account data that ever enters the repository.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/import/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { parseRuNumber } from '../../scripts/import/numbers.js';

describe('parseCsv', () => {
  it('handles quotes, embedded commas, newlines and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","line1\nline2"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'line1\nline2'],
    ]);
    expect(parseCsv('a,"he said ""hi"""')).toEqual([['a', 'he said "hi"']]);
  });
});

describe('parseRuNumber', () => {
  it('reads spreadsheet numbers into decimal strings', () => {
    expect(parseRuNumber('2 100 675,19')).toBe('2100675.19');
    expect(parseRuNumber('0,00')).toBe('0');
    expect(parseRuNumber('14 000,00')).toBe('14000');
    expect(parseRuNumber('$1 259,80')).toBe('1259.80');
    expect(parseRuNumber('-')).toBeNull();
    expect(parseRuNumber('')).toBeNull();
    expect(parseRuNumber('abc')).toBeNull();
  });
});
```

`apps/api/test/import/accounts-mapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapAccounts } from '../../scripts/import/accounts-mapper.js';

/** Synthetic rows in the sheet's column order; no real data. */
const HEADER =
  'Название банка,Страна,Сумма,Валюта,в USD,в EUR,Платежная система,Тип,Номер карты,Срок действия,BIN Type,Оплата,Снятие,Обслуживание,Лимиты,Именная,Привилегии,ApplePay,NFS,Переводы,СИМ,Паспорт,Подробности,Бонусы';
const CSV = [
  HEADER,
  'Demo Bank,🇷🇺 Россия,"1 234,56",RUB,$1,€1,Mir,Elite,************5520,07/27,DEBIT,0%,2%,$0,,Да,Нет,Нет,Есть,P2P,70000000000,РФ,"Multi\nline",',
  'Demo Bank Вклад,🇷🇺 Россия,"0,00",RUB,$0,€0,,Account,-,-,,,,,,,,,,,,,,',
  'Demo Broker,🇰🇿 Казахстан,"10,00",USD,$10,€9,,Investing,,,,,,,,,,,,,,,,',
  'Demo Exchange,🪙 Crypto,"0,33",ETH,$800,€700,,Investing,,,,,,,,,,,,,,,,',
  'Cash EUR,💰 Cash,"310,00",EUR,$359,€310,,Account,,,,,,,,,,,,,,,,',
  'Twin Bank,🇬🇪 Грузия,"0,00",USD,$0,€0,VISA,Platinum,************2236,08/28,DEBIT,,,,,,,,,,,,,',
  'Twin Bank,🇬🇪 Грузия,"5,00",USD,$5,€4,MasterCard,Digital,************9827,08/28,CREDIT,,,,,,,,,,,,,',
  ',,,,$1 000,€900,,,,,,,,,,,,,,,,,,',
].join('\n');

describe('mapAccounts', () => {
  const rows = parseCsv(CSV);
  const result = mapAccounts(rows, { known: new Set(['RUB', 'USD', 'ETH', 'EUR']) });
  const accounts = result._unsafeUnwrap();

  it('maps every non-empty row and skips the totals row', () => {
    expect(accounts).toHaveLength(7);
  });
  it('maps a card with its fields and a markdown note', () => {
    const card = accounts[0]!;
    expect(card).toMatchObject({
      name: 'Demo Bank',
      bank: 'Demo Bank',
      country: 'RU',
      currency: 'RUB',
      kind: 'card',
      cardType: 'debit',
      cardNetwork: 'Mir',
      cardTier: 'Elite',
      cardLast4: '5520',
      cardExpires: '2027-07-31',
      balance: '1234.56',
      sortOrder: 0,
    });
    expect(card.note).toContain('- Снятие: 2%');
    expect(card.note).toContain('- Паспорт: РФ');
    expect(card.note).toContain('- Подробности: Multi\nline');
    expect(card.note).not.toContain('Лимиты');
  });
  it('recognises deposits, brokers, crypto coins and cash', () => {
    expect(accounts[1]).toMatchObject({
      kind: 'deposit',
      bank: 'Demo Bank',
      name: 'Demo Bank Вклад',
      note: null,
    });
    expect(accounts[2]).toMatchObject({ kind: 'broker', country: 'KZ' });
    expect(accounts[3]).toMatchObject({
      kind: 'crypto_wallet',
      country: 'XX',
      currency: 'ETH',
      balance: '0.33',
    });
    expect(accounts[4]).toMatchObject({ kind: 'cash', country: 'XX', bank: 'Cash EUR' });
  });
  it('disambiguates two accounts of one bank in one currency by tier and keeps the card type', () => {
    expect(accounts[5]!.name).toBe('Twin Bank · Platinum');
    expect(accounts[6]).toMatchObject({ name: 'Twin Bank · Digital', cardType: 'credit' });
  });
  it('fails on an unknown currency, naming it', () => {
    const r = mapAccounts(rows, { known: new Set(['RUB', 'USD', 'EUR']) });
    expect(r._unsafeUnwrapErr().message).toContain('ETH');
  });
  it('fails on an unknown country', () => {
    const r = mapAccounts(
      parseCsv(`${HEADER}\nX,🇫🇷 Франция,"1,00",EUR,,,,Account,,,,,,,,,,,,,,,,`),
      { known: new Set(['EUR']) },
    );
    expect(r._unsafeUnwrapErr().message).toContain('Франция');
  });
});
```

`apps/api/test/import/rates-mapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapRates } from '../../scripts/import/rates-mapper.js';

const CSV = [
  'Курсы пересчёта,,,',
  ',2015,2016,2017',
  'Курс USD/RUB,"60,14","69,72",',
  'Курс EUR/USD,"1,110","1,107","1,130"',
].join('\n');

describe('mapRates', () => {
  it('turns the yearly block into Jan-1 USD-based rates, skipping blanks', () => {
    const rates = mapRates(parseCsv(CSV))._unsafeUnwrap();
    expect(rates).toEqual([
      { base: 'RUB', date: '2015-01-01', value: '0.01662786831' },
      { base: 'RUB', date: '2016-01-01', value: '0.01434308663' },
      { base: 'EUR', date: '2015-01-01', value: '1.11' },
      { base: 'EUR', date: '2016-01-01', value: '1.107' },
      { base: 'EUR', date: '2017-01-01', value: '1.13' },
    ]);
  });
  it('fails when the year header is missing', () => {
    expect(mapRates(parseCsv('a,b\n1,2')).isErr()).toBe(true);
  });
});
```

(RUB values are `1/60.14` and `1/69.72` to ten significant digits.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && bun run test`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`apps/api/scripts/import/csv.ts`:

```ts
/** RFC 4180 with CRLF tolerance. Google Sheets quotes any cell with a comma, quote or newline. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
```

`apps/api/scripts/import/numbers.ts`:

```ts
/** "2 100 675,19", "$1 259,80", "0,00" → "2100675.19", "1259.80", "0". Anything else → null. */
export function parseRuNumber(raw: string): string | null {
  const s = raw
    .replace(/[\s  ]/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const [int, frac] = s.split('.') as [string, string | undefined];
  const cleanInt = int.replace(/^(-?)0+(?=\d)/, '$1');
  if (frac === undefined || /^0+$/.test(frac)) return cleanInt;
  return `${cleanInt}.${frac}`;
}
```

`apps/api/scripts/import/accounts-mapper.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { AccountKind, CardType } from '@magermoney/domain';
import type { NewAccount } from '../../src/modules/accounts/application/account-repository.js';
import { parseRuNumber } from './numbers.js';

export class ImportError extends Error {}
export type MappedAccount = NewAccount & { balance: string };

export const COUNTRY_BY_NAME: Record<string, string> = {
  Россия: 'RU',
  Португалия: 'PT',
  Узбекистан: 'UZ',
  Казахстан: 'KZ',
  Грузия: 'GE',
  Кыргызстан: 'KG',
  Индонезия: 'ID',
  Египет: 'EG',
  Турция: 'TR',
  Армения: 'AM',
  Сербия: 'RS',
  Таиланд: 'TH',
  Вьетнам: 'VN',
  ОАЭ: 'AE',
  Crypto: 'XX',
  Cash: 'XX',
};
const NOTE_COLUMNS = [
  'Оплата',
  'Снятие',
  'Обслуживание',
  'Лимиты',
  'Именная',
  'Привилегии',
  'ApplePay',
  'NFC',
  'NFS',
  'Переводы',
  'СИМ',
  'Паспорт',
  'Подробности',
  'Бонусы',
];
const TIERS = new Set(['Classic', 'Gold', 'Platinum', 'Elite', 'Digital']);
const NETWORKS: Record<string, string> = { VISA: 'Visa', MASTERCARD: 'MasterCard', MIR: 'Mir' };

const clean = (s: string | undefined) => (s ?? '').trim();
const blank = (s: string) => s === '' || s === '-' || s === '—';
/** Flags may arrive as mojibake; keep letters only and match the name. */
const countryName = (cell: string) => cell.replace(/[^A-Za-zА-Яа-яЁё ]/g, '').trim();

function kindOf(
  name: string,
  type: string,
  country: string,
  isCrypto: boolean,
): { kind: AccountKind; tier: string | null } {
  if (TIERS.has(type)) return { kind: 'card', tier: type };
  if (country === 'Cash') return { kind: 'cash', tier: null };
  if (/Вклад/i.test(name)) return { kind: 'deposit', tier: null };
  if (type === 'Investing') return { kind: isCrypto ? 'crypto_wallet' : 'broker', tier: null };
  if (country === 'Crypto') return { kind: 'crypto_wallet', tier: null };
  return { kind: 'bank_account', tier: null };
}

export function mapAccounts(
  rows: string[][],
  opts: { known: Set<string> },
): Result<MappedAccount[], ImportError> {
  const header = rows[0]?.map(clean) ?? [];
  const col = (name: string) => header.indexOf(name);
  const need = ['Название банка', 'Страна', 'Сумма', 'Валюта', 'Тип'].filter((n) => col(n) < 0);
  if (need.length > 0) return err(new ImportError(`Missing columns: ${need.join(', ')}`));

  const out: MappedAccount[] = [];
  for (const [i, raw] of rows.slice(1).entries()) {
    const cell = (name: string) => clean(raw[col(name)]);
    const name = cell('Название банка');
    if (name === '') continue; // totals row
    const rawCountry = countryName(cell('Страна'));
    const country = COUNTRY_BY_NAME[rawCountry];
    if (!country) return err(new ImportError(`Row ${i + 2}: unknown country "${rawCountry}"`));
    const currency = cell('Валюта');
    if (!opts.known.has(currency))
      return err(
        new ImportError(
          `Row ${i + 2}: unknown currency ${currency}; add it to the currencies table first`,
        ),
      );
    const balance = parseRuNumber(cell('Сумма'));
    if (balance === null)
      return err(new ImportError(`Row ${i + 2}: unreadable amount "${cell('Сумма')}"`));
    const { kind, tier } = kindOf(
      name,
      cell('Тип'),
      rawCountry,
      country === 'XX' && rawCountry === 'Crypto',
    );
    const isCard = kind === 'card';
    const bin = cell('BIN Type').toUpperCase();
    const expires = cell('Срок действия');
    const m = /^(\d{2})\/(\d{2})$/.exec(expires);
    const cardExpires = isCard && m ? lastDayOfMonth(2000 + Number(m[2]), Number(m[1])) : null;
    const last4 = cell('Номер карты').replace(/\D/g, '').slice(-4);
    const noteLines = NOTE_COLUMNS.filter((c) => col(c) >= 0 && !blank(cell(c))).map(
      (c) => `- ${c === 'NFS' ? 'NFC' : c}: ${cell(c)}`,
    );
    out.push({
      name,
      bank: name.replace(/\s+(USD|EUR|RUB|KZT|Вклад|Инвест)$/i, ''),
      country,
      currency,
      kind,
      cardType: isCard
        ? ((bin === 'CREDIT' ? 'credit' : bin === 'DEBIT' ? 'debit' : null) as CardType | null)
        : null,
      isSpending: false,
      cardLast4: isCard && /^\d{4}$/.test(last4) ? last4 : null,
      cardNetwork: isCard
        ? (NETWORKS[cell('Платежная система').toUpperCase()] ?? (cell('Платежная система') || null))
        : null,
      cardTier: isCard ? tier : null,
      cardExpires,
      note: noteLines.length > 0 ? noteLines.join('\n') : null,
      sortOrder: out.length,
      balance,
    });
  }
  // Two accounts of one bank in one currency get a suffix so the list can tell them apart.
  const key = (a: MappedAccount) => `${a.name}|${a.currency}`;
  const counts = new Map<string, number>();
  for (const a of out) counts.set(key(a), (counts.get(key(a)) ?? 0) + 1);
  for (const a of out)
    if ((counts.get(key(a)) ?? 0) > 1)
      a.name = `${a.name} · ${a.cardTier ?? (a.kind === 'card' ? 'Card' : 'Account')}`;
  return ok(out);
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}
```

`apps/api/scripts/import/rates-mapper.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { Decimal } from '@magermoney/domain';
import { ImportError } from './accounts-mapper.js';
import { parseRuNumber } from './numbers.js';

const D = Decimal.clone({ precision: 40 });
const SIG = 10;

/**
 * The "Курсы пересчёта" block: a row of years, then "Курс USD/RUB" (rubles per
 * dollar → stored as 1/x) and "Курс EUR/USD" (dollars per euro → stored as is).
 * Every value is dated January 1 of its year.
 */
export function mapRates(
  rows: string[][],
): Result<{ base: string; date: string; value: string }[], ImportError> {
  const yearRow = rows.find((r) => r.slice(1).some((c) => /^\d{4}$/.test(c.trim())));
  if (!yearRow) return err(new ImportError('No row of years found'));
  const years = yearRow.map((c) => c.trim());
  const out: { base: string; date: string; value: string }[] = [];
  const take = (label: RegExp, base: string, invert: boolean) => {
    const row = rows.find((r) => label.test(r[0]?.trim() ?? ''));
    if (!row) return;
    for (let i = 1; i < years.length; i++) {
      if (!/^\d{4}$/.test(years[i]!)) continue;
      const n = parseRuNumber(row[i] ?? '');
      if (n === null || n === '0') continue;
      const v = invert ? new D(1).div(n) : new D(n);
      out.push({ base, date: `${years[i]}-01-01`, value: v.toSignificantDigits(SIG).toFixed() });
    }
  };
  take(/USD\/RUB/i, 'RUB', true);
  take(/EUR\/USD/i, 'EUR', false);
  return ok(out);
}
```

- [ ] **Step 4: Run tests, lint**

Run: `cd apps/api && bun run test && bun run lint && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/import apps/api/test/import
git commit -m "feat(import): parse the accounts sheet and yearly rates"
```

---

### Task 18: Import — the runner: dry-run, force, one transaction, docs

**Files:**

- Create: `apps/api/scripts/import/run.ts`, `apps/api/scripts/import-sheet.ts`
- Modify: `apps/api/package.json` (script `import`), `.gitignore` (`imports/`), `README.md`
- Test: `apps/api/test/import/run.test.ts` (argument parsing + plan rendering, no DB)

**Interfaces:**

- Consumes: Task 17 mappers, `PgAccountRepository`, `PgRateRepository`, `createDb`.
- Produces: `parseArgs(argv): ImportArgs`, `renderPlan(accounts, rates): string`, `runImport(args, sql, io)`; CLI `bun run import -- --user <email> [--accounts f] [--rates f] [--recorded-at iso] [--dry-run] [--force]`.

- [ ] **Step 1: Write the failing test**

`apps/api/test/import/run.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseArgs, renderPlan } from '../../scripts/import/run.js';

describe('import CLI', () => {
  it('parses flags and requires a user', () => {
    expect(parseArgs(['--user', 'a@b.c', '--accounts', 'x.csv', '--dry-run'])).toEqual({
      user: 'a@b.c',
      accounts: 'x.csv',
      rates: undefined,
      recordedAt: undefined,
      dryRun: true,
      force: false,
    });
    expect(() => parseArgs(['--accounts', 'x.csv'])).toThrow(/--user/);
  });
  it('renders a table and totals', () => {
    const text = renderPlan(
      [
        {
          name: 'Alfa',
          bank: 'Alfa',
          country: 'RU',
          currency: 'RUB',
          kind: 'card',
          cardType: 'debit',
          isSpending: false,
          cardLast4: '1',
          cardNetwork: null,
          cardTier: null,
          cardExpires: null,
          note: 'a\nb',
          sortOrder: 0,
          balance: '1.5',
        },
      ],
      [{ base: 'RUB', date: '2015-01-01', value: '0.01' }],
    );
    expect(text).toContain('Alfa');
    expect(text).toContain('1 accounts, 1 rates');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && bun run test`. Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`apps/api/scripts/import/run.ts`:

```ts
import { readFile } from 'node:fs/promises';
import type { Sql } from '../../src/shared/db/client.js';
import { PgAccountRepository } from '../../src/modules/accounts/infrastructure/pg-account-repository.js';
import { PgRateRepository } from '../../src/modules/rates/infrastructure/pg-rate-repository.js';
import { parseCsv } from './csv.js';
import { ImportError, mapAccounts, type MappedAccount } from './accounts-mapper.js';
import { mapRates } from './rates-mapper.js';

export interface ImportArgs {
  user: string;
  accounts: string | undefined;
  rates: string | undefined;
  recordedAt: string | undefined;
  dryRun: boolean;
  force: boolean;
}

export function parseArgs(argv: string[]): ImportArgs {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const user = get('--user');
  if (!user) throw new Error('--user <email> is required');
  return {
    user,
    accounts: get('--accounts'),
    rates: get('--rates'),
    recordedAt: get('--recorded-at'),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
  };
}

export function renderPlan(
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
): string {
  const lines = accounts.map((a) =>
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
  return [...lines, `${accounts.length} accounts, ${rates.length} rates`].join('\n');
}

class DryRun extends Error {}

export async function runImport(
  args: ImportArgs,
  sql: Sql,
  io: { log: (s: string) => void } = console,
): Promise<void> {
  const [userRow] = await sql<
    { id: string }[]
  >`select id from auth.users where email = ${args.user}`;
  if (!userRow) throw new ImportError(`No user with email ${args.user}`);
  const userId = userRow.id;
  const known = new Set(
    (await sql<{ code: string }[]>`select code from currencies`).map((r) => r.code),
  );

  const accounts = args.accounts
    ? mapAccounts(parseCsv(await readFile(args.accounts, 'utf8')), { known }).match(
        (v) => v,
        (e) => {
          throw e;
        },
      )
    : [];
  const rates = args.rates
    ? mapRates(parseCsv(await readFile(args.rates, 'utf8'))).match(
        (v) => v,
        (e) => {
          throw e;
        },
      )
    : [];
  io.log(renderPlan(accounts, rates));

  const recordedAt = args.recordedAt ?? new Date().toISOString();
  try {
    await sql.begin(async (tx) => {
      const t = tx as unknown as Sql;
      const accountRepo = new PgAccountRepository(t);
      const existing = await accountRepo.list(userId);
      if (accounts.length > 0 && existing.length > 0) {
        if (!args.force)
          throw new ImportError(
            `User already has ${existing.length} accounts; pass --force to replace the ones without transfers`,
          );
        for (const a of existing) {
          const outcome = await accountRepo.delete(userId, a.id);
          io.log(`${outcome === 'deleted' ? 'removed' : 'kept (has transfers)'}: ${a.name}`);
        }
      }
      for (const { balance, ...data } of accounts)
        await accountRepo.create(userId, data, { amount: balance, recordedAt });
      if (rates.length > 0)
        await new PgRateRepository(t).upsertMany(
          rates.map((r) => ({ ...r, source: 'manual' as const, userId })),
        );
      if (args.dryRun) throw new DryRun();
    });
    io.log(args.accounts || args.rates ? 'Imported.' : 'Nothing to import.');
  } catch (e) {
    if (e instanceof DryRun) {
      io.log('Dry run: rolled back.');
      return;
    }
    throw e;
  }
}
```

`apps/api/scripts/import-sheet.ts`:

```ts
/**
 * Imports the owner's "Счета" sheet (and the yearly rates block) from CSV files
 * that never enter the repository. Reads DATABASE_URL from the environment;
 * point it at local Supabase or, with `.env.prod.local`, at production.
 *
 *   bun run import -- --user me@example.com --accounts imports/accounts.csv --rates imports/rates.csv --dry-run
 */
import { createDb } from '../src/shared/db/client.js';
import { parseArgs, runImport } from './import/run.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (run `vercel env pull` or export it)');
const sql = createDb(url);
try {
  await runImport(parseArgs(process.argv.slice(2)), sql);
} finally {
  await sql.end();
}
```

`apps/api/package.json` scripts: add `"import": "bun --env-file=.env.local scripts/import-sheet.ts"` and document that production runs as `bun --env-file=.env.prod.local scripts/import-sheet.ts …`. Root `.gitignore`: add `imports/`.

`README.md` — add a section:

```markdown
## Import from the spreadsheet

Export the "Счета" sheet and the "Курсы пересчёта" block (History by years) as CSV into `imports/` (git-ignored), then:

    cd apps/api
    bun run import -- --user you@example.com --accounts ../../imports/accounts.csv --rates ../../imports/rates.csv --dry-run
    bun run import -- --user you@example.com --accounts ../../imports/accounts.csv --rates ../../imports/rates.csv

Every row becomes an Account with one Balance entry dated now (or `--recorded-at <ISO>`). A second run refuses unless `--force`, which replaces the accounts that have no transfers. Against production use `bun --env-file=.env.prod.local scripts/import-sheet.ts …`.
```

- [ ] **Step 4: Run tests, typecheck, lint; then a real dry run against local Supabase**

`cd apps/api && bun run test && bun run typecheck && bun run lint`. Then create a throwaway CSV from the Task 17 fixture in `imports/demo.csv`, sign up a local user (Inbucket at http://127.0.0.1:54324), and run `bun run import -- --user <that email> --accounts ../../imports/demo.csv --dry-run` — expect the table and `Dry run: rolled back.`; run without `--dry-run` and check `GET /accounts` shows seven rows; run again and expect the `--force` refusal.

- [ ] **Step 5: Commit**

```bash
git add apps/api .gitignore README.md
git commit -m "feat(import): add the spreadsheet import command"
```

---

### Task 19: E2E scenario, decisions log and phase wrap-up docs

**Files:**

- Modify: `apps/web/e2e/smoke.spec.ts`, `docs/discovery/decisions-log.md`, `docs/db/schema.dbml` (final check), `AGENTS.md`

- [ ] **Step 1: Extend the smoke scenario**

Replace the body after sign-in in `smoke.spec.ts` with:

```ts
await page.goto('/');
await expect(page.getByTestId('capital-total')).toBeVisible();

// Create two accounts through the form.
for (const [name, currency, opening] of [
  ['Alfa', 'USD', '100'],
  ['Beta', 'USD', '0'],
] as const) {
  await page.goto('/accounts/new');
  await page.getByTestId('form-name').fill(name);
  await page.getByTestId('form-bank').fill(name);
  await page.getByTestId('form-country').fill('RU');
  await page.getByTestId('form-opening').fill(opening);
  await page.getByTestId('form-submit').click();
  await expect(page.getByTestId('account-name')).toHaveText(name);
}

// Record a balance on Beta from its detail page.
await page.getByTestId('account-record').click();
await page.getByTestId('balance-amount').fill('10');
await page.getByTestId('balance-save').click();
await expect(page.getByTestId('account-balance')).toContainText('10');

// Transfer 40 from Alfa to Beta; the total stays 110, Beta shows 50.
await page.getByTestId('account-transfer').click();
const from = page.getByTestId('transfer-from');
await from.selectOption({ label: /Alfa/ });
await page.getByTestId('transfer-to').selectOption({ label: /Beta/ });
await page.getByTestId('transfer-sent').fill('40');
await page.getByTestId('transfer-save').click();
await expect(page.getByTestId('account-balance')).toContainText('50');
await page.goto('/');
await expect(page.getByTestId('capital-total')).toContainText('110');

// The display currency switch still converts everything.
await page.getByTestId('currency-switch').getByRole('button', { name: 'EUR' }).click();
await expect(page.getByTestId('capital-total')).toContainText('€');
```

Keep the user cleanup in `finally`. The test stays gated by `E2E_ENABLED`; run it locally once against `bun run dev` with the local Supabase env (`E2E_BASE_URL=http://localhost:5173` and the local `E2E_*` values from `supabase status -o env`) and record the outcome in the ledger.

- [ ] **Step 2: Decisions log and agent docs**

Append to `docs/discovery/decisions-log.md` a section `## Phase 2 (2026-09-12)` listing the six brainstorm decisions from spec §1 plus the two execution rulings (account form as a page; `PATCH /accounts/order` registered before `/:id`), and to `AGENTS.md` under Layout: `apps/api` gains `shared/db/unit-of-work.ts` + `pg-unit-of-work.ts` (every multi-table write goes through `deps.uow`), and a **Scripts** line: `apps/api/scripts/import-sheet.ts` — local only, never reads real data from the repo.

- [ ] **Step 3: Full verification**

From the repo root: `bun run lint && bun run typecheck && bun run test && bun run build`, then `bun run lint:boundaries-check`. Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e docs AGENTS.md
git commit -m "docs: record phase 2 decisions and extend the smoke scenario"
```

---

## Self-review notes

- Spec §4 routes ↔ Tasks 6, 7, 8, 10: every row of both tables has a route; `PATCH /accounts/order` is server-only as the spec says.
- Spec §5 screens ↔ Tasks 13–16; the one deviation (form as page) is ruled in Task 14 and logged in Task 19.
- Spec §6 import ↔ Tasks 17–18, including `--dry-run`, `--force`, idempotency, and the unknown-currency failure.
- Spec §7 tests ↔ property tests (Task 1), API branch coverage (6–8), concurrency + RLS (4, 9), import fixtures (17), web composables/components (12–15), e2e (19).
- Type names used across tasks: `AccountRow`, `NewAccount`, `BalanceEntryRow`, `TransferRow`, `Repos`, `UnitOfWork`, `AccountDeps`, `TransferDeps`, `MappedAccount`, `CapitalSummary`, `GroupSummary` — defined once each, in the task that produces them.
