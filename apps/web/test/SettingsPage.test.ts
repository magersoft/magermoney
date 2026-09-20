import { describe, expect, it } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import SettingsPage from '../src/modules/profile/ui/SettingsPage.vue';
import { applyTheme, useTheme } from '../src/shared/theme';

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function mountSettings() {
  return mount(SettingsPage, {
    global: {
      plugins: [
        createPinia(),
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
        createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } }),
      ],
      provide: {
        [API_KEY as unknown as string]: {
          fetch: async (path: string) => json(path === '/me' ? profile : []),
        },
      },
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $router: { push: () => undefined } },
    },
  });
}

describe('SettingsPage', () => {
  /*
   * The top bar used to carry a theme toggle, and it was the only tested way
   * to change the theme. The bar is navigation and one screen action now, so
   * this screen is the whole of it — and the only thing holding the preference
   * to the document.
   */
  it('is the only place the theme is changed, and changing it reaches the document', async () => {
    const { theme, set } = useTheme();
    set('system');
    applyTheme('system');

    const w = mountSettings();
    await flushPromises();

    /* Reka's trigger shows the bound value; the translated item list is portalled. */
    expect(w.get('[aria-labelledby="theme-label"]').text()).toBe('system');

    set('dark');
    await flushPromises();
    expect(theme.value).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(w.get('[aria-labelledby="theme-label"]').text()).toBe('dark');

    set('system');
    applyTheme('system');
  });

  it('is where the rates screen is reached from', async () => {
    const w = mount(SettingsPage, {
      global: {
        plugins: [
          createPinia(),
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
          createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } }),
        ],
        provide: {
          [API_KEY as unknown as string]: {
            fetch: async (path: string) => json(path === '/me' ? profile : []),
          },
        },
        stubs: { RouterLink: RouterLinkStub },
        mocks: { $router: { push: () => undefined } },
      },
    });
    await flushPromises();
    const link = w
      .findAllComponents(RouterLinkStub)
      .find((l) => l.props('to') === '/settings/rates');
    expect(link?.text()).toContain('Exchange rates');
  });
});
