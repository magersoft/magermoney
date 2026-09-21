import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppShell from '../src/shared/layout/AppShell.vue';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const page = (text: string) => ({ template: `<p>${text}</p>` });

async function mountShell(at = '/') {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { ru, en },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page('home') },
      { path: '/accounts', component: page('accounts') },
      { path: '/accounts/:id', component: page('account') },
      { path: '/transfers', component: page('transfers') },
      { path: '/plan', component: page('plan') },
      { path: '/plan/income/:id', component: page('source') },
      { path: '/settings', component: page('settings') },
      { path: '/settings/rates', component: page('rates') },
    ],
  });
  await router.push(at);
  await router.isReady();
  const shell = mount(AppShell, { global: { plugins: [i18n, router] } });
  await flushPromises();
  return shell;
}

/**
 * The labels of the links that claim to be the current page. Not deduplicated:
 * exactly one tab per navigation has to be lit, so the same label twice is the
 * assertion — once would mean the desktop bar and the phone pill disagree.
 * Settings is the one section that is a tab in the header only (the avatar
 * leads there on a phone), so there it is lit once by design.
 */
const current = (shell: Awaited<ReturnType<typeof mountShell>>) =>
  shell.findAll('a[aria-current="page"]').map((a) => a.text());

describe('AppShell', () => {
  it('gives the header every section and the pill the four that are tabs', async () => {
    const shell = await mountShell();
    const labels = shell.findAll('nav a').map((a) => a.text());
    /*
     * The desktop bar carries all five; the phone pill carries four, so the "+"
     * keeps two tabs on each side. Settings is reached by the avatar there.
     */
    expect(labels).toEqual([
      'Home',
      'Accounts',
      'Plan',
      'Goals',
      'Settings',
      'Home',
      'Accounts',
      'Plan',
      'Goals',
    ]);
  });

  it('marks home only on home itself, in both navigations', async () => {
    expect(current(await mountShell('/'))).toEqual(['Home', 'Home']);
    expect(current(await mountShell('/plan'))).toEqual(['Plan', 'Plan']);
  });

  it('keeps a tab lit on the screens that belong to it', async () => {
    expect(current(await mountShell('/accounts/abc'))).toEqual(['Accounts', 'Accounts']);
    expect(current(await mountShell('/transfers'))).toEqual(['Accounts', 'Accounts']);
    expect(current(await mountShell('/plan/income/abc'))).toEqual(['Plan', 'Plan']);
    // Lit once: Settings is a tab in the header only.
    expect(current(await mountShell('/settings/rates'))).toEqual(['Settings']);
  });

  it('makes the skip link target focusable, so the skip actually moves focus', async () => {
    expect((await mountShell()).get('main#main').attributes('tabindex')).toBe('-1');
  });

  it('passes the pill\'s "+" on to whoever owns the quick actions', async () => {
    const shell = await mountShell('/settings');
    await shell.get('[data-testid="quick-add"]').trigger('click');
    expect(shell.emitted('quick')).toHaveLength(1);
  });
});
