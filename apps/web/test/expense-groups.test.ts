import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, Decimal, RateTable } from '@magermoney/domain';
import type { ExpenseCategoryDto, ExpenseDto } from '@magermoney/contracts';
import { groupExpenses } from '../src/modules/expenses/application/expense-groups.js';

const reg = CurrencyRegistry.default();
const table = new RateTable(
  '2026-09-17',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.2'), date: '2026-09-17', source: 'api' }],
  reg,
);
const cats: ExpenseCategoryDto[] = [
  { id: 'c1', name: 'Housing', icon: null, sortOrder: 0 },
  { id: 'c2', name: 'Subscriptions', icon: null, sortOrder: 1 },
];
const exp = (over: Partial<ExpenseDto>): ExpenseDto => ({
  id: 'e',
  categoryId: 'c1',
  name: 'Rent',
  amount: '1000',
  currency: 'EUR',
  period: 'monthly',
  billingDay: null,
  billingMonth: null,
  isEssential: false,
  activeFrom: '2026-01-01',
  activeTo: null,
  ...over,
});

describe('groupExpenses', () => {
  it('groups active expenses by category with monthly totals in the display currency', () => {
    const g = groupExpenses(
      [
        exp({ id: 'a', isEssential: true }),
        exp({
          id: 'b',
          categoryId: 'c2',
          name: 'IDE',
          amount: '120',
          currency: 'USD',
          period: 'yearly',
        }),
        exp({ id: 'c', name: 'Old', activeTo: '2026-06-30' }),
      ],
      cats,
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.groups.map((x) => x.category.name)).toEqual(['Housing', 'Subscriptions']);
    expect(g.groups[0]?.total.round().toString()).toBe('1200');
    expect(g.groups[1]?.rows[0]?.monthly.toString()).toBe('10');
    expect(g.planned.round().toString()).toBe('1210');
    expect(g.essential.round().toString()).toBe('1200');
    expect(g.ended.map((e) => e.id)).toEqual(['c']);
  });

  it('lists what it cannot convert instead of dropping it', () => {
    const g = groupExpenses(
      [exp({ id: 'x', currency: 'BTC', amount: '1' })],
      cats,
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.unconvertible.map((e) => e.id)).toEqual(['x']);
    expect(g.planned.toString()).toBe('0');
  });

  it('is undefined until rates and the display currency exist', () => {
    expect(groupExpenses([], cats, undefined, reg, 'USD', '2026-09-17')).toBeUndefined();
    expect(groupExpenses([], cats, table, reg, 'XXX', '2026-09-17')).toBeUndefined();
  });
});
