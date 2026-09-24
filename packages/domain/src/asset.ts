import type { Currency } from './currency.js';
import type { MarkColor } from './mark.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';
import type { RateTable } from './rate-table.js';

/** One entry of an Asset's valuation journal. */
export interface Valuation {
  id: string;
  value: Money;
  valuedOn: IsoDate;
}

/**
 * Something owned that is worth money but is not money: a car, a watch. Its
 * worth is an opinion with a date, so it is kept as a journal and the current
 * value is simply the last entry — never a second copy of the number.
 */
export interface Asset {
  id: string;
  name: string;
  /** One emoji, or null to show the first letter of the name. */
  icon: string | null;
  color: MarkColor | null;
  /** The latest valuation, or null while the Asset has never been valued. */
  value: Money | null;
  valuedOn: IsoDate | null;
  /** Whether this Asset is part of the capital on the Home screen. */
  countsInTotal: boolean;
  acquiredOn: IsoDate | null;
  purchasePrice: Money | null;
  archived: boolean;
}

/** An Asset carrying a value: what `assetsTotal` is allowed to add up. */
interface ValuedAsset extends Asset {
  value: Money;
}

const isValued = (a: Asset): a is ValuedAsset => a.value !== null;

export function assetValue(valuations: readonly Valuation[]): Valuation | null {
  let latest: Valuation | null = null;
  for (const v of valuations) if (!latest || v.valuedOn > latest.valuedOn) latest = v;
  return latest;
}

/**
 * What the owned things add to the capital: the Assets marked for it, in the
 * display currency. An Asset whose currency today's rates cannot price is
 * listed rather than counted as zero, as `totalCapital` lists an Account —
 * but there is no Account to list, so it is reported by its own id.
 */
export function assetsTotal(
  assets: readonly Asset[],
  table: RateTable,
  display: Currency,
): { total: Money; unconvertible: Asset[] } {
  let total = Money.zero(display);
  const unconvertible: Asset[] = [];
  for (const a of assets.filter((x) => !x.archived && x.countsInTotal).filter(isValued)) {
    const converted = table.convert(a.value, display.code);
    if (converted.isErr()) {
      unconvertible.push(a);
      continue;
    }
    total = total.add(converted.value)._unsafeUnwrap();
  }
  return { total, unconvertible };
}
