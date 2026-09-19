/** A country as the picker shows it: the code it stores, the name it reads as. */
export interface CountryOption {
  /** ISO 3166-1 alpha-2, upper case. */
  code: string;
  /** The name in the language the interface is in. */
  name: string;
}

/**
 * Folds a string down to what a search should compare: no case, no accents, no
 * punctuation around the edges. «Кот-д'Ивуар» has to be findable by typing
 * «кот», and "Åland" by typing "al".
 */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * The countries matching what has been typed, best first.
 *
 * Two things are searched, because two things are typed: the name, and the
 * alpha-2 code someone who knows it is faster spelling than scrolling. A name
 * that starts with the query outranks one that merely contains it — typing
 * "ma" should offer Malta before Denmark, which contains "ma" in «Дания».
 */
export function filterCountries(options: readonly CountryOption[], query: string): CountryOption[] {
  const q = fold(query);
  if (!q) return [...options];

  /** Nearer the front of the name is nearer the front of the list. */
  function rankOf(option: CountryOption): number {
    const name = fold(option.name);
    if (name.startsWith(q)) return 0;
    if (option.code.toLowerCase().startsWith(q)) return 1;
    /* Any word of the name, so «Новая Зеландия» answers to «зел». */
    if (name.split(/[\s-]+/).some((word) => word.startsWith(q))) return 2;
    return name.includes(q) ? 3 : -1;
  }

  const ranked: { option: CountryOption; rank: number }[] = [];
  for (const option of options) {
    const rank = rankOf(option);
    if (rank >= 0) ranked.push({ option, rank });
  }
  /* Stable within a rank, so the caller's order — alphabetical — survives. */
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.option);
}
