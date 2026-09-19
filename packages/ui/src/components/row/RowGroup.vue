<script setup lang="ts">
/**
 * What holds rows together (reference slide 14). Two things at once, because
 * they are the same thing: the card that groups the rows, and the heading that
 * names the group and gives its subtotal on the right.
 *
 * There are no dividing lines inside. That is the change direction.md makes
 * when the ledger hairline goes: what separates two rows is the edge of the
 * card around them and the air between, which groups fifteen numbers better
 * than a rule ever did.
 *
 * With no title the group is a plain card — the shape a list without headings
 * needs, and the reason a screen does not have to choose between two components.
 */
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import type { AmountLocale } from '../amount-lockup/format-amount';

const props = withDefaults(
  defineProps<{
    /** The name of the group: «Апрель», «Продукты». */
    title?: string;
    /** The group's subtotal, as the exact decimal string. */
    amount?: string;
    code?: string;
    scale?: number;
    locale?: AmountLocale;
    showCode?: boolean;
    /** A group of changes subtotals to a change: signed, and coloured like one. */
    variant?: 'balance' | 'change';
    /** The accessible name of the list, when the title is not next to it. */
    ariaLabel?: string;
    class?: HTMLAttributes['class'];
  }>(),
  {
    title: undefined,
    amount: undefined,
    code: undefined,
    scale: 2,
    locale: 'en',
    showCode: false,
    variant: 'balance',
    ariaLabel: undefined,
    class: '',
  },
);
</script>

<template>
  <div data-slot="row-group" :class="cn('flex w-full flex-col gap-2', props.class)">
    <div
      v-if="props.title"
      data-slot="row-group-header"
      class="flex items-baseline justify-between gap-3 px-2"
    >
      <span class="text-muted-foreground truncate text-sm font-medium">{{ props.title }}</span>
      <span
        v-if="props.amount && props.code"
        data-slot="row-group-subtotal"
        class="text-ink shrink-0"
      >
        <AmountLockup
          :amount="props.amount"
          :code="props.code"
          :scale="props.scale"
          :locale="props.locale"
          :show-code="props.showCode"
          :variant="props.variant"
          class="text-sm"
        />
      </span>
    </div>

    <ul
      data-slot="row-group-list"
      :aria-label="props.ariaLabel"
      class="bg-surface shadow-card flex w-full flex-col rounded-xl p-1"
    >
      <slot />
    </ul>
  </div>
</template>
