import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import BottomNav from '../src/shared/layout/BottomNav.vue';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const page = (text: string) => ({ template: `<p>${text}</p>` });

async function mountNav(at = '/') {
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
  const nav = mount(BottomNav, { global: { plugins: [i18n, router] } });
  await flushPromises();
  return nav;
}

describe('BottomNav', () => {
  it('puts the "+" between Accounts and Plan, and gives every tab an icon', async () => {
    const nav = await mountNav();
    expect(
      nav
        .findAll('[data-testid^="tab-"], [data-testid="quick-add"]')
        .map((el) => el.attributes('data-testid')),
    ).toEqual(['tab-home', 'tab-accounts', 'quick-add', 'tab-plan', 'tab-settings']);
    expect(nav.findAll('a').map((a) => a.text())).toEqual(['Home', 'Accounts', 'Plan', 'Settings']);
    // One icon per tab, plus the one on the "+".
    expect(nav.findAll('svg')).toHaveLength(5);
  });

  it('lights the tab that owns the screen, nested routes included', async () => {
    const lit = async (at: string) =>
      (await mountNav(at)).findAll('a[aria-current="page"]').map((a) => a.text());
    expect(await lit('/')).toEqual(['Home']);
    expect(await lit('/accounts/abc')).toEqual(['Accounts']);
    expect(await lit('/transfers')).toEqual(['Accounts']);
    expect(await lit('/plan/income/abc')).toEqual(['Plan']);
    expect(await lit('/settings/rates')).toEqual(['Settings']);
  });

  it('asks for the quick actions rather than navigating when the "+" is pressed', async () => {
    const nav = await mountNav('/settings');
    const plus = nav.get('[data-testid="quick-add"]');
    // A button, not a link: it opens a sheet over the screen you are on.
    expect(plus.element.tagName).toBe('BUTTON');
    expect(plus.attributes('aria-label')).toBe('Add');
    await plus.trigger('click');
    expect(nav.emitted('quick')).toHaveLength(1);
  });
});
