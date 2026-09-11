/**
 * `@magermoney/ui` — the design system. Depends on Vue and the Tailwind family
 * only; it must never import `@magermoney/domain` or `@magermoney/contracts`.
 *
 * Import `@magermoney/ui/styles` once in the consuming app for the tokens, and
 * load Instrument Sans + IBM Plex Mono there too (see docs/design/direction.md).
 */

import type { IconifyJSON } from '@iconify/types';
import { addCollection } from '@iconify/vue';
import { toast } from 'vue-sonner';
import subset from './icons/subset.json';

/*
 * Registering up front is what makes every currency mark render offline, with no
 * request to the Iconify API — a requirement for the PWA, and the reason
 * CurrencyIcon works inside a service-worker-served shell.
 *
 * The subset is built at development time by `bun run icons:build` from the
 * resolver's own tables, so an icon can never be resolvable but unregistered,
 * and the two ~1.1MB collections never reach a consumer's bundle.
 */
for (const collection of Object.values(subset)) {
  addCollection(collection as unknown as IconifyJSON);
}

export { cn } from './lib/utils';

export * from './components/ui/button';
export * from './components/ui/input';
export * from './components/ui/select';
export * from './components/ui/card';
export * from './components/ui/sheet';
export * from './components/ui/sonner';
export * from './components/ui/skeleton';

export { default as CurrencyIcon } from './components/currency-icon/CurrencyIcon.vue';
export {
  resolveCurrencyIcon,
  FIAT_FLAG,
  CRYPTO_KNOWN,
} from './components/currency-icon/resolve-icon';
export type { CurrencyIconInput, ResolvedIcon } from './components/currency-icon/resolve-icon';

export {
  fadeUp,
  scaleIn,
  listStagger,
  withMotionPreference,
  EASE_OUT_QUART,
} from './motion/presets';
export type { MotionPreset } from './motion/presets';

/**
 * Toasts. `Toaster` mounts once in the app shell; `useToast()` is how a screen
 * raises one, so callers never import `vue-sonner` directly.
 */
export function useToast() {
  return { toast };
}
