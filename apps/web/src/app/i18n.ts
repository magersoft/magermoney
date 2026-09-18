import { createI18n } from 'vue-i18n';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';

/**
 * Russian counts in three forms — 1 день, 2 дня, 5 дней — and the teens are all
 * "many" (11 дней, not 11 день). A message with three forms is written
 * `one | few | many`; anything else keeps vue-i18n's two-form default.
 */
export function ruPlural(choice: number, choicesLength: number): number {
  const n = Math.abs(choice);
  if (choicesLength !== 3) return n === 1 ? 0 : 1;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  if (!teen && n % 10 === 1) return 0;
  if (!teen && n % 10 >= 2 && n % 10 <= 4) return 1;
  return 2;
}

/** Russian is the interface language; English is the fallback for missing keys. */
export const i18n = createI18n({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'en',
  pluralRules: { ru: ruPlural },
  messages: { ru, en },
});
