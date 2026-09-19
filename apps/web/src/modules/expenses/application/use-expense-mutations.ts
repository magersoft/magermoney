import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { ExpenseInput, UpdateExpenseInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { expensesApi } from '../infrastructure/expenses-api';
import { EXPENSE_CATEGORIES_KEY } from './use-expense-categories';
import { EXPENSES_KEY } from './use-expenses';

/** A save may have created a category on the fly, so both lists are refreshed. */
function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
      qc.invalidateQueries({ queryKey: EXPENSE_CATEGORIES_KEY }),
    ]);
}

export function useCreateExpense() {
  const api = expensesApi(useApi());
  const m = useMutation({ mutationFn: api.create, onSettled: useRefresh() });
  return { create: (input: ExpenseInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateExpense() {
  const api = expensesApi(useApi());
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) => api.update(id, input),
    onSettled: useRefresh(),
  });
  return {
    update: (id: string, input: UpdateExpenseInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useDeleteExpense() {
  const api = expensesApi(useApi());
  const m = useMutation({ mutationFn: api.remove, onSettled: useRefresh() });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
