import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQueries, useQuery } from '@tanstack/vue-query';
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

/**
 * Several accounts' journals at once, in the order the ids were given. The
 * goals module needs them to measure how fast a goal is being funded, and the
 * query keys are this module's business, not its caller's.
 */
export function useBalanceJournals(ids: MaybeRefOrGetter<string[]>): {
  journals: ComputedRef<BalanceEntryDto[][]>;
  isLoading: ComputedRef<boolean>;
} {
  const api = accountsApi(useApi());
  const queries = useQueries({
    queries: computed(() =>
      toValue(ids).map((id) => ({ queryKey: balancesKey(id), queryFn: () => api.balances(id) })),
    ),
  });
  return {
    journals: computed(() => queries.value.map((q) => q.data ?? [])),
    isLoading: computed(() => queries.value.some((q) => q.isLoading)),
  };
}
