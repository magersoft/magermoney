/**
 * The categories a variable budget is usually about (reference slide 16). Not
 * data: a starting palette, so the third step of the wizard is a row of chips
 * to tap rather than an empty field to fill in eight times.
 *
 * Only the key and the emoji live here; the name is a locale string, because
 * every word a person reads does (`budgets.palette.<key>`). Anything the
 * palette does not have is typed in and becomes a budget just the same.
 */
export interface PaletteCategory {
  key: string;
  emoji: string;
}

export const BUDGET_PALETTE: readonly PaletteCategory[] = [
  { key: 'groceries', emoji: '🛒' },
  { key: 'dining', emoji: '🍽' },
  { key: 'transport', emoji: '🚕' },
  { key: 'health', emoji: '💊' },
  { key: 'fun', emoji: '🎬' },
  { key: 'clothes', emoji: '👕' },
  { key: 'home', emoji: '🏠' },
  { key: 'gifts', emoji: '🎁' },
] as const;

/** The id a category typed in carries, so it can never collide with a palette key. */
export const customId = (name: string): string => `custom:${name.trim().toLowerCase()}`;
