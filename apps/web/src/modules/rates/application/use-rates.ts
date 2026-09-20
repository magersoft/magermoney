import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { RateDto } from '@magermoney/contracts';
import { RateTable } from '@magermoney/domain';
import { toRate, useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { ratesApi } from '../infrastructure/rates-api';
import { todayIso } from '../domain';

/** Everything rate-shaped hangs off this root, so one invalidation reaches every day. */
export const RATES_KEY = ['rates'] as const;
/** One day's rates. `null` is the backend's today, which is a different key from any date. */
export const ratesKey = (date?: string) => ['rates', date ?? null] as const;

/**
 * The rates for a day, as the domain's `RateTable`. The registry comes from the
 * backend's currency list rather than the compiled-in defaults, so a currency
 * added to the database converts the same day it appears.
 */
export function useRates(date?: string): {
  table: ComputedRef<RateTable | undefined>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  refetch: () => void;
  date: ComputedRef<string>;
  /** The rows behind the table, unmodelled — a screen that needs to know which
   * base carries a manual override reads this instead of fetching `/rates` a
   * second time under a different query key. */
  rows: ComputedRef<RateDto[]>;
} {
  const api = ratesApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: ratesKey(date), queryFn: () => api.list(date) });

  const table = computed(() => {
    const rates = query.data.value;
    if (!rates || registry.value.all().length === 0) return undefined;
    return new RateTable(date ?? rates[0]?.date ?? todayIso(), rates.map(toRate), registry.value);
  });

  return {
    table,
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: () => void query.refetch(),
    date: computed(() => table.value?.date ?? date ?? todayIso()),
    rows: computed(() => query.data.value ?? []),
  };
}
