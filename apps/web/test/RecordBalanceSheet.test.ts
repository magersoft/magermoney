import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import RecordBalanceSheet from '../src/modules/accounts/ui/RecordBalanceSheet.vue';

const acc = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
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
  balance: '10',
  balanceRecordedAt: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('RecordBalanceSheet', () => {
  it('posts the parsed amount for the account and closes', async () => {
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/currencies')
        return json([
          {
            code: 'RUB',
            kind: 'fiat',
            scale: 2,
            symbol: null,
            nameRu: null,
            nameEn: null,
            icon: null,
          },
        ]);
      if (init?.method === 'POST')
        return json(
          {
            id: '22222222-2222-4222-8222-222222222222',
            accountId: acc.id,
            amount: '1250.5',
            recordedAt: '2026-09-11T00:00:00.000Z',
            origin: 'manual',
            transferId: null,
            note: null,
          },
          201,
        );
      return json([acc]);
    });
    const w = mount(RecordBalanceSheet, {
      props: { accountId: acc.id, open: true },
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
    await flushPromises();
    // The sheet's content is teleported to `document.body` (reka-ui's
    // DialogPortal), outside `w.element` — query the body, not the wrapper.
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="balance-amount"]').setValue('1 250,5');
    await body.get('form').trigger('submit');
    await flushPromises();
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe(`/accounts/${acc.id}/balances`);
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({ amount: '1250.5' });
    expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
  });
});
