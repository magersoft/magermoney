<script setup lang="ts">
/**
 * The home screen's row of accounts: a scroller of fixed-width cards that ends
 * with the tile for adding one. Fixed width rather than fluid, because a strip
 * whose cards resize with the count stops being recognisable as the same object
 * between screens.
 *
 * Snap points land a card against the gutter, and the gutter is padding on the
 * scroller itself, so the first and last card can still reach the edge.
 */
import type { Component, HTMLAttributes } from 'vue';
import { PlusIcon } from '@lucide/vue';
import { cn } from '../../lib/utils';
import type { AmountLocale } from '../amount-lockup/format-amount';
import AccountCard from './AccountCard.vue';
import type { AccountCardItem } from './types';

const props = withDefaults(
  defineProps<{
    accounts: readonly AccountCardItem[];
    baseCode?: string;
    locale?: AmountLocale;
    /** What a card renders as — a router link on a routed screen. */
    as?: string | Component;
    /** Where the add tile leads. Without it, the strip has no tile. */
    addHref?: string;
    addLabel?: string;
    class?: HTMLAttributes['class'];
  }>(),
  {
    baseCode: undefined,
    locale: 'en',
    as: 'a',
    addHref: undefined,
    addLabel: undefined,
    class: '',
  },
);
</script>

<template>
  <ul
    data-slot="account-card-strip"
    :class="
      cn(
        'flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth',
        // Room for the lift on hover and for the focus ring, which sits outside.
        '-mx-4 px-4 py-2',
        props.class,
      )
    "
  >
    <li v-for="account in props.accounts" :key="account.id" class="w-44 shrink-0 snap-start">
      <AccountCard
        :account="account"
        :base-code="props.baseCode"
        :locale="props.locale"
        :as="props.as"
        size="sm"
        class="h-full"
      />
    </li>
    <li v-if="props.addHref" class="w-44 shrink-0 snap-start">
      <!--
        Dashed, unfilled and ink-quiet: the tile is the one thing in the strip
        that is not money, and it should not read as an account with none.
      -->
      <component
        :is="props.as"
        data-slot="add-account-tile"
        :href="props.as === 'a' ? props.addHref : undefined"
        :to="props.as === 'a' ? undefined : props.addHref"
        class="border-line-strong text-ink duration-fast ease-out-quart outline-offset-2 flex h-full min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <PlusIcon aria-hidden="true" class="size-5" />
        <span class="text-sm font-medium">{{ props.addLabel }}</span>
      </component>
    </li>
  </ul>
</template>
