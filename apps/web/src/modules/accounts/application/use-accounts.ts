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
  isError: ComputedRef<boolean>;
  refetch: () => void;
} {
  const api = accountsApi(useApi());
  const query = useQuery({ queryKey: ACCOUNTS_KEY, queryFn: api.list });
  return {
    accounts: computed(() => query.data.value ?? []),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: () => void query.refetch(),
  };
}

export function useAccount(id: MaybeRefOrGetter<string>): ComputedRef<AccountDto | undefined> {
  const { accounts } = useAccounts();
  return computed(() => accounts.value.find((a) => a.id === toValue(id)));
}
