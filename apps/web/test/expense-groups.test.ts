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

  it('holds an expense that starts later apart from the month being read', () => {
    const g = groupExpenses(
      [exp({ id: 'f', name: 'Future rent', activeFrom: '2026-12-01' })],
      cats,
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.groups).toEqual([]);
    expect(g.upcoming.map((e) => e.id)).toEqual(['f']);
    expect(g.ended).toEqual([]);
    expect(g.planned.toString()).toBe('0');
  });

  it('reads the month it is given: the same plan pages back and forward', () => {
    const dtos = [
      exp({ id: 'now', name: 'Rent' }),
      exp({ id: 'later', name: 'Future rent', activeFrom: '2026-12-01' }),
      exp({ id: 'gone', name: 'Old gym', amount: '50', activeTo: '2026-06-30' }),
    ];
    const december = groupExpenses(dtos, cats, table, reg, 'USD', '2026-09-17', '2026-12-01')!;
    expect(december.groups[0]?.rows.map((r) => r.expense.id)).toEqual(['later', 'now']);
    expect(december.upcoming).toEqual([]);
    expect(december.planned.round().toString()).toBe('2400');

    const june = groupExpenses(dtos, cats, table, reg, 'USD', '2026-09-17', '2026-06-15')!;
    expect(june.groups[0]?.rows.map((r) => r.expense.id)).toEqual(['gone', 'now']);
    expect(june.ended).toEqual([]);
    expect(june.upcoming.map((e) => e.id)).toEqual(['later']);
  });

  it('counts an expense in the month it ends in, and not in the one after', () => {
    const dtos = [exp({ id: 'gone', name: 'Gym', amount: '50', activeTo: '2026-06-30' })];
    expect(
      groupExpenses(dtos, cats, table, reg, 'USD', '2026-09-17', '2026-06-01')!.groups,
    ).toHaveLength(1);
    const july = groupExpenses(dtos, cats, table, reg, 'USD', '2026-09-17', '2026-07-01')!;
    expect(july.groups).toEqual([]);
    expect(july.ended.map((e) => e.id)).toEqual(['gone']);
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
