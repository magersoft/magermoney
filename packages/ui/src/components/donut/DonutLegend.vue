<script setup lang="ts">
/**
 * The legend (reference slides 12, 14). It is not a key to the colours — it is
 * the chart in words: every slice states its name and what it cost, so the
 * breakdown survives greyscale, a colour deficiency, a screen reader, and the
 * plain fact that seven categories cannot be told apart by hue alone.
 *
 * A chip is therefore a chip, not a swatch: the dot is the smallest part of it.
 * Picking one is how a slice is singled out in the ring, so the chip is a
 * toggle and says so in `aria-pressed` rather than only in its fill.
 *
 * With nothing to list the legend is not an empty list — it is nothing at all.
 */
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import type { AmountLocale } from '../amount-lockup/format-amount';
import { segmentStyle, type DonutArc } from './segments';

const props = withDefaults(
  defineProps<{
    arcs: readonly DonutArc[];
    code: string;
    scale?: number;
    locale?: AmountLocale;
    /** The slice that is singled out, if one is. */
    activeId?: string | null;
    ariaLabel?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { scale: 2, locale: 'en', activeId: null, ariaLabel: undefined, class: '' },
);

const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <ul
    v-if="props.arcs.length > 0"
    data-slot="donut-legend"
    :aria-label="props.ariaLabel"
    :class="cn('flex w-full flex-wrap items-center gap-2', props.class)"
  >
    <li v-for="arc in props.arcs" :key="arc.id" class="min-w-0 max-w-full">
      <button
        type="button"
        data-slot="donut-legend-chip"
        :data-segment-id="arc.id"
        :aria-pressed="props.activeId === arc.id ? 'true' : 'false'"
        :class="
          cn(
            'inline-flex max-w-full min-h-9 items-center gap-2 rounded-full px-3 py-1.5',
            'bg-surface-sunken text-ink text-sm font-medium',
            'duration-fast ease-out-quart transition-opacity',
            'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
            'pointer-coarse:min-h-11',
            /* Dimming is the echo of the ring, where the same slices go quiet. */
            props.activeId && props.activeId !== arc.id && 'opacity-60',
          )
        "
        @click="emit('select', arc.id)"
      >
        <!--
          The dot repeats the arc's colour so the chip can be found in the ring.
          It is decoration: everything it could say is already in the words.
        -->
        <span
          data-slot="donut-legend-dot"
          aria-hidden="true"
          :style="segmentStyle(arc.hue)"
          class="bg-segment size-2.5 shrink-0 rounded-full"
        />
        <span v-if="arc.emoji" aria-hidden="true">{{ arc.emoji }}</span>
        <AmountLockup
          :amount="arc.amount"
          :code="props.code"
          :scale="props.scale"
          :locale="props.locale"
          class="shrink-0 text-sm"
        />
        <span class="text-muted-foreground min-w-0 truncate font-normal">{{ arc.label }}</span>
      </button>
    </li>
  </ul>
</template>
