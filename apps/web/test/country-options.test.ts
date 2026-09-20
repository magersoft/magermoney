import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES } from '@magermoney/ui';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';
import { countryOptions } from '../src/shared/countries/options';

describe('countryOptions', () => {
  it('names every country the picker can offer, in both languages', () => {
    const unnamed = COUNTRY_CODES.filter(
      (code) =>
        !(code in (ru.country as Record<string, string>)) ||
        !(code in (en.country as Record<string, string>)),
    );
    expect(unnamed).toEqual([]);
  });

  /*
   * A plain sort would put «Ямайка» before «Япония» by code point and leave
   * "Åland" at the end of the English list; the locale's own collation is the
   * only thing that reads as alphabetical to the person scrolling.
   */
  it('orders the list by the alphabet of the language it is in', () => {
    const names = (locale: 'ru' | 'en', messages: { country: Record<string, string> }) =>
      countryOptions(COUNTRY_CODES, (code) => messages.country[code] ?? code, locale).map(
        (o) => o.name,
      );

    const russian = names('ru', ru as unknown as { country: Record<string, string> });
    expect(russian).toEqual([...russian].sort(new Intl.Collator('ru').compare));

    const english = names('en', en as unknown as { country: Record<string, string> });
    expect(english.indexOf('Åland Islands')).toBeLessThan(english.indexOf('Belgium'));
  });

  it('keeps the alpha-2 code beside the name, which is what the API stores', () => {
    const names = ru.country as Record<string, string>;
    const options = countryOptions(['PT', 'RU'], (code) => names[code] ?? code, 'ru');
    expect(options).toContainEqual({ code: 'PT', name: 'Португалия' });
  });
});
