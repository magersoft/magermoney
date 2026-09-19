<script setup lang="ts">
/**
 * An account, as a card. The reference's payment card with its two pieces of
 * bank furniture swapped for ours: the scheme logo becomes the currency mark,
 * the masked number becomes the account's name, and the fill carries the
 * currency instead of decorating (`currency-tint.ts`).
 *
 * Everything the card says sits in its top band, because the stack layout
 * overlaps into the bottom one — a card whose amount could be covered would be
 * a card you have to open to read.
 *
 * All the type is ink. A balance is never coloured (docs/design/direction.md),
 * and a second, quieter tone would not clear AA on the tint anyway.
 */
import { computed } from 'vue';
import { Primitive, type PrimitiveProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import CurrencyIcon from '../currency-icon/CurrencyIcon.vue';
import type { AmountLocale } from '../amount-lockup/format-amount';
import { currencyTintStyle } from './currency-tint';
import type { AccountCardItem } from './types';

interface Props extends PrimitiveProps {
  account: AccountCardItem;
  /** The base currency. An account held in anything else gets marked. */
  baseCode?: string;
  locale?: AmountLocale;
  /** `sm` is the strip's tile, `md` the stack's wallet card. */
  size?: 'sm' | 'md';
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  as: 'a',
  baseCode: undefined,
  locale: 'en',
  size: 'md',
  class: '',
});

/*
 * The multicurrency fact the reference has no answer for: money that is not in
 * the currency you count in. The code in mono caps is the mark, and it is real
 * text, so a screen reader reaches it along with the balance.
 */
const foreign = computed(
  () =>
    props.baseCode !== undefined &&
    props.account.code.toUpperCase() !== props.baseCode.toUpperCase(),
);

/*
 * One destination, spelled the way the element it renders as expects it: an
 * anchor takes `href`, a router link takes `to`. A screen therefore swaps `as`
 * and nothing else, and cannot end up with a card that leads nowhere.
 */
const linkAttrs = computed(() => {
  if (!props.account.href) return {};
  return props.as === 'a' ? { href: props.account.href } : { to: props.account.href };
});
</script>

<template>
  <Primitive
    data-slot="account-card"
    :as="as"
    :as-child="asChild"
    :data-foreign="foreign || undefined"
    :style="currencyTintStyle(props.account.code)"
    v-bind="linkAttrs"
    :class="
      cn(
        'bg-currency-tint text-ink shadow-card relative flex flex-col gap-2 rounded-xl p-4',
        /*
         * The edge the dark theme needs and the light one does not: with no
         * shadow on a dark canvas, a hairline of ink is what catches the top of
         * a card against whatever it is lying on. In light the token is
         * transparent and this draws nothing.
         */
        'border-card-edge border',
        'duration-fast ease-out-quart outline-offset-2 transition-transform',
        'hover:-translate-y-0.5 focus-visible:-translate-y-0.5',
        'focus-visible:outline-ring focus-visible:outline-2 motion-reduce:transition-none',
        props.size === 'sm' ? 'min-h-28' : 'min-h-36',
        props.class,
      )
    "
  >
    <span class="flex items-start justify-between gap-2">
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ props.account.name }}</span>
      <!-- The mark is the currency; the code is announced by the foreign badge. -->
      <span aria-hidden="true" class="shrink-0">
        <CurrencyIcon
          :code="props.account.code"
          :kind="props.account.kind"
          :size="props.size === 'sm' ? 20 : 24"
        />
      </span>
    </span>
    <span class="flex items-baseline justify-between gap-2">
      <AmountLockup
        :amount="props.account.amount"
        :code="props.account.code"
        :scale="props.account.scale ?? 2"
        :locale="props.locale"
        :class="props.size === 'sm' ? 'text-base' : 'text-lg'"
      />
      <span
        v-if="foreign"
        data-slot="account-card-foreign"
        class="bg-ink/10 text-2xs shrink-0 rounded-full px-2 py-0.5 font-mono tracking-[0.08em] uppercase"
        >{{ props.account.code.toUpperCase() }}</span
      >
    </span>
  </Primitive>
</template>
