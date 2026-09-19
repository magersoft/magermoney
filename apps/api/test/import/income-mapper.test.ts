import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapIncomeSources } from '../../scripts/import/income-mapper.js';

/** Synthetic: the monthly table, its total, the yearly table below, a calculator to the right. */
const CSV = [
  'Источник,USD,EUR,RUB,Налоги,Коммисии,USD net,EUR net,RUB net,,Вариант,Часы,USD',
  'Acme Salary,"$4 123,45","€3 800,12","350 000,00 ₽",13%,5%,"$3 408,03","€3 140,80","289 275,00 ₽",,3h a day,60,"$3 000,00"',
  'Side Gig,"$2 000,00","€1 843,27","169 701,55 ₽",0%,0%,"$2 000,00","€1 843,27","169 701,55 ₽",,5h a day,100,"$5 000,00"',
  'Deposit,"$41,07","€37,85","3 485,20 ₽",0%,,"$41,07","€37,85","3 485,20 ₽",,This month,0,"$0,00"',
  ',,,,,,,,,,,,',
  'Месячный доход,"$6 164,52","€5 681,24","523 186,75 ₽",,,"$5 449,10","€5 021,92","462 461,75 ₽",,,,',
  ',,,,,,,,,,,,',
  'Источник,USD,EUR,RUB,Налоги,Коммисии,USD net,EUR net,RUB net,,,,',
  'Acme Salary,"$49 481,40","€45 601,44","4 200 000,00 ₽",13%,5%,"$40 896,36","€37 689,60","3 471 300,00 ₽",,,,',
].join('\n');

const known = new Set(['USD', 'EUR', 'RUB']);
const opts = (currencyOf: [string, string][] = []) => ({
  known,
  currencyOf: new Map(currencyOf),
  fallback: 'EUR',
});

describe('mapIncomeSources', () => {
  it('reads only the first table and picks each native currency by roundness', () => {
    expect(mapIncomeSources(parseCsv(CSV), opts())._unsafeUnwrap()).toEqual([
      {
        name: 'Acme Salary',
        currency: 'RUB',
        grossAmount: '350000',
        taxRate: '0.13',
        commissionRate: '0.05',
        ambiguous: false,
      },
      {
        name: 'Side Gig',
        currency: 'USD',
        grossAmount: '2000',
        taxRate: '0',
        commissionRate: '0',
        ambiguous: false,
      },
      {
        name: 'Deposit',
        currency: 'EUR',
        grossAmount: '37.85',
        taxRate: '0',
        commissionRate: '0',
        ambiguous: true,
      },
    ]);
  });
  it('honours --currency-of', () => {
    const deposit = mapIncomeSources(parseCsv(CSV), opts([['Deposit', 'RUB']]))._unsafeUnwrap()[2];
    expect(deposit).toMatchObject({ currency: 'RUB', grossAmount: '3485.20', ambiguous: false });
  });
  it('fails on a currency the database does not know', () => {
    const r = mapIncomeSources(parseCsv(CSV), { ...opts(), known: new Set(['USD', 'EUR']) });
    expect(r._unsafeUnwrapErr().message).toMatch(/unknown currency RUB/);
  });
  it('fails on a duplicated name, a bad percent, a missing header or an empty table', () => {
    const twice = CSV.replace('Side Gig', 'Acme Salary');
    expect(mapIncomeSources(parseCsv(twice), opts())._unsafeUnwrapErr().message).toMatch(/twice/);
    const badTax = CSV.replace('13%,5%', '130%,5%');
    expect(mapIncomeSources(parseCsv(badTax), opts())._unsafeUnwrapErr().message).toMatch(/tax/);
    expect(mapIncomeSources(parseCsv('a,b\n1,2'), opts()).isErr()).toBe(true);
    expect(mapIncomeSources(parseCsv('Источник,USD,EUR,RUB\n,,,'), opts()).isErr()).toBe(true);
  });
});
