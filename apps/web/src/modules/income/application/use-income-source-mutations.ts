import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type {
  IncomeSourceDto,
  IncomeSourceInput,
  UpdateIncomeSourceInput,
} from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { incomeSourcesApi } from '../infrastructure/income-sources-api';
import { INCOME_SOURCES_KEY } from './use-income-sources';

/**
 * Making a source primary clears the flag on the others server-side, so an
 * answer is patched into the list and the list is refetched anyway: the patch
 * is for the next frame, the refetch is for the truth.
 */
export function useCreateIncomeSource() {
  const api = incomeSourcesApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.create,
    onSuccess: (dto) =>
      qc.setQueryData<IncomeSourceDto[]>(INCOME_SOURCES_KEY, (list) => [...(list ?? []), dto]),
    onSettled: () => qc.invalidateQueries({ queryKey: INCOME_SOURCES_KEY }),
  });
  return { create: (input: IncomeSourceInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateIncomeSource() {
  const api = incomeSourcesApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIncomeSourceInput }) =>
      api.update(id, input),
    onSuccess: (dto) =>
      qc.setQueryData<IncomeSourceDto[]>(INCOME_SOURCES_KEY, (list) =>
        (list ?? []).map((s) => (s.id === dto.id ? dto : s)),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: INCOME_SOURCES_KEY }),
  });
  return {
    update: (id: string, input: UpdateIncomeSourceInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useDeleteIncomeSource() {
  const api = incomeSourcesApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.remove,
    onSuccess: (_v, id) =>
      qc.setQueryData<IncomeSourceDto[]>(INCOME_SOURCES_KEY, (list) =>
        (list ?? []).filter((s) => s.id !== id),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: INCOME_SOURCES_KEY }),
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
