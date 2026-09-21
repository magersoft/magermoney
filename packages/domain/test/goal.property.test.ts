import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
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
