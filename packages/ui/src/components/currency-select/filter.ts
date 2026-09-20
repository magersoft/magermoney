/** A currency as the picker shows it. */
export interface CurrencyOption {
  /** ISO 4217 code or crypto ticker, upper case. */
  code: string;
  kind: 'fiat' | 'crypto';
  /** The name in the language the interface is in — what the row reads as. */
  name: string;
  /**
   * The name in the other language. Searched but never shown: someone reading
   * Russian still types "rubl" or "bitcoin" half the time, and a list that only
   * matched what it displays would find neither.
   */
  altName?: string | null;
  /** `$`, `₽`, `₿`. Searched, and shown beside the code when there is one. */
  symbol?: string | null;
}

/**
 * Folds a string down to what a search should compare: no case, no accents, no
 * surrounding space. «Кот-д'Ивуар» has to be findable by typing «кот», and
 * "Åland" by typing "al".
 */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * How well one currency answers the query. Lower is better; -1 is no match.
 *
 * The code outranks the name deliberately. Ranking the name first means typing
 * "us" in English offers the Uzbekistani som before the US dollar, because
 * "Uzbekistani" and "US Dollar" are both name matches and the som sorts first —
 * and someone typing two letters of a currency almost always means the ticker.
 */
function rankOf(option: CurrencyOption, q: string): number {
  const code = option.code.toLowerCase();
  if (code === q) return 0;
  if (code.startsWith(q)) return 1;

  const names = [option.name, option.altName].flatMap((n) => (n ? [fold(n)] : []));
  if (names.some((n) => n.startsWith(q))) return 2;
  /* Any word, so «Колумбийский песо» answers to «песо» and "Bitcoin Cash" to "cash". */
  if (names.some((n) => n.split(/[\s-]+/).some((word) => word.startsWith(q)))) return 3;
  if (option.symbol && fold(option.symbol) === q) return 4;
  return names.some((n) => n.includes(q)) ? 5 : -1;
}

/**
 * The currencies matching what has been typed, best first.
 *
 * Stable within a rank, so whatever order the caller passed — usually
 * alphabetical, or most-used first — survives among equally good matches.
 */
export function filterCurrencies(
  options: readonly CurrencyOption[],
  query: string,
): CurrencyOption[] {
  const q = fold(query);
  if (!q) return [...options];

  const ranked: { option: CurrencyOption; rank: number }[] = [];
  for (const option of options) {
    const rank = rankOf(option, q);
    if (rank >= 0) ranked.push({ option, rank });
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.option);
}

/** One block of the list: a heading and the currencies under it. */
export interface CurrencyGroup {
  id: 'frequent' | 'fiat' | 'crypto';
  options: CurrencyOption[];
}

/**
 * The matches, split into the blocks the list draws.
 *
 * Fiat and crypto are groups inside one search rather than a pair of tabs. A
 * tab makes you choose a section before you know which one holds what you are
 * after: someone typing USDT would have to notice they are on the wrong tab and
 * type it again. A heading costs a line and answers the same question after the
 * fact.
 *
 * `frequent` comes first: the handful somebody uses every day, so the common
 * case needs no typing at all. Those codes are then left out of the blocks
 * below rather than repeated — a currency listed twice in one popup reads as a
 * mistake, and a keyboard walking the list would stop on it twice. A group with
 * no matches is not returned, so nothing draws an empty heading.
 */
export function groupCurrencies(
  options: readonly CurrencyOption[],
  query: string,
  frequentCodes: readonly string[] = [],
): CurrencyGroup[] {
  const matches = filterCurrencies(options, query);
  const frequent = new Set(frequentCodes);

  /* In the order the caller listed them, not the order they matched: this is a
     shortcut block, and a shortcut that reshuffles is not a shortcut. */
  const top = frequentCodes.flatMap((code) => matches.filter((o) => o.code === code));
  const rest = matches.filter((o) => !frequent.has(o.code));

  const groups: CurrencyGroup[] = [
    { id: 'frequent', options: top },
    { id: 'fiat', options: rest.filter((o) => o.kind === 'fiat') },
    { id: 'crypto', options: rest.filter((o) => o.kind === 'crypto') },
  ];
  /* Nothing left underneath means the split says nothing: drop the heading and
     let the matches read as one list. */
  if (rest.length === 0) return top.length > 0 ? [{ id: 'fiat', options: top }] : [];
  return groups.filter((g) => g.options.length > 0);
}
