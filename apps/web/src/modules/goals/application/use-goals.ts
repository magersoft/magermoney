import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { GoalDto } from '@magermoney/contracts';
import type { Goal } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toGoal } from '../domain/mappers';
import { goalsApi } from '../infrastructure/goals-api';

export const GOALS_KEY = ['goals'] as const;

/** Every goal, archived ones included: the segment decides what it shows. */
export function useGoals(): {
  goals: ComputedRef<Goal[]>;
  dtos: ComputedRef<GoalDto[]>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  refetch: () => void;
} {
  const api = goalsApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: GOALS_KEY, queryFn: api.list });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    goals: computed(() => dtos.value.map((d) => toGoal(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: () => void query.refetch(),
  };
}
