<script setup lang="ts">
/**
 * A budget category against its limit (reference slide 16): emoji, name, the
 * pair it is measured by, and its own bar.
 *
 * Two things the reference does not have to deal with are handled here. A
 * budget can be kept in a currency that is not the base one, so the row says
 * which — the code follows both halves of the pair, the lockup's own rule for a
 * screen where a glyph is shared. And a category that went over says so in
 * words: the bar can only fill, so red would be the whole message otherwise,
 * and red alone is not a message to someone who cannot see it.
 *
 * The bar is decoration, not a widget: the pair above it is the same fact in
 * text, and announcing both would say everything twice.
 */
import { computed } from 'vue';
import { Primitive, type PrimitiveProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ChevronRightIcon, TriangleAlertIcon } from '@lucide/vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import type { AmountLocale } from '../amount-lockup/format-amount';

interface Props extends PrimitiveProps {
  name: string;
  /** The category's own emoji. Decoration: the name is what is announced. */
  emoji?: string;
  /** The exact decimal strings, as stored. */
  spent: string;
  limit: string;
  /**
   * The same two amounts as floats, for drawing only — the rule `ProgressRule`
   * follows. They never reach a figure a person reads.
   */
  spentValue: number;
  limitValue: number;
  /** The budget's currency, and the one the screen counts in. */
  code: string;
  baseCode?: string;
  scale?: number;
  locale?: AmountLocale;
  /** Shown when the limit has been passed, in the screen's words. */
  overLabel?: string;
  href?: string;
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  as: 'div',
  emoji: undefined,
  baseCode: undefined,
  scale: 2,
  locale: 'en',
  overLabel: undefined,
  href: undefined,
  class: '',
});

/* A budget of nothing is a budget nobody set, not a division by zero. */
const share = computed(() => {
  if (!(props.limitValue > 0)) return 0;
  const value = props.spentValue / props.limitValue;
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
});

const over = computed(() => props.limitValue > 0 && props.spentValue > props.limitValue);

/* Only when it differs: a screen in one currency should not be shouting it. */
const showCode = computed(
  () => props.baseCode !== undefined && props.code.toUpperCase() !== props.baseCode.toUpperCase(),
);

const linkAttrs = computed(() => {
  if (!props.href) return {};
  return props.as === 'a' ? { href: props.href } : { to: props.href };
});
</script>

<template>
  <Primitive
    data-slot="category-row"
    :as="as"
    :as-child="asChild"
    :data-over="over ? 'true' : 'false'"
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
      v-if="props.emoji"
      data-slot="category-row-emoji"
      aria-hidden="true"
      class="bg-surface-sunken grid size-10 shrink-0 place-items-center rounded-full text-base"
      >{{ props.emoji }}</span
    >

    <span class="flex min-w-0 flex-1 flex-col gap-1.5">
      <span class="flex items-baseline justify-between gap-3">
        <span data-slot="category-row-name" class="truncate text-sm font-medium">{{
          props.name
        }}</span>
        <span
          data-slot="category-row-pair"
          class="text-muted-foreground flex shrink-0 items-baseline gap-1 text-sm"
        >
          <AmountLockup
            :amount="props.spent"
            :code="props.code"
            :scale="props.scale"
            :locale="props.locale"
            :show-code="showCode"
            :class="over ? 'text-negative' : 'text-ink'"
          />
          <span aria-hidden="true">/</span>
          <AmountLockup
            :amount="props.limit"
            :code="props.code"
            :scale="props.scale"
            :locale="props.locale"
            :show-code="showCode"
            class="font-medium"
          />
        </span>
      </span>

      <span
        data-slot="category-row-bar"
        aria-hidden="true"
        class="bg-surface-sunken block h-1.5 w-full overflow-hidden rounded-full"
      >
        <span
          data-slot="category-row-fill"
          :class="
            cn(
              'duration-base ease-out-quart block h-full w-full origin-left rounded-full',
              'transition-transform motion-reduce:transition-none',
              over ? 'bg-negative' : 'bg-primary',
            )
          "
          :style="{ transform: `scaleX(${share})` }"
        />
      </span>

      <!-- Red is the second way of saying this, never the only one. -->
      <span
        v-if="over && props.overLabel"
        data-slot="category-row-over"
        class="text-negative inline-flex items-center gap-1 text-xs font-medium"
      >
        <TriangleAlertIcon aria-hidden="true" class="size-3.5 shrink-0" />
        {{ props.overLabel }}
      </span>
    </span>

    <ChevronRightIcon
      v-if="props.href"
      data-slot="row-chevron"
      aria-hidden="true"
      class="text-muted-foreground pointer-events-none size-5 shrink-0"
    />
  </Primitive>
</template>
