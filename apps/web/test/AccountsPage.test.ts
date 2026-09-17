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

describe('AccountsPage', () => {
  it('shows the total, the payday amount and one row per active account', async () => {
    resetDisplayCurrency();
    const fetch = vi.fn(async (path: string) => {
      if (path === '/me') return json(profile);
      if (path === '/currencies') return json(currencies);
      if (path.startsWith('/rates')) return json(rates);
      return json([
        acc('11111111-1111-4111-8111-111111111111', { isSpending: true }),
        acc('22222222-2222-4222-8222-222222222222', { currency: 'EUR', bank: 'Other' }),
        acc('33333333-3333-4333-8333-333333333333', {
          archivedAt: '2026-01-01T00:00:00.000Z',
        }),
      ]);
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: AccountsPage },
        { path: '/accounts/:id', component: { template: '<div />' } },
      ],
    });
    const w = mount(AccountsPage, {
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
    await flushPromises();
    expect(w.get('[data-testid="capital-total"]').text()).toContain('216');
    expect(w.get('[data-testid="capital-payday"]').text()).toContain('100');
    expect(w.findAll('[data-testid^="account-row-"]')).toHaveLength(2);
    expect(w.text()).toContain('Other');
  });

  it('exposes the archived disclosure state to assistive tech', async () => {
    resetDisplayCurrency();
    const archivedId = '33333333-3333-4333-8333-333333333333';
    const fetch = vi.fn(async (path: string) => {
      if (path === '/me') return json(profile);
      if (path === '/currencies') return json(currencies);
      if (path.startsWith('/rates')) return json(rates);
      return json([acc(archivedId, { archivedAt: '2026-01-01T00:00:00.000Z' })]);
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: AccountsPage },
        { path: '/accounts/:id', component: { template: '<div />' } },
      ],
    });
    const w = mount(AccountsPage, {
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
    await flushPromises();

    const toggle = w.get('button[aria-controls="archived-accounts"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(w.find(`[data-testid="account-row-${archivedId}"]`).exists()).toBe(false);

    await toggle.trigger('click');

    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(w.find(`[data-testid="account-row-${archivedId}"]`).exists()).toBe(true);
  });
});
