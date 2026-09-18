import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import {
  activeKinds,
  parseArgs,
  planPhase3,
  renderDryRun,
  renderTotals,
} from '../../scripts/import/run.js';

const INCOME = [
  'Источник,USD,EUR,RUB,Налоги,Коммисии',
  'Acme Salary,"$4 123,45","€3 800,12","350 000,00 ₽",13%,5%',
  'Side Gig,"$2 000,00","€1 843,27","169 701,55 ₽",0%,0%',
  ',,,,,',
  'Месячный доход,"$6 123,45","€5 643,39","519 701,55 ₽",,',
].join('\n');
const INFLOWS = [
  'Дата,Откуда,USD/RUB,RUB,USD',
  '25.01.2025,Acme Salary,"100,00 ₽","150 000,00 ₽","$1 500,00"',
  '21.03.2025,Acme Salary,"92,50 ₽","152 250,00 ₽","$1 645,95"',
  '12.01.2025,Refund,"101,00 ₽","5 000,00 ₽","$49,50"',
].join('\n');
const EXPENSES = [
  'Позиция,USD,EUR,RUB',
  'Rent,"$1 377,05","€1 200,00","116 366,40 ₽"',
  'Groceries,"$918,03","€800,00","77 577,60 ₽"',
  'Подписка IDE (yearly),"$5,75","€5,01","485,90 ₽"',
  'Итого,"$2 300,83","€2 005,01","194 429,90 ₽"',
].join('\n');

const base = {
  incomeRows: undefined,
  inflowRows: undefined,
  expenseRows: undefined,
  existingSources: new Map<string, string>(),
  importDay: '2026-09-17',
  known: new Set(['USD', 'EUR', 'RUB']),
  currencyOf: new Map<string, string>(),
  fallback: 'EUR',
  asBudget: new Set<string>(),
};

describe('parseArgs, phase 3 flags', () => {
  it('collects repeatable flags and defaults the fallback to EUR', () => {
    const args = parseArgs([
      '--user',
      'a@b.c',
      '--income-sources',
      'i.csv',
      '--expenses',
      'e.csv',
      '--inflows',
      'f.csv',
      '--currency-of',
      'Deposit=RUB',
      '--currency-of',
      'Music=USD',
      '--as-budget',
      'Groceries',
      '--only',
      'income,inflows',
    ]);
    expect(args).toMatchObject({
      incomeSources: 'i.csv',
      expenses: 'e.csv',
      inflows: 'f.csv',
      currencyOf: ['Deposit=RUB', 'Music=USD'],
      asBudget: ['Groceries'],
      fallbackCurrency: 'EUR',
      only: ['income', 'inflows'],
    });
    expect(parseArgs(['--user', 'a@b.c', '--fallback-currency', 'RUB']).fallbackCurrency).toBe(
      'RUB',
    );
  });
  it('rejects a bad --only or --fallback-currency before any database work', () => {
    expect(() => parseArgs(['--user', 'a@b.c', '--only', 'goals'])).toThrow(/--only accepts/);
    expect(() => parseArgs(['--user', 'a@b.c', '--fallback-currency', 'eur'])).toThrow(
      /--fallback-currency/,
    );
  });
});

describe('activeKinds', () => {
  it('is every kind whose file was passed', () => {
    const args = parseArgs(['--user', 'a@b.c', '--rates', 'r.csv', '--inflows', 'f.csv']);
    expect([...activeKinds(args)]).toEqual(['rates', 'inflows']);
  });
  it('is narrowed by --only and refuses a kind without its file', () => {
    const args = parseArgs([
      '--user',
      'a@b.c',
      '--accounts',
      'a.csv',
      '--expenses',
      'e.csv',
      '--only',
      'expenses',
    ]);
    expect([...activeKinds(args)]).toEqual(['expenses']);
    expect(() => activeKinds(parseArgs(['--user', 'a@b.c', '--only', 'inflows']))).toThrow(
      /--inflows was not passed/,
    );
  });
});

