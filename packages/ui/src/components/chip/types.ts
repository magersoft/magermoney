/**
 * What the chips need to know. Plain values, never the domain: the design
 * system depends on Vue and Tailwind and nothing else, and every word a chip
 * shows — including the name of its remove control — is written by the screen,
 * because the copy lives in the app's locales.
 */

/** One filter that is on, as the row shows it. */
export interface FilterChipItem {
  /** What the screen gets back when this filter is dropped. */
  id: string;
  /** The value, as the user set it: «Апрель», «Visa 2340». */
  label: string;
  /** The accessible name of the remove control: «Снять фильтр: Апрель». */
  removeLabel: string;
}

/** One category in a palette of them. */
export interface CategoryChipItem {
  id: string;
  label: string;
  /** The category's own emoji. A category without one is still a chip. */
  emoji?: string;
}
