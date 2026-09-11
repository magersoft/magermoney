import { describe, expect, it } from 'vitest';
import {
  CreateAccountInputSchema,
  CreateTransferInputSchema,
  CursorQuerySchema,
  UpdateAccountInputSchema,
} from '../src/index.js';

const base = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'bank_account',
  isSpending: true,
};

describe('account contracts', () => {
  it('accepts a plain account with an opening balance', () => {
    expect(
      CreateAccountInputSchema.safeParse({ ...base, openingBalance: { amount: '14577.45' } })
        .success,
    ).toBe(true);
  });
  it('rejects card fields on a non-card', () => {
    const r = CreateAccountInputSchema.safeParse({ ...base, cardLast4: '5520' });
    expect(r.success).toBe(false);
  });
  it('accepts card fields on a card and lower-case country is rejected', () => {
    expect(
      CreateAccountInputSchema.safeParse({
        ...base,
        kind: 'card',
        cardType: 'debit',
        cardLast4: '5520',
        cardExpires: '2027-07-31',
      }).success,
    ).toBe(true);
    expect(CreateAccountInputSchema.safeParse({ ...base, country: 'ru' }).success).toBe(false);
  });
  it('a partial update may carry card fields only together with kind=card', () => {
    expect(UpdateAccountInputSchema.safeParse({ name: 'New' }).success).toBe(true);
    expect(UpdateAccountInputSchema.safeParse({ cardLast4: '1234' }).success).toBe(false);
    expect(UpdateAccountInputSchema.safeParse({ kind: 'card', cardLast4: '1234' }).success).toBe(
      true,
    );
  });
  it('a partial update omitting isSpending should not inject a default', () => {
    expect(UpdateAccountInputSchema.parse({ name: 'New' })).toEqual({ name: 'New' });
  });
  it('a creation omitting isSpending should default to false', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isSpending, ...baseWithoutSpending } = base;
    expect(CreateAccountInputSchema.parse(baseWithoutSpending).isSpending).toBe(false);
  });
  it('coerces the list limit and caps it', () => {
    expect(CursorQuerySchema.parse({}).limit).toBe(50);
    expect(CursorQuerySchema.parse({ limit: '20' }).limit).toBe(20);
    expect(CursorQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('transfer contracts', () => {
  const ids = {
    fromAccountId: '11111111-1111-4111-8111-111111111111',
    toAccountId: '22222222-2222-4222-8222-222222222222',
  };
  it('accepts sent only (same currency decided server-side)', () => {
    expect(CreateTransferInputSchema.safeParse({ ...ids, amountSent: '100' }).success).toBe(true);
  });
  it('rejects non-decimal amounts', () => {
    expect(CreateTransferInputSchema.safeParse({ ...ids, amountSent: '1,5' }).success).toBe(false);
  });
});
