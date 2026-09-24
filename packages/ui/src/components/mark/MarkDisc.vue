<script setup lang="ts">
/**
 * What a goal or an asset is marked with: its emoji, or the first letter of its
 * name, on the colour it was given — the profile disc's language, used for
 * things. A list of them then reads by shape and colour before a word of it is
 * read.
 *
 * The colours are the card palette, and the glyph takes the ink each fill was
 * chosen with, so a disc is legible in either theme for the same reason a card
 * is. Uncoloured, it sits on the sunken surface with the theme's ink — quiet,
 * but never an empty slot.
 *
 * Presentational and size-agnostic: the size comes from whoever places it, and
 * the glyph scales with the font size given to it. `aria-hidden`, because the
 * name printed beside it already says everything the disc does.
 */
import { computed } from 'vue';
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import { cardFillStyle } from '../account-card/palette';

const props = withDefaults(
  defineProps<{
    /** One emoji, already checked by the caller; null draws the initial. */
    emoji?: string | null;
    /** What the initial is taken from. */
    name: string;
    /** A card-palette colour name; null keeps the plain surface. */
    color?: string | null;
    class?: HTMLAttributes['class'];
  }>(),
  { emoji: null, color: null, class: '' },
);

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/* By grapheme, so «Ярослав», a flag and a ZWJ emoji at the start all come out whole. */
const initial = computed(() => {
  const first = graphemes.segment(props.name.trim())[Symbol.iterator]().next();
  return first.done ? '' : first.value.segment.toUpperCase();
});
const paint = computed(() => (props.color ? cardFillStyle(0, props.color) : undefined));
</script>

<template>
  <span
    aria-hidden="true"
    data-slot="mark-disc"
    :data-color="props.color ?? undefined"
    :style="paint"
    :class="
      cn(
        'grid shrink-0 place-items-center rounded-full font-medium select-none',
        props.color ? 'bg-card-fill text-card-ink' : 'bg-surface-sunken text-ink',
        props.class,
      )
    "
  >
    <span v-if="props.emoji" class="text-[1.2em] leading-none">{{ props.emoji }}</span>
    <template v-else>{{ initial }}</template>
  </span>
</template>
