import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { formatAmountInput, parseAmountInput } from '../src/components/money-input/parse';
import MoneyInput from '../src/components/money-input/MoneyInput.vue';

describe('parseAmountInput', () => {
  it('accepts locale separators and spaces, never a float', () => {
    expect(parseAmountInput('13 723,27', 2, false)).toBe('13723.27');
    expect(parseAmountInput('13 723.27', 2, false)).toBe('13723.27');
    expect(parseAmountInput('0,33', 8, false)).toBe('0.33');
    expect(parseAmountInput('', 2, false)).toBe('');
  });
  it('accepts the narrow no-break space Intl.NumberFormat("ru-RU") uses as a group separator', () => {
    expect(parseAmountInput('13 723,27', 2, false)).toBe('13723.27');
    expect(parseAmountInput('13 723,27', 2, false)).toBe('13723.27');
  });
  it('rejects junk, two separators, too many decimals, and negatives unless allowed', () => {
    expect(parseAmountInput('1.2.3', 2, false)).toBeNull();
    expect(parseAmountInput('abc', 2, false)).toBeNull();
    expect(parseAmountInput('1.234', 2, false)).toBeNull();
    expect(parseAmountInput('-5', 2, false)).toBeNull();
    expect(parseAmountInput('-5', 2, true)).toBe('-5');
  });
  it('treats a leading-dot fraction as zero point something', () => {
    expect(parseAmountInput('.5', 2, false)).toBe('0.5');
    expect(parseAmountInput(',5', 2, false)).toBe('0.5');
  });
  it('formats for the locale without rounding', () => {
    expect(formatAmountInput('13723.27', 'ru')).toBe('13 723,27');
    expect(formatAmountInput('13723.27', 'en')).toBe('13,723.27');
    expect(formatAmountInput('0.00000001', 'en')).toBe('0.00000001');
  });
});

describe('MoneyInput', () => {
  it('emits the normalised decimal string and keeps invalid input unemitted', async () => {
    const w = mount(MoneyInput, { props: { modelValue: '', scale: 2, locale: 'ru' } });
    const input = w.get('input');
    await input.setValue('1 250,5');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['1250.5']);
    await input.setValue('1,2,3');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['1250.5']);
    expect(input.attributes('aria-invalid')).toBe('true');
  });
  it('uses the decimal keyboard', () => {
    const w = mount(MoneyInput, { props: { modelValue: '', scale: 2, locale: 'en' } });
    expect(w.get('input').attributes('inputmode')).toBe('decimal');
  });
  it('clears invalid once an external update replaces the text', async () => {
    const w = mount(MoneyInput, { props: { modelValue: '', scale: 2, locale: 'ru' } });
    const input = w.get('input');
    await input.setValue('1,2,3');
    expect(input.attributes('aria-invalid')).toBe('true');
    await w.setProps({ modelValue: '7' });
    expect(input.element.value).toBe('7');
    expect(input.attributes('aria-invalid')).toBeUndefined();
  });
});
