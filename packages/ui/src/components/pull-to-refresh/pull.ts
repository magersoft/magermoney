/**
 * The arithmetic behind the gesture, kept out of the component so the feel can
 * be tested without a touch screen.
 */

/** How far the list travels before releasing means "refresh". */
export const PULL_THRESHOLD = 64;

/**
 * The furthest the list can travel, however hard the finger pulls. Twice the
 * threshold: enough headroom that passing the threshold is felt as a change in
 * the pull rather than as hitting a wall.
 */
export const PULL_MAX = PULL_THRESHOLD * 2;

/**
 * Finger travel to list travel. The list follows one-to-one at the start and
 * asymptotically approaches `max`, so the pull gets heavier the further it
 * goes and the rubber never snaps — the iOS feel, in one line.
 */
export function pullOffset(distance: number, max: number = PULL_MAX): number {
  if (distance <= 0) return 0;
  return max * (1 - Math.exp(-distance / max));
}

/** Where the gesture stands, which is what the indicator draws. */
export type PullPhase = 'idle' | 'pulling' | 'ready';

export function pullPhase(offset: number, threshold: number = PULL_THRESHOLD): PullPhase {
  if (offset <= 0) return 'idle';
  return offset >= threshold ? 'ready' : 'pulling';
}

/** 0 to 1 across the threshold, for the indicator's opacity and rotation. */
export function pullProgress(offset: number, threshold: number = PULL_THRESHOLD): number {
  return Math.min(1, Math.max(0, offset / threshold));
}

/**
 * The nearest ancestor that actually scrolls, or `null` when the page itself
 * is the scroller. The gesture must only start at the top of whatever is
 * scrolling under the finger, and in this app that is usually the document.
 */
export function scrollableAncestor(from: Element | null): Element | null {
  for (let el = from; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el);
    const scrolls = /auto|scroll|overlay/.test(style.overflowY);
    if (scrolls && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/** True when the scroller under the finger is at its very top. */
export function atTop(scroller: Element | null): boolean {
  if (scroller) return scroller.scrollTop <= 0;
  const doc = document.scrollingElement ?? document.documentElement;
  return (doc?.scrollTop ?? 0) <= 0;
}
