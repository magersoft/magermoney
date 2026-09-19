import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TabBar from '../src/components/tab-bar/TabBar.vue';

const tabs = [
  { value: 'income', label: 'Income' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'budgets', label: 'Budgets' },
];
const mountIt = (modelValue = 'income') =>
  mount(TabBar, {
    props: { modelValue, tabs, ariaLabel: 'Plan sections', panelId: 'plan-panel' },
    attachTo: document.body,
  });

describe('TabBar', () => {
  it('is a tab list: one selected tab, one tab stop, and it names its panel', () => {
    const w = mountIt('expenses');
    expect(w.get('[role="tablist"]').attributes('aria-label')).toBe('Plan sections');
    const items = w.findAll('[role="tab"]');
    expect(items.map((r) => r.attributes('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(items.map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(items.map((r) => r.attributes('aria-controls'))).toEqual([
      'plan-panel',
      'plan-panel',
      'plan-panel',
    ]);
    /* The panel is labelled by the tab that is open, so each tab needs its own id. */
    expect(items.map((r) => r.attributes('id'))).toEqual([
      'tab-income',
      'tab-expenses',
      'tab-budgets',
    ]);
    w.unmount();
  });

  it('emits the tab that was clicked, and nothing when it is already open', async () => {
    const w = mountIt();
    await w.get('[data-testid="tab-budgets"]').trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['budgets']]);
    await w.get('[data-testid="tab-income"]').trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['budgets']]);
    w.unmount();
  });

  /* Driven the way a screen drives it: what it emits comes back as the prop. */
  it('moves with the arrow keys, wrapping at both ends, and takes focus along', async () => {
    const w = mountIt('income');
    await w.get('[data-testid="tab-income"]').trigger('keydown', { key: 'ArrowLeft' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['budgets']);
    expect(document.activeElement).toBe(w.get('[data-testid="tab-budgets"]').element);
    await w.setProps({ modelValue: 'budgets' });
    await w.get('[data-testid="tab-budgets"]').trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['income']);
    w.unmount();
  });

  it('jumps to the first and last tab with Home and End', async () => {
    const w = mountIt('expenses');
    await w.get('[data-testid="tab-expenses"]').trigger('keydown', { key: 'End' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['budgets']);
    await w.setProps({ modelValue: 'budgets' });
    await w.get('[data-testid="tab-budgets"]').trigger('keydown', { key: 'Home' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['income']);
    w.unmount();
  });

  it('leaves other keys to the browser', async () => {
    const w = mountIt();
    await w.get('[data-testid="tab-income"]').trigger('keydown', { key: 'a' });
    expect(w.emitted('update:modelValue')).toBeUndefined();
    w.unmount();
  });
});
