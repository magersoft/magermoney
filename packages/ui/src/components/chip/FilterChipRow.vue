<script setup lang="ts">
/**
 * The filters that are on, as a row (reference slides 12, 14). What is filtered
 * is half of what a screen of numbers means, so the row states it in words and
 * lets every filter be dropped where it is read, rather than back in the
 * control that set it.
 *
 * More filters than fit is the normal case: the row wraps by default, and a
 * screen with no vertical room to give asks for the scroller instead. Neither
 * layout widens its parent.
 *
 * With nothing on, the row is not an empty row — it is nothing at all.
 */
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import FilterChip from './FilterChip.vue';
import type { FilterChipItem } from './types';

const props = withDefaults(
  defineProps<{
    chips: readonly FilterChipItem[];
    /** The name of the clear-all control. Without it, the row has none. */
    clearLabel?: string;
    /** How the row handles overflow. */
    layout?: 'wrap' | 'scroll';
    ariaLabel?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { clearLabel: undefined, layout: 'wrap', ariaLabel: undefined, class: '' },
);

const emit = defineEmits<{ remove: [id: string]; clear: [] }>();
</script>

<template>
  <ul
    v-if="props.chips.length > 0"
    data-slot="filter-chip-row"
    :aria-label="props.ariaLabel"
    :class="
      cn(
        'flex items-center gap-x-2',
        props.layout === 'scroll'
          ? // Room for the focus ring, which sits outside the chip.
            'flex-nowrap overflow-x-auto py-1 [scrollbar-width:none]'
          : // 12px between lines, not 8: the remove targets reach 10px past the
            // 32px pill, and at 8px the one below would start inside this one.
            'flex-wrap gap-y-3',
        props.class,
      )
    "
  >
    <!--
      Wrapped, a chip longer than the line has to give: it shrinks and its label
      truncates. In the scroller nothing shrinks — that is the whole point of
      scrolling — so the chip keeps its width and the row runs off the edge.
    -->
    <li
      v-for="chip in props.chips"
      :key="chip.id"
      :class="props.layout === 'scroll' ? 'shrink-0' : 'min-w-0 max-w-full'"
    >
      <FilterChip
        :label="chip.label"
        :remove-label="chip.removeLabel"
        @remove="emit('remove', chip.id)"
      />
    </li>
    <!--
      Clearing everything is one action, not a chip: no fill, no pill, and it
      reads as the exit from the filtered state rather than another filter.
    -->
    <li v-if="props.clearLabel" class="shrink-0">
      <button
        type="button"
        data-slot="filter-chip-clear"
        class="text-accent-foreground focus-visible:outline-ring inline-flex min-h-8 items-center rounded-full px-2 text-sm font-medium underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 pointer-coarse:min-h-11"
        @click="emit('clear')"
      >
        {{ props.clearLabel }}
      </button>
    </li>
  </ul>
</template>
