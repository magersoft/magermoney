import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  type Asset,
  type IncomeSource,
} from '@magermoney/domain';
import { buildDashboard } from '../src/modules/dashboard/application/build-dashboard.js';

const reg = CurrencyRegistry.sample();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const BTC = reg.get('BTC')._unsafeUnwrap();
const table = new RateTable(
  '2026-09-21',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.2'), date: '2026-09-21', source: 'api' }],
  reg,
);

const source: IncomeSource = {
  id: 's1',
  name: 'Job',
  grossAmount: Money.of('3000', USD),
  taxRate: new Decimal(0),
  commissionRate: new Decimal(0),
  payDays: [10, 25],
  isPrimary: true,
  defaultAccountId: null,
  activeFrom: '2026-01-01',
  activeTo: null,
};

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: 'a1',
  name: 'BMW 530e',
  value: Money.of('30000', EUR),
  valuedOn: '2026-09-01',
  countsInTotal: true,
  acquiredOn: null,
  purchasePrice: null,
  archived: false,
  ...over,
});

const capital = {
  total: Money.of('5000', USD),
  availableUntilPayday: Money.of('800', USD),
  unconvertible: [],
  groups: [],
  archived: [],
};

const input = (assets: Asset[]) => ({
  capital,
  assets,
  sources: [source],
  expenses: [],
  budgets: [],
  inflows: [],
  table,
  registry: reg,
  display: 'USD',
  today: '2026-09-21',
});

describe('the capital on Home counts the owned things too', () => {
  it('adds an asset marked for the capital, converted into the display currency', () => {
    // 30 000 EUR at 1.2 = 36 000 USD, on top of 5 000 in accounts.
    const d = buildDashboard(input([asset()]))!;
    expect(d.capital.total.toString()).toBe('41000');
    expect(d.assets.total.toString()).toBe('36000');
  });

  it('leaves out an asset its owner did not mark, and an archived one', () => {
    const d = buildDashboard(
      input([asset({ id: 'a2', countsInTotal: false }), asset({ id: 'a3', archived: true })]),
    )!;
    expect(d.capital.total.toString()).toBe('5000');
    expect(d.assets.total.toString()).toBe('0');
  });

  it('reports an asset it cannot price rather than counting it as zero', () => {
    const d = buildDashboard(input([asset({ id: 'a4', value: Money.of('1', BTC) })]))!;
    expect(d.capital.total.toString()).toBe('5000');
    expect(d.assets.unconvertible.map((a) => a.id)).toEqual(['a4']);
  });

  it('is the accounts total on their own when nothing is owned', () => {
    const d = buildDashboard(input([]))!;
    expect(d.capital.total.toString()).toBe('5000');
    expect(d.assets.unconvertible).toEqual([]);
  });
});
