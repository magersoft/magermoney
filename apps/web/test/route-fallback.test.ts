/* eslint-disable vue/one-component-per-file -- the stand-in screen and its host are fixtures. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, type Component } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';
import {
  isChunkLoadError,
  pageReloader,
  routeComponent,
} from '../src/shared/layout/route-fallback.js';

const i18n = () =>
  createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } });

/**
 * A routed screen is rendered by a parent, never mounted as the root: an async
 * component has no instance of its own until its chunk arrives, and test-utils
 * needs one to read the DOM from. The host is the router-view stand-in.
 */
const host = (screen: Component) =>
  mount(defineComponent({ setup: () => () => h(screen) }), {
    global: { plugins: [i18n()] },
  });

afterEach(() => vi.restoreAllMocks());

describe('routeComponent', () => {
  it('renders the screen once its chunk arrives', async () => {
    const Page = defineComponent({ setup: () => () => h('p', 'the page') });
    // `__esModule` is what Vue looks for before it unwraps `default`; a real
    // `import()` carries it, a hand-made object does not.
    const w = host(routeComponent(() => Promise.resolve({ default: Page, __esModule: true })));
    await flushPromises();
    expect(w.text()).toContain('the page');
  });

  it('offers a reload when the chunk is gone, instead of a blank screen', async () => {
    const reload = vi.spyOn(pageReloader, 'reload').mockImplementation(() => undefined);
    // Vue warns about the rejected loader; that warning is the point of the test.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const w = host(
      routeComponent(() =>
        Promise.reject(new Error('Failed to fetch dynamically imported module')),
      ),
    );
    await flushPromises();
    expect(w.get('[role="alert"]').text()).toContain('Reload');
    await w.get('[data-testid="route-reload"]').trigger('click');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('isChunkLoadError', () => {
  it('recognises a lazy import that failed in each browser', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  });
  it('leaves every other failure alone', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });
});
