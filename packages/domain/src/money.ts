import Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import type { Currency } from './currency.js';
import { CurrencyMismatchError, InvalidAmountError } from './errors.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type DecimalInput = string | number | Decimal;

export class Money {
  private constructor(
    readonly amount: Decimal,
    readonly currency: Currency,
  ) {}

  static of(amount: DecimalInput, currency: Currency): Money {
    return new Money(new D(amount), currency);
  }

  static zero(currency: Currency): Money {
    return new Money(new D(0), currency);
  }

  static parse(raw: string, currency: Currency): Result<Money, InvalidAmountError> {
    if (!/^-?\d+(\.\d+)?$/.test(raw.trim())) return err(new InvalidAmountError(raw));
    return ok(new Money(new D(raw.trim()), currency));
  }

  private same(other: Money): Result<true, CurrencyMismatchError> {
    return this.currency.code === other.currency.code
      ? ok(true)
      : err(new CurrencyMismatchError(this.currency.code, other.currency.code));
  }

  add(other: Money): Result<Money, CurrencyMismatchError> {
    return this.same(other).map(() => new Money(this.amount.plus(other.amount), this.currency));
  }
  subtract(other: Money): Result<Money, CurrencyMismatchError> {
    return this.same(other).map(() => new Money(this.amount.minus(other.amount), this.currency));
  }
  multiply(factor: DecimalInput): Money {
    return new Money(this.amount.times(new D(factor)), this.currency);
  }
  compare(other: Money): Result<-1 | 0 | 1, CurrencyMismatchError> {
    return this.same(other).map(() => this.amount.comparedTo(other.amount) as -1 | 0 | 1);
  }
  round(): Money {
    return new Money(
      this.amount.toDecimalPlaces(this.currency.scale, Decimal.ROUND_HALF_UP),
      this.currency,
    );
  }
  isZero(): boolean {
    return this.amount.isZero();
  }
  isNegative(): boolean {
    return this.amount.isNegative();
  }
  toString(): string {
    return this.amount.toFixed();
  }
  toJSON(): { amount: string; currency: string } {
    return { amount: this.toString(), currency: this.currency.code };
  }
}
