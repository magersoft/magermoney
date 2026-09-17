import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppShell from '../src/shared/layout/AppShell.vue';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

function mountShell() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { ru, en },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<p>home</p>' } },
      { path: '/settings', component: { template: '<p>settings</p>' } },
    ],
  });
  return mount(AppShell, {
    props: { theme: 'system' as const },
    global: { plugins: [i18n, router] },
  });
}

describe('AppShell', () => {
  it('renders both navigations, so a phone and a desktop each have one', () => {
    const text = mountShell().text();
    expect(text).toContain('Accounts');
    expect(text).toContain('Rates');
    expect(text).toContain('Settings');
  });

  it('makes the skip link target focusable, so the skip actually moves focus', () => {
    expect(mountShell().get('main#main').attributes('tabindex')).toBe('-1');
  });

  it('asks for the next theme in the cycle rather than setting it itself', async () => {
    const shell = mountShell();

    await shell.get('button').trigger('click');

    expect(shell.emitted('update:theme')).toEqual([['light']]);
  });
});
