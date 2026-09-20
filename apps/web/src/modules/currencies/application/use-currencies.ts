import { computed, type ComputedRef, type Ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { CurrencyDto } from '@magermoney/contracts';
import { CurrencyRegistry } from '@magermoney/domain';
import { useApi } from '@/shared/api/use-api';
import { currenciesApi } from '../infrastructure/currencies-api';
import { toCurrency } from '../domain/mappers';
import { CATALOGUE_KEY, CURRENCIES_KEY } from './query-keys';

const DAY_MS = 24 * 3_600_000;

/**
 * The currencies this person has connected — what every form offers and what
 * the rates screen lists. Not the catalogue: that runs to a couple of hundred
 * entries, and nobody holds Kuwaiti dinars because they exist.
 */
export function useCurrencies(): Ref<CurrencyDto[]> {
  const api = currenciesApi(useApi());
  const query = useQuery({ queryKey: CURRENCIES_KEY, queryFn: api.list, staleTime: DAY_MS });
  return computed(() => query.data.value ?? []);
}

/**
 * Every currency the app knows, for the one screen that connects a new one.
 * Fetched lazily and kept for the session: it is large, it never changes
 * between releases of the database, and no other screen needs it.
 */
export function useCurrencyCatalogue(enabled?: Ref<boolean>): {
  currencies: Ref<CurrencyDto[]>;
  isLoading: Ref<boolean>;
} {
  const api = currenciesApi(useApi());
  const query = useQuery({
    queryKey: CATALOGUE_KEY,
    queryFn: api.catalogue,
    staleTime: Infinity,
    ...(enabled ? { enabled } : {}),
  });
  return {
    currencies: computed(() => query.data.value ?? []),
    isLoading: computed(() => query.isLoading.value),
  };
}

/**
 * Connecting and disconnecting. Both answer by replacing the connected list, so
 * the forms behind the screen see the new currency without a round trip; the
 * rates are invalidated too, because connecting fetches one server-side.
 */
export function useConnectedCurrencies() {
  const api = currenciesApi(useApi());
  const qc = useQueryClient();
  /*
   * Connecting answers with the new list, so writing it into the cache is the
   * whole update — invalidating on top of that would throw the fresh answer
   * away and fetch it again. The rates are a different matter: the backend
   * fetched one for the new currency, and every converted amount on screen
   * reads `['rates', …]`.
   */
  const connect = useMutation({
    mutationFn: api.connect,
    onSuccess: (list) => {
      qc.setQueryData(CURRENCIES_KEY, list);
      void qc.invalidateQueries({ queryKey: ['rates'] });
    },
  });
  /** A 204 carries no list, so this one does have to go back and read it. */
  const disconnect = useMutation({
    mutationFn: api.disconnect,
    onSuccess: () => qc.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  });

  return {
    connect: (code: string) => connect.mutateAsync(code),
    disconnect: (code: string) => disconnect.mutateAsync(code),
    isPending: computed(() => connect.isPending.value || disconnect.isPending.value),
  };
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
