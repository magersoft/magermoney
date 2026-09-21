import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import { h } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import AppShell from '../src/shared/layout/AppShell.vue';
import { usePageTitle } from '../src/shared/layout/page-bar';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

/** A screen that names itself, the way every tab screen but Home does. */
const titled = (text: string) => ({
  setup() {
    usePageTitle(() => text);
    return () => h('p', text);
  },
});
const plain = (text: string) => ({ template: `<p>${text}</p>` });

/**
 * The avatar as the composition root renders it: a link to /settings handed to
 * the shell's `lead` slot, and handed only when there is somebody to show.
 */
const avatar = () => h(RouterLink, { to: '/settings', 'data-testid': 'nav-avatar' }, () => 'me');

async function mountAt(at: string, withLead = true) {
  const i18n = createI18n({
    legacy: false,
    locale: 'ru',
    fallbackLocale: 'ru',
    messages: { ru, en },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: plain('home') },
      { path: '/accounts', name: 'accounts', component: titled('Счета') },
      { path: '/goals', name: 'savings', component: titled('Цели') },
      { path: '/settings', name: 'settings', component: titled('Настройки') },
    ],
  });
  await router.push(at);
  await router.isReady();
  const shell = mount(AppShell, {
    global: { plugins: [i18n, router] },
    // The screen goes in the default slot, as the composition root puts it —
    // without it nothing names the bar and every screen looks like Home.
    slots: {
      default: () => h(RouterView),
      ...(withLead ? { lead: avatar } : {}),
    },
  });
  await flushPromises();
  return shell;
}

/** The bar hides itself at phone width when it would hold nothing at all. */
const hiddenOnPhone = (shell: Awaited<ReturnType<typeof mountAt>>) =>
  shell.get('header').classes().includes('hidden');

describe('the avatar that leads to settings', () => {
  it('opens settings when it is pressed on a screen that names itself', async () => {
    const shell = await mountAt('/goals');
    expect(hiddenOnPhone(shell)).toBe(false);
    await shell.get('[data-testid="nav-avatar"]').trigger('click');
    await flushPromises();
    expect(shell.vm.$route.path).toBe('/settings');
  });

  /*
   * The home screen is the one this was broken on: it names nothing and asks
   * for nothing, so the bar used to hide itself and take the avatar with it —
   * and since the pill has no settings tab, that left no way there at all.
   */
  it('opens settings from the home screen, which names nothing', async () => {
    const shell = await mountAt('/');
    expect(hiddenOnPhone(shell)).toBe(false);
    await shell.get('[data-testid="nav-avatar"]').trigger('click');
    await flushPromises();
    expect(shell.vm.$route.path).toBe('/settings');
  });

  it('still refuses to draw a bar that would hold nothing', async () => {
    // No lead, no title, no action, nothing to go back to: the original rule.
    const shell = await mountAt('/', false);
    expect(hiddenOnPhone(shell)).toBe(true);
  });
});
