import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, Decimal, Money, RateTable, type Account } from '@magermoney/domain';
import {
  EMPTY_FILTER,
  activeFilterCount,
  filterAccounts,
  filterChoices,
  type AccountFilter,
  type FilterableAccount,
} from '../src/modules/accounts/domain/account-filter.js';

const reg = CurrencyRegistry.sample();
const usd = reg.get('USD')._unsafeUnwrap();
const table = new RateTable(
  '2026-09-11',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.16'), date: '2026-09-11', source: 'api' }],
  reg,
);
const TODAY = '2026-09-23';
const context = { table, display: usd, today: TODAY };

const account = (
  id: string,
  over: Partial<Account> & { currency?: string; amount?: string; expires?: string | null } = {},
): FilterableAccount => {
  const { currency = 'USD', amount = '100', expires = null, ...rest } = over;
  return {
    id,
    name: id,
    bank: 'Bank',
    country: 'RU',
    kind: 'bank_account',
    cardType: null,
    isSpending: false,
    isPinned: false,
    sortOrder: 0,
    archived: false,
    balance: Money.of(amount, reg.get(currency)._unsafeUnwrap()),
    expires,
    ...rest,
  };
};

const ids = (list: readonly { id: string }[]) => list.map((a) => a.id);
const withFilter = (over: Partial<AccountFilter>): AccountFilter => ({ ...EMPTY_FILTER, ...over });

const WALLET = [
  account('usd-ru', {}),
  account('eur-de', { currency: 'EUR', country: 'DE' }),
  account('card-debit', {
    kind: 'card',
    cardType: 'debit',
    country: 'PT',
    amount: '500',
    expires: '2026-10-01',
  }),
  account('card-credit', {
    kind: 'card',
    cardType: 'credit',
    amount: '-40',
    expires: '2026-08-01',
  }),
  account('btc', { currency: 'BTC', kind: 'crypto_wallet', amount: '0.1' }),
];

describe('filterAccounts', () => {
  it('lets everything through while nothing is set', () => {
    expect(ids(filterAccounts(WALLET, EMPTY_FILTER, context))).toEqual(ids(WALLET));
  });

  it('keeps an account whose currency is any of the chosen ones', () => {
    const f = withFilter({ currencies: ['EUR', 'BTC'] });
    expect(ids(filterAccounts(WALLET, f, context))).toEqual(['eur-de', 'btc']);
  });

  it('keeps an account held in any of the chosen countries', () => {
    const f = withFilter({ countries: ['DE', 'PT'] });
    expect(ids(filterAccounts(WALLET, f, context))).toEqual(['eur-de', 'card-debit']);
  });

  it('keeps an account of any chosen kind', () => {
    const f = withFilter({ kinds: ['card'] });
    expect(ids(filterAccounts(WALLET, f, context))).toEqual(['card-debit', 'card-credit']);
  });

  it('asks the card type of cards only', () => {
    const f = withFilter({ cardTypes: ['credit'] });
    expect(ids(filterAccounts(WALLET, f, context))).toEqual(['card-credit']);
  });

  it('counts a card as valid through the last day of the month it is embossed with', () => {
    const expired = withFilter({ expiry: 'expired' });
    const soon = withFilter({ expiry: 'soon' });
    expect(ids(filterAccounts(WALLET, expired, context))).toEqual(['card-credit']);
    expect(ids(filterAccounts(WALLET, soon, context))).toEqual(['card-debit']);

    const lastDay = [account('sep', { kind: 'card', expires: '2026-09-01' })];
    expect(ids(filterAccounts(lastDay, expired, context))).toEqual([]);
    expect(ids(filterAccounts(lastDay, soon, context))).toEqual(['sep']);
  });

  it('still counts the card on the last day it is good for', () => {
    const cards = [account('sep', { kind: 'card', expires: '2026-09-01' })];
    const lastDay = { ...context, today: '2026-09-30' };
    expect(filterAccounts(cards, withFilter({ expiry: 'expired' }), lastDay)).toEqual([]);
    expect(ids(filterAccounts(cards, withFilter({ expiry: 'soon' }), lastDay))).toEqual(['sep']);
  });

  it('does not call a card that runs for another year soon', () => {
    const later = [account('later', { kind: 'card', expires: '2027-09-01' })];
    expect(filterAccounts(later, withFilter({ expiry: 'soon' }), context)).toEqual([]);
  });

  it('compares the balance in the display currency, both ends included', () => {
    // EUR 100 is USD 116.
    const f = withFilter({ min: '110', max: '500' });
    expect(ids(filterAccounts(WALLET, f, context))).toEqual(['eur-de', 'card-debit']);
  });

  it('reads an open end as no bound, and a negative balance as below any positive one', () => {
    expect(ids(filterAccounts(WALLET, withFilter({ max: '0' }), context))).toEqual(['card-credit']);
  });

  it('leaves out an account it cannot convert once an amount is asked for', () => {
    const f = withFilter({ min: '0' });
    expect(ids(filterAccounts(WALLET, f, context))).not.toContain('btc');
  });

  it('applies every group at once', () => {
    const f = withFilter({ kinds: ['card'], countries: ['RU'], max: '0' });
    expect(ids(filterAccounts(WALLET, f, context))).toEqual(['card-credit']);
  });
});

describe('activeFilterCount', () => {
  it('counts each chosen value and each bound, as the chips do', () => {
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(
      activeFilterCount(
        withFilter({
          currencies: ['EUR', 'USD'],
          countries: ['DE'],
          kinds: ['card'],
          cardTypes: ['debit'],
          expiry: 'soon',
          min: '10',
          max: '',
        }),
      ),
    ).toBe(7);
  });
});

describe('filterChoices', () => {
  it('offers only what the accounts actually have, sorted', () => {
    const choices = filterChoices(WALLET);
    expect(choices.currencies).toEqual(['BTC', 'EUR', 'USD']);
    expect(choices.countries).toEqual(['DE', 'PT', 'RU']);
    expect(choices.kinds).toEqual(['bank_account', 'card', 'crypto_wallet']);
    expect(choices.cardTypes).toEqual(['debit', 'credit']);
    expect(choices.hasExpiry).toBe(true);
  });

  it('offers no card questions when no account is a card that says', () => {
    const choices = filterChoices([account('a'), account('b', { kind: 'card' })]);
    expect(choices.cardTypes).toEqual([]);
    expect(choices.hasExpiry).toBe(false);
  });
});
