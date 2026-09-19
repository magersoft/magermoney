import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  monthPlan,
  type Budget,
  type Expense,
  type IncomeSource,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const table = new RateTable(
  '2026-09-17',
  [
    {
      base: 'EUR',
      quote: 'USD',
      value: new Decimal('1.1737'),
      date: '2026-09-17',
      source: 'api',
    },
    {
      base: 'RUB',
      quote: 'USD',
      value: new Decimal('0.011855'),
      date: '2026-09-17',
      source: 'api',
    },
  ],
  reg,
);
const currency = fc.constantFrom('USD', 'EUR', 'RUB').map((code) => reg.get(code)._unsafeUnwrap());
const money = fc
  .tuple(fc.integer({ min: 0, max: 10_000_000_00 }), currency)
  .map(([n, cur]) => Money.of(new Decimal(n).div(100), cur));
const period = { activeFrom: '2000-01-01', activeTo: null };

describe('month plan properties', () => {
  it('remainder + plannedOutgo = netIncome in the display currency', () => {
    fc.assert(
      fc.property(
        fc.array(money, { maxLength: 5 }),
        fc.array(fc.tuple(money, fc.boolean(), fc.boolean()), { maxLength: 8 }),
        fc.array(money, { maxLength: 4 }),
        currency,
        (gross, costs, limits, display) => {
          const sources: IncomeSource[] = gross.map((grossAmount, i) => ({
            ...period,
            id: `s${i}`,
            name: `S${i}`,
            grossAmount,
            taxRate: new Decimal('0.13'),
            commissionRate: new Decimal('0.05'),
            payDays: [],
            isPrimary: false,
            defaultAccountId: null,
          }));
          const expenses: Expense[] = costs.map(([amount, yearly, isEssential], i) => ({
            ...period,
            id: `e${i}`,
            categoryId: 'c',
            name: `E${i}`,
            amount,
            period: yearly ? 'yearly' : 'monthly',
            billingDay: null,
            billingMonth: null,
            isEssential,
          }));
          const budgets: Budget[] = limits.map((monthlyLimit, i) => ({
            ...period,
            id: `b${i}`,
            name: `B${i}`,
            icon: null,
            monthlyLimit,
          }));
          const plan = monthPlan({
            sources,
            expenses,
            budgets,
            table,
            display,
            today: '2026-09-17',
          });
          const back = plan.remainder.add(plan.plannedOutgo)._unsafeUnwrap();
          expect(back.round().toString()).toBe(plan.netIncome.round().toString());
          expect(plan.essential.compare(plan.plannedOutgo)._unsafeUnwrap()).toBeLessThanOrEqual(0);
        },
      ),
    );
  });
});
