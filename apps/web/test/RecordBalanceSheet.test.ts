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
  colorway: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  goalId: null,
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

type Fetch = (path: string, init?: RequestInit) => Promise<Response>;
const currencies = () =>
  json([
    {
      code: 'RUB',
      kind: 'fiat',
      scale: 2,
      symbol: null,
      nameRu: null,
      nameEn: null,
      icon: null,
      rateSource: 'open-er-api',
    },
  ]);
const created = (amount: string) => json({ ...entry, amount }, 201);
/** Everything the sheet reads, plus whatever a test wants to answer to a write. */
const api = (write?: (init: RequestInit) => Response | Promise<Response>): Fetch =>
  vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/me/currencies') return currencies();
    if (init?.method && init.method !== 'GET' && write) return write(init);
    return json([acc]);
  });

const body = () => new DOMWrapper(document.body);
const amountInput = () => body().get('[data-slot="quick-action-amount"] input');
const dateInput = () => body().get('[data-testid="balance-recorded-at"] input');
const confirm = () => body().get('[data-slot="quick-action-confirm"]');

function mountSheet(fetch: Fetch, props: { entry?: typeof entry } = { entry }) {
  return mount(RecordBalanceSheet, {
    props: { accountId: acc.id, open: true, ...props },
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
  /**
   * The same sheet as the expense, the transfer and the inflow: the amount is
   * the first and largest thing, the account's currency stands beside it, and
   * what the account held before is right under it, with the change it makes.
   */
  it('names the account, shows what it held and how far the typed amount moves it', async () => {
    const w = mountSheet(api(), {});
    await flushPromises();
    const sheet = body().get('[data-slot="quick-action-sheet"]');
    expect(sheet.attributes('data-testid')).toBe('balance-form');
    expect(sheet.text()).toContain('Обновить остаток');
    expect(sheet.text()).toContain('Alfa');
    expect(body().get('[data-testid="balance-currency"]').text()).toContain('RUB');
    expect(body().get('[data-testid="balance-before"]').text()).toContain('10,00');
    expect(body().find('[data-testid="balance-change"]').exists()).toBe(false);

    await amountInput().setValue('12,5');
    expect(body().get('[data-testid="balance-change"]').text()).toContain('+2,50');
    await amountInput().setValue('7');
    expect(body().get('[data-testid="balance-change"]').text()).toContain('−3,00');
    w.unmount();
  });

  it('posts the parsed amount for the account and closes', async () => {
    const fetch = api(() => created('1250.5'));
    const w = mountSheet(fetch, {});
    await flushPromises();
    await amountInput().setValue('1 250,5');
    await confirm().trigger('click');
    await flushPromises();
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
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
    const fetch = api(() => created('1250.5'));
    const w = mountSheet(fetch, {});
    await flushPromises();
    await amountInput().setValue('1 250,5');
    await dateInput().setValue('2026-09-01T10:00');
    await confirm().trigger('click');
    await flushPromises();
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    const postBody = JSON.parse(post?.[1]?.body as string);
    expect(postBody).toHaveProperty('recordedAt');
    w.unmount();
  });

  it('says at the date field that a future date will not do, and does not send it', async () => {
    const fetch = api(() => created('12'));
    const w = mountSheet(fetch, {});
    await flushPromises();
    await amountInput().setValue('12');
    await dateInput().setValue('2999-01-01T10:00');
    const field = body().get('[data-testid="balance-recorded-at"]');
    expect(field.get('[data-slot="field-row-error"]').text()).toBe(ru.errors.recordedInFuture);
    expect(confirm().attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('edits the latest entry in the same sheet, with a way to delete it', async () => {
    const w = mountSheet(api());
    await flushPromises();
    const sheet = body().get('[data-slot="quick-action-sheet"]');
    expect(sheet.text()).toContain('Изменить запись');
    expect((amountInput().element as HTMLInputElement).value).toBe('10');
    expect(body().find('[data-testid="balance-delete"]').exists()).toBe(true);
    w.unmount();
  });

  it('reports a plain failure when deleting the entry errors', async () => {
    toast.mockClear();
    const w = mountSheet(api(() => errorJson('INTERNAL_ERROR', 'Something went wrong', 500)));
    await flushPromises();
    await body().get('[data-testid="balance-delete"]').trigger('click');
    await flushPromises();

    expect(toast).toHaveBeenCalledWith('Не удалось записать. Попробуйте ещё раз.');
    expect(w.emitted('update:open')).toBeFalsy();
    w.unmount();
  });

  it('reports a conflict when deleting a non-latest entry', async () => {
    toast.mockClear();
    const w = mountSheet(api(() => errorJson('entry_not_latest', 'Not latest', 409)));
    await flushPromises();
    await body().get('[data-testid="balance-delete"]').trigger('click');
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(ru.errors.entryNotLatest);
    expect(w.emitted('update:open')).toBeFalsy();
    w.unmount();
  });

  it('puts recorded_before_previous at the date field, not in a toast', async () => {
    toast.mockClear();
    const w = mountSheet(api(() => errorJson('recorded_before_previous', 'Too early', 400)));
    await flushPromises();
    await amountInput().setValue('12');
    await confirm().trigger('click');
    await flushPromises();

    const field = body().get('[data-testid="balance-recorded-at"]');
    expect(field.get('[data-slot="field-row-error"]').text()).toBe(
      ru.errors.recordedBeforePrevious,
    );
    expect(toast).not.toHaveBeenCalled();
    expect(w.emitted('update:open')).toBeFalsy();

    // Picking another date is the fix, so the words go with it.
    await dateInput().setValue('2026-09-12T10:00');
    expect(field.find('[data-slot="field-row-error"]').exists()).toBe(false);
    w.unmount();
  });

  it('points at the transfer when the entry is not a manual one', async () => {
    toast.mockClear();
    const w = mountSheet(
      api(() => errorJson('entry_not_manual', 'Change the transfer instead', 409)),
    );
    await flushPromises();
    await body().get('[data-testid="balance-delete"]').trigger('click');
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(ru.errors.entryNotManual);
    expect(toast).not.toHaveBeenCalledWith(ru.errors.entryNotLatest);
    w.unmount();
  });

  it('closes and says the write is parked when there is no network', async () => {
    toast.mockClear();
    onlineManager.setOnline(false);
    // What `fetch` rejects with when the device is offline.
    const fetch = api(() => {
      throw new TypeError('Failed to fetch');
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
    await amountInput().setValue('12');
    await confirm().trigger('click');
    // The mutation pauses only after the retryer's back-off.
    for (let i = 0; i < 400 && !w.emitted('update:open'); i++) {
      await new Promise((r) => setTimeout(r, 10));
      await flushPromises();
    }

    expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
    expect(toast).toHaveBeenCalledWith(ru.offline.saved);
    expect(confirm().attributes('disabled')).toBeUndefined();
    onlineManager.setOnline(true);
    w.unmount();
  }, 15000);
});
