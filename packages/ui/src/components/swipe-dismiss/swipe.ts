/**
 * The arithmetic behind dragging a bottom sheet away, kept out of the
 * composable so the feel can be tested without a touch screen.
 */

/** Travel, in pixels, past which letting go closes a tall sheet. */
export const SWIPE_DISTANCE = 120;

/**
 * A short sheet asks for a third of its own height instead: 120px of a 240px
 * sheet is half of it, and a thumb that has pushed half the sheet off the
 * screen has already said what it wants.
 */
export const SWIPE_FRACTION = 1 / 3;

/** Speed, in px/ms, at which a flick closes the sheet however short it was. */
export const SWIPE_VELOCITY = 0.5;

/** A flick shorter than this is a tap that wobbled, not a flick. */
export const SWIPE_MIN_FLICK = 24;

export type SwipeOutcome = 'dismiss' | 'settle';

export function swipeOutcome({
  distance,
  velocity,
  height,
}: {
  /** How far down the finger has moved since the drag began. */
  distance: number;
  /** How fast it was moving down when it let go, in px/ms. */
  velocity: number;
  /** The sheet's own height; zero when it cannot be measured. */
  height: number;
}): SwipeOutcome {
  if (distance <= 0) return 'settle';
  const needed = height > 0 ? Math.min(SWIPE_DISTANCE, height * SWIPE_FRACTION) : SWIPE_DISTANCE;
  if (distance >= needed) return 'dismiss';
  return velocity >= SWIPE_VELOCITY && distance >= SWIPE_MIN_FLICK ? 'dismiss' : 'settle';
}
