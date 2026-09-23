import { computed, type ComputedRef, type Ref } from 'vue';
import { totalCapital, type Account, type Money } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import {
  filterAccounts,
  filterChoices,
  type AccountFilter,
  type FilterChoices,
  type FilterableAccount,
} from '../domain/account-filter';
import type { CapitalSummary } from './use-capital-summary';
import { useAccounts } from './use-accounts';

/**
 * The Accounts screen under a filter: which accounts it shows, what they add up
 * to, and what the filter sheet can offer.
 *
 * The total is summed again from what is shown rather than taken from the
 * summary, because a figure over a filtered stack that still counts the hidden
 * cards is the screen contradicting itself. With nothing filtered the two are
 * the same sum.
 */
export function useFilteredAccounts(
  summary: Ref<CapitalSummary | undefined>,
  filter: Ref<AccountFilter>,
): {
  shown: ComputedRef<Account[]>;
  choices: ComputedRef<FilterChoices>;
  total: ComputedRef<Money | undefined>;
  unconvertible: ComputedRef<Account[]>;
} {
  const { accounts: dtos } = useAccounts();
  const rates = useRates();
  const registry = useCurrencyRegistry();
  const { current } = useDisplayCurrency();

  /*
   * The groups are flattened: on this screen the bank is a detail of the
   * account, and the stack reads as one wallet. The summary's order survives.
   */
  const filterable = computed<FilterableAccount[]>(() => {
    const expires = new Map(dtos.value.map((d) => [d.id, d.cardExpires]));
    return (summary.value?.groups ?? [])
      .flatMap((g) => g.accounts)
      .map((a) => ({ ...a, expires: expires.get(a.id) ?? null }));
  });

  const display = computed(() => registry.value.get(current.value).unwrapOr(undefined));

  const shown = computed<Account[]>(() => {
    const table = rates.table.value;
    if (!table || !display.value) return filterable.value;
    return filterAccounts(filterable.value, filter.value, {
      table,
      display: display.value,
      today: todayIso(),
    });
  });

  const sum = computed(() => {
    const table = rates.table.value;
    if (!table || !display.value || !summary.value) return undefined;
    return totalCapital(shown.value, table, display.value);
  });

  return {
    shown,
    choices: computed(() => filterChoices(filterable.value)),
    total: computed(() => sum.value?.total),
    unconvertible: computed(() => sum.value?.unconvertible ?? []),
  };
}
