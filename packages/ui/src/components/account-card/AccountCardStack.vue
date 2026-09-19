<script setup lang="ts">
/**
 * The accounts screen: the same cards, dealt as an overlapping stack.
 *
 * The overlap is made of reserved space, not of offsets — every item but the
 * last reserves only the peek band and lets its card overflow into the item
 * below, which paints over it. So the DOM order is the visual order, the tab
 * order comes free with it, and nothing here sets `tabindex` to patch it up.
 *
 * A card that is hovered or holds focus is raised above the one covering it:
 * otherwise the focus ring of every card but the last would be clipped, which
 * is the usual way a stack like this fails a keyboard.
 */
import type { Component, HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import type { AmountLocale } from '../amount-lockup/format-amount';
import AccountCard from './AccountCard.vue';
import type { AccountCardItem } from './types';

const props = withDefaults(
  defineProps<{
    accounts: readonly AccountCardItem[];
    baseCode?: string;
    locale?: AmountLocale;
    as?: string | Component;
    /** How much of a covered card stays visible. Its whole top band, by design. */
    peek?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { baseCode: undefined, locale: 'en', as: 'a', peek: '5.5rem', class: '' },
);
</script>

<template>
  <ul data-slot="account-card-stack" :class="cn('flex flex-col', props.class)">
    <li
      v-for="(account, index) in props.accounts"
      :key="account.id"
      :style="index < props.accounts.length - 1 ? { height: props.peek } : undefined"
      class="relative hover:z-10 focus-within:z-10"
    >
      <!--
        A ring in the canvas colour cuts one card off the next. The shadow
        cannot do it here — it is `none` in dark — and two cards in the same
        currency share a fill, so lightness cannot do it either.
      -->
      <AccountCard
        :account="account"
        :base-code="props.baseCode"
        :locale="props.locale"
        :as="props.as"
        class="ring-background w-full ring-2"
      />
    </li>
  </ul>
</template>