describe('planPhase3', () => {
  it('dates a sheet source by its first inflow, else by the import day, and ends an inflow-only one', () => {
    const plan = planPhase3({
      ...base,
      incomeRows: parseCsv(INCOME),
      inflowRows: parseCsv(INFLOWS),
    })._unsafeUnwrap();
    expect(
      plan.sources.map((s) => [s.name, s.currency, s.grossAmount, s.activeFrom, s.activeTo]),
    ).toEqual([
      ['Acme Salary', 'RUB', '350000', '2025-01-25', null],
      ['Side Gig', 'USD', '2000', '2026-09-17', null],
      ['Refund', 'RUB', '0', '2025-01-12', '2025-01-12'],
    ]);
    expect(plan.inflows).toHaveLength(3);
  });
  it('resolves inflows against existing sources when the sources sheet is absent', () => {
    const ok = planPhase3({
      ...base,
      inflowRows: parseCsv(INFLOWS),
      existingSources: new Map([
        ['Acme Salary', 'RUB'],
        ['Refund', 'RUB'],
      ]),
    })._unsafeUnwrap();
    expect(ok.sources).toEqual([]);
    expect(ok.inflows).toHaveLength(3);
    const missing = planPhase3({ ...base, inflowRows: parseCsv(INFLOWS) });
    expect(missing._unsafeUnwrapErr().message).toMatch(/"Acme Salary", "Refund"/);
  });
  it('splits expenses and budgets', () => {
    const plan = planPhase3({
      ...base,
      expenseRows: parseCsv(EXPENSES),
      asBudget: new Set(['Groceries']),
    })._unsafeUnwrap();
    expect(plan.categories).toEqual(['Прочее', 'Подписки']);
    expect(plan.expenses.map((e) => e.name)).toEqual(['Rent', 'IDE']);
    expect(plan.budgets.map((b) => b.name)).toEqual(['Groceries']);
    expect(plan.importDay).toBe('2026-09-17');
  });
  it('lists the problems of every sheet at once', () => {
    const r = planPhase3({
      ...base,
      inflowRows: parseCsv(INFLOWS),
      expenseRows: parseCsv(EXPENSES),
      asBudget: new Set(['Taxi']),
    });
    const message = r._unsafeUnwrapErr().message;
    expect(message).toMatch(/No income source named/);
    expect(message).toMatch(/--as-budget names no row in the sheet/);
  });
});

describe('rendering', () => {
  const plan = planPhase3({
    ...base,
    incomeRows: parseCsv(INCOME),
    inflowRows: parseCsv(INFLOWS),
    expenseRows: parseCsv(EXPENSES),
    asBudget: new Set(['Groceries']),
  })._unsafeUnwrap();
  it('prints one table per active kind and the totals line in a dry run', () => {
    const text = renderDryRun(new Set(['income', 'inflows', 'expenses'] as const), [], [], plan);
    expect(text).toContain('# Income sources');
    expect(text).toContain('# Inflows');
    expect(text).toMatch(/Acme Salary\s+2 inflows\s+2025-01-25…2025-03-21\s+302250 RUB/);
    expect(text).toContain('# Expenses and budgets');
    expect(text).toMatch(/IDE\s+Подписки\s+EUR\s+60\.12\s+yearly\s+ambiguous approx/);
    expect(text).toMatch(/Groceries\s+budget/);
    expect(text).not.toContain('# Accounts');
    expect(text.split('\n').at(-1)).toBe(
      '0 accounts, 0 rates, 3 income sources, 3 inflows, 2 expenses, 1 budgets',
    );
  });
  it('prints totals alone for a real run, with no name or amount', () => {
    const totals = renderTotals([], [], plan);
    expect(totals).toBe('0 accounts, 0 rates, 3 income sources, 3 inflows, 2 expenses, 1 budgets');
  });
});
