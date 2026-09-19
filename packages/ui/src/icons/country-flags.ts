/**
 * The country flags, on demand.
 *
 * `src/index.ts` registers the currency marks eagerly because a screen cannot
 * paint an account without one. The 257 country flags are another ~155KB of
 * JSON, and an account's flag is a detail of a card rather than the card — so
 * they arrive as their own chunk, a beat later, and nothing waits for them.
 *
 * Whoever might draw one asks for them: `CurrencyIcon` when it is handed a
 * country, the country picker when it opens. The request is made once.
 */
import { ref, type Ref } from 'vue';
import type { IconifyJSON } from '@iconify/types';
import { addCollection } from '@iconify/vue';

const ready = ref(false);
let pending: Promise<void> | null = null;

/**
 * True once the flags are registered. Reactive, so a mark that fell back to its
 * currency while they were in flight redraws itself as the country.
 */
export const countryFlagsReady: Readonly<Ref<boolean>> = ready;

/** Registers the country flags. Idempotent; the second caller waits on the first. */
export function loadCountryFlags(): Promise<void> {
  pending ??= import('./country-flags.json')
    .then((module) => {
      addCollection(module.default as unknown as IconifyJSON);
      ready.value = true;
    })
    .catch((error: unknown) => {
      /*
       * A flag is not worth breaking a screen over: the mark falls back to the
       * currency flag or to initials, which is what it showed a moment ago
       * anyway. Let the next caller try again rather than failing forever.
       */
      pending = null;
      console.warn('[ui] could not load country flags', error);
    });
  return pending;
}
