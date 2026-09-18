import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import ExpensesSegment from '../src/modules/expenses/ui/ExpensesSegment.vue';

const profile = {
  id: 'u',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
const currencies = [
  { code: 'USD', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
  { code: 'EUR', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
];
const rates = [{ base: 'EUR', quote: 'USD', value: '1.2', date: '2026-09-17', source: 'api' }];
const CAT = '22222222-2222-4222-8222-222222222222';
const exp = (id: string, over: object) => ({
  id,
  categoryId: CAT,
  name: id,
  amount: '100',
  currency: 'USD',
  period: 'monthly',
  billingDay: null,
  billingMonth: null,
  isEssential: false,
  activeFrom: '2020-01-01',
  activeTo: null,
  ...over,
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function mountSegment(expenses: unknown[]) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json(currencies);
    if (path.startsWith('/rates')) return json(rates);
    if (path === '/expense-categories')
      return json([{ id: CAT, name: 'Housing', icon: null, sortOrder: 0 }]);
    return json(expenses);
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: ExpensesSegment },
      { path: '/plan/expenses/new', name: 'expense-new', component: { template: '<div />' } },
      { path: '/plan/expenses/:id/edit', name: 'expense-edit', component: { template: '<div />' } },
    ],
  });
  return mount(ExpensesSegment, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
        createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
      stubs: { Motion: { template: '<div><slot /></div>' } },
    },
  });
}

describe('ExpensesSegment', () => {
  it('shows a row per active expense, the planned total and the essential total', async () => {
    const A = '11111111-1111-4111-8111-111111111111';
    const B = '33333333-3333-4333-8333-333333333333';
    const C = '44444444-4444-4444-8444-444444444444';
    const w = mountSegment([
      exp(A, { isEssential: true }),
      exp(B, { amount: '120', period: 'yearly' }),
      exp(C, { activeTo: '2021-01-01' }),
    ]);
    await flushPromises();
    expect(w.findAll('[data-testid^="expense-row-"]')).toHaveLength(2);
    expect(w.get('[data-testid="expenses-planned"]').text()).toContain('110');
    expect(w.get('[data-testid="expenses-essential"]').text()).toContain('100');
    expect(w.text()).toContain('Housing');
    expect(w.get(`[data-testid="expense-row-${B}"]`).text()).toContain('год');

    const toggle = w.get('button[aria-controls="ended-expenses"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(w.find(`[data-testid="expense-row-${C}"]`).exists()).toBe(true);
  });

  it('offers to add the first expense when there are none', async () => {
    const w = mountSegment([]);
    await flushPromises();
    expect(w.get('[data-testid="expenses-empty"]').text()).toContain('Пока ни одного расхода');
  });
});
