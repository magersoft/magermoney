import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  assetValue,
  assetsTotal,
  type Asset,
  type Rate,
  type Valuation,
} from '../src/index.js';

const registry = CurrencyRegistry.sample();
const c = (code: string) => registry.get(code)._unsafeUnwrap();
const EUR = c('EUR');
const USD = c('USD');
const rate = (base: string, value: string): Rate => ({
  base,
  quote: 'USD',
  value: new Decimal(value),
  date: '2026-09-21',
  source: 'api',
});
const table = new RateTable('2026-09-21', [rate('EUR', '1.1')], registry);

const valuation = (value: number, valuedOn: string): Valuation => ({
  id: valuedOn,
  value: Money.of(new Decimal(value), EUR),
  valuedOn,
});

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: 'x',
  name: 'Car',
  icon: null,
  color: null,
  value: Money.of(new Decimal(30_000), EUR),
  valuedOn: '2026-09-01',
  countsInTotal: true,
  acquiredOn: null,
  purchasePrice: null,
  archived: false,
  ...over,
});

describe('assetValue', () => {
  it('takes the latest valuation whatever order they arrive in', () => {
    const latest = assetValue([
      valuation(28_000, '2026-01-01'),
      valuation(30_000, '2026-09-01'),
      valuation(29_000, '2026-05-01'),
    ]);
    expect(latest?.valuedOn).toBe('2026-09-01');
  });

  it('has no value before the first valuation', () => {
    expect(assetValue([])).toBeNull();
  });
});

describe('assetsTotal', () => {
  it('counts only the assets marked for the capital', () => {
    const total = assetsTotal(
      [asset(), asset({ id: 'y', countsInTotal: false, value: Money.of(new Decimal(9_000), EUR) })],
      table,
      EUR,
    );
    expect(total.total.amount.toString()).toBe('30000');
    expect(total.unconvertible).toEqual([]);
  });

  it('converts into the display currency', () => {
    const total = assetsTotal([asset()], table, USD);
    expect(total.total.amount.toString()).toBe('33000');
  });

  it('ignores an archived asset and one never valued', () => {
    const total = assetsTotal(
      [asset({ archived: true }), asset({ id: 'z', value: null, valuedOn: null })],
      table,
      EUR,
    );
    expect(total.total.amount.toString()).toBe('0');
  });

  it('lists an asset it cannot price instead of counting it as zero', () => {
    const total = assetsTotal(
      [asset({ id: 'w', value: Money.of(new Decimal(1), c('BTC')) })],
      table,
      EUR,
    );
    expect(total.total.amount.toString()).toBe('0');
    expect(total.unconvertible.map((a) => a.id)).toEqual(['w']);
  });
});
