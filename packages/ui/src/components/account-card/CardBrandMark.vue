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
    one mark people read as a colour.

    Which is also why it needs a plate under it. The fills are now saturated,
    and a red disc on a red or magenta card is simply not there — the mark
    survived the pastel palette and vanished on the vivid one. So it sits on a
    light rounded plate, the way a scheme logo sits on a printed patch on a real
    card: the discs are then read against a constant, whatever the card is
    painted in, and the graphic keeps the 3:1 it owes (WCAG 1.4.11) without the
    card's colour having a say.
  -->
  <svg
    v-if="props.brand === 'mastercard'"
    data-slot="card-brand"
    :data-brand="props.brand"
    :width="props.size"
    :height="(props.size * 26) / 42"
    viewBox="0 0 42 26"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="0" y="0" width="42" height="26" rx="4" fill="#FFFFFF" fill-opacity="0.92" />
    <circle cx="17" cy="13" r="8" fill="#EB001B" />
    <circle cx="25" cy="13" r="8" fill="#F79E1B" fill-opacity="0.9" />
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
