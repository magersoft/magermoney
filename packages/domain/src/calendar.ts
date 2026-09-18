import type { IsoDate } from './rate.js';

/**
 * Calendar arithmetic on `YYYY-MM-DD` strings. Everything goes through
 * `Date.UTC`, so the answer never depends on the machine's time zone, and two
 * IsoDates compare correctly with `<` and `>` as plain strings.
 */
export interface YearMonth {
  year: number;
  /** 1..12 */
  month: number;
}

const DAY_MS = 86_400_000;
const pad = (n: number, width: number) => String(n).padStart(width, '0');

export function parseIso(d: IsoDate): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = d.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function toIso(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

const toUtc = (d: IsoDate): number => {
  const { year, month, day } = parseIso(d);
  return Date.UTC(year, month - 1, day);
};

/** Day 0 of the next month is the last day of this one. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A day beyond the month's length falls on the month's last day: the 31st in February is the 28th or 29th. */
export function clampDay(year: number, month: number, day: number): IsoDate {
  return toIso(year, month, Math.min(day, daysInMonth(year, month)));
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return new Date(toUtc(d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** `to − from` in whole days; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function firstOfMonth(d: IsoDate): IsoDate {
  const { year, month } = parseIso(d);
  return toIso(year, month, 1);
}

export function lastOfMonth(d: IsoDate): IsoDate {
  const { year, month } = parseIso(d);
  return toIso(year, month, daysInMonth(year, month));
}

/** Every month the inclusive range touches, in order; empty when `from` is after `to`. */
export function monthsTouching(from: IsoDate, to: IsoDate): YearMonth[] {
  if (from > to) return [];
  const end = parseIso(to);
  let { year, month } = parseIso(from);
  const months: YearMonth[] = [];
  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
