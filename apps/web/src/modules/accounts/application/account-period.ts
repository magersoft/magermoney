/**
 * One account, one month: what moved on it, when, and where each movement came
 * from. Pure — no Vue, no i18n, no rates. The screen decides what the months
 * and the origins are called.
 *
 * Balances are declared, not computed (CONTEXT.md, Balance entry), so a
 * movement is not stored anywhere: it is the difference between an entry and
 * the entry before it. That difference is what the owner actually reads as an
 * operation, and it is the only figure on this screen that is not written down
 * in the journal.
 *
 * The very first entry an account ever had has nothing before it. It is read as
 * the money arriving: an account that was opened with 1 000 did receive 1 000,
 * and a screen that showed that month as empty would be hiding the one movement
 * it has.
 */
import type { BalanceEntryDto } from '@magermoney/contracts';
import { Decimal, firstOfMonth, lastOfMonth, type IsoDate } from '@magermoney/domain';

export type MovementOrigin = BalanceEntryDto['origin'];

/** One entry, read as the operation it performed. */
export interface AccountMovement {
  /** The entry's id: the row leads back to the entry it was derived from. */
  id: string;
  /** The local calendar day it fell on — the day the owner lived through. */
  day: IsoDate;
  recordedAt: string;
  origin: MovementOrigin;
  /** Signed and exact: `-200`, `700`. */
  delta: string;
  /** The balance the entry declared. */
  balance: string;
  note: string | null;
}

/** A day of the month, and everything that moved on it. */
export interface MovementDay {
  day: IsoDate;
  /** The day's net change, signed. */
  subtotal: string;
  /** Newest first, as the journal reads. */
  movements: AccountMovement[];
}

/** One slice of the ring: everything that came from one origin, by magnitude. */
export interface OriginSlice {
  origin: MovementOrigin;
  /** Exact, unsigned. */
  amount: string;
  /** The same figure as a float, for drawing the arc only (ADR 0001). */
  value: number;
}

export interface AccountPeriod {
  /** The month this covers, as its first day. */
  from: IsoDate;
  to: IsoDate;
  /** Newest day first. */
  days: MovementDay[];
  /** What came in, what went out — both unsigned. */
  incoming: string;
  outgoing: string;
  /** `incoming + outgoing`: what the ring is a picture of. */
  turnover: string;
  /** `incoming − outgoing`: what the month did to the balance. */
  net: string;
  /** The turnover split by origin, largest slice first. */
  byOrigin: OriginSlice[];
  /** Movements in the month, zero-sized ones included. */
  count: number;
}

/** The local day an instant fell on, as the calendar string the rest of the app speaks. */
function localDay(iso: string): IsoDate {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Newest first, with the id breaking a tie so two entries of the same instant keep an order. */
const byNewest = (a: BalanceEntryDto, b: BalanceEntryDto) =>
  b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id);

/**
 * The whole month, from the account's journal. `anchor` is any day inside the
 * month — the screen holds one date and steps it by months.
 */
export function accountPeriod(entries: readonly BalanceEntryDto[], anchor: IsoDate): AccountPeriod {
  const from = firstOfMonth(anchor);
  const to = lastOfMonth(anchor);
  /* Sorted here rather than trusted: the order decides what every delta means. */
  const sorted = [...entries].sort(byNewest);

  const movements: AccountMovement[] = [];
  for (const [i, e] of sorted.entries()) {
    const day = localDay(e.recordedAt);
    if (day < from || day > to) continue;
    const before = sorted[i + 1];
    const delta = before ? new Decimal(e.amount).minus(before.amount) : new Decimal(e.amount);
    movements.push({
      id: e.id,
      day,
      recordedAt: e.recordedAt,
      origin: e.origin,
      delta: delta.toString(),
      balance: e.amount,
      note: e.note,
    });
  }

  let incoming = new Decimal(0);
  let outgoing = new Decimal(0);
  const byOrigin = new Map<MovementOrigin, Decimal>();
  for (const m of movements) {
    const d = new Decimal(m.delta);
    if (d.isPositive()) incoming = incoming.plus(d);
    else outgoing = outgoing.plus(d.abs());
    if (d.isZero()) continue;
    byOrigin.set(m.origin, (byOrigin.get(m.origin) ?? new Decimal(0)).plus(d.abs()));
  }

  return {
    from,
    to,
    days: groupByDay(movements),
    incoming: incoming.toString(),
    outgoing: outgoing.toString(),
    turnover: incoming.plus(outgoing).toString(),
    net: incoming.minus(outgoing).toString(),
    byOrigin: [...byOrigin.entries()]
      .map(([origin, amount]) => ({ origin, amount: amount.toString(), value: amount.toNumber() }))
      .sort((a, b) => b.value - a.value || a.origin.localeCompare(b.origin)),
    count: movements.length,
  };
}

function groupByDay(movements: readonly AccountMovement[]): MovementDay[] {
  const days: MovementDay[] = [];
  for (const m of movements) {
    const last = days.at(-1);
    if (last?.day === m.day) last.movements.push(m);
    else days.push({ day: m.day, subtotal: '0', movements: [m] });
  }
  return days.map((d) => ({ ...d, subtotal: sum(d.movements) }));
}

const sum = (movements: readonly AccountMovement[]) =>
  movements.reduce((total, m) => total.plus(m.delta), new Decimal(0)).toString();

/**
 * The list under the ring, narrowed to the slice that was picked. Subtotals are
 * re-added from what is left: a day heading that still counted the movements it
 * no longer shows would be the screen contradicting itself.
 */
export function movementDays(period: AccountPeriod, origin: MovementOrigin | null): MovementDay[] {
  if (!origin) return period.days;
  return period.days
    .map((d) => {
      const movements = d.movements.filter((m) => m.origin === origin);
      return { day: d.day, movements, subtotal: sum(movements) };
    })
    .filter((d) => d.movements.length > 0);
}

/**
 * How far a month moved against the one before it, as a ratio for the badge.
 * A month before that held nothing is not a rise of infinity — it is nothing to
 * compare against, and the badge is left out rather than made up.
 */
export function periodShare(amount: string, previous: string): number | null {
  const before = new Decimal(previous);
  if (before.isZero()) return null;
  return new Decimal(amount).minus(before).dividedBy(before).toDecimalPlaces(4).toNumber();
}
