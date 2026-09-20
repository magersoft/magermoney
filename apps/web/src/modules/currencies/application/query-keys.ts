/**
 * The two currency caches, apart from the composables that read them so the
 * offline entry can invalidate either without dragging a screen into the
 * entry chunk.
 */

/** The signed-in person's connected currencies. */
export const CURRENCIES_KEY = ['currencies', 'connected'] as const;

/** Every currency the app knows. Only the picker asks for it. */
export const CATALOGUE_KEY = ['currencies', 'catalogue'] as const;
