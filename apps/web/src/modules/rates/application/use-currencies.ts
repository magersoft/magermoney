import { useQuery } from '@tanstack/vue-query';
import type { CurrencyDto } from '@magermoney/contracts';
import { computed, type Ref } from 'vue';
import { useApi } from '@/shared/api/use-api';
import { ratesApi } from '../infrastructure/rates-api';

const DAY_MS = 24 * 3_600_000;

/**
 * The currencies the backend knows. A new one appears in the database far more
 * often than the app is released, so this is fetched rather than compiled in —
 * and it changes at most daily, hence the long stale time.
 */
export function useCurrencies(): Ref<CurrencyDto[]> {
  const api = ratesApi(useApi());
  const query = useQuery({ queryKey: ['currencies'], queryFn: api.currencies, staleTime: DAY_MS });
  return computed(() => query.data.value ?? []);
}
