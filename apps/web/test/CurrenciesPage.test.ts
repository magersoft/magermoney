import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import type { CurrencyDto, ProfileDto } from '@magermoney/contracts';
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

const profile = (reporting: string[], main = reporting[0]!): ProfileDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: main,
  reportingCurrencies: reporting,
  onboardingCompletedAt: null,
});
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
  reporting = ['USD'],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['currencies', 'connected'], connected);
  queryClient.setQueryData(['me'], profile(reporting));

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

    // USD is in the switch, so it sits in that section; EUR is below.
    expect(w.find('[data-testid="switch-row-USD"]').exists()).toBe(true);
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
    expect(w.get('[data-testid="currency-row-EUR"]').text()).not.toContain('No rate available');
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
    const w = mountPage(async () => json([]), [cur('USD')], ['USD']);
    await flushPromises();
    expect(w.get('[data-testid="currency-remove-USD"]').attributes('disabled')).toBeDefined();
    w.unmount();
  });
});

describe('CurrenciesPage, the display switch', () => {
  /* The GET has to answer with the same switch the test seeded, or the refetch
     on mount replaces it and the rows under test are gone. */
  const patched =
    (calls: { path: string; body: unknown }[], reporting: string[]) =>
    async (path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        calls.push({ path, body });
        return json({ ...profile(reporting), ...body });
      }
      if (path === '/currencies') return json(CATALOGUE);
      if (path === '/me') return json(profile(reporting));
      return json(CONNECTED);
    };

  it('shows the switch currencies on top, in the order the switch uses', async () => {
    const w = mountPage(async () => json([]), [...CONNECTED, cur('COP')], ['EUR', 'USD']);
    await flushPromises();

    const order = [...w.element.querySelectorAll('[data-testid^="switch-row-"]')].map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(order).toEqual(['switch-row-EUR', 'switch-row-USD']);
    // Everything not in the switch is below it, not repeated above.
    expect(w.find('[data-testid="currency-row-COP"]').exists()).toBe(true);
    expect(w.find('[data-testid="currency-row-USD"]').exists()).toBe(false);
    w.unmount();
  });

  it('counts what is in the switch out of the maximum', async () => {
    const w = mountPage(async () => json([]), [...CONNECTED, cur('COP')], ['USD', 'EUR']);
    await flushPromises();
    expect(w.get('[data-testid="switch-count"]').text()).toBe('2 of 3');
    w.unmount();
  });

  it('greys out the rest at three, and says what to do about it', async () => {
    const w = mountPage(
      async () => json([]),
      [...CONNECTED, cur('COP'), cur('KPW')],
      ['USD', 'EUR', 'COP'],
    );
    await flushPromises();

    expect(w.get('[data-testid="switch-count"]').text()).toBe('3 of 3');
    expect(w.get('[data-testid="switch-toggle-KPW"]').attributes('disabled')).toBeDefined();
    expect(w.text()).toContain('Take one off to add another.');
    w.unmount();
  });

  it('will not let the last one out of the switch, and says so once', async () => {
    const w = mountPage(async () => json([]), CONNECTED, ['USD']);
    await flushPromises();

    expect(w.get('[data-testid="switch-toggle-USD"]').attributes('disabled')).toBeDefined();
    expect(w.get('[data-testid="switch-last-note"]').text()).toBe('Keep at least one.');
    w.unmount();
  });

  it('adds a currency to the switch at the end', async () => {
    const calls: { path: string; body: unknown }[] = [];
    const w = mountPage(patched(calls, ['USD']), CONNECTED, ['USD']);
    await flushPromises();

    await w.get('[data-testid="switch-toggle-EUR"]').trigger('change');
    await flushPromises();
    expect(calls.at(-1)?.body).toMatchObject({ reportingCurrencies: ['USD', 'EUR'] });
    w.unmount();
  });

  it('reorders the switch', async () => {
    const calls: { path: string; body: unknown }[] = [];
    const w = mountPage(patched(calls, ['USD', 'EUR']), CONNECTED, ['USD', 'EUR']);
    await flushPromises();

    await w.get('[data-testid="switch-up-EUR"]').trigger('click');
    await flushPromises();
    expect(calls.at(-1)?.body).toMatchObject({ reportingCurrencies: ['EUR', 'USD'] });

    // The ends cannot move further.
    expect(w.get('[data-testid="switch-up-USD"]').attributes('disabled')).toBeDefined();
    expect(w.get('[data-testid="switch-down-EUR"]').attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('moves the main currency without reordering the switch', async () => {
    const calls: { path: string; body: unknown }[] = [];
    const w = mountPage(patched(calls, ['USD', 'EUR']), CONNECTED, ['USD', 'EUR']);
    await flushPromises();

    await w.get('[data-testid="switch-main-EUR"]').trigger('change');
    await flushPromises();
    expect(calls.at(-1)?.body).toMatchObject({
      reportingCurrencies: ['USD', 'EUR'],
      defaultCurrency: 'EUR',
    });
    w.unmount();
  });

  it('takes the main currency along when it is the one removed', async () => {
    const calls: { path: string; body: unknown }[] = [];
    const w = mountPage(patched(calls, ['USD', 'EUR']), CONNECTED, ['USD', 'EUR']);
    await flushPromises();

    await w.get('[data-testid="switch-toggle-USD"]').trigger('change');
    await flushPromises();
    expect(calls.at(-1)?.body).toMatchObject({
      reportingCurrencies: ['EUR'],
      defaultCurrency: 'EUR',
    });
    w.unmount();
  });
});
