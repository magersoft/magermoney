<script setup lang="ts">
/**
 * The amounts worth one tap (reference slide 20). It sits above the keyboard
 * because that is where it saves the typing, and it exists because a personal
 * ledger is full of the same four or five numbers.
 *
 * Each button hands back the exact decimal string it was given, never the text
 * it drew: the formatting is for the eye, and the amount that is stored has to
 * be the one that was meant (ADR 0001).
 *
 * With nothing to offer it is not an empty row — it is nothing at all.
 */
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import type { AmountLocale } from '../amount-lockup/format-amount';

const props = withDefaults(
  defineProps<{
    /** Exact decimal strings, as they will be stored. */
    amounts: readonly string[];
    code: string;
    scale?: number;
    locale?: AmountLocale;
    ariaLabel?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { scale: 2, locale: 'en', ariaLabel: undefined, class: '' },
);

const emit = defineEmits<{ pick: [amount: string] }>();
</script>

<template>
  <div
    v-if="props.amounts.length > 0"
    data-slot="quick-amount-grid"
    role="group"
    :aria-label="props.ariaLabel"
    :class="cn('flex w-full flex-wrap gap-2', props.class)"
  >
    <button
      v-for="amount in props.amounts"
      :key="amount"
      type="button"
      data-slot="quick-amount"
      :class="
        cn(
          'bg-surface-sunken text-ink inline-flex min-h-11 flex-1 items-center justify-center',
          'rounded-full px-3 text-sm font-medium',
          'duration-fast ease-out-quart transition-colors hover:bg-surface-sunken/70',
          'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
        )
      "
      @click="emit('pick', amount)"
    >
      <AmountLockup
        :amount="amount"
        :code="props.code"
        :scale="props.scale"
        :locale="props.locale"
        class="text-sm"
      />
    </button>
  </div>
</template>
