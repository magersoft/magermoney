import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError } from './errors.js';

export type CurrencyCode = string;
export type CurrencyKind = 'fiat' | 'crypto';
export interface Currency {
  code: CurrencyCode;
  kind: CurrencyKind;
  scale: number;
  symbol?: string;
}

const fiat = (code: string, scale = 2): Currency => ({ code, kind: 'fiat', scale });
const crypto = (code: string, scale: number, symbol?: string): Currency =>
  symbol === undefined ? { code, kind: 'crypto', scale } : { code, kind: 'crypto', scale, symbol };

/**
 * What the rest of the app asks about a currency. An interface rather than the
 * class, so a registry that is loaded from the catalogue and swapped when it
 * arrives can stand in for one built from a literal list — the callers only
 * ever read.
 */
export interface CurrencyLookup {
  has(code: CurrencyCode): boolean;
  get(code: CurrencyCode): Result<Currency, UnknownCurrencyError>;
  all(): Currency[];
}

/**
 * A small stand-in set for tests and fixtures. Deliberately NOT the app's
 * catalogue: that lives in `public.currencies` and is loaded from there, so
 * adding a currency needs a migration rather than a release (ADR 0006). Nothing
 * on a production path may read this list.
 */
export const SAMPLE_CURRENCIES: readonly Currency[] = [
  fiat('USD'),
  fiat('EUR'),
  fiat('RUB'),
  fiat('KZT'),
  fiat('UZS'),
  fiat('IDR'),
  fiat('EGP'),
  fiat('GEL'),
  fiat('KGS'),
  crypto('BTC', 8, '₿'),
  crypto('ETH', 8, 'Ξ'),
  crypto('USDT', 2, '₮'),
  crypto('XRP', 6),
  crypto('SOL', 6),
  crypto('DOGE', 4),
  crypto('PEPE', 8),
  crypto('AVAX', 6),
  crypto('ATOM', 6),
  crypto('TRX', 6),
];

export class CurrencyRegistry implements CurrencyLookup {
  private readonly byCode = new Map<CurrencyCode, Currency>();
  constructor(list: readonly Currency[]) {
    for (const c of list) {
      if (this.byCode.has(c.code)) throw new Error(`Duplicate currency: ${c.code}`);
      this.byCode.set(c.code, c);
    }
  }
  /** The stand-in set — tests and fixtures only. See `SAMPLE_CURRENCIES`. */
  static sample(): CurrencyRegistry {
    return new CurrencyRegistry(SAMPLE_CURRENCIES);
  }
  has(code: CurrencyCode): boolean {
    return this.byCode.has(code);
  }
  get(code: CurrencyCode): Result<Currency, UnknownCurrencyError> {
    const c = this.byCode.get(code);
    return c ? ok(c) : err(new UnknownCurrencyError(code));
  }
  all(): Currency[] {
    return [...this.byCode.values()];
  }
}
