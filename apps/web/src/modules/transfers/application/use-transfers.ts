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
