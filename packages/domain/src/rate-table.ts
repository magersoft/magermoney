import Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import type { CurrencyCode, CurrencyRegistry } from './currency.js';
import { RateMissingError, UnknownCurrencyError } from './errors.js';
import { Money } from './money.js';
import type { IsoDate, Rate } from './rate.js';

export class RateTable {
  private readonly byBase = new Map<CurrencyCode, Decimal>();
  constructor(
    readonly date: IsoDate,
    rates: readonly Rate[],
    private readonly registry: CurrencyRegistry,
  ) {
    for (const r of rates) this.byBase.set(r.base, r.value);
    if (!this.byBase.has('USD')) this.byBase.set('USD', new Decimal(1));
  }

  rateOf(code: CurrencyCode): Result<Decimal, RateMissingError> {
    const v = this.byBase.get(code);
    return v && v.isFinite() && !v.isZero()
      ? ok(v)
      : err(new RateMissingError(code, 'USD', this.date));
  }

  convert(money: Money, to: CurrencyCode): Result<Money, RateMissingError | UnknownCurrencyError> {
    return this.registry.get(to).andThen((target) => {
      if (target.code === money.currency.code) return ok(money);
      return this.rateOf(money.currency.code).andThen((fromRate) =>
        this.rateOf(target.code).map((toRate) =>
          Money.of(money.amount.times(fromRate).div(toRate), target),
        ),
      );
    });
  }
}
