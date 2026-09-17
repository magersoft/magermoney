import { describe, expect, it } from 'vitest';
import { parseArgs, renderPlan } from '../../scripts/import/run.js';

describe('import CLI', () => {
  it('parses flags and requires a user', () => {
    expect(parseArgs(['--user', 'a@b.c', '--accounts', 'x.csv', '--dry-run'])).toEqual({
      user: 'a@b.c',
      accounts: 'x.csv',
      rates: undefined,
      recordedAt: undefined,
      dryRun: true,
      force: false,
    });
    expect(() => parseArgs(['--accounts', 'x.csv'])).toThrow(/--user/);
  });
  it('renders a table and totals', () => {
    const text = renderPlan(
      [
        {
          name: 'Alfa',
          bank: 'Alfa',
          country: 'RU',
          currency: 'RUB',
          kind: 'card',
          cardType: 'debit',
          isSpending: false,
          cardLast4: '1',
          cardNetwork: null,
          cardTier: null,
          cardExpires: null,
          note: 'a\nb',
          sortOrder: 0,
          balance: '1.5',
        },
      ],
      [{ base: 'RUB', date: '2015-01-01', value: '0.01' }],
    );
    expect(text).toContain('Alfa');
    expect(text).toContain('1 accounts, 1 rates');
  });
});
