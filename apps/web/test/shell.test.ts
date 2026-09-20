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
  const shell = mount(AppShell, {
    props: { theme: 'system' as const },
    global: { plugins: [i18n, router] },
  });
  await flushPromises();
  return shell;
}

/**
 * The labels of the links that claim to be the current page. Not deduplicated:
 * exactly one tab per navigation has to be lit, so the same label twice is the
 * assertion — once would mean the desktop bar and the phone pill disagree.
 */
const current = (shell: Awaited<ReturnType<typeof mountShell>>) =>
  shell.findAll('a[aria-current="page"]').map((a) => a.text());

describe('AppShell', () => {
  it('offers four tabs in both navigations, and rates is no longer one of them', async () => {
    const shell = await mountShell();
    const labels = shell.findAll('nav a').map((a) => a.text());
    // Two navs (desktop bar, phone pill), four links each.
    expect(labels).toEqual([
      'Home',
      'Accounts',
      'Plan',
      'Settings',
      'Home',
      'Accounts',
      'Plan',
      'Settings',
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
    expect(current(await mountShell('/settings/rates'))).toEqual(['Settings', 'Settings']);
  });

  it('makes the skip link target focusable, so the skip actually moves focus', async () => {
    expect((await mountShell()).get('main#main').attributes('tabindex')).toBe('-1');
  });

  it('asks for the next theme in the cycle rather than setting it itself', async () => {
    const shell = await mountShell();
    await shell.get('header button').trigger('click');
    expect(shell.emitted('update:theme')).toEqual([['light']]);
  });

  it('passes the pill\'s "+" on to whoever owns the quick actions', async () => {
    const shell = await mountShell('/settings');
    await shell.get('[data-testid="quick-add"]').trigger('click');
    expect(shell.emitted('quick')).toHaveLength(1);
  });
});
