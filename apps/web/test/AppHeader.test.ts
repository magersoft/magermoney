import { describe, expect, it } from 'vitest';
import { defineComponent, h, type PropType, type VNode } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import AppShell from '../src/shared/layout/AppShell.vue';
import { usePageAction, type PageAction } from '../src/shared/layout/page-action';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const page = (text: string) => ({ template: `<p>${text}</p>` });

/**
 * A screen that claims the bar's action, so the shell can be tested end to end.
 * Defined once, outside the slot function: a component built inside one is a
 * different component on every render, which unmounts and remounts the screen
 * for as long as the shell is willing to re-render.
 */
const Acting = defineComponent({
  props: { action: { type: Function as PropType<() => PageAction | null>, required: true } },
  setup(props) {
    usePageAction(() => props.action());
    return () => h('p', 'acting');
  },
});

const acting = (action: () => PageAction | null) => () => h(Acting, { action });

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

  it('no longer carries the theme, which belongs to the settings screen', async () => {
    const { shell } = await mountShell('/settings');
    expect(shell.find('header').text()).not.toContain('Theme');
    expect(shell.findAll('header button')).toHaveLength(0);
  });
});
