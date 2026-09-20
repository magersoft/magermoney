<script setup lang="ts">
/**
 * The amount lockup — the one thing the app is recognised by, and therefore the
 * only place an amount is ever set. The symbol leads, the fraction is set at
 * 0.6 of the integer and sits on the same baseline.
 *
 * The size comes from outside: nothing here declares a font size, so the same
 * component is the hero on the home screen and the number inside a chip, and
 * the 0.6 proportion holds at every step because it is expressed in `em`.
 *
 * `data-amount` is what makes the digits tabular (`styles/index.css`), so an
 * amount of the same length does not shift as it updates.
 *
 * Balances are ink; only a change is coloured (`variant="change"`), which is
 * also the only case that shows a plus.
 */
import { computed } from 'vue';
import { cn } from '../../lib/utils';
import { formatAmountLockup, plainAmount, type AmountLocale } from './format-amount';

const props = withDefaults(
  defineProps<{
    /** The exact decimal string, as stored. */
    amount: string;
    code: string;
    locale?: AmountLocale;
    /** `null` forces the code into the symbol's place; omit it to resolve. */
    symbol?: string | null;
    scale?: number;
    /** Repeats the code after the number, when a glyph is shared on screen. */
    showCode?: boolean;
    variant?: 'balance' | 'change';
    class?: string;
  }>(),
  {
    locale: 'en',
    symbol: undefined,
    scale: 2,
    showCode: false,
    variant: 'balance',
    class: '',
  },
);

const parts = computed(() =>
  formatAmountLockup(props.amount, {
    code: props.code,
    locale: props.locale,
    symbol: props.symbol,
    scale: props.scale,
    showCode: props.showCode,
    signed: props.variant === 'change',
  }),
);

const tone = computed(() => {
  if (props.variant !== 'change' || !parts.value.sign) return '';
  return parts.value.sign === '+' ? 'text-positive' : 'text-negative';
});

/* Mono caps with the tracking the small labels use, at the fraction's size. */
const MONO = 'font-mono text-[0.6em] uppercase tracking-[0.08em]';
</script>

<template>
  <span
    data-amount
    data-slot="amount-lockup"
    :class="cn('inline-flex items-baseline font-semibold', tone, props.class)"
  >
    <span class="sr-only">{{ plainAmount(parts) }}</span>
    <span aria-hidden="true" class="inline-flex items-baseline gap-[0.15em]">
      <!-- The sign hugs the symbol; the gap belongs between symbol and digits. -->
      <span class="inline-flex items-baseline">
        <span v-if="parts.sign" data-slot="amount-sign">{{ parts.sign }}</span>
        <span data-slot="amount-lead" :class="parts.lead.kind === 'code' ? MONO : undefined">{{
          parts.lead.text
        }}</span>
      </span>
      <span class="inline-flex items-baseline">
        <span data-slot="amount-integer">{{ parts.integer }}</span>
        <span v-if="parts.fraction" data-slot="amount-fraction" class="text-[0.6em]">{{
          parts.fraction
        }}</span>
      </span>
      <span v-if="parts.code" data-slot="amount-code" :class="MONO">{{ parts.code }}</span>
    </span>
  </span>
</template>
