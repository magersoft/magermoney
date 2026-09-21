import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  goalForecast,
  goalProgress,
  type Account,
  type Goal,
} from '../src/index.js';

const registry = CurrencyRegistry.sample();
const EUR = registry.get('EUR')._unsafeUnwrap();
const table = new RateTable('2026-09-21', [], registry);
const amounts = fc.array(fc.integer({ min: 0, max: 100_000 }), { maxLength: 8 });

const accountsOf = (xs: number[]): Account[] =>
  xs.map((n, i) => ({
    id: `a${i}`,
    name: 'A',
    bank: 'B',
    country: 'DE',
    kind: 'bank_account',
    cardType: null,
    isSpending: false,
    isPinned: false,
    sortOrder: 0,
    archived: false,
    balance: Money.of(new Decimal(n), EUR),
  }));

const goalOf = (target: number): Goal => ({
  id: 'g',
  name: 'G',
  icon: null,
  target: Money.of(new Decimal(target), EUR),
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
});

describe('goalProgress properties', () => {
  it('is never negative and never above its target ratio of 1', () => {
    fc.assert(
      fc.property(amounts, fc.integer({ min: 1, max: 100_000 }), (xs, target) => {
        const p = goalProgress(goalOf(target), accountsOf(xs), table);
        expect(p.funded.amount.isNegative()).toBe(false);
        expect(p.remaining.amount.isNegative()).toBe(false);
        expect(p.ratio).toBeGreaterThanOrEqual(0);
        expect(p.ratio).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('does not depend on the order of the accounts', () => {
    fc.assert(
      fc.property(amounts, fc.integer({ min: 1, max: 100_000 }), (xs, target) => {
        const forward = goalProgress(goalOf(target), accountsOf(xs), table);
        const backward = goalProgress(goalOf(target), accountsOf([...xs].reverse()), table);
        expect(forward.funded.amount.toString()).toBe(backward.funded.amount.toString());
      }),
    );
  });

  it('has zero remaining exactly when funded has reached the target', () => {
    fc.assert(
      fc.property(amounts, fc.integer({ min: 1, max: 100_000 }), (xs, target) => {
        const p = goalProgress(goalOf(target), accountsOf(xs), table);
        const reached = p.funded.amount.gte(target);
        expect(p.remaining.amount.isZero()).toBe(reached);
      }),
    );
  });
});

describe('goalForecast properties', () => {
  const rising = fc.array(fc.integer({ min: 1, max: 5_000 }), { minLength: 2, maxLength: 9 });

  it('never forecasts a date in the past', () => {
    fc.assert(
      fc.property(rising, (steps) => {
        let running = 0;
        const history = steps.map((s, i) => {
          running += s;
          return {
            month: { year: 2026, month: i + 1 },
            total: Money.of(new Decimal(running), EUR),
          };
        });
        const p = goalProgress(goalOf(1_000_000), accountsOf([running]), table);
        const f = goalForecast(goalOf(1_000_000), p, history, '2026-09-21');
        if (f.kind === 'date') expect(f.on >= '2026-09-21').toBe(true);
      }),
    );
  });

  it('never forecasts a date when the rate is not positive', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 5_000 }), { minLength: 2, maxLength: 9 }),
        (xs) => {
          const falling = [...xs].sort((a, b) => b - a);
          const history = falling.map((n, i) => ({
            month: { year: 2026, month: i + 1 },
            total: Money.of(new Decimal(n), EUR),
          }));
          const p = goalProgress(goalOf(1_000_000), accountsOf([falling.at(-1)!]), table);
          const f = goalForecast(goalOf(1_000_000), p, history, '2026-09-21');
          if (falling[0]! > falling.at(-1)!)
            expect(f).toEqual({ kind: 'none', reason: 'not_advancing' });
        },
      ),
    );
  });
});
