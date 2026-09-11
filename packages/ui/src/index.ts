/**
 * `@magermoney/ui` — the design system. Depends on Vue and the Tailwind family
 * only; it must never import `@magermoney/domain` or `@magermoney/contracts`.
 *
 * Import `@magermoney/ui/styles` once in the consuming app for the tokens, and
 * load Instrument Sans + IBM Plex Mono there too (see docs/design/direction.md).
 */

import { addCollection } from '@iconify/vue';
import { icons as circleFlags } from '@iconify-json/circle-flags';
import { icons as cryptocurrencyColor } from '@iconify-json/cryptocurrency-color';
import { toast } from 'vue-sonner';

/*
 * Registering both sets up front makes every currency mark render offline, with
 * no request to the Iconify API — a requirement for the PWA, and the reason
 * CurrencyIcon can be rendered inside a service-worker-served shell.
 */
addCollection(circleFlags);
addCollection(cryptocurrencyColor);

export { cn } from './lib/utils';

export * from './components/ui/button';
export * from './components/ui/input';
export * from './components/ui/select';
export * from './components/ui/card';
export * from './components/ui/sheet';
export * from './components/ui/sonner';
export * from './components/ui/skeleton';

export { default as CurrencyIcon } from './components/currency-icon/CurrencyIcon.vue';
export { resolveCurrencyIcon } from './components/currency-icon/resolve-icon';
export type { CurrencyIconInput, ResolvedIcon } from './components/currency-icon/resolve-icon';

export { fadeUp, scaleIn, listStagger, withMotionPreference, EASE_OUT_QUART } from './motion/presets';
export type { MotionPreset } from './motion/presets';

/**
 * Toasts. `Toaster` mounts once in the app shell; `useToast()` is how a screen
 * raises one, so callers never import `vue-sonner` directly.
 */
export function useToast() {
  return { toast };
}
