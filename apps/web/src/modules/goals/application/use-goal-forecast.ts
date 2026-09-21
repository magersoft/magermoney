import { computed, type ComputedRef, type Ref } from 'vue';
import type { AccountDto, BalanceEntryDto } from '@magermoney/contracts';
import {
  FORECAST_WINDOW_MONTHS,
  Money,
  goalForecast,
  lastOfMonth,
  monthsTouching,
  toIso,
  type CurrencyRegistry,
  type Goal,
  type GoalForecast,
  type GoalProgress,
  type MonthlyBalance,
  type RateTable,
  type YearMonth,
} from '@magermoney/domain';
import { useBalanceJournals } from '@/modules/accounts';
import { useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useRates } from '@/modules/rates';

/** The last calendar day of the month — the day a month's closing balance is read on. */
const lastOf = (m: YearMonth) => lastOfMonth(toIso(m.year, m.month, 1));

/**
 * One linked account's balance at the end of each month in the window. The
 * journal is newest first, so the closing balance of a month is the last entry
 * dated on or before that month's end — and a month with no entry keeps the
 * previous one's, which is what a balance means.
 */
function closingBalances(
  entries: readonly BalanceEntryDto[],
  months: YearMonth[],
): (string | null)[] {
  const oldestFirst = [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return months.map((m) => {
    const end = lastOf(m);
    let amount: string | null = null;
    for (const e of oldestFirst) {
      if (e.recordedAt.slice(0, 10) > end) break;
      amount = e.amount;
    }
    return amount;
  });
}

/**
 * The linked accounts' closing totals, month by month, in the goal's currency.
 * A month an account cannot be priced in is simply not counted for that month —
 * the forecast is a rate, and a rate measured over a gap is still a rate.
 */
export function monthlySeries(
  goal: Goal,
  linked: readonly AccountDto[],
  journals: readonly (readonly BalanceEntryDto[])[],
  table: RateTable,
  registry: CurrencyRegistry,
  today: string,
): MonthlyBalance[] {
  const months = monthsTouching(shiftMonths(today, FORECAST_WINDOW_MONTHS - 1), today);
  const perAccount = journals.map((j) => closingBalances(j, months));
  return months.map((month, i) => {
    let total = Money.zero(goal.target.currency);
    for (const [a, account] of linked.entries()) {
      const amount = perAccount[a]?.[i];
      if (amount == null) continue;
      const currency = registry.get(account.currency).unwrapOr(goal.target.currency);
      const converted = table.convert(Money.of(amount, currency), goal.target.currency.code);
      if (converted.isOk()) total = total.add(converted.value)._unsafeUnwrap();
    }
    return { month, total };
  });
}

/** `today` minus n whole months, as an IsoDate — first of that month is enough for `monthsTouching`. */
function shiftMonths(today: string, n: number): string {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) - n;
  return toIso(Math.floor(total / 12), (total % 12) + 1, 1);
}

/**
 * When the goal is reached at the rate it is actually being funded at. The
 * client assembles the series because the conversion needs a rate table, which
 * the domain deliberately does not carry.
 */
export function useGoalForecast(
  goal: Ref<Goal | undefined>,
  progress: Ref<GoalProgress | undefined>,
  linked: Ref<AccountDto[]>,
): { forecast: ComputedRef<GoalForecast | undefined>; isLoading: ComputedRef<boolean> } {
  const rates = useRates();
  const registry = useCurrencyRegistry();
  const { journals, isLoading: journalsLoading } = useBalanceJournals(() =>
    linked.value.map((a) => a.id),
  );

  return {
    forecast: computed(() => {
      const g = goal.value;
      const p = progress.value;
      const table = rates.table.value;
      if (!g || !p || !table) return undefined;
      if (journalsLoading.value) return undefined;
      const series = monthlySeries(
        g,
        linked.value,
        journals.value,
        table,
        registry.value,
        todayIso(),
      );
      return goalForecast(g, p, series, todayIso());
    }),
    isLoading: computed(() => rates.isLoading.value || journalsLoading.value),
  };
}
