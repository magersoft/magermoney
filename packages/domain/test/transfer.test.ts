import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  InsufficientFundsError,
  Money,
  TransferError,
  applyTransfer,
  deriveTransfer,
  CurrencyMismatchError,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const c = (code: string) => reg.get(code)._unsafeUnwrap();
const m = (amount: string, code: string) => Money.of(amount, c(code));

describe('deriveTransfer', () => {
  it('same currency: fee is the difference and there is no rate', () => {
    const d = deriveTransfer({
      amountSent: m('100', 'USD'),
      amountReceived: m('98.5', 'USD'),
    })._unsafeUnwrap();
    expect(d.fee?.toString()).toBe('1.5');
    expect(d.realisedRate).toBeNull();
  });
  it('same currency: a received amount above the sent one is a negative fee', () => {
    const e = deriveTransfer({
      amountSent: m('100', 'USD'),
      amountReceived: m('101', 'USD'),
    })._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(TransferError);
    expect((e as TransferError).reason).toBe('negative_fee');
  });
  it('cross currency: the realised rate is received / sent to 10 significant digits, no fee', () => {
    const d = deriveTransfer({
      amountSent: m('15931.21', 'USD'),
      amountReceived: m('13723.27', 'EUR'),
    })._unsafeUnwrap();
    // 13723.27 / 15931.21 to 10 significant digits; the brief's literal value
    // (0.8614076412) does not match this input pair — verified independently
    // with decimal.js and plain float division. See task-1-report.md.
    expect(d.realisedRate?.toString()).toBe('0.8614078905');
    expect(d.fee).toBeNull();
  });
  it('rejects a zero sent amount', () => {
    const e = deriveTransfer({
      amountSent: m('0', 'USD'),
      amountReceived: m('0', 'EUR'),
    })._unsafeUnwrapErr();
    expect((e as TransferError).reason).toBe('non_positive_amount');
  });
  it('rejects a zero received amount', () => {
    const e = deriveTransfer({
      amountSent: m('100', 'USD'),
      amountReceived: m('0', 'EUR'),
    })._unsafeUnwrapErr();
    expect((e as TransferError).reason).toBe('non_positive_amount');
  });
});

describe('applyTransfer', () => {
  const debit = { kind: 'card', cardType: 'debit' } as const;
  const credit = { kind: 'card', cardType: 'credit' } as const;
  it('moves money between two balances', () => {
    const r = applyTransfer({
      from: { balance: m('1000', 'USD'), ...debit },
      toBalance: m('50', 'EUR'),
      amountSent: m('100', 'USD'),
      amountReceived: m('86.14', 'EUR'),
    })._unsafeUnwrap();
    expect(r.fromAfter.toString()).toBe('900');
    expect(r.toAfter.toString()).toBe('136.14');
  });
  it('refuses to overdraw a debit account', () => {
    const e = applyTransfer({
      from: { balance: m('10', 'USD'), ...debit },
      toBalance: m('0', 'USD'),
      amountSent: m('11', 'USD'),
      amountReceived: m('11', 'USD'),
    })._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(InsufficientFundsError);
  });
  it('lets a credit card go negative', () => {
    const r = applyTransfer({
      from: { balance: m('10', 'USD'), ...credit },
      toBalance: m('0', 'USD'),
      amountSent: m('11', 'USD'),
      amountReceived: m('11', 'USD'),
    })._unsafeUnwrap();
    expect(r.fromAfter.toString()).toBe('-1');
  });
  it('rejects a sent amount in another currency than the source balance', () => {
    const e = applyTransfer({
      from: { balance: m('10', 'USD'), ...debit },
      toBalance: m('0', 'EUR'),
      amountSent: m('1', 'EUR'),
      amountReceived: m('1', 'EUR'),
    })._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(CurrencyMismatchError);
  });
  it('a missing balance is zero', () => {
    expect(Money.zero(c('EUR')).toString()).toBe('0');
    expect(Money.zero(c('EUR')).currency.code).toBe('EUR');
  });
});
