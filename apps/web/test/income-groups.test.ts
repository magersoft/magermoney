import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, Decimal, RateTable } from '@magermoney/domain';
import type { IncomeSourceDto } from '@magermoney/contracts';
import { groupIncome } from '../src/modules/income/application/income-groups.js';

const reg = CurrencyRegistry.sample();
const table = new RateTable(
  '2026-09-17',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.2'), date: '2026-09-17', source: 'api' }],
  reg,
);
const src = (over: Partial<IncomeSourceDto>): IncomeSourceDto => ({
  id: 's',
  name: 'Salary',
  grossAmount: '1000',
  currency: 'USD',
  taxRate: '0',
  commissionRate: '0',
  payDays: [10],
  isPrimary: false,
  defaultAccountId: null,
  activeFrom: '2026-01-01',
  activeTo: null,
  netMonthly: '1000.00',
  ...over,
});

describe('groupIncome', () => {
  it('splits current sources into scheduled and irregular, each with its subtotal', () => {
    const g = groupIncome(
      [
        src({ id: 'a', name: 'Salary', isPrimary: true }),
        src({ id: 'b', name: 'Contract', currency: 'EUR', grossAmount: '500' }),
        src({ id: 'c', name: 'Odd jobs', payDays: [], grossAmount: '200' }),
        src({ id: 'd', name: 'Old gig', activeTo: '2026-06-30' }),
      ],
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.groups.map((x) => x.kind)).toEqual(['scheduled', 'irregular']);
    /* The primary source heads its group; everything else is alphabetical. */
    expect(g.groups[0]?.rows.map((r) => r.source.id)).toEqual(['a', 'b']);
    expect(g.groups[0]?.total.round().toString()).toBe('1600');
    expect(g.groups[1]?.rows.map((r) => r.source.id)).toEqual(['c']);
    expect(g.groups[1]?.total.round().toString()).toBe('200');
    expect(g.net.round().toString()).toBe('1800');
    expect(g.ended.map((s) => s.id)).toEqual(['d']);
  });

  it('nets each source down by tax and commission before it counts', () => {
    const g = groupIncome(
      [src({ id: 'a', taxRate: '0.13', commissionRate: '0' })],
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.groups[0]?.rows[0]?.net.toString()).toBe('870');
    expect(g.net.round().toString()).toBe('870');
  });

  it('lists a source that starts next month: it is already part of the plan', () => {
    const g = groupIncome(
      [src({ id: 'f', name: 'New job', activeFrom: '2026-12-01' })],
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.groups[0]?.rows.map((r) => r.source.id)).toEqual(['f']);
    expect(g.ended).toEqual([]);
  });

  it('leaves out a group that has no sources at all', () => {
    const g = groupIncome([src({ id: 'a' })], table, reg, 'USD', '2026-09-17')!;
    expect(g.groups.map((x) => x.kind)).toEqual(['scheduled']);
  });

  it('lists what it cannot convert instead of dropping it', () => {
    const g = groupIncome(
      [src({ id: 'x', currency: 'BTC', grossAmount: '1' })],
      table,
      reg,
      'USD',
      '2026-09-17',
    )!;
    expect(g.unconvertible.map((s) => s.id)).toEqual(['x']);
    expect(g.net.toString()).toBe('0');
    /* Still a row: it is income, it just has no rate to be counted at. */
    expect(g.groups[0]?.rows.map((r) => r.source.id)).toEqual(['x']);
  });

  it('is undefined until rates and the display currency exist', () => {
    expect(groupIncome([], undefined, reg, 'USD', '2026-09-17')).toBeUndefined();
    expect(groupIncome([], table, reg, 'XXX', '2026-09-17')).toBeUndefined();
  });
});
