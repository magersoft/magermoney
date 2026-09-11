import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CurrencyRegistry, Money } from '../src/index.js';

const USD = CurrencyRegistry.default().get('USD')._unsafeUnwrap();
const amount = fc
  .tuple(fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }), fc.integer({ min: 0, max: 999 }))
  .map(([int, frac]) => `${int}.${String(frac).padStart(3, '0')}`);

describe('Money properties', () => {
  it('addition is commutative and associative', () => {
    fc.assert(
      fc.property(amount, amount, amount, (a, b, c) => {
        const [x, y, z] = [Money.of(a, USD), Money.of(b, USD), Money.of(c, USD)];
        expect(x.add(y)._unsafeUnwrap().toString()).toBe(y.add(x)._unsafeUnwrap().toString());
        const l = x.add(y)._unsafeUnwrap().add(z)._unsafeUnwrap();
        const r = x.add(y.add(z)._unsafeUnwrap())._unsafeUnwrap();
        expect(l.toString()).toBe(r.toString());
      }),
    );
  });

  it('round is idempotent and never exceeds the scale', () => {
    fc.assert(
      fc.property(amount, (a) => {
        const once = Money.of(a, USD).round();
        expect(once.round().toString()).toBe(once.toString());
        expect(once.amount.decimalPlaces()).toBeLessThanOrEqual(USD.scale);
      }),
    );
  });

  it('parse(toString) round-trips', () => {
    fc.assert(
      fc.property(amount, (a) => {
        const m = Money.of(a, USD);
        expect(Money.parse(m.toString(), USD)._unsafeUnwrap().toString()).toBe(m.toString());
      }),
    );
  });
});
