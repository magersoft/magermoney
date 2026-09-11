import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { RateTable } from '@magermoney/domain';
import { toRate, useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { ratesApi } from '../infrastructure/rates-api';
import { todayIso } from '../domain';

/**
 * The rates for a day, as the domain's `RateTable`. The registry comes from the
 * backend's currency list rather than the compiled-in defaults, so a currency
 * added to the database converts the same day it appears.
 */
export function useRates(date?: string): {
  table: ComputedRef<RateTable | undefined>;
  isLoading: ComputedRef<boolean>;
  date: ComputedRef<string>;
} {
  const api = ratesApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: ['rates', date ?? null], queryFn: () => api.list(date) });

  const table = computed(() => {
    const rates = query.data.value;
    if (!rates || registry.value.all().length === 0) return undefined;
    return new RateTable(date ?? rates[0]?.date ?? todayIso(), rates.map(toRate), registry.value);
  });

  return {
    table,
    isLoading: computed(() => query.isLoading.value),
    date: computed(() => table.value?.date ?? date ?? todayIso()),
  };
}
