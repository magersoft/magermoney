import { computed, type ComputedRef, type Ref } from 'vue';
import type { AccountDto } from '@magermoney/contracts';
import {
  goalProgress,
  type CurrencyRegistry,
  type Goal,
  type GoalProgress,
  type RateTable,
} from '@magermoney/domain';
import { toAccount, useAccounts } from '@/modules/accounts';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useRates } from '@/modules/rates';

/**
 * What a goal holds. The API does not serve it (ADR 0003): it is the balances
 * of the accounts linked to the goal, converted into the goal's own currency at
 * today's rates, and rates are a client concern.
 *
 * Pure, so the segment and the goal's own screen compute the same number the
 * same way, and a test can pin both without a query client.
 */
export function progressOf(
  goal: Goal,
  accounts: readonly AccountDto[],
  table: RateTable | undefined,
  registry: CurrencyRegistry,
): GoalProgress | undefined {
  if (!table) return undefined;
  const linked = accounts.filter((a) => a.goalId === goal.id).map((a) => toAccount(a, registry));
  return goalProgress(goal, linked, table);
}

export function useGoalProgress(goal: Ref<Goal | undefined>): {
  progress: ComputedRef<GoalProgress | undefined>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
} {
  const { accounts: dtos, isLoading, isError } = useAccounts();
  const rates = useRates();
  const registry = useCurrencyRegistry();
  return {
    progress: computed(() =>
      goal.value
        ? progressOf(goal.value, dtos.value, rates.table.value, registry.value)
        : undefined,
    ),
    isLoading: computed(() => isLoading.value || rates.isLoading.value),
    isError: computed(() => isError.value || rates.isError.value),
  };
}
