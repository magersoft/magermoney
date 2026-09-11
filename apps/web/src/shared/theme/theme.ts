/**
 * The theme as the DOM sees it. No state and no storage: `app` owns the
 * preference, this only stamps it, so anything in `shared` can read the type.
 */

export type Theme = 'system' | 'light' | 'dark';

/** The order the shell's toggle walks through. */
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

/**
 * `system` leaves the attribute off so the tokens fall back to
 * `prefers-color-scheme`; an explicit choice pins it.
 */
export function applyTheme(t: Theme): void {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
