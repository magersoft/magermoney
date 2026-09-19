import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import BudgetsSegment from '../src/modules/budgets/ui/BudgetsSegment.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const EUR_TO_USD = [{ base: 'EUR', quote: 'USD', value: '1.2', date: '2026-09-17', source: 'api' }];
const budget = (id: string, over: object = {}) => ({
  id,
  name: id,
  icon: null,
  monthlyLimit: '100',
  currency: 'USD',
  activeFrom: '2020-01-01',
  activeTo: null,
  ...over,
});

const mountSegment = (budgets: unknown[], status = 200) => {
  resetDisplayCurrency();
  return mountAt(
    BudgetsSegment,
    '/plan',
    apiOf((path) => {
      if (path.startsWith('/rates')) return json(EUR_TO_USD);
      if (path === '/budgets') return json(budgets, status);
      return undefined;
    }),
  );
};

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('BudgetsSegment', () => {
  it('lists current budgets and totals their limits in the display currency', async () => {
    const { wrapper } = await mountSegment([
      budget(A, { monthlyLimit: '1000', currency: 'EUR' }),
      budget(B),
      budget(C, { activeTo: '2021-01-01' }),
    ]);
    await flushPromises();
    expect(wrapper.findAll('[data-testid^="budget-row-"]')).toHaveLength(2);
    const total = wrapper.get('[data-testid="budgets-total"]').text();
    expect(total).toContain('1');
    expect(total).toContain('300');
    expect(wrapper.get(`[data-testid="budget-row-${A}"]`).text()).toContain('1000 EUR');

    const toggle = wrapper.get('[data-testid="budgets-ended-toggle"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(wrapper.find(`[data-testid="budget-row-${C}"]`).exists()).toBe(true);
    wrapper.unmount();
  });

  it('keeps a budget that has not started yet in the list', async () => {
    const { wrapper } = await mountSegment([budget(A, { activeFrom: '2099-01-01' })]);
    await flushPromises();
    expect(wrapper.find(`[data-testid="budget-row-${A}"]`).exists()).toBe(true);
    wrapper.unmount();
  });

  it('says the list did not load instead of showing an empty plan', async () => {
    const { wrapper } = await mountSegment([], 500);
    await flushPromises();
    expect(wrapper.find('[data-testid="budgets-empty"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="budgets-error"]').text()).toContain('бюджеты');
    wrapper.unmount();
  });

  it('offers to add the first budget when there are none', async () => {
    const { wrapper } = await mountSegment([]);
    await flushPromises();
    expect(wrapper.get('[data-testid="budgets-empty"]').text()).toContain('Пока ни одного бюджета');
    expect(wrapper.get('[data-testid="budgets-add"]').attributes('href')).toBe('/plan/budgets/new');
    wrapper.unmount();
  });
});
