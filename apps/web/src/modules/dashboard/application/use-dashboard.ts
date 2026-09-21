import { computed, type ComputedRef } from 'vue';
import { addDays, firstOfMonth, lastOfMonth } from '@magermoney/domain';
import { useCapitalSummary } from '@/modules/accounts';
import { useAssets } from '@/modules/assets';
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
  /** Any of the composed lists failed: every number here is derived from all of
   * them at once, so one missing answer makes the whole screen wrong rather
   * than incomplete. The screen says so instead of showing a total. */
  isError: ComputedRef<boolean>;
  refetch: () => void;
  rateDate: ComputedRef<string>;
} {
  const today = todayIso();
  const capital = useCapitalSummary();
  const assets = useAssets();
  const sources = useIncomeSources();
  const expenses = useExpenses();
  const budgets = useBudgets();
  /* Two months in one window: the income tile is this month against the last. */
  const inflows = useInflows(() => ({
    from: firstOfMonth(addDays(firstOfMonth(today), -1)),
    to: lastOfMonth(today),
  }));
  const rates = useRates();
  const registry = useCurrencyRegistry();
  const { current } = useDisplayCurrency();

  return {
    model: computed(() =>
      buildDashboard({
        capital: capital.summary.value,
        assets: assets.assets.value,
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
        assets.isLoading.value ||
        sources.isLoading.value ||
        expenses.isLoading.value ||
        budgets.isLoading.value ||
        inflows.isLoading.value,
    ),
    isError: computed(
      () =>
        capital.isError.value ||
        assets.isError.value ||
        sources.isError.value ||
        expenses.isError.value ||
        budgets.isError.value ||
        inflows.isError.value,
    ),
    refetch: () => {
      capital.refetch();
      assets.refetch();
      sources.refetch();
      expenses.refetch();
      budgets.refetch();
      inflows.refetch();
    },
    rateDate: capital.rateDate,
  };
}
