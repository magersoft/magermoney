import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  formatAmountLockup,
  resolveCurrencySymbol,
} from '../src/components/amount-lockup/format-amount';
import AmountLockup from '../src/components/amount-lockup/AmountLockup.vue';
import * as ui from '../src/index';

describe('resolveCurrencySymbol', () => {
  it('finds the narrow symbol of a currency that has one', () => {
    expect(resolveCurrencySymbol('USD', 'en')).toBe('$');
    expect(resolveCurrencySymbol('RUB', 'ru')).toBe('₽');
    expect(resolveCurrencySymbol('EUR', 'en')).toBe('€');
  });

  it('returns null when the code is its own symbol or is not ISO-shaped', () => {
    expect(resolveCurrencySymbol('BTC', 'en')).toBeNull();
    expect(resolveCurrencySymbol('USDT', 'en')).toBeNull();
    expect(resolveCurrencySymbol('KZT', 'en')).not.toBe('KZT');
  });
});

describe('formatAmountLockup', () => {
  it('leads with the symbol and splits the fraction off the integer', () => {
    expect(formatAmountLockup('8254.32', { code: 'USD', locale: 'en' })).toEqual({
      sign: '',
      lead: { kind: 'symbol', text: '$' },
      integer: '8,254',
      fraction: '.32',
      code: null,
    });
  });

  it('gives the code the symbol place when the currency has none', () => {
    const parts = formatAmountLockup('3094.32', { code: 'USDT', locale: 'en', scale: 2 });
    expect(parts.lead).toEqual({ kind: 'code', text: 'USDT' });
    expect(parts.integer).toBe('3,094');
    expect(parts.fraction).toBe('.32');
  });

  it('keeps crypto precision instead of rounding to two places', () => {
    const parts = formatAmountLockup('0.10250000', { code: 'BTC', locale: 'en', scale: 8 });
    expect(parts.integer).toBe('0');
    expect(parts.fraction).toBe('.1025');
    expect(parts.lead).toEqual({ kind: 'code', text: 'BTC' });
  });

  it('adds the code after the number when two currencies share a glyph', () => {
    const parts = formatAmountLockup('55', { code: 'CAD', locale: 'en', showCode: true });
    expect(parts.lead).toEqual({ kind: 'symbol', text: '$' });
    expect(parts.code).toBe('CAD');
  });

  it('never repeats a code that already stands in for the symbol', () => {
    expect(
      formatAmountLockup('12', { code: 'USDT', locale: 'en', showCode: true }).code,
    ).toBeNull();
  });

  it('carries the sign, not the minus of the grouping', () => {
    expect(formatAmountLockup('-1240.5', { code: 'USD', locale: 'en' })).toMatchObject({
      sign: '−',
      integer: '1,240',
      fraction: '.50',
    });
    expect(formatAmountLockup('0', { code: 'USD', locale: 'en' })).toMatchObject({
      sign: '',
      integer: '0',
      fraction: '.00',
    });
    expect(formatAmountLockup('-0.00', { code: 'USD', locale: 'en' }).sign).toBe('');
  });

  it('marks a positive change with a plus and leaves a balance unsigned', () => {
    expect(formatAmountLockup('120', { code: 'USD', locale: 'en', signed: true }).sign).toBe('+');
    expect(formatAmountLockup('120', { code: 'USD', locale: 'en' }).sign).toBe('');
    expect(formatAmountLockup('0', { code: 'USD', locale: 'en', signed: true }).sign).toBe('');
  });

  it('groups the way the locale does', () => {
    const ru = formatAmountLockup('1240500.00', { code: 'RUB', locale: 'ru' });
    expect(ru.integer.replace(/[   ]/g, '_')).toBe('1_240_500');
    expect(ru.fraction).toBe(',00');
    expect(formatAmountLockup('1240500.00', { code: 'USD', locale: 'en' }).integer).toBe(
      '1,240,500',
    );
  });

  it('takes an explicit symbol over the resolved one, and null as "use the code"', () => {
    expect(formatAmountLockup('10', { code: 'XYZ', locale: 'en', symbol: '¤' }).lead).toEqual({
      kind: 'symbol',
      text: '¤',
    });
    expect(formatAmountLockup('10', { code: 'USD', locale: 'en', symbol: null }).lead).toEqual({
      kind: 'code',
      text: 'USD',
    });
  });
});

describe('AmountLockup', () => {
  it('sets the fraction at 0.6 of the integer and keeps the digits tabular', () => {
    const w = mount(AmountLockup, { props: { amount: '8254.32', code: 'USD', locale: 'en' } });
    const fraction = w.get('[data-slot="amount-fraction"]');
    expect(fraction.text()).toBe('.32');
    expect(fraction.classes().join(' ')).toContain('0.6em');
    expect(w.attributes('data-amount')).toBeDefined();
    expect(w.get('[data-slot="amount-integer"]').text()).toBe('8,254');
  });

  it('reads as one amount to a screen reader, with the visual split hidden', () => {
    const w = mount(AmountLockup, {
      props: { amount: '8254.32', code: 'USD', locale: 'en', showCode: true },
    });
    expect(w.get('.sr-only').text()).toBe('$8,254.32 USD');
    expect(w.get('[aria-hidden="true"]').text()).toContain('8,254');
  });

  it('sets a code that stands in for a symbol in mono caps', () => {
    const w = mount(AmountLockup, { props: { amount: '3094.32', code: 'usdt', locale: 'en' } });
    const lead = w.get('[data-slot="amount-lead"]');
    expect(lead.text()).toBe('USDT');
    expect(lead.classes()).toContain('font-mono');
  });

  it('leaves a balance in ink and colours only a change', () => {
    const balance = mount(AmountLockup, {
      props: { amount: '-1240.50', code: 'USD', locale: 'en' },
    });
    expect(balance.text()).toContain('−');
    expect(balance.classes().join(' ')).not.toContain('text-negative');

    const down = mount(AmountLockup, {
      props: { amount: '-1240.50', code: 'USD', locale: 'en', variant: 'change' },
    });
    expect(down.classes()).toContain('text-negative');

    const up = mount(AmountLockup, {
      props: { amount: '1240.50', code: 'USD', locale: 'en', variant: 'change' },
    });
    expect(up.classes()).toContain('text-positive');
    expect(up.text()).toContain('+');
  });

  it('is exported from the package public API, formatter included', () => {
    for (const name of ['AmountLockup', 'formatAmountLockup', 'resolveCurrencySymbol'])
      expect(ui).toHaveProperty(name);
  });

  it('inherits its size from the caller instead of declaring one', () => {
    const w = mount(AmountLockup, {
      props: { amount: '12.00', code: 'USD', locale: 'en', class: 'text-3xl' },
    });
    expect(w.classes()).toContain('text-3xl');
    expect(w.classes().join(' ')).not.toMatch(/\btext-(xs|sm|base|lg|xl|2xl)\b/);
  });
});
