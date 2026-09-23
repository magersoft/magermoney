/**
 * Drag a bottom sheet down to close it — what every phone has taught a thumb to
 * try first. Escape, the × and the click outside stay the ways in for a
 * keyboard and a mouse; this is the shortcut for a finger, never the only exit.
 *
 * Touch only, like `PullToRefresh`: a mouse has the × and the backdrop, and a
 * drag with it would fight text selection. The gesture arms on a downward drag
 * only while whatever scrolls under the finger is at its top, so a long sheet
 * scrolls as it always did and closes only once it is back at its first line.
 * A drag that starts in a text field belongs to the field.
 *
 * On release the sheet either slides the rest of the way out and then asks to
 * close, or settles back. Both ride the motion tokens, which fall to zero when
 * reduced motion is asked for, so the sheet then simply goes or simply stays.
 */
import { onBeforeUnmount, toValue, type MaybeRefOrGetter } from 'vue';
import { atTop, scrollableAncestor } from '../pull-to-refresh/pull';
import { swipeOutcome } from './swipe';

/** Travel before the gesture decides whether it is ours: a tap wobbles. */
const SLOP = 6;
/** How long the slide out and the settle back take, as the tokens say. */
const DURATION_MS = 240;
const TRANSITION = 'transform var(--mm-duration-base, 240ms) var(--ease-out-quart, ease-out)';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where a drag can start without being taken for one. */
const OWN_GESTURES =
  'textarea, [contenteditable=""], [contenteditable="true"], [data-swipe-ignore]';

/** Keyed by event name, as `v-on="…"` takes them. */
export interface SwipeHandlers {
  touchstart: (e: TouchEvent) => void;
  touchmove: (e: TouchEvent) => void;
  touchend: () => void;
  touchcancel: () => void;
}

/**
 * The handlers go on the sheet itself, in its template: `v-on="swipe"`. The
 * sheet is whatever element they are bound to, read from the event, so there
 * is no template ref to chase through a library's component — reka's parts
 * render through a presence wrapper whose `$el` is not the panel when a ref is
 * first read, and a gesture bound to that silently never arms. A listener
 * declared in the template is not passive, which is what lets a drag that has
 * become ours win over the scroll.
 */
export function useSwipeDismiss(
  onDismiss: () => void,
  options: { disabled?: MaybeRefOrGetter<boolean> } = {},
): SwipeHandlers {
  let sheet: HTMLElement | null = null;
  let startX = 0;
  let startY: number | null = null;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let dragging = false;
  let scroller: Element | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function reset() {
    startY = null;
    dragging = false;
    velocity = 0;
  }

  function onTouchstart(e: TouchEvent) {
    const touch = e.touches[0];
    sheet = e.currentTarget as HTMLElement | null;
    if (!sheet || !touch || e.touches.length > 1 || toValue(options.disabled)) return reset();
    const from = e.target as Element | null;
    if (from?.closest(OWN_GESTURES)) return reset();
    scroller = scrollableAncestor(from);
    /* A scroller outside the sheet is the page behind it, which is not ours to ask. */
    if (scroller && !sheet.contains(scroller)) scroller = null;
    startX = touch.clientX;
    startY = touch.clientY;
    lastY = touch.clientY;
    lastT = e.timeStamp || performance.now();
    velocity = 0;
    dragging = false;
  }

  function onTouchmove(e: TouchEvent) {
    const touch = e.touches[0];
    if (startY === null || !sheet || !touch) return;
    const dy = touch.clientY - startY;
    const dx = touch.clientX - startX;

    if (!dragging) {
      if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return;
      /* Up, sideways, or a scroller with somewhere to go: not a dismissal. */
      const ours = dy > 0 && Math.abs(dy) > Math.abs(dx) && (!scroller || atTop(scroller));
      if (!ours) return reset();
      dragging = true;
      sheet.style.transition = 'none';
    }

    if (e.cancelable) e.preventDefault();
    const now = e.timeStamp || performance.now();
    const dt = now - lastT;
    if (dt > 0) velocity = (touch.clientY - lastY) / dt;
    lastY = touch.clientY;
    lastT = now;
    sheet.style.transform = `translate3d(0, ${Math.max(0, dy)}px, 0)`;
  }

  function onTouchend() {
    const el = sheet;
    if (!dragging || startY === null || !el) return reset();
    const distance = lastY - startY;
    const height = el.getBoundingClientRect().height;
    const outcome = swipeOutcome({ distance, velocity, height });
    reset();

    const duration = reducedMotion() ? 0 : DURATION_MS;
    el.style.transition = duration ? TRANSITION : 'none';
    if (outcome === 'dismiss') {
      el.style.transform = 'translate3d(0, 100%, 0)';
      /*
       * The sheet has already left the screen, so its own closing animation
       * would only bring it back to slide out a second time.
       */
      timer = setTimeout(() => {
        el.style.animation = 'none';
        onDismiss();
      }, duration);
    } else {
      el.style.transform = '';
      timer = setTimeout(() => (el.style.transition = ''), duration);
    }
  }

  onBeforeUnmount(() => clearTimeout(timer));

  return {
    touchstart: onTouchstart,
    touchmove: onTouchmove,
    touchend: onTouchend,
    touchcancel: onTouchend,
  };
}
