import { computed, type ComputedRef, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { CurrencyDto } from '@magermoney/contracts';
import { CurrencyRegistry } from '@magermoney/domain';
import { useApi } from '@/shared/api/use-api';
import { currenciesApi } from '../infrastructure/currencies-api';
import { toCurrency } from '../domain/mappers';

const DAY_MS = 24 * 3_600_000;

/**
 * The currencies the backend knows. A new one appears in the database far more
 * often than the app is released, so this is fetched rather than compiled in —
 * and it changes at most daily, hence the long stale time.
 */
export function useCurrencies(): Ref<CurrencyDto[]> {
  const api = currenciesApi(useApi());
  const query = useQuery({ queryKey: ['currencies'], queryFn: api.list, staleTime: DAY_MS });
  return computed(() => query.data.value ?? []);
}

/**
 * The same list as the domain's registry, which is what conversion needs. Empty
 * until the list arrives: an empty registry knows no currency, so a conversion
 * attempted too early fails loudly instead of guessing a scale.
 */
export function useCurrencyRegistry(): ComputedRef<CurrencyRegistry> {
  const currencies = useCurrencies();
  return computed(() => new CurrencyRegistry(currencies.value.map(toCurrency)));
}
