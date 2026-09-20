import { computed, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CurrencyDto } from '@magermoney/contracts';
import type { CurrencyOption } from '@magermoney/ui';

/**
 * A currency as the picker wants it: the name in the language on screen, the
 * other language kept for searching.
 *
 * Both are searched because both get typed — someone reading the Russian
 * interface still types "usdt" and "bitcoin", and a list that only matched what
 * it displayed would find neither. The code stands in when the catalogue has no
 * name, which happens for the handful ICU cannot name.
 */
export function toCurrencyOption(dto: CurrencyDto, locale: string): CurrencyOption {
  const ru = dto.nameRu ?? dto.nameEn ?? dto.code;
  const en = dto.nameEn ?? dto.nameRu ?? dto.code;
  return {
    code: dto.code,
    kind: dto.kind,
    name: locale === 'ru' ? ru : en,
    altName: locale === 'ru' ? en : ru,
    symbol: dto.symbol,
  };
}

/** The same, for a list, following the interface's language as it changes. */
export function useCurrencyOptions(currencies: Ref<CurrencyDto[]>): ComputedRef<CurrencyOption[]> {
  const { locale } = useI18n();
  return computed(() => currencies.value.map((c) => toCurrencyOption(c, locale.value)));
}
