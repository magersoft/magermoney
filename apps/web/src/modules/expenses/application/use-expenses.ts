import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { ExpenseDto } from '@magermoney/contracts';
import type { Expense } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toExpense } from '../domain/mappers';
import { expensesApi } from '../infrastructure/expenses-api';

export const EXPENSES_KEY = ['expenses'] as const;

/** Every expense, ended ones included: the segment decides what is current. */
export function useExpenses(): {
  expenses: ComputedRef<Expense[]>;
  dtos: ComputedRef<ExpenseDto[]>;
  isLoading: ComputedRef<boolean>;
} {
  const api = expensesApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: EXPENSES_KEY, queryFn: api.list });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    expenses: computed(() => dtos.value.map((d) => toExpense(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
  };
}
