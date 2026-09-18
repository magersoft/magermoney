import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { UpdateInflowInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { inflowsApi } from '../infrastructure/inflows-api';
import { invalidateAfterInflow } from './invalidate';

export function useUpdateInflow() {
  const api = inflowsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInflowInput; accountIds: string[] }) =>
      api.update(id, input),
    onSettled: (_d, _e, { accountIds }) => invalidateAfterInflow(qc, accountIds),
  });
  return {
    update: (id: string, input: UpdateInflowInput, accountIds: string[]) =>
      m.mutateAsync({ id, input, accountIds }),
    isPending: m.isPending,
  };
}

export function useDeleteInflow() {
  const api = inflowsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id }: { id: string; accountIds: string[] }) => api.remove(id),
    onSettled: (_d, _e, { accountIds }) => invalidateAfterInflow(qc, accountIds),
  });
  return {
    remove: (id: string, accountIds: string[]) => m.mutateAsync({ id, accountIds }),
    isPending: m.isPending,
  };
}
