import { describe, expect, it } from 'vitest';
import { formatMoney } from '../src/shared/money/format.js';

/**
 * `Intl` separates groups and the currency symbol with non-breaking spaces.
 * They are the correct output, and unreadable in an assertion, so the spaces
 * are normalised here rather than the expectations weakened.
 */
function fmt(...args: Parameters<typeof formatMoney>): string {
  return formatMoney(...args).replace(/ | /g, ' ');
}

describe('formatMoney', () => {
  it('formats fiat with Intl per locale', () => {
    expect(fmt('1234.5', 'EUR', 'ru')).toBe('1 234,50 €');
    expect(fmt('1234.5', 'USD', 'en')).toBe('$1,234.50');
  });

  it('formats crypto with the given scale and symbol', () => {
    expect(fmt('0.01570000', 'BTC', 'en', { scale: 8, symbol: '₿' })).toBe('₿0.0157');
    expect(fmt('24715', 'USDT', 'ru', { scale: 2, symbol: '₮' })).toBe('24 715,00 ₮');
  });

  it('hides digits when asked', () => {
    expect(fmt('1234.5', 'EUR', 'ru', { hide: true })).toBe('•••• €');
  });
});
