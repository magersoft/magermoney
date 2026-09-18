import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapExpenses } from '../../scripts/import/expenses-mapper.js';

/** Synthetic: a blank first row, the obligations block, wish-list blocks to the right, totals below. */
const CSV = [
  ',,,,,,,,,',
  'Позиция,USD,EUR,RUB,,Позиция,USD,EUR,RUB,Куплено',
  'Rent,"$1 377,05","€1 200,00","116 366,40 ₽",,Sofa,"$1 000,00","€871,42","84 500,00 ₽",TRUE',
  '"Utilities\n","$137,70","€120,00","11 636,64 ₽",,Desk,"$500,00","€435,71","42 250,00 ₽",FALSE',
  'Groceries,"$918,03","€800,00","77 577,60 ₽",,,"$0,00","€0,00","0,00 ₽",',
  'Gift to family,"$236,69","€206,25","20 000,00 ₽",,,,,,',
  'Подписка Music,"$3,00","€2,61","254,00 ₽",,,,,,',
  'Подписка IDE (yearly),"$5,75","€5,01","485,90 ₽",,,,,,',
  'Подписка Old (yearly),"$0,00","€0,00","0,00 ₽",,Итого,"$1 500,00","€1 307,13","126 750,00 ₽",',
  'Итого,"$2 807,05","€2 446,12","237 205,24 ₽",,,,,,',
  'Минимум,"$1 526,24","€1 330,00","128 972,74 ₽",,,,,,',
  'Stray note,"$1,00","€1,00","1,00 ₽",,,,,,',
].join('\n');

const known = new Set(['USD', 'EUR', 'RUB']);
const opts = (over: Partial<Parameters<typeof mapExpenses>[1]> = {}) => ({
  known,
  currencyOf: new Map<string, string>(),
  fallback: 'EUR',
  asBudget: new Set<string>(),
  ...over,
});

describe('mapExpenses', () => {
  it('reads the first block up to "Итого", skipping zero rows and the neighbours', () => {
    const { expenses, budgets, categories } = mapExpenses(parseCsv(CSV), opts())._unsafeUnwrap();
    expect(budgets).toEqual([]);
    expect(categories).toEqual(['Прочее', 'Подписки']);
    expect(expenses).toEqual([
      {
        name: 'Rent',
        category: 'Прочее',
        currency: 'EUR',
        amount: '1200',
        period: 'monthly',
        ambiguous: false,
        approx: false,
      },
      {
        name: 'Utilities',
        category: 'Прочее',
        currency: 'EUR',
        amount: '120',
        period: 'monthly',
        ambiguous: false,
        approx: false,
      },
      {
        name: 'Groceries',
        category: 'Прочее',
        currency: 'EUR',
        amount: '800',
        period: 'monthly',
        ambiguous: false,
        approx: false,
      },
      {
        name: 'Gift to family',
        category: 'Прочее',
        currency: 'RUB',
        amount: '20000',
        period: 'monthly',
        ambiguous: false,
        approx: false,
      },
      // $3,00 and 254,00 ₽ are both round: the fallback is taken and flagged.
      {
        name: 'Music',
        category: 'Подписки',
        currency: 'EUR',
        amount: '2.61',
        period: 'monthly',
        ambiguous: true,
        approx: false,
      },
      // Nothing is round; 5,01 × 12 rebuilt as the yearly amount.
      {
        name: 'IDE',
        category: 'Подписки',
        currency: 'EUR',
        amount: '60.12',
        period: 'yearly',
        ambiguous: true,
        approx: true,
      },
    ]);
  });
  it('matches --currency-of against the name as the sheet spells it', () => {
    const { expenses } = mapExpenses(
      parseCsv(CSV),
      opts({ currencyOf: new Map([['Подписка IDE (yearly)', 'USD']]) }),
    )._unsafeUnwrap();
    expect(expenses.at(-1)).toEqual({
      name: 'IDE',
      category: 'Подписки',
      currency: 'USD',
      amount: '69',
      period: 'yearly',
      ambiguous: false,
      approx: true,
    });
  });
  it('turns an --as-budget row into a Budget', () => {
    const { expenses, budgets } = mapExpenses(
      parseCsv(CSV),
      opts({ asBudget: new Set(['Groceries']) }),
    )._unsafeUnwrap();
    expect(budgets).toEqual([
      { name: 'Groceries', currency: 'EUR', monthlyLimit: '800', ambiguous: false },
    ]);
    expect(expenses.map((e) => e.name)).not.toContain('Groceries');
  });
  it('fails on an --as-budget name the sheet does not have', () => {
    const r = mapExpenses(parseCsv(CSV), opts({ asBudget: new Set(['Groceries ', 'Taxi']) }));
    expect(r._unsafeUnwrapErr().message).toMatch(/"Groceries ", "Taxi"/);
  });
  it('fails on an unknown currency, a missing header, or a block without "Итого"', () => {
    const unknown = mapExpenses(parseCsv(CSV), opts({ known: new Set(['USD', 'RUB']) }));
    expect(unknown._unsafeUnwrapErr().message).toMatch(/unknown currency EUR/);
    expect(mapExpenses(parseCsv('a,b\n1,2'), opts()).isErr()).toBe(true);
    const open = 'Позиция,USD,EUR,RUB\nRent,"$1,50","€1,00","101,50 ₽"';
    expect(mapExpenses(parseCsv(open), opts())._unsafeUnwrapErr().message).toMatch(/Итого/);
  });
});
