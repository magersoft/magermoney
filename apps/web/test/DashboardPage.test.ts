import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { ruPlural } from '../src/app/i18n.js';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import DashboardPage from '../src/modules/dashboard/ui/DashboardPage.vue';

const SRC = '11111111-1111-4111-8111-111111111111';
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
const account = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Card',
  bank: 'Bank',
  country: 'PT',
  currency: 'USD',
  kind: 'cash',
  cardType: null,
  isSpending: true,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '800',
  balanceRecordedAt: null,
};
const sourceDto = {
  id: SRC,
  name: 'Job',
  grossAmount: '3000',
  currency: 'USD',
  taxRate: '0',
  commissionRate: '0',
  payDays: [10, 25],
  isPrimary: true,
  activeFrom: '2026-01-01',
  activeTo: null,
  defaultAccountId: null,
  netMonthly: '3000',
};
const inflowDto = {
  id: '33333333-3333-4333-8333-333333333333',
  incomeSourceId: SRC,
  amount: '1500',
  currency: 'USD',
  receivedOn: '2026-09-10',
  realisedRateToUsd: null,
  accountId: null,
  creditedAmount: null,
  realisedRate: null,
  note: null,
};
const expenseDto = {
  id: '44444444-4444-4444-8444-444444444444',
  categoryId: '55555555-5555-4555-8555-555555555555',
  name: 'Rent',
  amount: '1000',
  currency: 'EUR',
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2026-01-01',
  activeTo: null,
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function mountPage(data: { sources: unknown[]; inflows: unknown[]; expenses: unknown[] }) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json(currencies);
    if (path.startsWith('/rates')) return json(rates);
    if (path === '/accounts') return json([account]);
    if (path.startsWith('/income-sources')) return json(data.sources);
    if (path.startsWith('/inflows')) return json(data.inflows);
    if (path === '/expenses') return json(data.expenses);
    return json([]); // budgets, expense-categories
  });
  const blank = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: DashboardPage },
      { path: '/accounts', name: 'accounts', component: blank },
      { path: '/plan', name: 'plan', component: blank },
      { path: '/plan/income/:id', name: 'income-source', component: blank },
    ],
  });
  return mount(DashboardPage, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
        createI18n({
          legacy: false,
          locale: 'ru',
          messages: { ru },
          pluralRules: { ru: ruPlural },
        }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
      stubs: {
        Motion: { template: '<div><slot /></div>' },
        InflowSheet: {
          props: ['open'],
          template: '<div data-testid="inflow-sheet" :data-open="String(open)" />',
        },
      },
    },
  });
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-17T09:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('shows capital, days to payday, the month plan, inflows and what is coming', async () => {
    const w = mountPage({ sources: [sourceDto], inflows: [inflowDto], expenses: [expenseDto] });
    await flushPromises();
    expect(w.get('[data-testid="capital-total"]').text()).toContain('800');
    expect(w.get('[data-testid="dash-days"]').text()).toContain('8 дней');
    expect(w.get('[data-testid="dash-per-day"]').text()).toContain('100');
    expect(w.get('[data-testid="dash-net-income"]').text()).toContain('3');
    expect(w.get('[data-testid="dash-remainder"]').attributes('data-sign')).toBe('positive');
    expect(w.get(`[data-testid="dash-inflow-row-${SRC}"]`).text()).toContain('из');
    expect(w.find('[data-testid="dash-upcoming-day-2026-09-25"]').exists()).toBe(true);
    expect(w.find('[data-testid="dash-upcoming-day-2026-10-05"]').exists()).toBe(true);
  });

  it('opens the inflow sheet from the inflows block', async () => {
    const w = mountPage({ sources: [sourceDto], inflows: [], expenses: [] });
    await flushPromises();
    expect(w.get('[data-testid="inflow-sheet"]').attributes('data-open')).toBe('false');
    await w.get('[data-testid="dash-record-inflow"]').trigger('click');
    expect(w.get('[data-testid="inflow-sheet"]').attributes('data-open')).toBe('true');
  });

  it('leads to the matching Plan segment from each empty state', async () => {
    const w = mountPage({ sources: [], inflows: [], expenses: [] });
    await flushPromises();
    expect(w.get('[data-testid="dash-payday-setup"]').attributes('href')).toBe('/plan?tab=income');
    expect(w.get('[data-testid="dash-plan-empty"] a').attributes('href')).toBe('/plan?tab=income');
    expect(w.get('[data-testid="dash-inflows-empty"] a').attributes('href')).toBe(
      '/plan?tab=income',
    );
    expect(w.get('[data-testid="dash-upcoming-empty"] a').attributes('href')).toBe(
      '/plan?tab=expenses',
    );
  });
});
