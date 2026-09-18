import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { fractionToPercent, percentToFraction } from '../src/components/percent-input/percent';
import PercentInput from '../src/components/percent-input/PercentInput.vue';

describe('percentToFraction', () => {
  it('moves the point two places left without ever touching a float', () => {
    expect(percentToFraction('15')).toBe('0.15');
    expect(percentToFraction('5')).toBe('0.05');
    expect(percentToFraction('10')).toBe('0.1');
    expect(percentToFraction('15,5')).toBe('0.155');
    expect(percentToFraction('0.25')).toBe('0.0025');
    expect(percentToFraction('13 %')).toBe('0.13');
    expect(percentToFraction('0')).toBe('0');
    expect(percentToFraction('')).toBe('0');
  });
  it('rejects 100 and above, three decimals, negatives and junk', () => {
    expect(percentToFraction('100')).toBeNull();
    expect(percentToFraction('12.345')).toBeNull();
    expect(percentToFraction('-5')).toBeNull();
    expect(percentToFraction('abc')).toBeNull();
    expect(percentToFraction('1.2.3')).toBeNull();
  });
});

describe('fractionToPercent', () => {
  it('moves the point two places right and drops padding zeros', () => {
    expect(fractionToPercent('0.15')).toBe('15');
    expect(fractionToPercent('0.05')).toBe('5');
    expect(fractionToPercent('0.1')).toBe('10');
    expect(fractionToPercent('0.155')).toBe('15.5');
    expect(fractionToPercent('0.0025')).toBe('0.25');
    expect(fractionToPercent('0')).toBe('0');
    expect(fractionToPercent('0.150')).toBe('15');
  });
  it('round-trips every value the field accepts', () => {
    for (const p of ['0', '1', '9.5', '13', '15.25', '99.99'])
      expect(fractionToPercent(percentToFraction(p)!)).toBe(p);
  });
});

describe('PercentInput', () => {
  it('shows the fraction as a percentage in the locale and emits a fraction', async () => {
    const w = mount(PercentInput, { props: { modelValue: '0.155', locale: 'ru' } });
    const input = w.get('input');
    expect(input.element.value).toBe('15,5');
    await input.setValue('13');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['0.13']);
  });
  it('keeps junk in the field, marks it invalid and emits nothing for it', async () => {
    const w = mount(PercentInput, { props: { modelValue: '0', locale: 'en' } });
    const input = w.get('input');
    await input.setValue('120');
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
  it('follows an external change', async () => {
    const w = mount(PercentInput, { props: { modelValue: '0.1', locale: 'en' } });
    await w.setProps({ modelValue: '0.2' });
    expect(w.get('input').element.value).toBe('20');
  });
});
