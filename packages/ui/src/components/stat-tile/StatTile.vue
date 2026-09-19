<script setup lang="ts">
/**
 * A month's income or spending, as a tile (reference slides 10, 12, 14). It is
 * the second half of the question the owner opens the app with: not «сколько»,
 * which the balance answers, but «больше ли, чем в прошлом месяце».
 *
 * The tile is therefore two facts stacked — the sum, and the change — and the
 * colour rule from docs/design/direction.md is what keeps them apart: the
 * amount is ink like every other amount in the app, and the badge is the only
 * thing on the screen allowed to be green or red. The icon's disc stays neutral
 * for the same reason; on a home screen carrying two of these, a coloured disc
 * would compete with the one mark that actually carries meaning.
 *
 * Direction never rests on the fill: the sign is in the text and the arrow is
 * beside it, so the change survives greyscale, a colour deficiency and a screen
 * reader.
 */
import { computed } from 'vue';
import { Primitive, type PrimitiveProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ArrowDownRightIcon, ArrowUpRightIcon, ChevronRightIcon } from '@lucide/vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import type { AmountLocale } from '../amount-lockup/format-amount';
import { deltaDirection, deltaTone, formatDelta } from './delta';

interface Props extends PrimitiveProps {
  /** «Доходы», «Расходы». Written by the screen — the copy lives in locales. */
  label: string;
  /** The exact decimal string, as stored. */
  amount: string;
  code: string;
  scale?: number;
  locale?: AmountLocale;
  /**
   * The change against the previous period as a ratio: `0.05` is +5 %.
   * `null` or omitted means there is nothing to compare against, and the badge
   * is left out rather than shown empty.
   */
  delta?: number | null;
  /** Income that grows is good news; spending that grows is not. */
  upIsGood?: boolean;
  /** Read out after the badge: «к прошлому месяцу». Written by the screen. */
  deltaCaption?: string;
  /** Where the tile leads. Without it the tile is not a control. */
  href?: string;
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  as: 'div',
  scale: 2,
  locale: 'en',
  delta: null,
  upIsGood: true,
  deltaCaption: undefined,
  href: undefined,
  class: '',
});

const badge = computed(() => {
  if (props.delta === null || props.delta === undefined) return null;
  return {
    tone: deltaTone(props.delta, props.upIsGood),
    direction: deltaDirection(props.delta),
    text: formatDelta(props.delta, props.locale),
  };
});

/*
 * A fill carries its own foreground: the pastels are the same colour in both
 * themes, so `text-ink` would disappear on them in dark. Flat is not a fill at
 * all — a month that did not move gets no colour, only the sunken surface.
 */
const BADGE_TONE = {
  good: 'bg-positive-fill text-positive-fg',
  bad: 'bg-negative-fill text-negative-fg',
  flat: 'bg-surface-sunken text-ink',
} as const;

/*
 * One destination, spelled the way the element it renders as expects it — the
 * account card's rule, and for the same reason: a screen swaps `as` and nothing
 * else, and cannot end up with a tile that leads nowhere.
 */
const linkAttrs = computed(() => {
  if (!props.href) return {};
  return props.as === 'a' ? { href: props.href } : { to: props.href };
});
</script>

<template>
  <Primitive
    data-slot="stat-tile"
    :as="as"
    :as-child="asChild"
    v-bind="linkAttrs"
    :class="
      cn(
        'bg-surface text-ink shadow-card flex min-h-28 flex-col gap-2 rounded-xl p-4',
        'duration-fast ease-out-quart outline-offset-2 transition-transform',
        props.href && 'hover:-translate-y-0.5 focus-visible:-translate-y-0.5',
        'focus-visible:outline-ring focus-visible:outline-2 motion-reduce:transition-none',
        props.class,
      )
    "
  >
    <span class="flex items-start justify-between gap-2">
      <span
        v-if="$slots.icon"
        data-slot="stat-tile-icon"
        aria-hidden="true"
        class="bg-surface-sunken text-ink grid size-10 shrink-0 place-items-center rounded-full"
      >
        <slot name="icon" />
      </span>
      <span
        v-if="badge"
        data-slot="stat-tile-delta"
        :data-tone="badge.tone"
        :data-direction="badge.direction"
        :class="
          cn(
            'ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full py-0.5',
            /* The arrow reads as part of the number, so it eats its own left padding. */
            badge.direction === 'flat' ? 'px-2' : 'pr-2 pl-1.5',
            'text-xs font-medium',
            BADGE_TONE[badge.tone],
          )
        "
      >
        <component
          :is="badge.direction === 'up' ? ArrowUpRightIcon : ArrowDownRightIcon"
          v-if="badge.direction !== 'flat'"
          data-slot="stat-tile-delta-arrow"
          aria-hidden="true"
          class="size-3.5"
        />
        <!-- The sign is inside the text, so the direction is spoken as well as drawn. -->
        <span>{{ badge.text }}</span>
        <span v-if="props.deltaCaption" class="sr-only">{{ props.deltaCaption }}</span>
      </span>
    </span>

    <span class="mt-auto flex items-end justify-between gap-2">
      <span class="flex min-w-0 flex-col gap-0.5">
        <span data-slot="stat-tile-label" class="text-muted-foreground truncate text-sm font-medium"
          >{{ props.label }}
        </span>
        <AmountLockup
          :amount="props.amount"
          :code="props.code"
          :scale="props.scale"
          :locale="props.locale"
          class="text-base sm:text-lg"
        />
      </span>
      <ChevronRightIcon
        v-if="props.href"
        data-slot="stat-tile-chevron"
        aria-hidden="true"
        class="text-muted-foreground size-5 shrink-0"
      />
    </span>
  </Primitive>
</template>
