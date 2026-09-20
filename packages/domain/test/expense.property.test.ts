import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CurrencyRegistry,
  Money,
  addDays,
  occurrencesBetween,
  toIso,
  type Expense,
} from '../src/index.js';

const EUR = CurrencyRegistry.sample().get('EUR')._unsafeUnwrap();

describe('billing calendar properties', () => {
  it('twelve consecutive full months hold 12 charges of a monthly expense and 1 of a yearly one', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        fc.integer({ min: 1, max: 12 }),
        (year, month, billingDay, billingMonth) => {
          const from = toIso(year, month, 1);
          const to = addDays(toIso(year + 1, month, 1), -1);
          const base: Expense = {
            id: 'e',
            categoryId: 'c',
            name: 'E',
            amount: Money.of('10', EUR),
            period: 'monthly',
            billingDay,
            billingMonth: null,
            isEssential: false,
            activeFrom: '2000-01-01',
            activeTo: null,
          };
          expect(occurrencesBetween(base, from, to)).toHaveLength(12);
          expect(
            occurrencesBetween({ ...base, period: 'yearly', billingMonth }, from, to),
          ).toHaveLength(1);
        },
      ),
    );
  });
});
