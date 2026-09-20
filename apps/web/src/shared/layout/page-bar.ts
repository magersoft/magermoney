/**
 * What the open screen puts in the top bar: its title, and the one action in
 * the right-hand corner.
 *
 * The bar owns the places, the screen owns the meaning. The shell has no way
 * of knowing that this screen is called "Exchange rates" and that one saves an
 * account, and a bar that read either off the route would have to be edited
 * every time a screen changed its mind. So the screen declares and the bar
 * renders whatever it was handed.
 *
 * `null` is a first-class answer to both. A screen with nothing to offer
 * leaves the corner empty rather than inventing something to put there, and a
 * screen that carries its own large title — the tab's own screen — leaves the
 * bar's title unset rather than saying the same word twice.
 */
import {
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  watchEffect,
  type InjectionKey,
  type MaybeRefOrGetter,
  type ShallowRef,
} from 'vue';

export type PageAction = {
  /**
   * The words on the button, and short enough to sit in a bar: "Save", "Add".
   * The screen around it says what is being saved or added.
   */
  readonly label: string;
  /**
   * The whole phrase, for when the short one is too little on its own — a
   * screen reader that lands on the button has no screen around it to read.
   * It has to contain `label` word for word, or the voice and the eye are
   * naming two different buttons.
   */
  readonly ariaLabel?: string;
  readonly onSelect: () => void;
  /** The action exists but cannot run yet — an incomplete form, most often. */
  readonly disabled?: boolean;
  /** The action is running: the button says so and refuses a second press. */
  readonly pending?: boolean;
  readonly testid?: string;
};

export type PageBar = {
  readonly title: ShallowRef<string | null>;
  readonly action: ShallowRef<PageAction | null>;
};

const KEY: InjectionKey<PageBar> = Symbol('mm:page-bar');

/**
 * Opens the bar's places. Called once, by the shell that renders it; the refs
 * it returns are what the bar reads.
 */
export function providePageBar(): PageBar {
  const bar: PageBar = { title: shallowRef(null), action: shallowRef(null) };
  provide(KEY, bar);
  return bar;
}

/**
 * Claims one of the bar's places for as long as this screen is mounted.
 *
 * The cleanup only clears what it put there. Vue mounts the arriving screen
 * before the departing one is torn down, so an unconditional clear on unmount
 * would wipe the new screen's claim a tick after it was set — which is exactly
 * the kind of bug that only shows up on a real navigation and never in a test
 * that mounts one screen.
 */
function claim<T>(
  pick: (bar: PageBar) => ShallowRef<T | null>,
  source: MaybeRefOrGetter<T | null>,
) {
  /* Screens also render outside the shell — the sign-in page, and every test that mounts one alone. */
  const bar = inject(KEY, null);
  if (!bar) return;

  const slot = pick(bar);
  let mine: T | null = null;
  watchEffect(() => {
    mine = toValue(source);
    slot.value = mine;
  });
  onScopeDispose(() => {
    if (slot.value === mine) slot.value = null;
  });
}

/** The screen's name, shown in the bar on a phone. */
export function usePageTitle(source: MaybeRefOrGetter<string | null>): void {
  claim((bar) => bar.title, source);
}

/** The screen's one action, shown in the bar's right-hand corner. */
export function usePageAction(source: MaybeRefOrGetter<PageAction | null>): void {
  claim((bar) => bar.action, source);
}
