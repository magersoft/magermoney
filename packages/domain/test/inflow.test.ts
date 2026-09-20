import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CurrencyMismatchError,
  CurrencyRegistry,
  InflowError,
  Money,
  applyInflow,
  deriveInflowCredit,
} from '../src/index.js';

const reg = CurrencyRegistry.sample();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const reason = (r: { isErr(): boolean; _unsafeUnwrapErr(): unknown }) =>
  (r._unsafeUnwrapErr() as InflowError).reason;

describe('deriveInflowCredit', () => {
  it('credits the inflow amount itself when the account holds the same currency', () => {
    const r = deriveInflowCredit({
      amount: Money.of('4200', USD),
      accountCurrency: USD,
    })._unsafeUnwrap();
    expect(r.credited.toString()).toBe('4200');
    expect(r.realisedRate).toBeNull();
  });
  it('accepts an equal credited amount in the same currency and refuses a different one', () => {
    expect(
      deriveInflowCredit({
        amount: Money.of('100', USD),
        accountCurrency: USD,
        creditedAmount: Money.of('100.00', USD),
      }).isOk(),
    ).toBe(true);
    expect(
      reason(
        deriveInflowCredit({
          amount: Money.of('100', USD),
          accountCurrency: USD,
          creditedAmount: Money.of('99', USD),
        }),
      ),
    ).toBe('credited_mismatch');
  });
  it('needs both amounts when the account holds another currency and derives the realised rate', () => {
    expect(
      reason(
        deriveInflowCredit({
          amount: Money.of('4200', USD),
          accountCurrency: EUR,
        }),
      ),
    ).toBe('credited_amount_required');
    const r = deriveInflowCredit({
      amount: Money.of('4200', USD),
      accountCurrency: EUR,
      creditedAmount: Money.of('3864', EUR),
    })._unsafeUnwrap();
    expect(r.credited.toString()).toBe('3864');
    expect(r.realisedRate?.toFixed()).toBe('0.92');
  });
  it('refuses a credited amount that is not in the account currency', () => {
    const r = deriveInflowCredit({
      amount: Money.of('4200', USD),
      accountCurrency: EUR,
      creditedAmount: Money.of('4200', USD),
    });
    expect(r._unsafeUnwrapErr()).toBeInstanceOf(InflowError);
    expect(r._unsafeUnwrapErr().code).toBe('INFLOW_INVALID');
    expect(reason(r)).toBe('credited_mismatch');
  });
  it('refuses zero and negative amounts on either side', () => {
    expect(
      reason(
        deriveInflowCredit({
          amount: Money.of('0', USD),
          accountCurrency: USD,
        }),
      ),
    ).toBe('non_positive_amount');
    expect(
      reason(
        deriveInflowCredit({
          amount: Money.of('10', USD),
          accountCurrency: EUR,
          creditedAmount: Money.of('-1', EUR),
        }),
      ),
    ).toBe('non_positive_amount');
  });
});

describe('applyInflow', () => {
  it('adds the credited amount to the latest balance', () => {
    const after = applyInflow({
      balance: Money.of('120.50', EUR),
      credited: Money.of('30', EUR),
    });
    expect(after._unsafeUnwrap().toString()).toBe('150.5');
  });
  it('lets a credit card debt shrink', () => {
    const after = applyInflow({
      balance: Money.of('-200', EUR),
      credited: Money.of('50', EUR),
    });
    expect(after._unsafeUnwrap().toString()).toBe('-150');
  });
  it('refuses a non-positive credit and a credit in another currency', () => {
    expect(
      reason(
        applyInflow({
          balance: Money.of('1', EUR),
          credited: Money.of('0', EUR),
        }),
      ),
    ).toBe('non_positive_amount');
    expect(
      applyInflow({
        balance: Money.of('1', EUR),
        credited: Money.of('1', USD),
      })._unsafeUnwrapErr(),
    ).toBeInstanceOf(CurrencyMismatchError);
  });
  it('property: a same-currency credit raises the balance by exactly the inflow amount', () => {
    const cents = fc
      .integer({ min: 1, max: 10_000_000_00 })
      .map((n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`);
    fc.assert(
      fc.property(cents, cents, (bal, amt) => {
        const balance = Money.of(bal, USD);
        const amount = Money.of(amt, USD);
        const { credited } = deriveInflowCredit({
          amount,
          accountCurrency: USD,
        })._unsafeUnwrap();
        const after = applyInflow({ balance, credited })._unsafeUnwrap();
        expect(after.subtract(balance)._unsafeUnwrap().toString()).toBe(amount.toString());
      }),
    );
  });
});
