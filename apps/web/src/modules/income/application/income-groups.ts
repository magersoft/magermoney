import type { IncomeSourceDto } from '@magermoney/contracts';
import {
  Money,
  netMonthly,
  type CurrencyRegistry,
  type IncomeSource,
  type IsoDate,
  type RateTable,
} from '@magermoney/domain';
import { toIncomeSource } from '../domain/mappers';

/** What a source brings per month, in its own currency. */
export interface IncomeRowModel {
  source: IncomeSource;
  net: Money;
}

/**
 * The two kinds of income there are. A source with pay days is money with a
 * date on it; one without is money that will arrive, some time this month. They
 * plan differently, so they are read apart.
 */
export type IncomeGroupKind = 'scheduled' | 'irregular';

export interface IncomeGroup {
  kind: IncomeGroupKind;
  rows: IncomeRowModel[];
  /** Net monthly total of the group in the display currency. */
  total: Money;
}

export interface IncomeGroups {
  groups: IncomeGroup[];
  /** Net monthly income of every current source, in the display currency. */
  net: Money;
  ended: IncomeSource[];
  unconvertible: IncomeSource[];
}

/** Primary first, then by name: the primary source is the one the dashboard counts days to. */
const byPrimaryThenName = (a: IncomeSource, b: IncomeSource) =>
  Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name);

/** Pure: the Income segment. Undefined while rates or the display currency are missing. */
export function groupIncome(
  dtos: readonly IncomeSourceDto[],
  table: RateTable | undefined,
  registry: CurrencyRegistry,
  display: string,
  today: IsoDate,
): IncomeGroups | undefined {
  const currency = registry.get(display);
  if (!table || currency.isErr()) return undefined;
  const zero = Money.zero(currency.value);
  const all = dtos.map((d) => toIncomeSource(d, registry));
  /* A source that starts next month is already part of the plan — the reading
   * the Expenses and Budgets segments give something that has not begun yet.
   * "Ended" is the only thing that takes a row out of the list. */
  const current = all.filter((s) => s.activeTo === null || s.activeTo >= today);
  const unconvertible: IncomeSource[] = [];
  let net = zero;

  const groups: IncomeGroup[] = [];
  for (const kind of ['scheduled', 'irregular'] as const) {
    const sources = current
      .filter((s) => (kind === 'scheduled' ? s.payDays.length > 0 : s.payDays.length === 0))
      .sort(byPrimaryThenName);
    /* An empty group is a heading over nothing, so it is not a group at all. */
    if (sources.length === 0) continue;
    let total = zero;
    const rows: IncomeRowModel[] = [];
    for (const source of sources) {
      const own = netMonthly(source);
      rows.push({ source, net: own });
      const converted = table.convert(own, display);
      /* Countable or not, it stays a row: what it brings is simply unknown here. */
      if (converted.isErr()) unconvertible.push(source);
      else {
        total = total.add(converted.value)._unsafeUnwrap();
        net = net.add(converted.value)._unsafeUnwrap();
      }
    }
    groups.push({ kind, rows, total });
  }

  return {
    groups,
    net,
    ended: all.filter((s) => s.activeTo !== null && s.activeTo < today).sort(byPrimaryThenName),
    unconvertible,
  };
}
