import { describe, expect, it } from 'vitest';
import { defineComponent, h, type PropType, type VNode } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import AppShell from '../src/shared/layout/AppShell.vue';
import { usePageAction, usePageTitle, type PageAction } from '../src/shared/layout/page-bar';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const page = (text: string) => ({ template: `<p>${text}</p>` });

/**
 * A screen that claims the bar's places, so the shell can be tested end to
 * end. Defined once, outside the slot function: a component built inside one
 * is a different component on every render, which unmounts and remounts the
 * screen for as long as the shell is willing to re-render.
 */
const Claiming = defineComponent({
  props: {
    action: { type: Function as PropType<() => PageAction | null>, default: () => () => null },
    title: { type: String, default: null },
  },
  setup(props) {
    usePageAction(() => props.action());
    usePageTitle(() => props.title);
    return () => h('p', 'claiming');
  },
});

const acting = (action: () => PageAction | null) => () => h(Claiming, { action });
const titling = (title: string) => () => h(Claiming, { title });

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page('home') },
      { path: '/accounts', component: page('accounts') },
      { path: '/accounts/new', component: page('new account') },
      { path: '/accounts/:id', component: page('account') },
      { path: '/transfers', component: page('transfers') },
      { path: '/plan', component: page('plan') },
      { path: '/settings', component: page('settings') },
      { path: '/settings/rates', component: page('rates') },
    ],
  });
}

async function mountShell(at = '/', slots: Record<string, () => VNode> = {}) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { ru, en },
  });
  const router = makeRouter();
  await router.push(at);
  await router.isReady();
  const shell = mount(AppShell, { global: { plugins: [i18n, router] }, slots });
  await flushPromises();
  return { shell, router };
}

const back = (shell: { find: (s: string) => { exists: () => boolean } }) =>
  shell.find('[data-testid="nav-back"]');

describe('the top bar', () => {
  it("shows no way back on a tab's own screen", async () => {
    for (const root of ['/', '/accounts', '/plan', '/settings']) {
      const { shell } = await mountShell(root);
      expect(back(shell).exists(), root).toBe(false);
    }
  });

  it('shows a way back on every screen reached from another one', async () => {
    for (const inner of ['/accounts/new', '/accounts/abc', '/transfers', '/settings/rates']) {
      const { shell } = await mountShell(inner);
      expect(back(shell).exists(), inner).toBe(true);
    }
  });

  /* Named, not just drawn: a lone chevron is a hint, and this is the control everybody reaches for. */
  it('says "Back" rather than leaving the chevron to explain itself', async () => {
    const { shell } = await mountShell('/accounts/new');
    const button = shell.get('[data-testid="nav-back"]');
    expect(button.text()).toBe(en.action.back);
    expect(button.classes()).toContain('text-accent-foreground');
  });

  it('steps through history when there is history to step through', async () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      fallbackLocale: 'en',
      messages: { ru, en },
    });
    const router = makeRouter();
    await router.push('/accounts');
    await router.push('/accounts/abc');
    await router.isReady();
    const shell = mount(AppShell, { global: { plugins: [i18n, router] } });
    await flushPromises();

    await shell.get('[data-testid="nav-back"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/accounts');
  });

  it('falls back to the owning tab when the screen was opened cold', async () => {
    const { shell, router } = await mountShell('/settings/rates');
    await shell.get('[data-testid="nav-back"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/settings');
  });

  it('leaves the corner empty when the screen offers no action', async () => {
    const { shell } = await mountShell('/accounts');
    expect(shell.find('[data-testid="page-action"]').exists()).toBe(false);
  });

  it('renders the action the screen declared, and runs it on a press', async () => {
    let ran = 0;
    const { shell } = await mountShell('/accounts/new', {
      default: acting(() => ({ label: 'Save', onSelect: () => (ran += 1) })),
    });

    const button = shell.get('[data-testid="page-action"]');
    expect(button.text()).toBe('Save');
    await button.trigger('click');
    expect(ran).toBe(1);
  });

  it('refuses the action while the screen says it is unavailable or busy', async () => {
    const { shell } = await mountShell('/accounts/new', {
      default: acting(() => ({ label: 'Save', onSelect: () => {}, disabled: true, pending: true })),
    });

    const button = shell.get('[data-testid="page-action"]');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.attributes('aria-busy')).toBe('true');
  });

  /*
   * Home has no way back, no action of its own, and carries its own currency
   * switch — so on a phone there is nothing for the bar to hold. A wide window
   * keeps it: the tab links live in it there.
   */
  it('is not drawn on a phone when it would hold nothing', async () => {
    const { shell } = await mountShell('/');
    expect(shell.get('header').classes()).toContain('hidden');
    expect(shell.get('header').classes()).toContain('md:block');
  });

  it('is drawn once the screen hands it something to hold', async () => {
    const withAction = await mountShell('/', {
      default: acting(() => ({ label: 'Add', onSelect: () => {} })),
    });
    expect(withAction.shell.get('header').classes()).not.toContain('hidden');

    const withTitle = await mountShell('/', { default: titling('Home') });
    expect(withTitle.shell.get('header').classes()).not.toContain('hidden');

    const inner = await mountShell('/accounts/new');
    expect(inner.shell.get('header').classes()).not.toContain('hidden');
  });

  /*
   * The name of the screen, where a pushed screen puts it on iOS. A wide
   * window's bar carries the tab links instead, so the title is `md:hidden`
   * there and the screen's own heading takes over.
   */
  it('shows the screen its name, and only at phone width', async () => {
    const { shell } = await mountShell('/accounts/abc', { default: titling('Alfa Bank') });

    const heading = shell.get('[data-testid="page-title"]');
    expect(heading.text()).toBe('Alfa Bank');
    expect(heading.classes()).toContain('md:hidden');
  });

  it('says nothing where the screen carries its own large title', async () => {
    const { shell } = await mountShell('/accounts');
    expect(shell.find('[data-testid="page-title"]').exists()).toBe(false);
  });

  it('no longer carries the currency switch, which belongs to Home and to settings', async () => {
    const { shell } = await mountShell('/accounts');
    expect(shell.find('[data-testid="currency-switch"]').exists()).toBe(false);
  });

  /* The bar holds one action; a word in the accent colour is the whole of it. */
  it('writes the action out rather than drawing it as a glyph', async () => {
    const { shell } = await mountShell('/plan', {
      default: acting(() => ({ label: 'Add', ariaLabel: 'Add income source', onSelect: () => {} })),
    });

    const button = shell.get('[data-testid="page-action"]');
    expect(button.text()).toBe('Add');
    expect(button.attributes('aria-label')).toBe('Add income source');
    expect(button.find('svg').exists()).toBe(false);
  });

  it('no longer carries the theme, which belongs to the settings screen', async () => {
    const { shell } = await mountShell('/settings');
    expect(shell.find('header').text()).not.toContain('Theme');
    expect(shell.findAll('header button')).toHaveLength(0);
  });
});
