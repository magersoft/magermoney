import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { BudgetDto } from '@magermoney/contracts';
import type { Budget } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toBudget } from '../domain/mappers';
import { budgetsApi } from '../infrastructure/budgets-api';

export const BUDGETS_KEY = ['budgets'] as const;

/** Every budget, ended ones included: the segment decides what is current. */
export function useBudgets(): {
  budgets: ComputedRef<Budget[]>;
  dtos: ComputedRef<BudgetDto[]>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  refetch: () => void;
} {
  const api = budgetsApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: BUDGETS_KEY, queryFn: api.list });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    budgets: computed(() => dtos.value.map((d) => toBudget(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: () => void query.refetch(),
  };
}
