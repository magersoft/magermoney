<script setup lang="ts">
/**
 * The pattern worth the most in the whole reference (slide 13), and the direct
 * answer to «three taps before an expense can be written down»: the central
 * plus opens a sheet in which the amount is the first and largest thing, the
 * kind of operation is a segment under it, everything else is a row rather than
 * a bordered field, and the button that finishes it is at the bottom.
 *
 * Two things the reference never had to solve are here. A currency sits beside
 * the amount, because Moni is single-currency and this ledger is not — a number
 * without its currency is not an amount. And the sheet holds no state: every
 * value is a model the screen owns, so the same sheet writes an expense, an
 * income and a transfer without knowing what any of them are.
 *
 * It is built on reka's Dialog, which is what makes Escape, the click outside,
 * the focus trap and the return of focus to whatever opened it true rather than
 * claimed. Its arrival is `sheetUp` from `motion/presets`, so it settles rather
 * than springs and reduced motion drops the travel through `<MotionConfig>` in
 * the app; on close, reka takes the panel down at once, which is the behaviour
 * we want anyway — going away must never hold anyone up.
 */
import { XIcon } from '@lucide/vue';
import { Motion } from 'motion-v';
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import MoneyInput from '../money-input/MoneyInput.vue';
import SegmentedControl from '../segmented-control/SegmentedControl.vue';
import type { SegmentedOption } from '../segmented-control/types';
import type { AmountLocale } from '../amount-lockup/format-amount';
import { fade, sheetUp } from '../../motion/presets';
import QuickAmountGrid from './QuickAmountGrid.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** What is being written: «Новая операция». Also the sheet's name. */
    title: string;
    description?: string;
    /** The exact decimal string being typed. */
    amount: string;
    amountLabel: string;
    /** The currency of that amount, and the ones it can be switched to. */
    code: string;
    currencies: readonly string[];
    currencyLabel: string;
    scale?: number;
    locale?: AmountLocale;
    /** Расход / Доход / Перевод. Left out, the segment is not shown. */
    types?: readonly SegmentedOption[];
    type?: string;
    typeLabel?: string;
    /** Exact decimal strings worth one tap. */
    quickAmounts?: readonly string[];
    quickLabel?: string;
    confirmLabel: string;
    closeLabel: string;
    confirmDisabled?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  {
    description: undefined,
    scale: 2,
    locale: 'en',
    types: () => [],
    type: '',
    typeLabel: undefined,
    quickAmounts: () => [],
    quickLabel: undefined,
    confirmDisabled: false,
    class: '',
  },
);

const emit = defineEmits<{
  'update:open': [open: boolean];
  'update:amount': [amount: string];
  'update:code': [code: string];
  'update:type': [type: string];
  confirm: [];
}>();

/*
 * The sheet's root is reka's renderless `DialogRoot`, so anything a screen puts
 * on this component — an id, a test hook — would be dropped there. It belongs
 * on the panel people actually see, which is where `$attrs` goes instead.
 */
defineOptions({ inheritAttrs: false });

const pickCurrency = (event: Event) =>
  emit('update:code', (event.target as HTMLSelectElement).value);
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <!--
        The motion wraps the primitive rather than the other way round: reka
        hands its own directives to an `as-child` child, and a component root is
        not an element it can put them on.
      -->
      <Motion
        v-if="props.open"
        as-child
        :initial="fade.initial"
        :animate="fade.animate"
        :transition="fade.transition"
      >
        <DialogOverlay data-slot="quick-action-overlay" class="bg-ink/40 fixed inset-0 z-50" />
      </Motion>

      <Motion
        v-if="props.open"
        as-child
        :initial="sheetUp.initial"
        :animate="sheetUp.animate"
        :transition="sheetUp.transition"
      >
        <!--
          Capped in `dvh` rather than `vh`: the viewport unit that shrinks when
          the on-screen keyboard comes up is the only one that keeps the sheet
          inside what is left of the screen.
        -->
        <DialogContent
          v-bind="$attrs"
          data-slot="quick-action-sheet"
          :aria-describedby="props.description ? undefined : ''"
          :class="
            cn(
              'bg-surface-raised text-ink fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg',
              'flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl p-4',
              props.class,
            )
          "
        >
          <header class="flex items-start justify-between gap-3">
            <DialogTitle class="text-base font-medium">
              {{ props.title }}
            </DialogTitle>
            <button
              type="button"
              data-slot="quick-action-close"
              :aria-label="props.closeLabel"
              class="text-muted-foreground hover:bg-surface-sunken hover:text-ink focus-visible:outline-ring -mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full outline-offset-2 focus-visible:outline-2"
              @click="emit('update:open', false)"
            >
              <XIcon aria-hidden="true" class="size-5" />
            </button>
          </header>
          <DialogDescription v-if="props.description" class="text-muted-foreground -mt-2 text-sm">
            {{ props.description }}
          </DialogDescription>

          <!--
            The amount is the first thing and the largest, and the currency
            stands next to it: a number without its currency is not an amount,
            which is the one place this ledger cannot follow the reference.
          -->
          <div class="flex items-end gap-2">
            <label data-slot="quick-action-amount" class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="text-muted-foreground text-xs font-medium">{{ props.amountLabel }}</span>
              <MoneyInput
                :model-value="props.amount"
                :scale="props.scale"
                :locale="props.locale"
                class="h-14 rounded-none border-0 bg-transparent px-0 text-3xl focus-visible:ring-0"
                @update:model-value="emit('update:amount', $event)"
              />
            </label>
            <select
              data-slot="quick-action-currency"
              :aria-label="props.currencyLabel"
              :value="props.code"
              class="border-input bg-surface text-ink focus-visible:outline-ring h-11 shrink-0 rounded-lg border px-2 font-mono text-sm tracking-[0.08em] uppercase outline-offset-2 focus-visible:outline-2"
              @change="pickCurrency"
            >
              <option v-for="currency in props.currencies" :key="currency" :value="currency">
                {{ currency }}
              </option>
            </select>
          </div>

          <QuickAmountGrid
            :amounts="props.quickAmounts"
            :code="props.code"
            :scale="props.scale"
            :locale="props.locale"
            :aria-label="props.quickLabel"
            @pick="emit('update:amount', $event)"
          />

          <SegmentedControl
            v-if="props.types.length > 0"
            :model-value="props.type"
            :options="[...props.types]"
            :aria-label="props.typeLabel"
            @update:model-value="emit('update:type', $event)"
          />

          <div class="flex flex-col gap-2">
            <slot name="fields" />
          </div>

          <slot />

          <!--
            What else this sheet can raise, when the screen has more to offer
            than the one operation being written: quiet, and below the fields
            it is not part of.
          -->
          <div
            v-if="$slots.secondary"
            data-slot="quick-action-secondary"
            class="flex flex-col gap-2"
          >
            <slot name="secondary" />
          </div>

          <!--
            The button the sheet exists for cannot be the thing the keyboard
            covers, so it stays on the bottom edge instead of scrolling away
            with the fields, and it clears the home indicator.
          -->
          <div
            data-slot="quick-action-footer"
            class="bg-surface-raised sticky bottom-0 -mx-4 mt-auto px-4 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
          >
            <!-- The button the sheet exists for is a 48px target, never the 32px default. -->
            <Button
              data-slot="quick-action-confirm"
              size="lg"
              class="min-h-12 w-full"
              :disabled="props.confirmDisabled"
              @click="emit('confirm')"
            >
              {{ props.confirmLabel }}
            </Button>
          </div>
        </DialogContent>
      </Motion>
    </DialogPortal>
  </DialogRoot>
</template>
