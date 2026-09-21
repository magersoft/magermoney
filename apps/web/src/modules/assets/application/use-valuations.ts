import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { ValuationDto } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { assetsApi } from '../infrastructure/assets-api';
import { valuationsKey } from './use-assets';

/** One asset's journal of opinions about what it is worth, newest first. */
export function useValuations(assetId: MaybeRefOrGetter<string>): {
  valuations: ComputedRef<ValuationDto[]>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  refetch: () => void;
} {
  const api = assetsApi(useApi());
  const query = useQuery({
    queryKey: computed(() => valuationsKey(toValue(assetId))),
    queryFn: () => api.valuations(toValue(assetId)),
  });
  return {
    valuations: computed(() => query.data.value ?? []),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: () => void query.refetch(),
  };
}
