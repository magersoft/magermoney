import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { BudgetInput, UpdateBudgetInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { budgetsApi } from '../infrastructure/budgets-api';
import { BUDGETS_KEY } from './use-budgets';

export function useCreateBudget() {
  const api = budgetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.create,
    onSettled: () => qc.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
  return { create: (input: BudgetInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateBudget() {
  const api = budgetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) => api.update(id, input),
    onSettled: () => qc.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
  return {
    update: (id: string, input: UpdateBudgetInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useDeleteBudget() {
  const api = budgetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.remove,
    onSettled: () => qc.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
