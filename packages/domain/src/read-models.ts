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
