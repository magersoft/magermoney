import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import AccountsPage from '../src/modules/accounts/ui/AccountsPage.vue';

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
const rates = [{ base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api' }];
const acc = (id: string, over: object) => ({
  id,
  name: id,
  bank: 'Bank',
  country: 'RU',
  currency: 'USD',
  kind: 'cash',
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '100',
  balanceRecordedAt: null,
  ...over,
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const USD_ID = '11111111-1111-4111-8111-111111111111';
const EUR_ID = '22222222-2222-4222-8222-222222222222';
const ARCHIVED_ID = '33333333-3333-4333-8333-333333333333';

function mountPage(accounts: unknown[]) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json(currencies);
    if (path.startsWith('/rates')) return json(rates);
    return json(accounts);
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: AccountsPage },
      { path: '/accounts/new', component: { template: '<div />' } },
      { path: '/accounts/:id', component: { template: '<div />' } },
    ],
  });
  return mount(AccountsPage, {
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

describe('AccountsPage', () => {
  it('shows the total with its rate footnote and one card per active account', async () => {
    const w = mountPage([
      acc(USD_ID, { isSpending: true }),
      acc(EUR_ID, { currency: 'EUR', bank: 'Other' }),
      acc(ARCHIVED_ID, { archivedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    await flushPromises();

    expect(w.get('[data-testid="capital-total"]').text()).toContain('216');
    expect(w.get('[data-testid="accounts-rate-note"]').text()).toContain('2026-09-11');
    expect(w.findAll('[data-slot="account-card"]')).toHaveLength(2);
    expect(w.get('[data-testid="accounts-count"]').text()).toContain('2');
  });

  it('cards lead to their account and keep the tab order of the stack', async () => {
    const w = mountPage([acc(USD_ID, {}), acc(EUR_ID, { currency: 'EUR' })]);
    await flushPromises();

    const cards = w.findAll('[data-slot="account-card"]');
    expect(cards.map((c) => c.attributes('href'))).toEqual([
      `/accounts/${USD_ID}`,
      `/accounts/${EUR_ID}`,
    ]);
    expect(w.findAll('[tabindex]')).toHaveLength(0);
  });

  it('filters the stack by currency and drops the filter from its chip', async () => {
    const w = mountPage([acc(USD_ID, {}), acc(EUR_ID, { currency: 'EUR' })]);
    await flushPromises();

    const select = w.get('[data-testid="accounts-currency-filter"]');
    await select.setValue('EUR');

    expect(w.findAll('[data-slot="account-card"]')).toHaveLength(1);
    expect(w.get('[data-slot="account-card"]').attributes('href')).toBe(`/accounts/${EUR_ID}`);

    await w.get('[data-slot="filter-chip-remove"]').trigger('click');

    expect(w.findAll('[data-slot="account-card"]')).toHaveLength(2);
    expect(w.find('[data-slot="filter-chip"]').exists()).toBe(false);
  });

  it('waits with a stack-shaped skeleton instead of claiming the filter found nothing', async () => {
    const w = mountPage([acc(USD_ID, {})]);

    expect(w.find('[data-testid="accounts-loading"]').exists()).toBe(true);
    expect(w.find('[data-testid="accounts-filter-empty"]').exists()).toBe(false);

    await flushPromises();

    expect(w.find('[data-testid="accounts-loading"]').exists()).toBe(false);
  });

  it('offers the first account when there is none', async () => {
    const w = mountPage([]);
    await flushPromises();

    expect(w.get('[data-testid="accounts-add"]').attributes('href')).toBe('/accounts/new');
    expect(w.find('[data-slot="account-card"]').exists()).toBe(false);
  });

  it('exposes the archived disclosure state to assistive tech', async () => {
    const w = mountPage([acc(ARCHIVED_ID, { archivedAt: '2026-01-01T00:00:00.000Z' })]);
    await flushPromises();

    const toggle = w.get('button[aria-controls="archived-accounts"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(w.find(`[data-testid="account-row-${ARCHIVED_ID}"]`).exists()).toBe(false);

    await toggle.trigger('click');

    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(w.find(`[data-testid="account-row-${ARCHIVED_ID}"]`).exists()).toBe(true);
  });
});
