import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { CurrencyDto } from '@magermoney/contracts';
import { API_KEY } from '../src/shared/api/use-api.js';
import {
  useConnectedCurrencies,
  useCurrencies,
  useCurrencyCatalogue,
} from '../src/modules/currencies/application/use-currencies.js';

const cur = (code: string, nameEn: string): CurrencyDto => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn,
  icon: null,
  rateSource: 'open-er-api',
});

const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function mountIt(fetchImpl: (path: string, init?: RequestInit) => Promise<Response>) {
  let connected!: ReturnType<typeof useCurrencies>;
  let catalogue!: ReturnType<typeof useCurrencyCatalogue>;
  let actions!: ReturnType<typeof useConnectedCurrencies>;
  const Probe = defineComponent({
    setup() {
      connected = useCurrencies();
      catalogue = useCurrencyCatalogue();
      actions = useConnectedCurrencies();
      return () => h('div');
    },
  });
  mount(Probe, {
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
      ],
      provide: { [API_KEY as unknown as string]: { fetch: fetchImpl } },
    },
  });
  return { connected: () => connected, catalogue: () => catalogue, actions: () => actions };
}

describe('connected currencies', () => {
  it('reads the short list, not the catalogue', async () => {
    const asked: string[] = [];
    const p = mountIt(async (path) => {
      asked.push(path);
      if (path === '/me/currencies') return json([cur('USD', 'US Dollar')]);
      if (path === '/currencies')
        return json([cur('USD', 'US Dollar'), cur('COP', 'Colombian Peso')]);
      return json([]);
    });
    await flushPromises();

    expect(p.connected().value.map((c) => c.code)).toEqual(['USD']);
    expect(p.catalogue().currencies.value.map((c) => c.code)).toEqual(['USD', 'COP']);
    expect(asked).toContain('/me/currencies');
  });

  it('connecting replaces the list from the response, so forms see it at once', async () => {
    const p = mountIt(async (path, init) => {
      if (path === '/me/currencies' && init?.method === 'POST')
        return json([cur('USD', 'US Dollar'), cur('COP', 'Colombian Peso')]);
      if (path === '/me/currencies') return json([cur('USD', 'US Dollar')]);
      return json([]);
    });
    await flushPromises();

    await p.actions().connect('COP');
    await flushPromises();
    expect(p.connected().value.map((c) => c.code)).toContain('COP');
  });

  it('surfaces the refusal when something still uses the currency', async () => {
    const p = mountIt(async (path, init) => {
      if (init?.method === 'DELETE')
        return json({ code: 'CURRENCY_IN_USE', message: 'EUR is still used by 2 accounts' }, 409);
      if (path === '/me/currencies') return json([cur('USD', 'US Dollar'), cur('EUR', 'Euro')]);
      return json([]);
    });
    await flushPromises();

    await expect(p.actions().disconnect('EUR')).rejects.toMatchObject({
      status: 409,
      code: 'CURRENCY_IN_USE',
    });
  });
});
