import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import TransferSheet from '../src/modules/transfers/ui/TransferSheet.vue';

const USD_ID = '11111111-1111-4111-8111-111111111111';
const USD2_ID = '22222222-2222-4222-8222-222222222222';
const EUR_ID = '33333333-3333-4333-8333-333333333333';
const TRANSFER_ID = '44444444-4444-4444-8444-444444444444';

const acc = (id: string, currency: string) => ({
  id,
  name: id,
  bank: 'B',
  country: 'RU',
  currency,
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
});
const cur = (code: string) => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: null,
  icon: null,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mountSheet(fetch: (path: string, init?: RequestInit) => Promise<Response>) {
  return mount(TransferSheet, {
    props: { open: true, fromAccountId: USD_ID },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
        createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
    },
    attachTo: document.body,
  });
}

describe('TransferSheet', () => {
  it('shows the received field only when currencies differ and posts both amounts', async () => {
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/currencies') return json([cur('USD'), cur('EUR')]);
      if (path.startsWith('/rates'))
        return json([
          { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api' },
        ]);
      if (path === '/me')
        return json({
          id: 'u',
          displayName: null,
          locale: 'ru',
          defaultCurrency: 'USD',
          reportingCurrencies: ['USD'],
          onboardingCompletedAt: null,
        });
      if (init?.method === 'POST')
        return json(
          {
            id: TRANSFER_ID,
            fromAccountId: USD_ID,
            toAccountId: EUR_ID,
            amountSent: '100',
            amountReceived: '86',
            occurredAt: '2026-09-11T00:00:00.000Z',
            note: null,
            realisedRate: '0.86',
            fee: null,
          },
          201,
        );
      return json([acc(USD_ID, 'USD'), acc(USD2_ID, 'USD'), acc(EUR_ID, 'EUR')]);
    });
    const w = mountSheet(fetch);
    await flushPromises();
    // The sheet's content is teleported to `document.body` (reka-ui's
    // DialogPortal), outside `w.element` — query the body, not the wrapper.
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="transfer-to"]').setValue(USD2_ID);
    expect(body.find('[data-testid="transfer-received"]').exists()).toBe(false);
    await body.get('[data-testid="transfer-to"]').setValue(EUR_ID);
    expect(body.find('[data-testid="transfer-received"]').exists()).toBe(true);
    await body.get('[data-testid="transfer-sent"]').setValue('100');
    expect(body.get('[data-testid="transfer-hint"]').text()).toContain('86');
    await body.get('[data-testid="transfer-received"]').setValue('86');
    await body.get('form').trigger('submit');
    await flushPromises();
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    const postBody = JSON.parse(post?.[1]?.body as string);
    expect(postBody).toMatchObject({
      fromAccountId: USD_ID,
      toAccountId: EUR_ID,
      amountSent: '100',
      amountReceived: '86',
    });
    // The date field was never touched: the server should stamp the real
    // "now" rather than receive the coarse (minute-precision) default value.
    expect(postBody).not.toHaveProperty('occurredAt');
    expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
    w.unmount();
  });

  it('sends occurredAt only once the date field has been edited', async () => {
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/currencies') return json([cur('USD'), cur('EUR')]);
      if (path.startsWith('/rates'))
        return json([
          { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api' },
        ]);
      if (path === '/me')
        return json({
          id: 'u',
          displayName: null,
          locale: 'ru',
          defaultCurrency: 'USD',
          reportingCurrencies: ['USD'],
          onboardingCompletedAt: null,
        });
      if (init?.method === 'POST')
        return json(
          {
            id: TRANSFER_ID,
            fromAccountId: USD_ID,
            toAccountId: USD2_ID,
            amountSent: '100',
            amountReceived: '100',
            occurredAt: '2026-09-01T10:00:00.000Z',
            note: null,
            realisedRate: null,
            fee: null,
          },
          201,
        );
      return json([acc(USD_ID, 'USD'), acc(USD2_ID, 'USD'), acc(EUR_ID, 'EUR')]);
    });
    const w = mountSheet(fetch);
    await flushPromises();
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="transfer-to"]').setValue(USD2_ID);
    await body.get('[data-testid="transfer-sent"]').setValue('100');
    await body.get('[data-testid="transfer-occurred-at"]').setValue('2026-09-01T10:00');
    await body.get('form').trigger('submit');
    await flushPromises();
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    const postBody = JSON.parse(post?.[1]?.body as string);
    expect(postBody).toHaveProperty('occurredAt');
    w.unmount();
  });
});
