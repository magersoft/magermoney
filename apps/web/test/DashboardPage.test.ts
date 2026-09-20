import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { ruPlural } from '../src/app/i18n.js';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import DashboardPage from '../src/modules/dashboard/ui/DashboardPage.vue';

const SRC = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const profile = {
  id: '99999999-9999-4999-8999-999999999999',
  displayName: 'Влад',
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
  id: ACCOUNT,
  name: 'Card',
  bank: 'Bank',
  country: 'PT',
  currency: 'USD',
  kind: 'cash',
  cardType: null,
  isSpending: true,
  isPinned: true,
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
/** Its currency has no rate in the table above, so the month cannot price it. */
const unratedSourceDto = {
  ...sourceDto,
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Lessons',
  currency: 'RUB',
  grossAmount: '50000',
  netMonthly: '50000',
  isPrimary: false,
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
/** Last month's receipt: what the income tile measures this month against. */
const lastMonthInflowDto = {
  ...inflowDto,
  id: '88888888-8888-4888-8888-888888888888',
  amount: '1000',
  receivedOn: '2026-08-12',
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
/** No billing day: the Upcoming list cannot place it, so it is only ever a count. */
const undatedExpenseDto = {
  ...expenseDto,
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Gym',
  amount: '30',
  currency: 'USD',
  billingDay: null,
  isEssential: false,
};
/** ru-RU groups with a non-breaking space; the assertions care about the digits, not the codepoint. */
const norm = (text: string) => text.replace(/\s/g, ' ');
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function mountPage(
  data: { sources: unknown[]; inflows: unknown[]; expenses: unknown[]; accounts?: unknown[] },
  failing?: string,
) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    if (failing && path.startsWith(failing)) return new Response('boom', { status: 500 });
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json(currencies);
    if (path.startsWith('/rates')) return json(rates);
    if (path === '/accounts') return json(data.accounts ?? [account]);
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
      { path: '/accounts/new', name: 'account-new', component: blank },
      { path: '/accounts/:id', name: 'account', component: blank },
      { path: '/plan', name: 'plan', component: blank },
      { path: '/plan/income/:id', name: 'income-source', component: blank },
      { path: '/settings/rates', name: 'rates', component: blank },
    ],
  });
  return mount(DashboardPage, {
    global: {
      plugins: [
        createPinia(),
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
      stubs: { Motion: { template: '<div><slot /></div>' } },
    },
  });
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-17T09:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('greets the person and hands them the currency switch', async () => {
    const w = mountPage({ sources: [sourceDto], inflows: [inflowDto], expenses: [] });
    await flushPromises();
    expect(w.get('[data-testid="home-greeting"]').text()).toContain('Влад');
    expect(w.get('[data-testid="home-avatar"]').text()).toBe('В');
    expect(w.find('[data-testid="currency-switch"]').exists()).toBe(true);
  });

  it('sets the total with the rates it was summed at, and what is left until payday', async () => {
    const w = mountPage({
      sources: [sourceDto, unratedSourceDto],
      inflows: [inflowDto],
      expenses: [expenseDto, undatedExpenseDto],
    });
    await flushPromises();
    expect(w.get('[data-testid="capital-total"]').text()).toContain('800');
    // The footnote is part of the figure: a total summed from a dozen currencies without it is a guess.
    expect(w.get('[data-testid="dash-rate-note"]').text()).toContain('2026-09-17');
    expect(norm(w.get('[data-testid="dash-available"]').text())).toContain('800,00');
    expect(w.get('[data-testid="dash-days"]').text()).toContain('8 дней');
    expect(norm(w.get('[data-testid="dash-per-day"]').text())).toContain('100,00');
  });

  it('lays the accounts out as cards that end with the way to add one', async () => {
    const w = mountPage({ sources: [sourceDto], inflows: [inflowDto], expenses: [] });
    await flushPromises();
    const strip = w.get('[data-slot="account-card-strip"]');
    expect(strip.text()).toContain('Card');
    expect(strip.find(`a[href="/accounts/${ACCOUNT}"]`).exists()).toBe(true);
    expect(strip.get('[data-slot="add-account-tile"]').attributes('href')).toBe('/accounts/new');
  });

  it('keeps the strip to the pinned accounts, in the order they are listed', async () => {
    const other = { ...account, id: '44444444-4444-4444-8444-444444444444', name: 'Savings' };
    const pinnedLater = {
      ...account,
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Cash',
      sortOrder: 2,
    };
    const w = mountPage({
      sources: [sourceDto],
      inflows: [inflowDto],
      expenses: [],
      accounts: [account, { ...other, isPinned: false }, pinnedLater],
    });
    await flushPromises();
    const strip = w.get('[data-slot="account-card-strip"]');
    const names = strip.findAll('[data-slot="account-card"]').map((c) => c.text());
    expect(names).toHaveLength(2);
    expect(names[0]).toContain('Card');
    expect(names[1]).toContain('Cash');
    expect(strip.text()).not.toContain('Savings');
  });

  it('asks for a pin rather than showing an empty rail when nothing is pinned', async () => {
    const w = mountPage({
      sources: [sourceDto],
      inflows: [inflowDto],
      expenses: [],
      accounts: [{ ...account, isPinned: false }],
    });
    await flushPromises();
    expect(w.get('[data-testid="dash-accounts-unpinned"]').text()).toBe(
      ru.dashboard.accounts.unpinned,
    );
    expect(w.find('[data-slot="account-card"]').exists()).toBe(false);
    // The way out is the Accounts screen, where the pinning happens.
    expect(w.get('[data-testid="dash-accounts-all"]').attributes('href')).toBe('/accounts');
  });

  it('sets what came in and what the month costs against the month before', async () => {
    const w = mountPage({
      sources: [sourceDto],
      inflows: [inflowDto, lastMonthInflowDto],
      expenses: [expenseDto],
    });
    await flushPromises();
    const income = w.get('[data-testid="dash-stat-income"]');
    expect(norm(income.text())).toContain('1 500,00');
    // 1500 against last month's 1000: half as much again, and income growing is good news.
    expect(income.get('[data-slot="stat-tile-delta"]').attributes('data-tone')).toBe('good');
    expect(income.get('[data-slot="stat-tile-delta"]').text()).toContain('50');
    expect(norm(w.get('[data-testid="dash-stat-outgo"]').text())).toContain('1 200,00');
  });

  it('names the receipts the day rates cannot price instead of dropping them from the tile', async () => {
    const w = mountPage({
      sources: [sourceDto, unratedSourceDto],
      inflows: [inflowDto],
      expenses: [],
    });
    await flushPromises();
    expect(w.get('[data-testid="dash-stats-unconvertible"]').text()).toContain('Lessons');
  });

  it('draws the month plan as a ring with what is left in its gap', async () => {
    const w = mountPage({ sources: [sourceDto], inflows: [inflowDto], expenses: [expenseDto] });
    await flushPromises();
    const donut = w.get('[data-testid="dash-plan-donut"]');
    // 3000 net income, 1200 planned: 1800 left, and the caption says both figures.
    expect(norm(donut.get('[data-slot="donut-centre"]').text())).toContain('1 800,00');
    expect(norm(donut.get('[data-slot="donut-caption"]').text())).toContain('1 200');
    expect(donut.attributes('data-over')).toBe('false');
  });

  it('says so in words when the month plans to spend more than it brings', async () => {
    const w = mountPage({
      sources: [sourceDto],
      inflows: [],
      expenses: [
        expenseDto,
        {
          ...expenseDto,
          id: '12121212-1212-4121-8121-121212121212',
          name: 'Villa',
          amount: '3000',
        },
      ],
    });
    await flushPromises();
    const donut = w.get('[data-testid="dash-plan-donut"]');
    expect(donut.attributes('data-over')).toBe('true');
    expect(donut.get('[data-slot="donut-over"]').text()).toContain('больше дохода');
  });

  it('groups what is coming by day and counts the charges it cannot place', async () => {
    const w = mountPage({
      sources: [sourceDto],
      inflows: [inflowDto],
      expenses: [expenseDto, undatedExpenseDto],
    });
    await flushPromises();
    expect(w.find('[data-testid="dash-upcoming-day-2026-09-25"]').exists()).toBe(true);
    expect(w.find('[data-testid="dash-upcoming-day-2026-10-05"]').exists()).toBe(true);
    expect(w.get('[data-testid="dash-upcoming-undated"]').text()).toContain('ещё 1');
  });

  it('says the numbers are missing instead of showing wrong ones when a list fails', async () => {
    const w = mountPage({ sources: [sourceDto], inflows: [], expenses: [] }, '/expenses');
    await flushPromises();
    expect(w.find('[data-testid="dash-error"]').exists()).toBe(true);
    // Everything here is derived from every list at once: one missing list makes the total a lie.
    expect(w.find('[data-testid="dash-plan-donut"]').exists()).toBe(false);
  });

  it('leads somewhere from every empty block instead of standing blank', async () => {
    const w = mountPage({ sources: [], inflows: [], expenses: [], accounts: [] });
    await flushPromises();
    expect(w.find('[data-testid="dash-accounts-empty"]').exists()).toBe(true);
    expect(w.get('[data-slot="add-account-tile"]').attributes('href')).toBe('/accounts/new');
    expect(w.get('[data-testid="dash-payday-setup"]').attributes('href')).toBe('/plan?tab=income');
    expect(w.get('[data-testid="dash-plan-empty"] a').attributes('href')).toBe('/plan?tab=income');
    expect(w.get('[data-testid="dash-upcoming-empty"] a').attributes('href')).toBe(
      '/plan?tab=expenses',
    );
  });
});
