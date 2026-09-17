import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { ManualRateInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { ratesApi } from '../infrastructure/rates-api';

/** Every rate table on screen refetches after an override changes; there is no partial patch worth the risk. */
export function useManualRate() {
  const api = ratesApi(useApi());
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['rates'] });
  const set = useMutation({ mutationFn: api.setManual, onSettled: invalidate });
  const remove = useMutation({
    mutationFn: ({ base, date }: { base: string; date: string }) => api.removeManual(base, date),
    onSettled: invalidate,
  });
  return {
    set: (input: ManualRateInput) => set.mutateAsync(input),
    remove: (base: string, date: string) => remove.mutateAsync({ base, date }),
    isPending: set.isPending,
  };
}
