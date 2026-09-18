import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ru from '../src/locales/ru.json';
import BalanceTimeline from '../src/modules/accounts/ui/BalanceTimeline.vue';

const entry = (id: string, amount: string) => ({
  id,
  accountId: 'a',
  amount,
  recordedAt: '2026-09-11T00:00:00.000Z',
  origin: 'manual' as const,
  transferId: null,
  inflowId: null,
  note: null,
});

const mountTimeline = (scale: number, amounts: [string, string]) =>
  mount(BalanceTimeline, {
    props: {
      entries: [entry('1', amounts[0]), entry('2', amounts[1])],
      currency: 'BTC',
      scale,
      editableId: null,
    },
    global: { plugins: [createI18n({ legacy: false, locale: 'ru', messages: { ru } })] },
  });

describe('BalanceTimeline', () => {
  it("writes the delta with the currency's own scale", () => {
    expect(mountTimeline(8, ['1.00000002', '1']).text()).toContain('+0.00000002');
    expect(mountTimeline(2, ['1.5', '1']).text()).toContain('+0.50');
  });

  it('says which entries an inflow wrote', () => {
    const w = mount(BalanceTimeline, {
      props: {
        entries: [
          { ...entry('9', '600'), origin: 'inflow' as const, inflowId: 'i' },
          entry('2', '100'),
        ],
        currency: 'USD',
        scale: 2,
        editableId: null,
      },
      global: { plugins: [createI18n({ legacy: false, locale: 'ru', messages: { ru } })] },
    });
    // Which of them may be edited is the detail page's rule, asserted there.
    expect(w.get('[data-testid="balance-entry-9"]').text()).toContain('поступление');
  });
});
