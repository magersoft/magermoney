import { describe, expect, it } from 'vitest';
import { ref, shallowRef } from 'vue';
import { CurrencyRegistry, Decimal, Money, RateTable, type Currency } from '@magermoney/domain';
import { createConvertToDisplay } from '../src/modules/rates/application/convert-to-display.js';

const fiat = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });
const registry = new CurrencyRegistry([fiat('USD'), fiat('EUR'), fiat('KZT')]);
const table = new RateTable(
  '2026-09-11',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.16'), date: '2026-09-11', source: 'api' }],
  registry,
);

describe('convertToDisplay', () => {
  it('converts into the current display currency', () => {
    const convert = createConvertToDisplay(shallowRef<RateTable | undefined>(table), ref('USD'));

    const result = convert(Money.of('100', fiat('EUR')));

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().toString()).toBe('116');
  });

  it('fails with the missing rate rather than guessing', () => {
    const convert = createConvertToDisplay(shallowRef<RateTable | undefined>(table), ref('KZT'));

    const result = convert(Money.of('100', fiat('EUR')));

    expect(result._unsafeUnwrapErr().code).toBe('RATE_MISSING');
  });

  it('fails while the rates are still on their way', () => {
    const convert = createConvertToDisplay(
      shallowRef<RateTable | undefined>(undefined),
      ref('USD'),
    );

    expect(convert(Money.of('100', fiat('EUR'))).isErr()).toBe(true);
  });
});
