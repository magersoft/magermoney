import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import type { CurrencyDto } from '@magermoney/contracts';
import CurrenciesPage from '../src/modules/currencies/ui/CurrenciesPage.vue';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const toast = vi.fn();
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const cur = (code: string, over: Partial<CurrencyDto> = {}): CurrencyDto => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: code === 'COP' ? 'Colombian Peso' : code,
  icon: null,
  rateSource: 'open-er-api',
  ...over,
});

const CONNECTED = [cur('USD'), cur('EUR')];
const CATALOGUE = [...CONNECTED, cur('COP'), cur('KPW', { rateSource: null })];

const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  document.body.innerHTML = '';
  toast.mockClear();
});

function mountPage(
  fetch: (path: string, init?: RequestInit) => Promise<Response>,
  connected = CONNECTED,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['currencies', 'connected'], connected);

  return mount(CurrenciesPage, {
    global: {
      plugins: [
        [VueQueryPlugin, { queryClient }],
        createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } }),
      ],
      provide: { api: { fetch } },
    },
    attachTo: document.body,
  });
}

const listed = () =>
  [...document.querySelectorAll('[data-slot="combobox-item"]')].map((el) =>
    el.getAttribute('data-testid')?.replace('currency-option-', ''),
  );

async function openPicker(w: ReturnType<typeof mountPage>) {
  await w
    .get('[data-testid="currencies-picker"] [data-testid="currency-trigger"]')
    .trigger('click');
  await flushPromises();
}

describe('CurrenciesPage', () => {
  it('lists what is connected, with each currency’s name', async () => {
    const w = mountPage(async () => json([]));
    await flushPromises();

    expect(w.find('[data-testid="currency-row-USD"]').exists()).toBe(true);
    expect(w.find('[data-testid="currency-row-EUR"]').exists()).toBe(true);
    expect(w.find('[data-testid="currency-row-COP"]').exists()).toBe(false);
    w.unmount();
  });

  it('fetches the catalogue, which no other screen asks for', async () => {
    const paths: string[] = [];
    const w = mountPage(async (path) => {
      paths.push(path);
      return json(path === '/currencies' ? CATALOGUE : CONNECTED);
    });
    await flushPromises();
    expect(paths).toContain('/currencies');
    w.unmount();
  });

  it('offers the whole catalogue, and marks what is already there', async () => {
    const w = mountPage(async (path) => json(path === '/currencies' ? CATALOGUE : CONNECTED));
    await flushPromises();
    await openPicker(w);

    expect(listed()).toEqual(expect.arrayContaining(['USD', 'EUR', 'COP', 'KPW']));
    const usd = document.querySelector('[data-testid="currency-option-USD"]')!;
    expect(usd.getAttribute('data-disabled')).not.toBeNull();
    expect(usd.textContent).toContain('added');
    w.unmount();
  });

  it('adds a currency and shows it in the list straight away', async () => {
    let connected = CONNECTED;
    const w = mountPage(async (path, init) => {
      if (path === '/currencies') return json(CATALOGUE);
      if (init?.method === 'POST') {
        connected = [...CONNECTED, cur('COP')];
        return json(connected);
      }
      return json(connected);
    });
    await flushPromises();
    await openPicker(w);

    document.querySelector<HTMLElement>('[data-testid="currency-option-COP"]')!.click();
    await flushPromises();

    expect(w.find('[data-testid="currency-row-COP"]').exists()).toBe(true);
    w.unmount();
  });

  it('says so when a currency has no rate source, rather than letting it read as zero', async () => {
    const w = mountPage(async () => json([]), [...CONNECTED, cur('KPW', { rateSource: null })]);
    await flushPromises();

    const row = w.get('[data-testid="currency-row-KPW"]');
    expect(row.text()).toContain('No rate available');
    expect(w.get('[data-testid="currency-row-USD"]').text()).not.toContain('No rate available');
    w.unmount();
  });

  it('removes a currency nothing uses', async () => {
    const calls: string[] = [];
    const w = mountPage(async (path, init) => {
      if (init?.method === 'DELETE') {
        calls.push(path);
        return json(null, 204);
      }
      return json(CONNECTED.filter((c) => c.code !== 'EUR'));
    });
    await flushPromises();

    await w.get('[data-testid="currency-remove-EUR"]').trigger('click');
    await flushPromises();
    expect(calls).toEqual(['/me/currencies/EUR']);
    w.unmount();
  });

  it('shows the API’s own explanation when the currency is still in use', async () => {
    const w = mountPage(async (path, init) => {
      if (init?.method === 'DELETE')
        return json({ code: 'CURRENCY_IN_USE', message: 'EUR is still used by 2 accounts' }, 409);
      return json(CONNECTED);
    });
    await flushPromises();

    await w.get('[data-testid="currency-remove-EUR"]').trigger('click');
    await flushPromises();
    expect(toast).toHaveBeenCalledWith('EUR is still used by 2 accounts');
    w.unmount();
  });

  it('will not let the last currency go: a list of none shows nothing', async () => {
    const w = mountPage(async () => json([]), [cur('USD')]);
    await flushPromises();
    expect(w.get('[data-testid="currency-remove-USD"]').attributes('disabled')).toBeDefined();
    w.unmount();
  });
});
