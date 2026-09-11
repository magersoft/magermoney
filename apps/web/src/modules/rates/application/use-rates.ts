import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { CurrencyRegistry, RateTable } from '@magermoney/domain';
import { useApi } from '@/shared/api/use-api';
import { ratesApi } from '../infrastructure/rates-api';
import { toCurrency, toRate, todayIso } from '../domain';
import { useCurrencies } from './use-currencies';

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
  const currencies = useCurrencies();
  const query = useQuery({ queryKey: ['rates', date ?? null], queryFn: () => api.list(date) });

  const registry = computed(() => new CurrencyRegistry(currencies.value.map(toCurrency)));

  const table = computed(() => {
    const rates = query.data.value;
    if (!rates || currencies.value.length === 0) return undefined;
    return new RateTable(date ?? rates[0]?.date ?? todayIso(), rates.map(toRate), registry.value);
  });

  return {
    table,
    isLoading: computed(() => query.isLoading.value),
    date: computed(() => table.value?.date ?? date ?? todayIso()),
  };
}
