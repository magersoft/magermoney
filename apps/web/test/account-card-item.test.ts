import { describe, expect, it } from 'vitest';
import type { AccountDto } from '@magermoney/contracts';
import { ACCOUNT_COLORWAYS } from '@magermoney/domain';
import { ACCOUNT_COLORWAYS as UI_COLORWAYS } from '@magermoney/ui';
import {
  accountReference,
  cardExpiry,
  toCardItem,
} from '../src/modules/accounts/domain/account-card';

const dto = (over: Partial<AccountDto> = {}): AccountDto => ({
  id: 'a1',
  name: 'Карман',
  bank: 'Tinkoff',
  country: 'RU',
  currency: 'USD',
  kind: 'bank_account',
  cardType: null,
  isSpending: false,
  isPinned: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  colorway: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '1200.00',
  balanceRecordedAt: null,
  ...over,
});

const usd = { kind: 'fiat', scale: 2 } as const;

/*
 * The colours are declared twice — canonically in the domain, and again in the
 * design system, which may not import it. Two lists that drift would paint a
 * card in a colour the picker cannot offer, or offer one the API refuses.
 */
describe('the colour list', () => {
  it('says the same thing in the domain and in the design system', () => {
    expect([...UI_COLORWAYS]).toEqual([...ACCOUNT_COLORWAYS]);
  });
});

describe('cardExpiry', () => {
  it('embosses a stored date the way a card wears it', () => {
    expect(cardExpiry('2025-04-30')).toBe('04/25');
  });

  it('says nothing when there is no date', () => {
    expect(cardExpiry(null)).toBeNull();
  });
});

describe('toCardItem', () => {
  it('gives a payment card its scheme, its last digits and its expiry', () => {
    const card = toCardItem(
      dto({
        kind: 'card',
        cardNetwork: 'Visa',
        cardLast4: '2340',
        cardExpires: '2025-04-30',
      }),
      usd,
    );
    expect(card).toMatchObject({
      isCard: true,
      network: 'Visa',
      last4: '2340',
      expires: '04/25',
      reference: null,
    });
  });

  it('gives every other account where it is held instead — we store no account numbers', () => {
    const card = toCardItem(dto({ kind: 'deposit' }), usd);
    expect(card.isCard).toBe(false);
    expect(card.reference).toBe(accountReference({ bank: 'Tinkoff', country: 'RU' }));
  });

  it('carries the colour the owner picked, and leaves it empty when they picked none', () => {
    expect(toCardItem(dto({ colorway: 'teal' }), usd).colorway).toBe('teal');
    expect(toCardItem(dto(), usd).colorway).toBeNull();
  });

  it('reads zero for an account with no balance yet rather than leaving the card blank', () => {
    expect(toCardItem(dto({ balance: null }), usd).amount).toBe('0');
  });
});
