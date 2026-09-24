import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  assetValue,
  assetsTotal,
  type Asset,
} from '../src/index.js';

const registry = CurrencyRegistry.sample();
const EUR = registry.get('EUR')._unsafeUnwrap();
const table = new RateTable('2026-09-21', [], registry);

const assets = fc.array(
  fc.record({ n: fc.integer({ min: 0, max: 100_000 }), counts: fc.boolean() }),
  { maxLength: 10 },
);
const build = (xs: { n: number; counts: boolean }[]): Asset[] =>
  xs.map((x, i) => ({
    id: `a${i}`,
    name: 'A',
    icon: null,
    color: null,
    value: Money.of(new Decimal(x.n), EUR),
    valuedOn: '2026-01-01',
    countsInTotal: x.counts,
    acquiredOn: null,
    purchasePrice: null,
    archived: false,
  }));

describe('assetsTotal properties', () => {
  it('equals the sum of the assets marked for the capital, and ignores the rest', () => {
    fc.assert(
      fc.property(assets, (xs) => {
        const expected = xs.filter((x) => x.counts).reduce((s, x) => s + x.n, 0);
        expect(assetsTotal(build(xs), table, EUR).total.amount.toString()).toBe(String(expected));
      }),
    );
  });

  it('does not depend on the order of the assets', () => {
    fc.assert(
      fc.property(assets, (xs) => {
        const a = assetsTotal(build(xs), table, EUR).total.amount.toString();
        const b = assetsTotal(build([...xs].reverse()), table, EUR).total.amount.toString();
        expect(a).toBe(b);
      }),
    );
  });

  it('picks a valuation that no other valuation is later than', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.date({
            min: new Date('2020-01-01'),
            max: new Date('2030-01-01'),
            noInvalidDate: true,
          }),
          { minLength: 1, maxLength: 12 },
        ),
        (dates) => {
          const vs = dates.map((d, i) => ({
            id: `v${i}`,
            value: Money.of(new Decimal(i), EUR),
            valuedOn: d.toISOString().slice(0, 10),
          }));
          const latest = assetValue(vs)!;
          expect(vs.every((v) => v.valuedOn <= latest.valuedOn)).toBe(true);
        },
      ),
    );
  });
});
