import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin, onlineManager } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import { defaultQueryOptions } from '../src/app/query.js';
import RecordBalanceSheet from '../src/modules/accounts/ui/RecordBalanceSheet.vue';

/**
 * `vue-sonner` isn't a direct dependency of `apps/web` (only of
 * `@magermoney/ui`, which re-exports its `toast` through `useToast`), so it
 * can't be mocked directly — stub `useToast` on the package instead and keep
 * every other export real.
 */
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const acc = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'cash',
  cardType: null,
  isSpending: false,
  isPinned: false,
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
const entry = {
  id: '22222222-2222-4222-8222-222222222222',
  accountId: acc.id,
  amount: '10',
  recordedAt: '2026-09-11T00:00:00.000Z',
  origin: 'manual' as const,
  transferId: null,
  inflowId: null,
  note: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const errorJson = (code: string, message: string, status: number) =>
  json({ code, message }, status);

function mountSheet(fetch: (path: string, init?: RequestInit) => Promise<Response>) {
  return mount(RecordBalanceSheet, {
    props: { accountId: acc.id, open: true, entry },
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
            inflowId: null,
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
    const postBody = JSON.parse(post?.[1]?.body as string);
    expect(postBody).toMatchObject({ amount: '1250.5' });
    // The date field was never touched: the server should stamp the real
    // "now" rather than receive the coarse (minute-precision) default value.
    expect(postBody).not.toHaveProperty('recordedAt');
    expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
    w.unmount();
  });

  it('sends recordedAt only once the date field has been edited', async () => {
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
            inflowId: null,
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
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="balance-amount"]').setValue('1 250,5');
    await body.get('[data-testid="balance-recorded-at"]').setValue('2026-09-01T10:00');
    await body.get('form').trigger('submit');
    await flushPromises();
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    const postBody = JSON.parse(post?.[1]?.body as string);
    expect(postBody).toHaveProperty('recordedAt');
    w.unmount();
  });

  it('reports a plain failure when deleting the entry errors', async () => {
    toast.mockClear();
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
      if (init?.method === 'DELETE')
        return errorJson('INTERNAL_ERROR', 'Something went wrong', 500);
      return json([acc]);
    });
    const w = mountSheet(fetch);
    await flushPromises();
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="balance-delete"]').trigger('click');
    await flushPromises();

    expect(toast).toHaveBeenCalledWith('Не удалось записать. Попробуйте ещё раз.');
    expect(w.emitted('update:open')).toBeFalsy();
    w.unmount();
  });

  it('reports a conflict when deleting a non-latest entry', async () => {
    toast.mockClear();
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
      if (init?.method === 'DELETE') return errorJson('entry_not_latest', 'Not latest', 409);
      return json([acc]);
    });
    const w = mountSheet(fetch);
    await flushPromises();
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="balance-delete"]').trigger('click');
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(ru.errors.entryNotLatest);
    expect(w.emitted('update:open')).toBeFalsy();
    w.unmount();
  });

  it('says the date is too early when the API answers recorded_before_previous', async () => {
    toast.mockClear();
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
      if (init?.method === 'PATCH') return errorJson('recorded_before_previous', 'Too early', 400);
      return json([acc]);
    });
    const w = mountSheet(fetch);
    await flushPromises();
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="balance-amount"]').setValue('12');
    await body.get('form').trigger('submit');
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(ru.errors.recordedBeforePrevious);
    expect(toast).not.toHaveBeenCalledWith(ru.errors.entryNotLatest);
    w.unmount();
  });

  it('points at the transfer when the entry is not a manual one', async () => {
    toast.mockClear();
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
      if (init?.method === 'DELETE')
        return errorJson('entry_not_manual', 'Change the transfer instead', 409);
      return json([acc]);
    });
    const w = mountSheet(fetch);
    await flushPromises();
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="balance-delete"]').trigger('click');
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(ru.errors.entryNotManual);
    expect(toast).not.toHaveBeenCalledWith(ru.errors.entryNotLatest);
    w.unmount();
  });

  it('closes and says the write is parked when there is no network', async () => {
    toast.mockClear();
    onlineManager.setOnline(false);
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
      // What `fetch` rejects with when the device is offline.
      if (init?.method === 'POST') throw new TypeError('Failed to fetch');
      return json([acc]);
    });
    const queryClient = new QueryClient({ defaultOptions: defaultQueryOptions });
    const w = mount(RecordBalanceSheet, {
      props: { accountId: acc.id, open: true },
      global: {
        plugins: [
          [VueQueryPlugin, { queryClient }],
          createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
        ],
        provide: { [API_KEY as unknown as string]: { fetch } },
      },
      attachTo: document.body,
    });
    await flushPromises();
    const body = new DOMWrapper(document.body);
    await body.get('[data-testid="balance-amount"]').setValue('12');
    await body.get('form').trigger('submit');
    // The mutation pauses only after the retryer's back-off.
    for (let i = 0; i < 400 && !w.emitted('update:open'); i++) {
      await new Promise((r) => setTimeout(r, 10));
      await flushPromises();
    }

    expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
    expect(toast).toHaveBeenCalledWith(ru.offline.saved);
    expect(body.get('[data-testid="balance-save"]').attributes('disabled')).toBeUndefined();
    onlineManager.setOnline(true);
    w.unmount();
  }, 15000);
});
