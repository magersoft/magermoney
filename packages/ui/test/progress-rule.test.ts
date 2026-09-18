import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProgressRule from '../src/components/progress-rule/ProgressRule.vue';

const now = (value: number, max: number) =>
  mount(ProgressRule, { props: { value, max, label: 'Received' } })
    .get('[role="progressbar"]')
    .attributes('aria-valuenow');

describe('ProgressRule', () => {
  it('reports the share of max as a whole percentage', () => {
    expect(now(50, 100)).toBe('50');
    expect(now(1, 3)).toBe('33');
  });
  it('clamps below zero and above max, and draws nothing for a missing or broken max', () => {
    expect(now(-1, 10)).toBe('0');
    expect(now(17, 10)).toBe('100');
    expect(now(5, 0)).toBe('0');
    expect(now(Number.NaN, 10)).toBe('0');
    expect(now(5, Number.NaN)).toBe('0');
  });
  it('names itself for a screen reader', () => {
    const w = mount(ProgressRule, { props: { value: 2, max: 10, label: 'Received' } });
    expect(w.get('[role="progressbar"]').attributes('aria-label')).toBe('Received');
  });
});
