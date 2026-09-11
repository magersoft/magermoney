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

export const DEFAULT_CURRENCIES: readonly Currency[] = [
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

export class CurrencyRegistry {
  private readonly byCode = new Map<CurrencyCode, Currency>();
  constructor(list: readonly Currency[]) {
    for (const c of list) {
      if (this.byCode.has(c.code)) throw new Error(`Duplicate currency: ${c.code}`);
      this.byCode.set(c.code, c);
    }
  }
  static default(): CurrencyRegistry {
    return new CurrencyRegistry(DEFAULT_CURRENCIES);
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
