import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import type { CurrencyDto, ProfileDto } from '@magermoney/contracts';
import CurrencySwitch from '../src/modules/rates/ui/CurrencySwitch.vue';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const profile: ProfileDto = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};

const currency = (code: string): CurrencyDto => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: code,
  icon: null,
});

function mountSwitch() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['me'], profile);
  queryClient.setQueryData(['currencies'], [currency('USD'), currency('EUR')]);

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

  it('links to the rates screen, which no longer has a tab of its own', async () => {
    const wrapper = mountSwitch();
    await flushPromises();

    const link = wrapper.getComponent(RouterLinkStub);

    expect(link.props('to')).toBe('/settings/rates');
    expect(link.attributes('aria-label')).toBe('Exchange rates');
  });
});
