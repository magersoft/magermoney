/**
 * The one action a screen puts in the top bar's right-hand corner.
 *
 * The bar owns the place, the screen owns the meaning: the shell has no way of
 * knowing that an account form saves and a list adds, and a bar that guessed
 * from the route would have to be edited every time a screen changes its mind.
 * So the screen declares — a label, what to run, and whether it is currently
 * refusable or busy — and the bar renders whatever it was handed.
 *
 * `null` is a first-class answer: a screen with nothing to offer leaves the
 * corner empty rather than inventing something to put there.
 */
import {
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  watchEffect,
  type FunctionalComponent,
  type InjectionKey,
  type MaybeRefOrGetter,
  type ShallowRef,
} from 'vue';

export type PageAction = {
  /** Names the action, and labels the button for a screen reader when an icon replaces it. */
  readonly label: string;
  readonly onSelect: () => void;
  /** The action exists but cannot run yet — an incomplete form, most often. */
  readonly disabled?: boolean;
  /** The action is running: the button says so and refuses a second press. */
  readonly pending?: boolean;
  /** Shown instead of the label where the action is common enough to be a glyph. */
  readonly icon?: FunctionalComponent;
  readonly testid?: string;
};

const KEY: InjectionKey<ShallowRef<PageAction | null>> = Symbol('mm:page-action');

/**
 * Opens the corner. Called once, by the shell that renders the bar; the ref it
 * returns is what the bar reads.
 */
export function providePageAction(): ShallowRef<PageAction | null> {
  const action = shallowRef<PageAction | null>(null);
  provide(KEY, action);
  return action;
}

/**
 * Claims the corner for as long as this screen is mounted.
 *
 * The cleanup only clears what it put there. Vue mounts the arriving screen
 * before the departing one is torn down, so an unconditional clear on unmount
 * would wipe the new screen's action a tick after it was set — which is
 * exactly the kind of bug that only shows up on a real navigation and never in
 * a test that mounts one screen.
 */
export function usePageAction(source: MaybeRefOrGetter<PageAction | null>): void {
  /* Screens also render outside the shell — the sign-in page, and every test that mounts one alone. */
  const slot = inject(KEY, null);
  if (!slot) return;

  let mine: PageAction | null = null;
  watchEffect(() => {
    mine = toValue(source);
    slot.value = mine;
  });
  onScopeDispose(() => {
    if (slot.value === mine) slot.value = null;
  });
}
