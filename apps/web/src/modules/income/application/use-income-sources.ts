import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { IncomeSourceDto } from '@magermoney/contracts';
import type { IncomeSource } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toIncomeSource } from '../domain/mappers';
import { incomeSourcesApi } from '../infrastructure/income-sources-api';

export const INCOME_SOURCES_KEY = ['income-sources'] as const;

/** Every source, ended ones included: one query, and the screens decide what "current" means with the domain's `isActiveOn`. */
export function useIncomeSources(): {
  sources: ComputedRef<IncomeSource[]>;
  dtos: ComputedRef<IncomeSourceDto[]>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
} {
  const api = incomeSourcesApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: INCOME_SOURCES_KEY, queryFn: api.list });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    sources: computed(() => dtos.value.map((d) => toIncomeSource(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
  };
}

export function useIncomeSource(
  id: MaybeRefOrGetter<string>,
): ComputedRef<IncomeSourceDto | undefined> {
  const { dtos } = useIncomeSources();
  return computed(() => dtos.value.find((s) => s.id === toValue(id)));
}
