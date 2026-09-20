<script setup lang="ts">
/**
 * The most repeated object in the app (reference slides 12, 14): what was
 * bought, in which category, for how much, at what time. Every list of
 * movements is made of these — an account, the plan, transfers — so it is one
 * component rather than markup written out again on each screen.
 *
 * The amount is ink. A movement has a direction, and the number already carries
 * it in its sign; painting twenty rows in two colours would turn the screen
 * into the traffic light direction.md rules out. `variant="change"` is there for
 * the rare list that really is about change, and is never the default.
 *
 * The row is the target: 56px tall, the whole of it one control when it leads
 * somewhere, and the chevron cannot take the tap.
 */
import { computed } from 'vue';
import { Primitive, type PrimitiveProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ChevronRightIcon } from '@lucide/vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import type { AmountLocale } from '../amount-lockup/format-amount';

interface Props extends PrimitiveProps {
  /** What it was: «Пятёрочка». */
  title: string;
  /** Which category it fell into. Optional — a transfer has none. */
  category?: string;
  /** The exact decimal string, as stored. */
  amount: string;
  code: string;
  scale?: number;
  locale?: AmountLocale;
  /** Repeats the code after the number, when a glyph is shared on the screen. */
  showCode?: boolean;
  /** Ink unless the list is genuinely about change. */
  variant?: 'balance' | 'change';
  /** When it happened, formatted by the screen: «14:32». */
  time?: string;
  /** Where the row leads. Without it the row is not a control. */
  href?: string;
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  as: 'div',
  category: undefined,
  scale: 2,
  locale: 'en',
  showCode: false,
  variant: 'balance',
  time: undefined,
  href: undefined,
  class: '',
});

/* One destination, spelled the way the element it renders as expects it. */
const linkAttrs = computed(() => {
  if (!props.href) return {};
  return props.as === 'a' ? { href: props.href } : { to: props.href };
});
</script>

<template>
  <Primitive
    data-slot="transaction-row"
    :as="as"
    :as-child="asChild"
    v-bind="linkAttrs"
    :class="
      cn(
        'text-ink flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2',
        'duration-fast ease-out-quart transition-colors outline-offset-[-2px]',
        props.href && 'hover:bg-surface-sunken/60',
        'focus-visible:outline-ring focus-visible:outline-2 motion-reduce:transition-none',
        props.class,
      )
    "
  >
    <span
      v-if="$slots.icon"
      data-slot="transaction-row-icon"
      aria-hidden="true"
      class="bg-surface-sunken text-ink grid size-10 shrink-0 place-items-center rounded-full"
    >
      <slot name="icon" />
    </span>

    <span class="flex min-w-0 flex-1 flex-col">
      <span data-slot="transaction-row-title" class="truncate text-sm font-medium">{{
        props.title
      }}</span>
      <span
        v-if="props.category"
        data-slot="transaction-row-category"
        class="text-muted-foreground truncate text-xs"
        >{{ props.category }}</span
      >
    </span>

    <!-- The title gives when the row is too narrow; the amount never does. -->
    <span data-slot="transaction-row-amount" class="flex shrink-0 flex-col items-end gap-0.5">
      <AmountLockup
        :amount="props.amount"
        :code="props.code"
        :scale="props.scale"
        :locale="props.locale"
        :show-code="props.showCode"
        :variant="props.variant"
        class="text-sm"
      />
      <span
        v-if="props.time"
        data-slot="transaction-row-time"
        class="text-muted-foreground text-2xs font-mono tracking-[0.08em]"
        >{{ props.time }}</span
      >
    </span>

    <ChevronRightIcon
      v-if="props.href"
      data-slot="row-chevron"
      aria-hidden="true"
      class="text-muted-foreground pointer-events-none size-5 shrink-0"
    />
  </Primitive>
</template>
