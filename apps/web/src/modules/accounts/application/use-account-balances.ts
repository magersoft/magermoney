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
