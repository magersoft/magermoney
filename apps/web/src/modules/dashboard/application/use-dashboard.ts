import { computed, type ComputedRef } from 'vue';
import { firstOfMonth, lastOfMonth } from '@magermoney/domain';
import { useCapitalSummary } from '@/modules/accounts';
import { useBudgets } from '@/modules/budgets';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useExpenses } from '@/modules/expenses';
import { useIncomeSources, useInflows } from '@/modules/income';
import { todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { buildDashboard, type DashboardModel } from './build-dashboard';

/** The home screen has no data of its own (CONTEXT.md, Dashboard): it composes what the other modules already hold. */
export function useDashboard(): {
  model: ComputedRef<DashboardModel | undefined>;
  isLoading: ComputedRef<boolean>;
  rateDate: ComputedRef<string>;
} {
  const today = todayIso();
  const capital = useCapitalSummary();
  const sources = useIncomeSources();
  const expenses = useExpenses();
  const budgets = useBudgets();
  const inflows = useInflows(() => ({ from: firstOfMonth(today), to: lastOfMonth(today) }));
  const rates = useRates();
  const registry = useCurrencyRegistry();
  const { current } = useDisplayCurrency();

  return {
    model: computed(() =>
      buildDashboard({
        capital: capital.summary.value,
        sources: sources.sources.value,
        expenses: expenses.expenses.value,
        budgets: budgets.budgets.value,
        inflows: inflows.inflows.value,
        table: rates.table.value,
        registry: registry.value,
        display: current.value,
        today,
      }),
    ),
    isLoading: computed(
      () =>
        capital.isLoading.value ||
        sources.isLoading.value ||
        expenses.isLoading.value ||
        budgets.isLoading.value ||
        inflows.isLoading.value,
    ),
    rateDate: capital.rateDate,
  };
}
