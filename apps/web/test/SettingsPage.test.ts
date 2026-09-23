import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import SettingsPage from '../src/modules/profile/ui/SettingsPage.vue';
import { applyTheme, useTheme } from '../src/shared/theme';
import { useSessionStore } from '../src/modules/auth';

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
  avatarEmoji: null,
  avatarColor: null,
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

  describe('the profile', () => {
    /*
     * A server that remembers: a PATCH changes what the next GET returns, so a
     * refetch after the write does not paint the old disc back.
     */
    function server() {
      let stored = { ...profile, displayName: 'Vlad' as string | null };
      const patches: unknown[] = [];
      const fetch = vi.fn(async (path: string, init?: RequestInit) => {
        if (path !== '/me') return json([]);
        if (init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body));
          patches.push(body);
          stored = { ...stored, ...body };
        }
        return json(stored);
      });
      return { fetch, patches };
    }

    function mountProfile(fetch: (path: string, init?: RequestInit) => Promise<Response>) {
      const pinia = createPinia();
      setActivePinia(pinia);
      useSessionStore().user = { id: profile.id, email: 'vlad@example.com' };
      return mount(SettingsPage, {
        attachTo: document.body,
        global: {
          plugins: [
            pinia,
            [
              VueQueryPlugin,
              {
                queryClient: new QueryClient({
                  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
                }),
              },
            ],
            createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } }),
          ],
          provide: { [API_KEY as unknown as string]: { fetch } },
          stubs: { RouterLink: RouterLinkStub },
          mocks: { $router: { push: () => undefined } },
        },
      });
    }

    const disc = (root: ParentNode) =>
      root.querySelector<HTMLElement>(
        '[data-testid="settings-avatar"] [data-slot="profile-avatar"]',
      );
    const inSheet = (id: string) =>
      document.querySelector<HTMLElement>(`[data-testid="avatar-sheet"] [data-testid="${id}"]`);

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('comes first, with the disc, the name and the e-mail of the session', async () => {
      const w = mountProfile(server().fetch);
      await flushPromises();

      const section = w.get('[data-testid="settings-profile"]');
      /* Ahead of every parameter row, the first of which is the language. */
      const language = w.get('#language-label').element;
      expect(
        section.element.compareDocumentPosition(language) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(section.get('h2').text()).toBe('Profile');
      expect(section.get('[data-testid="settings-avatar"]').attributes('aria-label')).toBe(
        'Change avatar',
      );
      expect(disc(section.element)?.textContent?.trim()).toBe('V');
      expect((section.get('#display-name').element as HTMLInputElement).value).toBe('Vlad');
      expect(section.get('[data-testid="settings-email"]').text()).toBe('vlad@example.com');
    });

    it('keeps the name in the profile only, not again among the parameters', async () => {
      const w = mountProfile(server().fetch);
      await flushPromises();
      expect(w.findAll('#display-name')).toHaveLength(1);
      expect(w.findAll('input[autocomplete="name"]')).toHaveLength(1);
    });

    it('still saves the name on change, without a Save button', async () => {
      const { fetch, patches } = server();
      const w = mountProfile(fetch);
      await flushPromises();
      await w.get('#display-name').setValue('Vladislav');
      await w.get('#display-name').trigger('change');
      await flushPromises();
      expect(patches).toEqual([{ displayName: 'Vladislav' }]);
    });

    it('saves an emoji the moment it is picked, and the disc shows it', async () => {
      const { fetch, patches } = server();
      const w = mountProfile(fetch);
      await flushPromises();

      await w.get('[data-testid="settings-avatar"]').trigger('click');
      await flushPromises();
      inSheet('avatar-emoji-🦊')!.click();
      await flushPromises();

      expect(patches).toEqual([{ avatarEmoji: '🦊' }]);
      expect(disc(w.element)?.textContent?.trim()).toBe('🦊');
      expect(inSheet('avatar-emoji-🦊')!.getAttribute('aria-checked')).toBe('true');
      expect(inSheet('avatar-emoji-initial')!.getAttribute('aria-checked')).toBe('false');

      /* Going back to the letter is a choice in the same row. */
      inSheet('avatar-emoji-initial')!.click();
      await flushPromises();
      expect(patches.at(-1)).toEqual({ avatarEmoji: null });
      expect(disc(w.element)?.textContent?.trim()).toBe('V');
    });

    it('walks the colours with the arrow keys, saving and moving focus as it goes', async () => {
      const { fetch, patches } = server();
      const w = mountProfile(fetch);
      await flushPromises();
      await w.get('[data-testid="settings-avatar"]').trigger('click');
      await flushPromises();

      const none = inSheet('avatar-color-none')!;
      expect(none.getAttribute('aria-checked')).toBe('true');
      expect(none.tabIndex).toBe(0);
      expect(inSheet('avatar-color-red')!.tabIndex).toBe(-1);
      expect(inSheet('avatar-color-red')!.getAttribute('aria-label')).toBe('Red');

      none.focus();
      none.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await flushPromises();

      expect(patches).toEqual([{ avatarColor: 'red' }]);
      expect(inSheet('avatar-color-red')!.getAttribute('aria-checked')).toBe('true');
      expect(document.activeElement).toBe(inSheet('avatar-color-red'));
      expect(disc(w.element)?.dataset.color).toBe('red');

      /* Wraps backwards from the first choice to the last. */
      inSheet('avatar-color-red')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      );
      await flushPromises();
      inSheet('avatar-color-none')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      );
      await flushPromises();
      expect(patches.at(-1)).toEqual({ avatarColor: 'pink' });
    });
  });
});
