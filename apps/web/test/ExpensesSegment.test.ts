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
  avatarEmoji: null,
  avatarColor: null,
};
const currencies = [
  {
    code: 'USD',
    kind: 'fiat',
    scale: 2,
    symbol: null,
    nameRu: null,
    nameEn: null,
    icon: null,
    rateSource: 'open-er-api',
  },
  {
    code: 'EUR',
    kind: 'fiat',
    scale: 2,
    symbol: null,
    nameRu: null,
    nameEn: null,
    icon: null,
    rateSource: 'open-er-api',
  },
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

function mountSegment(expenses: unknown[], expensesStatus = 200) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    if (path === '/me') return json(profile);
    if (path === '/me/currencies') return json(currencies);
    if (path.startsWith('/rates')) return json(rates);
    if (path === '/expense-categories')
      return json([{ id: CAT, name: 'Housing', icon: null, sortOrder: 0 }]);
    return new Response(JSON.stringify(expenses), {
      status: expensesStatus,
      headers: { 'content-type': 'application/json' },
    });
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
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '33333333-3333-4333-8333-333333333333';
  const C = '44444444-4444-4444-8444-444444444444';

  it('shows a row per expense live this month, the planned total and the essential total', async () => {
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
    expect(w.get(`[data-testid="expense-row-${A}"]`).attributes('href')).toBe(
      `/plan/expenses/${A}/edit`,
    );

    const toggle = w.get('button[aria-controls="ended-expenses"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(w.find(`[data-testid="expense-row-${C}"]`).exists()).toBe(true);
  });

  it('splits the month by category in the ring and states the day its rates come from', async () => {
    const w = mountSegment([exp(A, {})]);
    await flushPromises();
    const donut = w.get('[data-testid="expenses-donut"]');
    expect(donut.findAll('[data-slot="donut-arc"]')).toHaveLength(1);
    expect(donut.get('[data-slot="donut-legend"]').text()).toContain('Housing');
    expect(w.get('[data-testid="expenses-rate-note"]').text()).toContain('Курсы на');
  });

  it('narrows the list to the category picked in the ring, and says so with a chip that drops it', async () => {
    const w = mountSegment([exp(A, {})]);
    await flushPromises();
    /* With nothing filtered the row is nothing at all, not an empty row. */
    expect(w.find('[data-testid="expenses-filters"]').exists()).toBe(false);

    await w.get('[data-slot="donut-legend-chip"]').trigger('click');
    await flushPromises();
    const chips = w.get('[data-testid="expenses-filters"]');
    expect(chips.text()).toContain('Housing');
    expect(w.findAll('[data-testid^="expense-group-"]')).toHaveLength(1);

    await chips.get('button[data-slot="filter-chip-remove"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="expenses-filters"]').exists()).toBe(false);
  });

  it('pages to another month, chips the month it landed on and holds what starts later apart', async () => {
    const w = mountSegment([exp(A, { activeFrom: '2099-01-01' })]);
    await flushPromises();
    expect(w.findAll('[data-testid^="expense-group-"]')).toHaveLength(0);
    expect(w.find('[data-testid="expenses-empty-month"]').exists()).toBe(true);
    expect(w.get('button[aria-controls="upcoming-expenses"]').text()).toContain('Начнутся позже');

    await w.get('[data-slot="donut-prev"]').trigger('click');
    await flushPromises();
    expect(w.get('[data-testid="expenses-filters"]').text()).toContain('2026');
    await w.get('[data-testid="expenses-reset-filters"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="expenses-filters"]').exists()).toBe(false);
  });

  it('says the list did not load instead of showing an empty plan', async () => {
    const w = mountSegment([], 500);
    await flushPromises();
    expect(w.find('[data-testid="expenses-empty"]').exists()).toBe(false);
    expect(w.get('[data-testid="expenses-error"]').text()).toContain('расходы');
  });

  it('offers to add the first expense when there are none', async () => {
    const w = mountSegment([]);
    await flushPromises();
    expect(w.get('[data-testid="expenses-empty"]').text()).toContain('Пока ни одного расхода');
  });
});
