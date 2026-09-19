import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import type { CurrencyDto, ProfileDto } from '@magermoney/contracts';
import CurrencySwitch from '../src/modules/rates/ui/CurrencySwitch.vue';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const profileWith = (reportingCurrencies: string[]): ProfileDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'USD',
  reportingCurrencies,
  onboardingCompletedAt: null,
});

const currency = (code: string): CurrencyDto => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: code,
  icon: null,
});

function mountSwitch(codes = ['USD', 'EUR']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['me'], profileWith(codes));
  queryClient.setQueryData(['currencies'], codes.map(currency));

  const Probe = defineComponent({ setup: () => () => h(CurrencySwitch) });

  return mount(Probe, {
    global: {
      plugins: [
        [VueQueryPlugin, { queryClient }],
        createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } }),
      ],
      provide: { api: { fetch: () => Promise.reject(new Error('offline')) } },
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

describe('CurrencySwitch', () => {
  // The switch is one instance for the whole app, so a mount with a different
  // set of currencies has to start from a clean one.
  beforeEach(resetDisplayCurrency);

  it('gives every segment a 44px target on a coarse pointer', async () => {
    const wrapper = mountSwitch();
    await flushPromises();

    const segments = wrapper.get('[data-testid="currency-switch"]').findAll('button');

    expect(segments).toHaveLength(2);
    for (const segment of segments) {
      /*
       * The utility rather than the design system's base-layer touch rule: a
       * `min-h-*` utility is emitted into the `utilities` layer and would win
       * against `base` on the same property, whatever `data-slot` says.
       */
      expect(segment.classes()).toContain('pointer-coarse:min-h-11');
    }
  });

  it('offers one segment per reporting currency', async () => {
    const wrapper = mountSwitch();
    await flushPromises();

    expect(wrapper.get('[data-testid="currency-switch"]').text()).toContain('USD');
    expect(wrapper.get('[data-testid="currency-switch"]').text()).toContain('EUR');
  });

  it('keeps both codes visible on a phone when there are only two of them', async () => {
    const wrapper = mountSwitch();
    await flushPromises();

    const codes = wrapper.get('[data-testid="currency-switch"]').findAll('span.font-mono');

    expect(codes).toHaveLength(2);
    for (const code of codes) expect(code.classes()).not.toContain('max-sm:sr-only');
  });

  it('hands the codes to the screen reader below sm: once a third one arrives', async () => {
    // Three codes, the rates link and the theme button do not fit a 375px
    // header; the currency's own mark identifies the segment instead.
    const wrapper = mountSwitch(['USD', 'EUR', 'RUB']);
    await flushPromises();

    const codes = wrapper.get('[data-testid="currency-switch"]').findAll('span.font-mono');

    expect(codes).toHaveLength(3);
    for (const code of codes) expect(code.classes()).toContain('max-sm:sr-only');
  });

  it('links to the rates screen, which no longer has a tab of its own', async () => {
    const wrapper = mountSwitch();
    await flushPromises();

    const link = wrapper.getComponent(RouterLinkStub);

    expect(link.props('to')).toBe('/settings/rates');
    expect(link.attributes('aria-label')).toBe('Exchange rates');
  });
});
