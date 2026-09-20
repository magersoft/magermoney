import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  firstOfMonth,
  lastOfMonth,
  netMonthly,
  payoutsBetween,
  toIso,
  type IncomeSource,
} from '../src/index.js';

const reg = CurrencyRegistry.sample();
const USD = reg.get('USD')._unsafeUnwrap();
const cents = fc
  .integer({ min: 0, max: 10_000_000_00 })
  .map((n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`);
const rate = fc.integer({ min: 0, max: 99 }).map((n) => new Decimal(n).div(100));

describe('pay schedule properties', () => {
  it('the payouts of any full month inside the active period sum to netMonthly', () => {
    fc.assert(
      fc.property(
        cents,
        rate,
        rate,
        fc.uniqueArray(fc.integer({ min: 1, max: 31 }), {
          minLength: 1,
          maxLength: 6,
        }),
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (gross, taxRate, commissionRate, payDays, year, month) => {
          const s: IncomeSource = {
            id: 's',
            name: 'S',
            grossAmount: Money.of(gross, USD),
            taxRate,
            commissionRate,
            payDays,
            isPrimary: true,
            defaultAccountId: null,
            activeFrom: '2000-01-01',
            activeTo: null,
          };
          const first = firstOfMonth(toIso(year, month, 1));
          const payouts = payoutsBetween(s, first, lastOfMonth(first));
          const sum = payouts.reduce((t, p) => t.add(p.amount)._unsafeUnwrap(), Money.zero(USD));
          expect(payouts).toHaveLength(payDays.length);
          expect(payouts.every((p) => !p.amount.isNegative())).toBe(true);
          expect(sum.toString()).toBe(netMonthly(s).toString());
        },
      ),
    );
  });
});
