import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapInflows } from '../../scripts/import/inflows-mapper.js';

/** Synthetic: five data columns, then a per-source summary block to the right. */
const CSV = [
  'Дата,Откуда,USD/RUB,RUB,USD,,,,Acme Salary,Side Gig',
  '25.01.2025,Acme Salary,"101,50 ₽","152 250,00 ₽","$1 514,93",,,USD,"$9 000,00","$4 000,00"',
  '04.02.2025,Side Gig,"80,00 ₽","160 000,00 ₽","$2 000,00",,,EUR,"€8 300,00","€3 700,00"',
  '10.02.2025,Acme Salary,"92,50 ₽","152 250,00 ₽","$1 645,95",,,,,',
  '12.01.2025,Refund,"101,00 ₽","5 000,00 ₽","$49,50",,,,,',
  '20.03.2025,Refund,"90,00 ₽","1 800,00 ₽","$20,00",,,,,',
  '21.03.2025,Refund,"90,00 ₽","2 700,00 ₽","$30,00",,,,,',
  '22.03.2025,Refund,"90,00 ₽","4 000,00 ₽","$44,44",,,,,',
  ',,,,,,,,,',
].join('\n');

const known = new Set(['USD', 'EUR', 'RUB']);
const sheetSources = new Map([
  ['Acme Salary', 'RUB'],
  ['Side Gig', 'USD'],
]);
const opts = (over: Partial<Parameters<typeof mapInflows>[1]> = {}) => ({
  known,
  sources: sheetSources,
  createMissing: true,
  currencyOf: new Map<string, string>(),
  fallback: 'EUR',
  ...over,
});

describe('mapInflows', () => {
  it('stores a RUB inflow with its realised rate and a USD inflow without one', () => {
    const { inflows } = mapInflows(parseCsv(CSV), opts())._unsafeUnwrap();
    expect(inflows.slice(0, 3)).toEqual([
      {
        source: 'Acme Salary',
        amount: '152250',
        currency: 'RUB',
        receivedOn: '2025-01-25',
        realisedRateToUsd: '0.009852216749',
      },
      {
        source: 'Side Gig',
        amount: '2000',
        currency: 'USD',
        receivedOn: '2025-02-04',
        realisedRateToUsd: null,
      },
      {
        source: 'Acme Salary',
        amount: '152250',
        currency: 'RUB',
        receivedOn: '2025-02-10',
        realisedRateToUsd: '0.01081081081',
      },
    ]);
    expect(inflows).toHaveLength(7);
  });
  it('creates a source that only the inflows name, in the column that is round more often', () => {
    const { created, spans, inflows } = mapInflows(parseCsv(CSV), opts())._unsafeUnwrap();
    // Refund: RUB is whole in 4 rows, USD in 2.
    expect(created).toEqual([
      {
        name: 'Refund',
        currency: 'RUB',
        grossAmount: '0',
        taxRate: '0',
        commissionRate: '0',
        ambiguous: false,
      },
    ]);
    expect(spans.get('Refund')).toEqual({ first: '2025-01-12', last: '2025-03-22' });
    expect(spans.get('Acme Salary')).toEqual({ first: '2025-01-25', last: '2025-02-10' });
    expect(inflows.filter((i) => i.source === 'Refund').map((i) => i.amount)).toEqual([
      '5000',
      '1800',
      '2700',
      '4000',
    ]);
  });
  it('stops on a tie unless --currency-of or a RUB/USD fallback settles it', () => {
    const tie = [
      'Дата,Откуда,USD/RUB,RUB,USD',
      '04.06.2025,Bonus Co,"80,00 ₽","160 000,00 ₽","$2 000,00"',
    ].join('\n');
    const stopped = mapInflows(parseCsv(tie), opts())._unsafeUnwrapErr().message;
    expect(stopped).toMatch(/Income source "Bonus Co" is in EUR/);
    expect(stopped).toMatch(/--currency-of "Bonus Co=RUB"/);
    const forced = mapInflows(parseCsv(tie), opts({ currencyOf: new Map([['Bonus Co', 'USD']]) }));
    expect(forced._unsafeUnwrap().created[0]).toMatchObject({ currency: 'USD', ambiguous: false });
    const fallback = mapInflows(parseCsv(tie), opts({ fallback: 'RUB' }))._unsafeUnwrap();
    expect(fallback.created[0]).toMatchObject({ currency: 'RUB', ambiguous: true });
    expect(fallback.inflows[0]).toMatchObject({ amount: '160000', realisedRateToUsd: '0.0125' });
  });
  it('requires every source to exist when the sources sheet is not part of the run', () => {
    const r = mapInflows(parseCsv(CSV), opts({ createMissing: false }));
    expect(r._unsafeUnwrapErr().message).toMatch(/No income source named "Refund"/);
  });
  it('lists every bad row at once', () => {
    const bad = [
      'Дата,Откуда,USD/RUB,RUB,USD',
      '2025-01-25,Acme Salary,"101,50 ₽","1 000,00 ₽","$9,95"',
      '26.01.2025,Acme Salary,,"1 000,00 ₽","$9,95"',
      '27.01.2025,Side Gig,"101,50 ₽","1 000,00 ₽","$0,00"',
      '28.01.2025,,"101,50 ₽","1 000,00 ₽","$9,95"',
    ].join('\n');
    const message = mapInflows(parseCsv(bad), opts())._unsafeUnwrapErr().message;
    expect(message.split('\n')).toEqual([
      'Row 2: needs a DD.MM.YYYY date and a source',
      'Row 5: needs a DD.MM.YYYY date and a source',
      'Row 3: a RUB inflow needs its USD/RUB rate',
      'Row 4: the USD amount must be greater than zero',
    ]);
  });
  it('fails on an unknown currency and on a missing header', () => {
    const r = mapInflows(parseCsv(CSV), opts({ known: new Set(['USD']) }));
    expect(r._unsafeUnwrapErr().message).toMatch(/unknown currency RUB/);
    expect(mapInflows(parseCsv('a,b\n1,2'), opts()).isErr()).toBe(true);
  });
});
