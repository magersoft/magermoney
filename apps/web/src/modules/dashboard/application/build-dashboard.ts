import {
  addDays,
  assetsTotal,
  daysToPayday,
  firstOfMonth,
  inflowsVsPlan,
  isActiveOn,
  monthPlan,
  nextPayday,
  parseIso,
  perDay,
  upcomingEvents,
  type Asset,
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
  /** Owned things. Only the ones marked for it join the capital. */
  assets: readonly Asset[];
  sources: readonly IncomeSource[];
  expenses: readonly Expense[];
  budgets: readonly Budget[];
  /**
   * Inflows of the current month and the one before it: the tiles are the
   * difference between the two, so the screen fetches both in one window.
   */
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
/**
 * One tile: a month's figure, the same figure a month earlier, and how far it
 * moved. The ratio is for the badge only — a float made from exact amounts for
 * drawing, never an amount anybody reads (ADR 0001).
 */
export interface MonthStat {
  /** This month, in the display currency. */
  amount: Money;
  /** The month before, in the display currency. What the delta is measured against. */
  previous: Money;
  /** `0.05` is +5 %. `null` when the month before held nothing to compare against. */
  delta: number | null;
}
export interface DashboardModel {
  /**
   * The accounts *and* the assets marked for the capital: what the person owns,
   * which is the question the headline number answers. `unconvertible` stays
   * the accounts' own — the assets report theirs beside it, because an Asset is
   * not an Account and the screen names them differently.
   */
  capital: CapitalSummary;
  assets: { total: Money; unconvertible: Asset[] };
  payday: { date: IsoDate | null; days: number | null; perDay: Money | null };
  plan: MonthPlan;
  /**
   * The two tiles. Income is what actually arrived; outgo is what the month is
   * planned to cost — there is no record of actual spending to draw on until
   * Spend exists (CONTEXT.md), and a tile that invented one would lie.
   */
  stats: { income: MonthStat; outgo: MonthStat };
  inflows: InflowsVsPlan;
  upcoming: UpcomingDay[];
  /** Active expenses the Upcoming list cannot place: no billing day, or yearly without a month. */
  undatedExpenses: number;
  has: { sources: boolean; outgo: boolean };
}

const isUndated = (e: Expense) =>
  e.billingDay === null || (e.period === 'yearly' && e.billingMonth === null);

/**
 * The share a month grew or shrank by. Zero last month is not a fall of 100 %
 * and not a rise of infinity — it is nothing to compare against, and the badge
 * is left out rather than made up.
 */
function stat(amount: Money, previous: Money): MonthStat {
  const before = previous.amount;
  const delta = before.isZero()
    ? null
    : amount.amount.minus(before).dividedBy(before).toDecimalPlaces(4).toNumber();
  return { amount, previous, delta };
}

/** Pure: the whole home screen. Undefined while capital, rates or the display currency are missing. */
export function buildDashboard(input: DashboardInput): DashboardModel | undefined {
  const { capital, assets, sources, expenses, budgets, inflows, table, registry, today } = input;
  const display = registry.get(input.display);
  if (!capital || !table || display.isErr()) return undefined;

  const days = daysToPayday(sources, today);
  const byDate = new Map<IsoDate, UpcomingEvent[]>();
  for (const e of upcomingEvents({ sources, expenses, today, days: UPCOMING_DAYS }))
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const activeExpenses = expenses.filter((e) => isActiveOn(e, today));
  /* The day before this month began: the month before, read the same way today is. */
  const lastMonthEnd = addDays(firstOfMonth(today), -1);
  const plan = monthPlan({ sources, expenses, budgets, table, display: display.value, today });
  const lastPlan = monthPlan({
    sources,
    expenses,
    budgets,
    table,
    display: display.value,
    today: lastMonthEnd,
  });
  const received = (of: IsoDate) => {
    const m = parseIso(of);
    return inflowsVsPlan({
      sources,
      inflows,
      month: { year: m.year, month: m.month },
      table,
      display: display.value,
    });
  };
  const thisMonth = received(today);
  /* Accounts plus the owned things: one number for everything owned. */
  const owned = assetsTotal(assets, table, display.value);
  const withAssets: CapitalSummary = {
    ...capital,
    total: capital.total.add(owned.total)._unsafeUnwrap(),
  };
  return {
    capital: withAssets,
    assets: owned,
    payday: {
      date: nextPayday(sources, today),
      days,
      perDay: days === null ? null : perDay(capital.availableUntilPayday, days),
    },
    plan,
    stats: {
      income: stat(thisMonth.totalReceived, received(lastMonthEnd).totalReceived),
      outgo: stat(plan.plannedOutgo, lastPlan.plannedOutgo),
    },
    inflows: thisMonth,
    upcoming: [...byDate.entries()].map(([date, events]) => ({ date, events })),
    undatedExpenses: activeExpenses.filter(isUndated).length,
    has: {
      sources: sources.some((s) => isActiveOn(s, today)),
      outgo: activeExpenses.length > 0 || budgets.some((b) => isActiveOn(b, today)),
    },
  };
}
