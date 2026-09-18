import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, Decimal, RateTable } from '@magermoney/domain';
import type { BudgetDto } from '@magermoney/contracts';
import { summariseBudgets } from '../src/modules/budgets/application/budget-summary.js';

const reg = CurrencyRegistry.default();
const table = new RateTable(
  '2026-09-17',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.2'), date: '2026-09-17', source: 'api' }],
  reg,
);
const b = (over: Partial<BudgetDto>): BudgetDto => ({
  id: 'b',
  name: 'Groceries',
  icon: null,
  monthlyLimit: '1000',
  currency: 'EUR',
  activeFrom: '2026-01-01',
  activeTo: null,
  ...over,
});

describe('summariseBudgets', () => {
  it('totals active limits in the display currency and sets ended budgets aside', () => {
    const s = summariseBudgets(
      [
        b({ id: 'a' }),
        b({ id: 'c', name: 'Taxi', monthlyLimit: '50', currency: 'USD' }),
        b({ id: 'd', activeTo: '2026-02-01' }),
      ],
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(s.active.map((x) => x.id)).toEqual(['a', 'c']);
    expect(s.total.round().toString()).toBe('1250');
    expect(s.ended.map((x) => x.id)).toEqual(['d']);
  });

  it('keeps a budget that has not started yet in the current list', () => {
    const s = summariseBudgets(
      [b({ id: 'later', name: 'Holiday', activeFrom: '2026-12-01' })],
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(s.active.map((x) => x.id)).toEqual(['later']);
    expect(s.ended).toEqual([]);
    expect(s.total.round().toString()).toBe('1200');
  });

  it('lists unconvertible budgets and is undefined without rates', () => {
    expect(
      summariseBudgets([b({ currency: 'BTC' })], table, reg, 'USD', '2026-09-17')!.unconvertible,
    ).toHaveLength(1);
    expect(summariseBudgets([], undefined, reg, 'USD', '2026-09-17')).toBeUndefined();
  });
});
