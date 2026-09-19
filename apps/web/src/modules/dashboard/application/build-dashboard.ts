import {
  daysToPayday,
  inflowsVsPlan,
  isActiveOn,
  monthPlan,
  nextPayday,
  parseIso,
  perDay,
  upcomingEvents,
  type Budget,
  type CurrencyRegistry,
  type Expense,
  type IncomeSource,
  type Inflow,
  type InflowsVsPlan,
  type IsoDate,
  type Money,
  type MonthPlan,
  type RateTable,
  type UpcomingEvent,
} from '@magermoney/domain';
import type { CapitalSummary } from '@/modules/accounts';

export const UPCOMING_DAYS = 30;

export interface DashboardInput {
  capital: CapitalSummary | undefined;
  sources: readonly IncomeSource[];
  expenses: readonly Expense[];
  budgets: readonly Budget[];
  /** Inflows of the current month only. */
  inflows: readonly Inflow[];
  table: RateTable | undefined;
  registry: CurrencyRegistry;
  display: string;
  today: IsoDate;
}
export interface UpcomingDay {
  date: IsoDate;
  events: UpcomingEvent[];
}
export interface DashboardModel {
  capital: CapitalSummary;
  payday: { date: IsoDate | null; days: number | null; perDay: Money | null };
  plan: MonthPlan;
  inflows: InflowsVsPlan;
  upcoming: UpcomingDay[];
  /** Active expenses the Upcoming list cannot place: no billing day, or yearly without a month. */
  undatedExpenses: number;
  has: { sources: boolean; outgo: boolean };
}

const isUndated = (e: Expense) =>
  e.billingDay === null || (e.period === 'yearly' && e.billingMonth === null);

/** Pure: the whole home screen. Undefined while capital, rates or the display currency are missing. */
export function buildDashboard(input: DashboardInput): DashboardModel | undefined {
  const { capital, sources, expenses, budgets, inflows, table, registry, today } = input;
  const display = registry.get(input.display);
  if (!capital || !table || display.isErr()) return undefined;

  const days = daysToPayday(sources, today);
  const { year, month } = parseIso(today);
  const byDate = new Map<IsoDate, UpcomingEvent[]>();
  for (const e of upcomingEvents({ sources, expenses, today, days: UPCOMING_DAYS }))
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const activeExpenses = expenses.filter((e) => isActiveOn(e, today));
  return {
    capital,
    payday: {
      date: nextPayday(sources, today),
      days,
      perDay: days === null ? null : perDay(capital.availableUntilPayday, days),
    },
    plan: monthPlan({ sources, expenses, budgets, table, display: display.value, today }),
    inflows: inflowsVsPlan({
      sources,
      inflows,
      month: { year, month },
      table,
      display: display.value,
    }),
    upcoming: [...byDate.entries()].map(([date, events]) => ({ date, events })),
    undatedExpenses: activeExpenses.filter(isUndated).length,
    has: {
      sources: sources.some((s) => isActiveOn(s, today)),
      outgo: activeExpenses.length > 0 || budgets.some((b) => isActiveOn(b, today)),
    },
  };
}
