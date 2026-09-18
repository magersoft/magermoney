import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { ExpenseCategoryDto } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { expensesApi } from '../infrastructure/expenses-api';

export const EXPENSE_CATEGORIES_KEY = ['expense-categories'] as const;

export function useExpenseCategories(): { categories: ComputedRef<ExpenseCategoryDto[]> } {
  const api = expensesApi(useApi());
  const query = useQuery({ queryKey: EXPENSE_CATEGORIES_KEY, queryFn: api.categories });
  return { categories: computed(() => query.data.value ?? []) };
}
