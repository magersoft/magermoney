import { describe, expect, it } from 'vitest';
import {
  addDays,
  clampDay,
  daysBetween,
  daysInMonth,
  firstOfMonth,
  lastOfMonth,
  monthsTouching,
  parseIso,
  toIso,
} from '../src/index.js';

describe('calendar', () => {
  it('parses and formats an ISO date', () => {
    expect(parseIso('2026-09-17')).toEqual({ year: 2026, month: 9, day: 17 });
    expect(toIso(2026, 9, 7)).toBe('2026-09-07');
    expect(toIso(987, 1, 1)).toBe('0987-01-01');
  });
  it('knows the length of every month, leap years included', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
  it('clamps a day beyond the month onto its last day', () => {
    expect(clampDay(2026, 2, 31)).toBe('2026-02-28');
    expect(clampDay(2028, 2, 30)).toBe('2028-02-29');
    expect(clampDay(2026, 9, 10)).toBe('2026-09-10');
  });
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-17', 0)).toBe('2026-09-17');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-17', 62)).toBe('2026-11-18');
  });
  it('counts whole days between two dates, across a DST change too', () => {
    expect(daysBetween('2026-09-17', '2026-09-17')).toBe(0);
    expect(daysBetween('2026-09-17', '2026-09-25')).toBe(8);
    expect(daysBetween('2026-09-25', '2026-09-17')).toBe(-8);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
  it('finds the first and the last day of a month', () => {
    expect(firstOfMonth('2026-02-17')).toBe('2026-02-01');
    expect(lastOfMonth('2026-02-17')).toBe('2026-02-28');
    expect(lastOfMonth('2026-12-01')).toBe('2026-12-31');
  });
  it('lists every month an inclusive range touches', () => {
    expect(monthsTouching('2026-09-17', '2026-09-30')).toEqual([{ year: 2026, month: 9 }]);
    expect(monthsTouching('2026-11-30', '2027-02-01')).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
    expect(monthsTouching('2026-09-18', '2026-09-17')).toEqual([]);
  });
});
