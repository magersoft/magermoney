import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SegmentedControl from '../src/components/segmented-control/SegmentedControl.vue';

const options = [
  { value: 'income', label: 'Income' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'budgets', label: 'Budgets' },
];
const mountIt = (modelValue = 'income') =>
  mount(SegmentedControl, {
    props: { modelValue, options, ariaLabel: 'Plan section' },
    attachTo: document.body,
  });

describe('SegmentedControl', () => {
  it('is a radio group: one checked segment, one tab stop', () => {
    const w = mountIt('expenses');
    expect(w.get('[role="radiogroup"]').attributes('aria-label')).toBe('Plan section');
    const radios = w.findAll('[role="radio"]');
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1']);
    w.unmount();
  });
  it('emits the value of the segment that was clicked', async () => {
    const w = mountIt();
    await w.get('[data-value="budgets"]').trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['budgets']]);
    w.unmount();
  });
  it('moves with the arrow keys, wrapping at both ends, and takes focus along', async () => {
    const w = mountIt('income');
    await w.get('[data-testid="segment-income"]').trigger('keydown', { key: 'ArrowLeft' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['budgets']);
    expect(document.activeElement).toBe(w.get('[data-testid="segment-budgets"]').element);
    await w.get('[data-testid="segment-budgets"]').trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['income']);
    w.unmount();
  });
});
