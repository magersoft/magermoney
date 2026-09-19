import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';

vi.mock('@/modules/income', () => ({
  IncomeSegment: { template: '<div data-testid="seg-income" />' },
}));
vi.mock('@/modules/expenses', () => ({
  ExpensesSegment: { template: '<div data-testid="seg-expenses" />' },
}));
vi.mock('@/modules/budgets', () => ({
  BudgetsSegment: { template: '<div data-testid="seg-budgets" />' },
}));

import PlanPage from '../src/modules/plan/ui/PlanPage.vue';

async function mountAt(path: string) {
  const blank = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/plan', name: 'plan', component: PlanPage },
      { path: '/plan/income/new', name: 'income-source-new', component: blank },
      { path: '/plan/expenses/new', name: 'expense-new', component: blank },
      { path: '/plan/budgets/new', name: 'budget-new', component: blank },
    ],
  });
  await router.push(path);
  const w = mount(PlanPage, {
    global: { plugins: [createI18n({ legacy: false, locale: 'ru', messages: { ru } }), router] },
  });
  await flushPromises();
  return { w, router };
}

describe('PlanPage', () => {
  it('names the open panel with the tab that opened it', async () => {
    const { w } = await mountAt('/plan?tab=budgets');
    const tabs = w.findAll('[data-testid="plan-tabs"] [role="tab"]');
    expect(tabs.map((t) => t.attributes('aria-selected'))).toEqual(['false', 'false', 'true']);
    const panel = w.get('[role="tabpanel"]');
    expect(panel.attributes('aria-labelledby')).toBe('tab-budgets');
    expect(tabs[2]?.attributes('aria-controls')).toBe(panel.attributes('id'));
  });

  it('opens on income by default and on the segment named in the query', async () => {
    expect((await mountAt('/plan')).w.find('[data-testid="seg-income"]').exists()).toBe(true);
    expect(
      (await mountAt('/plan?tab=budgets')).w.find('[data-testid="seg-budgets"]').exists(),
    ).toBe(true);
    expect(
      (await mountAt('/plan?tab=nonsense')).w.find('[data-testid="seg-income"]').exists(),
    ).toBe(true);
  });

  it('writes the chosen segment to the query and points "+" at that segment\'s form', async () => {
    const { w, router } = await mountAt('/plan');
    await w.get('[data-testid="plan-tabs"] [data-value="expenses"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.tab).toBe('expenses');
    expect(w.find('[data-testid="seg-expenses"]').exists()).toBe(true);
    await w.get('[data-testid="plan-add"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('expense-new');
  });
});
