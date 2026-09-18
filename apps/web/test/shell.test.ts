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

/** The labels of the links that claim to be the current page, across both navigations. */
const current = (shell: Awaited<ReturnType<typeof mountShell>>) => [
  ...new Set(shell.findAll('a[aria-current="page"]').map((a) => a.text())),
];

describe('AppShell', () => {
  it('offers four tabs in both navigations, and rates is no longer one of them', async () => {
    const shell = await mountShell();
    const labels = shell.findAll('nav a').map((a) => a.text());
    // Two navs (desktop bar, phone tab bar), four links each.
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

  it('marks home only on home itself', async () => {
    expect(current(await mountShell('/'))).toEqual(['Home']);
    expect(current(await mountShell('/plan'))).toEqual(['Plan']);
  });

  it('keeps a tab lit on the screens that belong to it', async () => {
    expect(current(await mountShell('/accounts/abc'))).toEqual(['Accounts']);
    expect(current(await mountShell('/transfers'))).toEqual(['Accounts']);
    expect(current(await mountShell('/plan/income/abc'))).toEqual(['Plan']);
    expect(current(await mountShell('/settings/rates'))).toEqual(['Settings']);
  });

  it('makes the skip link target focusable, so the skip actually moves focus', async () => {
    expect((await mountShell()).get('main#main').attributes('tabindex')).toBe('-1');
  });

  it('asks for the next theme in the cycle rather than setting it itself', async () => {
    const shell = await mountShell();
    await shell.get('button').trigger('click');
    expect(shell.emitted('update:theme')).toEqual([['light']]);
  });
});
