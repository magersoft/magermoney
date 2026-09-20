import { describe, expect, it } from 'vitest';
import type { BalanceEntryDto } from '@magermoney/contracts';
import {
  accountPeriod,
  movementDays,
  periodShare,
} from '../src/modules/accounts/application/account-period.js';

/**
 * Entries are written at local noon on purpose: the screen groups movements by
 * the day the owner lived through, and a UTC midnight would land on the day
 * before in half the world's time zones.
 */
const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour).toISOString();

let n = 0;
const entry = (amount: string, recordedAt: string, over: Partial<BalanceEntryDto> = {}) =>
  ({
    id: `e${(n += 1)}`,
    accountId: 'a',
    amount,
    recordedAt,
    origin: 'manual',
    transferId: null,
    inflowId: null,
    note: null,
    ...over,
  }) satisfies BalanceEntryDto;

/* The journal as the API hands it over: newest first. */
const journal = [
  entry('1500', at(2026, 9, 20), { origin: 'transfer', transferId: 't1' }),
  entry('1700', at(2026, 9, 20, 9), { origin: 'inflow', inflowId: 'i1', note: 'Аванс' }),
  entry('1000', at(2026, 9, 5)),
  entry('900', at(2026, 8, 28)),
];

describe('accountPeriod', () => {
  it('reads every entry of the month as the movement it made against the one before it', () => {
    const p = accountPeriod(journal, '2026-09-11');
    expect(p.days.map((d) => d.day)).toEqual(['2026-09-20', '2026-09-05']);
    expect(p.days[0]?.movements.map((m) => m.delta)).toEqual(['-200', '700']);
    expect(p.days[0]?.subtotal).toBe('500');
    expect(p.days[1]?.movements.map((m) => m.delta)).toEqual(['100']);
    expect(p.count).toBe(3);
  });

  it('counts what came in and what went out apart, and the turnover as their sum', () => {
    const p = accountPeriod(journal, '2026-09-11');
    expect(p.incoming).toBe('800');
    expect(p.outgoing).toBe('200');
    expect(p.turnover).toBe('1000');
    expect(p.net).toBe('600');
  });

  it('splits the turnover by where the movement came from, largest slice first', () => {
    const p = accountPeriod(journal, '2026-09-11');
    expect(p.byOrigin.map((s) => [s.origin, s.amount])).toEqual([
      ['inflow', '700'],
      ['transfer', '200'],
      ['manual', '100'],
    ]);
    expect(p.byOrigin[0]?.value).toBe(700);
  });

  it('takes the first entry an account ever had as the money arriving on it', () => {
    const p = accountPeriod(journal, '2026-08-15');
    expect(p.days[0]?.movements.map((m) => m.delta)).toEqual(['900']);
    expect(p.incoming).toBe('900');
  });

  it('keeps an entry that declared the same balance again: it happened, it moved nothing', () => {
    const p = accountPeriod(
      [
        entry('1000', at(2026, 9, 7)),
        entry('1000', at(2026, 9, 5)),
        entry('1000', at(2026, 8, 20)),
      ],
      '2026-09-11',
    );
    expect(p.count).toBe(2);
    expect(p.turnover).toBe('0');
    expect(p.byOrigin).toEqual([]);
  });

  it('holds nothing when the month does, and says whether the journal itself is empty', () => {
    expect(accountPeriod(journal, '2026-07-11').count).toBe(0);
    expect(accountPeriod(journal, '2026-07-11').turnover).toBe('0');
    expect(accountPeriod([], '2026-09-11').count).toBe(0);
  });

  it('reads the journal in date order however it arrives', () => {
    const shuffled = [journal[2], journal[0], journal[3], journal[1]] as BalanceEntryDto[];
    expect(accountPeriod(shuffled, '2026-09-11').days[0]?.subtotal).toBe('500');
  });
});

describe('movementDays', () => {
  it('narrows the list to one origin and re-adds the subtotals from what is left', () => {
    const p = accountPeriod(journal, '2026-09-11');
    const days = movementDays(p, 'inflow');
    expect(days.map((d) => d.day)).toEqual(['2026-09-20']);
    expect(days[0]?.movements.map((m) => m.delta)).toEqual(['700']);
    expect(days[0]?.subtotal).toBe('700');
  });

  it('hands back every day when nothing is picked', () => {
    const p = accountPeriod(journal, '2026-09-11');
    expect(movementDays(p, null)).toEqual(p.days);
  });
});

describe('periodShare', () => {
  it('measures a month against the one before it', () => {
    expect(periodShare('600', '500')).toBe(0.2);
    expect(periodShare('400', '500')).toBe(-0.2);
  });

  it('refuses to compare against a month that held nothing', () => {
    expect(periodShare('600', '0')).toBeNull();
  });
});
