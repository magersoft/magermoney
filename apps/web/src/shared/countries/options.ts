/**
 * The countries an account can be held in, named in the language the interface
 * is in and ordered the way that language orders words.
 *
 * The list itself is `COUNTRY_CODES` in the design system, because a country is
 * offerable exactly when there is a flag for it. Only the names are here, and
 * only as a lookup into `locales/*.json` — the app has one place words live.
 */
import { computed, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { COUNTRY_CODES, type CountryOption } from '@magermoney/ui';

/**
 * Alphabetical by name, by the locale's own alphabet: «Ю» after «Э» in Russian,
 * and "Åland" beside "A" in English — neither of which a plain sort gets right.
 */
export function countryOptions(
  codes: readonly string[],
  name: (code: string) => string,
  locale: string,
): CountryOption[] {
  const collator = new Intl.Collator(locale);
  return codes
    .map((code) => ({ code, name: name(code) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** The same list, wired to the current language. */
export function useCountryOptions(): ComputedRef<CountryOption[]> {
  const { t, locale } = useI18n();
  return computed(() =>
    countryOptions(COUNTRY_CODES, (code) => t(`country.${code}`), locale.value),
  );
}
