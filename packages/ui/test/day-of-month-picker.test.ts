import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DayOfMonthPicker from '../src/components/day-of-month-picker/DayOfMonthPicker.vue';

describe('DayOfMonthPicker', () => {
  it('offers 31 days and marks the chosen ones', () => {
    const w = mount(DayOfMonthPicker, { props: { modelValue: [10, 25] } });
    expect(w.findAll('button')).toHaveLength(31);
    expect(w.get('[data-testid="day-10"]').attributes('aria-pressed')).toBe('true');
    expect(w.get('[data-testid="day-11"]').attributes('aria-pressed')).toBe('false');
  });
  it('adds a day in order and removes one that was already chosen', async () => {
    const w = mount(DayOfMonthPicker, { props: { modelValue: [25] } });
    await w.get('[data-testid="day-10"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([[10, 25]]);
    await w.setProps({ modelValue: [10, 25] });
    await w.get('[data-testid="day-25"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([[10]]);
  });
  it('in single mode holds one day or none', async () => {
    const w = mount(DayOfMonthPicker, { props: { modelValue: null, multiple: false } });
    await w.get('[data-testid="day-15"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([15]);
    await w.setProps({ modelValue: 15 });
    expect(w.get('[data-testid="day-15"]').attributes('aria-pressed')).toBe('true');
    await w.get('[data-testid="day-20"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([20]);
    await w.setProps({ modelValue: 20 });
    await w.get('[data-testid="day-20"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([null]);
  });
  it('never emits a duplicate, even when it was handed one', async () => {
    const w = mount(DayOfMonthPicker, { props: { modelValue: [5, 5, 1] } });
    await w.get('[data-testid="day-3"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([[1, 3, 5]]);
  });
});
