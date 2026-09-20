<script setup lang="ts">
/**
 * The payment scheme's mark, in the card's top-right corner — the one piece of
 * bank furniture the reference has that we can honestly reproduce.
 *
 * Mastercard is its two circles, because that glyph is the mark and a word
 * would not be recognised in its place. Everything else is its name set in the
 * card's own ink: a wordmark in ink is legible on every tint the theme can
 * produce, which the brand colours are not, and it costs no network request on
 * an app built to work without one.
 *
 * The mark is decorative — `aria-hidden` — and the scheme is said in words by
 * whoever mounts this, so nothing depends on a screen reader spelling a logo.
 */
import { computed } from 'vue';
import type { CardBrand } from './card-brand';

const props = withDefaults(defineProps<{ brand: CardBrand; size?: number }>(), { size: 28 });

/** What a wordmark says. Mastercard is not here: it draws as circles instead. */
const WORDMARKS: Partial<Record<CardBrand, string>> = {
  visa: 'VISA',
  mir: 'MIR',
  unionpay: 'UNIONPAY',
  amex: 'AMEX',
  jcb: 'JCB',
};
const word = computed(() => WORDMARKS[props.brand]);
</script>

<template>
  <!--
    The circles carry their own colour rather than the card's ink: this is the
    one mark people read as a colour, and both discs stay legible on any tint
    because they overlap into a third, lighter shape in the middle.
  -->
  <svg
    v-if="props.brand === 'mastercard'"
    data-slot="card-brand"
    :data-brand="props.brand"
    :width="props.size"
    :height="(props.size * 22) / 36"
    viewBox="0 0 36 22"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="13" cy="11" r="11" fill="#EB001B" />
    <circle cx="23" cy="11" r="11" fill="#F79E1B" fill-opacity="0.9" />
  </svg>

  <!--
    A wordmark, not an image: real text in the card's ink, tracked wide and set
    in the mono face the rest of the card's furniture uses.
  -->
  <span
    v-else-if="word"
    data-slot="card-brand"
    :data-brand="props.brand"
    aria-hidden="true"
    class="font-mono text-xs font-semibold tracking-[0.14em] italic"
    >{{ word }}</span
  >
</template>
