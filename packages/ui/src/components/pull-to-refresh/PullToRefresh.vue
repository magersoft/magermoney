<script setup lang="ts">
/**
 * Pull a list down from its top edge to reload it — the gesture every phone
 * already teaches. It wraps content, it never scrolls anything itself: the
 * page (or whichever ancestor scrolls) keeps that job, and the gesture only
 * arms when that scroller is at its very top, so ordinary scrolling is
 * untouched.
 *
 * The work is the caller's: `@refresh` — the `onRefresh` callback prop, which
 * is the same thing — and the component holds the pending state until the
 * promise it returns settles, unless `refreshing` is driven from outside. A
 * second pull while one is running is ignored.
 *
 * There is no keyboard equivalent of a drag, so the component exposes
 * `refresh()`: a screen wires its own button — a page action, a menu item —
 * to the same call, and the gesture stays the shortcut rather than the only
 * way in.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { cn } from '../../lib/utils';
import {
  PULL_THRESHOLD,
  atTop,
  pullOffset,
  pullPhase,
  pullProgress,
  scrollableAncestor,
} from './pull';

const props = withDefaults(
  defineProps<{
    /**
     * Called by the gesture — written `@refresh` at the call site. A promise
     * keeps the indicator up until it settles. It is a callback prop rather
     * than an emit precisely so the component can await what it returns.
     */
    onRefresh?: (() => unknown | Promise<unknown>) | undefined;
    /** Drive the pending state from outside instead — a mutation's `isPending`. */
    refreshing?: boolean | undefined;
    /** Off entirely: an error screen, a list that cannot be reloaded. */
    disabled?: boolean;
    /** Travel, in pixels, at which releasing refreshes. */
    threshold?: number;
    /** What a screen reader hears while the refresh runs. */
    busyLabel?: string;
    class?: string;
  }>(),
  {
    onRefresh: undefined,
    refreshing: undefined,
    disabled: false,
    threshold: PULL_THRESHOLD,
    busyLabel: 'Refreshing',
    class: '',
  },
);

const offset = ref(0);
const settling = ref(false);
const running = ref(false);

/** `refreshing` wins when the caller passes it; otherwise we track our own. */
const busy = computed(() => props.refreshing ?? running.value);
const phase = computed(() => pullPhase(offset.value, props.threshold));
const progress = computed(() => pullProgress(offset.value, props.threshold));

/** While busy the indicator parks at the threshold, so it never jumps on release. */
const travel = computed(() =>
  busy.value ? Math.max(offset.value, props.threshold) : offset.value,
);

let startY: number | null = null;
let scroller: Element | null = null;

function onTouchStart(e: TouchEvent) {
  if (props.disabled || busy.value) return;
  const touch = e.touches[0];
  if (!touch) return;
  scroller = scrollableAncestor(e.target as Element | null);
  // Arming only at the top is what keeps an ordinary scroll an ordinary scroll.
  if (!atTop(scroller)) return;
  startY = touch.clientY;
  settling.value = false;
}

function onTouchMove(e: TouchEvent) {
  if (startY === null) return;
  const touch = e.touches[0];
  if (!touch) return;
  const distance = touch.clientY - startY;
  if (distance <= 0) {
    // Pulled back up past the start: hand the gesture back to the scroller.
    offset.value = 0;
    startY = null;
    return;
  }
  if (!atTop(scroller)) {
    offset.value = 0;
    startY = null;
    return;
  }
  // Only now, with a downward pull at the top, do we own the gesture.
  if (e.cancelable) e.preventDefault();
  offset.value = pullOffset(distance);
}

function onTouchEnd() {
  if (startY === null) return;
  startY = null;
  const crossed = phase.value === 'ready';
  settling.value = true;
  if (crossed) void refresh();
  else offset.value = 0;
}

/** The gesture's own entry point, and the one a button outside can call. */
async function refresh() {
  if (props.disabled || busy.value) return;
  settling.value = true;
  offset.value = props.threshold;
  if (!props.onRefresh) return;
  running.value = true;
  try {
    await props.onRefresh();
  } finally {
    running.value = false;
  }
}

// Whoever owns the pending state, the list returns home when it clears.
watch(busy, (now) => {
  if (!now) {
    settling.value = true;
    offset.value = 0;
  }
});

const root = ref<HTMLElement | null>(null);
watch(root, (el, previous) => {
  // Non-passive, because a pull at the top has to win over the page's scroll —
  // which a listener declared in the template cannot ask for.
  previous?.removeEventListener('touchmove', onTouchMove as EventListener);
  el?.addEventListener('touchmove', onTouchMove as EventListener, { passive: false });
});
onBeforeUnmount(() => root.value?.removeEventListener('touchmove', onTouchMove as EventListener));

defineExpose({ refresh });
</script>

<template>
  <div
    ref="root"
    data-slot="pull-to-refresh"
    :data-phase="busy ? 'refreshing' : phase"
    :class="cn('relative', props.class)"
    @touchstart.passive="onTouchStart"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <!--
      The indicator rides above the content's first line and is carried down by
      the same travel, so it reads as something the pull uncovers.
    -->
    <div
      class="pointer-events-none absolute inset-x-0 -top-10 flex justify-center"
      :class="settling ? 'transition-transform duration-base ease-out-quart' : ''"
      :style="{ transform: `translate3d(0, ${travel}px, 0)` }"
      aria-hidden="true"
    >
      <div
        class="flex size-8 items-center justify-center rounded-full bg-surface-raised text-muted-foreground shadow-card ring-1 ring-card-edge transition-colors duration-fast"
        :class="{ 'text-primary': phase === 'ready' || busy }"
        :style="{ opacity: busy ? 1 : progress }"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-4"
          :class="busy ? 'animate-spin' : 'transition-transform duration-fast ease-out-quart'"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :style="busy ? undefined : { transform: `rotate(${phase === 'ready' ? 180 : 0}deg)` }"
        >
          <template v-if="busy">
            <!-- Three quarters of a ring: a gap is what makes a spin visible. -->
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </template>
          <template v-else>
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </template>
        </svg>
      </div>
    </div>

    <div
      :class="settling ? 'transition-transform duration-base ease-out-quart' : ''"
      :style="{ transform: `translate3d(0, ${travel}px, 0)` }"
    >
      <slot />
    </div>

    <!-- The gesture is silent to a screen reader; this is what it hears. -->
    <span role="status" aria-live="polite" class="sr-only">{{ busy ? props.busyLabel : '' }}</span>
  </div>
</template>
