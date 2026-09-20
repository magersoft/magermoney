import { describe, expect, it } from 'vitest';
import { filterCountries, type CountryOption } from '../src/components/country-select/filter.js';

const OPTIONS: CountryOption[] = [
  { code: 'AX', name: 'Åland Islands' },
  { code: 'DK', name: 'Дания' },
  { code: 'MT', name: 'Malta' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PT', name: 'Portugal' },
  { code: 'TZ', name: 'Tanzania' },
];
const ALL = ['AX', 'DK', 'MT', 'NZ', 'PT', 'TZ'];
const codes = (query: string) => filterCountries(OPTIONS, query).map((o) => o.code);

describe('filterCountries', () => {
  it('hands back the whole list, in the caller’s order, for an empty query', () => {
    expect(codes('')).toEqual(ALL);
    expect(codes('   ')).toEqual(ALL);
  });

  it('finds a country by the start of its name, whatever the case', () => {
    expect(codes('por')).toEqual(['PT']);
    expect(codes('POR')).toEqual(['PT']);
  });

  it('finds a country by its ISO code', () => {
    expect(codes('pt')).toEqual(['PT']);
  });

  /*
   * Two keystrokes that are a code to one person and the middle of a word to
   * another. The code wins: someone typing «nz» means New Zealand.
   */
  it('puts the code match above the one that only contains the query', () => {
    expect(codes('nz')).toEqual(['NZ', 'TZ']);
  });

  it('answers to a word inside the name', () => {
    expect(codes('zeal')).toEqual(['NZ']);
  });

  it('ignores the accents nobody types', () => {
    /* Åland first because it starts there; Zealand happens to contain it. */
    expect(codes('åland')).toEqual(['AX', 'NZ']);
    expect(codes('aland')).toEqual(['AX', 'NZ']);
  });

  it('searches the language the names are written in', () => {
    expect(codes('дан')).toEqual(['DK']);
  });

  it('says nothing rather than something wrong', () => {
    expect(codes('zzz')).toEqual([]);
  });
});
