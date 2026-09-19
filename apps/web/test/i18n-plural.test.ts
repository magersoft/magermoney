import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { ruPlural } from '../src/app/i18n.js';

describe('ruPlural', () => {
  const t = createI18n({
    legacy: false,
    locale: 'ru',
    pluralRules: { ru: ruPlural },
    messages: { ru: { days: '{n} день | {n} дня | {n} дней', items: 'штука | штуки' } },
  }).global.t;

  it('picks one, few or many the way Russian counts', () => {
    const cases: [number, string][] = [
      [0, '0 дней'],
      [1, '1 день'],
      [2, '2 дня'],
      [4, '4 дня'],
      [5, '5 дней'],
      [11, '11 дней'],
      [12, '12 дней'],
      [14, '14 дней'],
      [21, '21 день'],
      [22, '22 дня'],
      [25, '25 дней'],
      [101, '101 день'],
      [111, '111 дней'],
    ];
    for (const [n, text] of cases) expect(t('days', { n }, n)).toBe(text);
  });
  it('leaves a two-form message to the default rule', () => {
    expect(ruPlural(1, 2)).toBe(0);
    expect(ruPlural(5, 2)).toBe(1);
  });
});
