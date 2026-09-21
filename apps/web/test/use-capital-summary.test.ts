import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, Decimal, RateTable } from '@magermoney/domain';
import type { AccountDto } from '@magermoney/contracts';
import { summarise } from '../src/modules/accounts/application/use-capital-summary.js';

const reg = CurrencyRegistry.sample();
const table = new RateTable(
  '2026-09-11',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.16'), date: '2026-09-11', source: 'api' }],
  reg,
);
const base: AccountDto = {
  id: 'a',
  name: 'A',
  bank: 'B',
  country: 'RU',
  currency: 'USD',
  kind: 'cash',
  cardType: null,
  isSpending: true,
  isPinned: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  colorway: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  goalId: null,
  balance: '100',
  balanceRecordedAt: null,
};

describe('summarise', () => {
  it('computes totals, payday money and provider groups in the display currency', () => {
    // Non-null: every input is present, so `summarise` cannot return undefined here.
    const s = summarise(
      [
        base,
        { ...base, id: 'b', bank: 'C', currency: 'EUR', isSpending: false, balance: '100' },
        { ...base, id: 'c', currency: 'BTC', balance: '1' },
      ],
      table,
      reg,
      'USD',
    )!;
    expect(s.total.round().toString()).toBe('216');
    expect(s.availableUntilPayday.toString()).toBe('100');
    expect(s.unconvertible.map((a) => a.id)).toEqual(['c']);
    expect(s.groups.map((g) => g.bank)).toEqual(['B', 'C']);
    expect(s.groups[0]?.total.toString()).toBe('100');
  });
  it('is undefined until rates and a display currency exist', () => {
    expect(summarise([base], undefined, reg, 'USD')).toBeUndefined();
    expect(summarise([base], table, reg, 'XXX')).toBeUndefined();
  });
});
