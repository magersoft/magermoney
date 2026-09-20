import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useApi } from '@/shared/api/use-api';
import { ratesApi } from '../infrastructure/rates-api';
import { RATES_KEY } from './use-rates';

/**
 * Fetching today's rates on the user's say-so.
 *
 * Invalidating `RATES_KEY` is the whole propagation: every screen that shows a
 * converted amount — the home totals, the accounts stack — reads the same
 * `['rates', …]` query rather than converting server-side, so they all pick up
 * the new numbers without knowing a refresh happened.
 */
export function useRefreshRates() {
  const api = ratesApi(useApi());
  const qc = useQueryClient();
  const refresh = useMutation({
    mutationFn: api.refresh,
    onSuccess: () => qc.invalidateQueries({ queryKey: RATES_KEY }),
  });
  return {
    /** Resolves with `refreshed: false` when the rates were already fresh. */
    refresh: () => refresh.mutateAsync(),
    isPending: refresh.isPending,
  };
}
