<script setup lang="ts">
/**
 * Progress drawn as a ledger rule: a hairline that fills in. The caller hands
 * two numbers made from exact amounts for drawing only; the float here decides a
 * width and never reaches a figure a person reads.
 *
 * The fill settles with `transform: scaleX()` rather than an animated `width`:
 * a width transition relayouts on every frame, a scale runs on the compositor.
 * `--duration-base` is already zeroed under `prefers-reduced-motion`; the
 * `motion-reduce` utility says so at the call site too.
 */
import { computed } from 'vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{ value: number; max: number; label?: string; class?: string }>(),
  { label: undefined, class: '' },
);

const percent = computed(() => {
  const share = props.max > 0 ? props.value / props.max : 0;
  return Number.isFinite(share) ? Math.round(Math.min(1, Math.max(0, share)) * 100) : 0;
});
</script>

<template>
  <div
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="percent"
    :aria-label="label"
    data-slot="progress-rule"
    :class="cn('h-0.5 w-full overflow-hidden rounded-full bg-border', props.class)"
  >
    <div
      class="h-full w-full origin-left rounded-full bg-foreground transition-transform duration-base ease-out-quart motion-reduce:transition-none"
      :style="{ transform: `scaleX(${percent / 100})` }"
    />
  </div>
</template>
