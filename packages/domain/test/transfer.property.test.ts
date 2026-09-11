import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CurrencyRegistry, Money, applyTransfer, deriveTransfer } from '../src/index.js';

const reg = CurrencyRegistry.default();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const cents = fc
  .integer({ min: 1, max: 10_000_000_00 })
  .map((n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`);

describe('transfer properties', () => {
  it('same currency: capital drops by exactly the fee', () => {
    fc.assert(
      fc.property(cents, cents, cents, (bal, sent, feeRaw) => {
        const sentM = Money.of(sent, USD);
        const fee = Money.of(feeRaw, USD);
        if (fee.compare(sentM)._unsafeUnwrap() >= 0) return;
        const balance = Money.of(bal, USD).add(sentM)._unsafeUnwrap();
        const received = sentM.subtract(fee)._unsafeUnwrap();
        const d = deriveTransfer({ amountSent: sentM, amountReceived: received })._unsafeUnwrap();
        const r = applyTransfer({
          from: { balance, kind: 'bank_account', cardType: null },
          toBalance: Money.zero(USD),
          amountSent: sentM,
          amountReceived: received,
        })._unsafeUnwrap();
        const before = balance;
        const after = r.fromAfter.add(r.toAfter)._unsafeUnwrap();
        expect(before.subtract(after)._unsafeUnwrap().toString()).toBe(d.fee!.toString());
      }),
    );
  });
  it('cross currency: sent × realisedRate rounds back to received', () => {
    fc.assert(
      fc.property(cents, cents, (sent, received) => {
        const d = deriveTransfer({
          amountSent: Money.of(sent, USD),
          amountReceived: Money.of(received, EUR),
        })._unsafeUnwrap();
        const back = Money.of(sent, USD).multiply(d.realisedRate!);
        expect(Money.of(back.amount, EUR).round().toString()).toBe(
          Money.of(received, EUR).round().toString(),
        );
      }),
    );
  });
});
