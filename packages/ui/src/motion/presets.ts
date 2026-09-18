/**
 * Motion presets for `motion-v`. See the motion section of
 * docs/design/direction.md — the rule is "settle, never bounce", so these are
 * eased transitions rather than springs, and nothing overshoots.
 *
 * Only `transform` and `opacity` are animated, and `transform` is written as a
 * full string: motion's `x`/`y`/`scale` shorthands are not hardware accelerated
 * and drop frames while the app is fetching rates.
 *
 * Reduced motion: wrap the app in `<MotionConfig reduced-motion="user">` once
 * (in `apps/web`) and motion-v drops the transform half of every preset while
 * keeping the fade, which is the behaviour we want — gentler, not absent. For
 * motion driven outside motion-v, use `withMotionPreference()` below.
 */

/** Matches `--ease-out-quart` in tokens.css. Everything entering uses it. */
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

/** Beyond this many items a stagger stops reading as sequence and starts reading as lag. */
const STAGGER_CAP = 8;
const STAGGER_STEP = 0.04;

/**
 * Content arriving in place: a card, a section, a screen's body.
 * Rises 8px — far enough to register as arriving, short enough not to be watched.
 */
export const fadeUp = {
  initial: { opacity: 0, transform: 'translateY(8px)' },
  animate: { opacity: 1, transform: 'translateY(0px)' },
  exit: { opacity: 0, transition: { duration: 0.15, ease: 'linear' } },
  transition: { duration: 0.24, ease: EASE_OUT_QUART },
} as const;

/**
 * Something appearing over the page: a popover, a sheet, a toast.
 * Starts at 0.96 rather than 0 — nothing in the real world appears from nothing.
 * Anchored elements should also set `transform-origin` at their trigger.
 */
export const scaleIn = {
  initial: { opacity: 0, transform: 'scale(0.96)' },
  animate: { opacity: 1, transform: 'scale(1)' },
  exit: { opacity: 0, transform: 'scale(0.98)', transition: { duration: 0.15, ease: 'linear' } },
  transition: { duration: 0.18, ease: EASE_OUT_QUART },
} as const;

/**
 * Something appearing in place inside something that is already moving: a field
 * a form grows, a line that answers what was just typed. Opacity only — a
 * second movement inside a sliding sheet reads as the form jumping — at the
 * same 150ms linear the other presets fade with.
 */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: 'linear' },
} as const;

/**
 * Rows of a list entering together. Index `i` is the row's position.
 * The delay stops growing after `STAGGER_CAP` rows, so a 40-account list does
 * not end with a row arriving two seconds late.
 */
export const listStagger = (i: number) => ({
  ...fadeUp,
  transition: {
    ...fadeUp.transition,
    delay: Math.min(i, STAGGER_CAP) * STAGGER_STEP,
  },
});

/** The shape every preset satisfies; `listStagger` returns one of these. */
export type MotionPreset =
  typeof fadeUp | typeof scaleIn | typeof fade | ReturnType<typeof listStagger>;

/**
 * Strips the movement out of a preset when the user asked for reduced motion,
 * keeping the fade. For code that cannot rely on `<MotionConfig>` — a WAAPI
 * call, a canvas, a bespoke transition.
 */
export function withMotionPreference<T extends MotionPreset>(preset: T): T | typeof reducedFade {
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduce ? reducedFade : preset;
}

const reducedFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.12, ease: 'linear' },
} as const;
