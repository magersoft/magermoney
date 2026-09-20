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

  /*
   * The pill is glass: content scrolls under it and shows through, so it reads
   * as a layer over the screen rather than the point the screen is cut off at.
   * The material itself is one utility from the design system — the panel's
   * legibility is proved once there, against every backdrop the app can put
   * behind it, and this bar is not allowed a second opinion about it.
   */
  it('cuts the pill from the glass the design system defines', async () => {
    const nav = await mountNav();
    const pill = nav.get('[data-testid="nav-pill"]');
    expect(pill.classes()).toContain('glass-panel');
    // Nothing here paints its own surface: no fill, no edge, no shadow of its own.
    expect(pill.classes().filter((c) => /^(bg-|shadow-|border-|backdrop-)/.test(c))).toEqual([]);
  });

  /*
   * Over glass the accent is read against whatever is scrolling past, so it
   * cannot mark the current tab on its own. The capsule is opaque, which puts
   * the one coloured thing in the bar back on a surface the palette proves.
   */
  it('marks the current tab with an opaque capsule rather than a tint alone', async () => {
    const nav = await mountNav('/plan');
    const current = nav.get('a[aria-current="page"]');
    expect(current.classes()).toContain('bg-surface-raised');
    expect(current.classes()).toContain('text-accent-foreground');
    for (const tab of nav.findAll('a').filter((a) => a.attributes('aria-current') !== 'page')) {
      expect(tab.classes()).not.toContain('bg-surface-raised');
      expect(tab.classes()).toContain('text-ink');
    }
  });

  /*
   * The accent reads at 2:1 against the glass over a saturated card, which is
   * under the 3:1 WCAG 1.4.11 asks of a focus indicator — so this is the one
   * bar in the app that does not take `outline-ring`. `currentColor`, drawn
   * inset, is whatever the control's own mark is set in, and that is by
   * construction the colour already proven against the surface it sits on.
   */
  it('draws focus in the one colour proven against whatever the control sits on', async () => {
    const nav = await mountNav('/plan');
    for (const control of [...nav.findAll('a'), nav.get('[data-testid="quick-add"]')]) {
      expect(control.classes()).toContain('focus-visible:outline-current');
      expect(control.classes()).not.toContain('focus-visible:outline-ring');
      // Inset, so the ring lands on that surface rather than beside it.
      expect(control.classes()).toContain('-outline-offset-2');
    }
  });

  /* The "+" is a disc, not a pane of glass: it stays solid and stays separate. */
  it('leaves the "+" solid', async () => {
    const plus = (await mountNav()).get('[data-testid="quick-add"]');
    expect(plus.classes()).not.toContain('glass-panel');
    expect(plus.classes()).toContain('bg-ink');
  });
});
