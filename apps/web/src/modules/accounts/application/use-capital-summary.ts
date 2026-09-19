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
  isError: ComputedRef<boolean>;
  refetch: () => void;
  rateDate: ComputedRef<string>;
} {
  const { accounts, isLoading, isError, refetch } = useAccounts();
  const rates = useRates();
  const registry = useCurrencyRegistry();
  const { current } = useDisplayCurrency();
  return {
    summary: computed(() =>
      summarise(accounts.value, rates.table.value, registry.value, current.value),
    ),
    isLoading: computed(() => isLoading.value || rates.isLoading.value),
    isError: computed(() => isError.value || rates.isError.value),
    refetch: () => {
      refetch();
      rates.refetch();
    },
    rateDate: rates.date,
  };
}
