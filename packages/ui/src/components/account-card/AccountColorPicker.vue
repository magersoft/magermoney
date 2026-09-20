<script setup lang="ts">
/**
 * Picking an account's colour by leafing through it on the card itself.
 *
 * The control *is* the preview: you swipe across the card and the next colour
 * is already on it, because a swatch grid would make you imagine the result and
 * then check it. The card under the gesture is the real one, with the real
 * balance and the real furniture, so nothing is left to imagine.
 *
 * Three ways to reach every colour, because a swipe is the fastest of them and
 * the least available. The dots below are the interface, and they are a radio
 * group rather than a row of toggles: this is one choice out of seven, and a
 * set of buttons each announcing «pressed» would let a screen reader user
 * believe they could hold two colours at once. Being a radio group is also what
 * makes the arrow keys the expected way through, and it carries the whole set
 * on one tab stop instead of eight. The swipe is the shortcut, not the
 * interface.
 *
 * The drag follows the finger and springs back; under reduced motion it does
 * neither — the colour simply changes when the gesture ends, which is the part
 * that was ever the point.
 */
import { computed, nextTick, ref, useTemplateRef } from 'vue';
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import AccountCard from './AccountCard.vue';
import { currencyHue } from './currency-tint';
import { ACCOUNT_COLORWAYS, cardFillStyle, type AccountColorway } from './palette';
import type { AmountLocale } from '../amount-lockup/format-amount';
import type { AccountCardItem } from './types';

const props = withDefaults(
  defineProps<{
    /** The card as it will look. The colour on it is `modelValue`, not the account's stored one. */
    account: AccountCardItem;
    locale?: AmountLocale;
    /** How the whole control is announced. */
    label: string;
    /** Names the colours, one per colorway. The design system has no words of its own. */
    colorLabels: Record<string, string>;
    /** What the untouched card is called — the colour of what the account holds. */
    defaultLabel: string;
    /** Said once under the card, so the gesture is discoverable without being tried. */
    hint?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { locale: 'en', hint: undefined, class: '' },
);

const model = defineModel<AccountColorway | null>({ default: null });

/** The deck: the account's own colour first, then the paints. */
const CHOICES: readonly (AccountColorway | null)[] = [null, ...ACCOUNT_COLORWAYS];

const index = computed(() => {
  const found = CHOICES.indexOf(model.value);
  return found === -1 ? 0 : found;
});
const nameOf = (choice: AccountColorway | null): string =>
  choice === null ? props.defaultLabel : (props.colorLabels[choice] ?? choice);

const dots = useTemplateRef<HTMLButtonElement[]>('dots');

/**
 * Wraps, because a deck you leaf through has no last page.
 *
 * When the step came from the keyboard, focus follows the selection: in a radio
 * group the checked radio is the one tab stop, so leaving focus on the dot that
 * is no longer checked would strand the keyboard outside the group's own tab
 * order. A swipe passes `focus: false` — nothing was focused to move.
 */
function step(by: 1 | -1, { focus = false } = {}): void {
  const next = (index.value + by + CHOICES.length) % CHOICES.length;
  model.value = CHOICES[next] ?? null;
  if (focus) void nextTick(() => dots.value?.[next]?.focus());
}

/*
 * The gesture. Pointer events rather than touch ones, so a mouse drag and a
 * trackpad swipe work the same way the finger does, and `setPointerCapture`
 * keeps the gesture alive when it leaves the card — a swipe that dies halfway
 * across is worse than no swipe.
 */
const THRESHOLD = 48;
const dragging = ref(false);
const dx = ref(0);
const start = ref(0);

function onDown(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  dragging.value = true;
  start.value = event.clientX;
  dx.value = 0;
  /* Optional: capture is a convenience, and a runtime without it still swipes. */
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}
function onMove(event: PointerEvent): void {
  if (!dragging.value) return;
  dx.value = event.clientX - start.value;
}
function onUp(): void {
  if (!dragging.value) return;
  dragging.value = false;
  /*
   * Left means forward, the way pages turn: dragging the card off to the left
   * brings the next one in behind it.
   */
  if (dx.value <= -THRESHOLD) step(1);
  else if (dx.value >= THRESHOLD) step(-1);
  dx.value = 0;
}

/*
 * The card is dragged with a transform and nothing else — no layout property
 * moves, so the gesture stays on the compositor. `motion-reduce` drops both the
 * follow and the spring back in the class list below; the offset here is only
 * ever applied while a pointer is down.
 */
const offset = computed(() => (dragging.value ? `translateX(${dx.value}px)` : undefined));
</script>

<template>
  <!--
    No role of its own: the radio group below carries the name, and a `group`
    wrapping it under the same label would only make a screen reader say it
    twice on the way in.
  -->
  <div :class="cn('flex flex-col gap-3', props.class)" data-slot="account-color-picker">
    <!--
      The gesture surface. It is not focusable and carries no role: everything
      it does, the dots below do in a way a keyboard and a screen reader can
      reach, so making it a fourth control would only add a stop that announces
      nothing new.
    -->
    <div
      class="touch-pan-y select-none"
      data-testid="colorway-swipe"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <AccountCard
        as="div"
        data-testid="colorway-preview"
        :account="{ ...props.account, colorway: model }"
        :locale="props.locale"
        :style="offset ? { transform: offset } : undefined"
        :class="
          cn(
            'pointer-events-none',
            dragging
              ? 'transition-none'
              : 'duration-base ease-out-quart transition-transform motion-reduce:transition-none',
          )
        "
      />
    </div>

    <p v-if="props.hint" class="text-muted-foreground text-xs">
      {{ props.hint }}
    </p>

    <!--
      One dot per colour, each painted in the colour it sets, so the row is a
      legend as well as a control. The dot that is on is ringed rather than
      merely larger: a size difference is not a state a colour-blind eye can
      read, and `aria-checked` carries it for everyone else.

      Roving tabindex, as a radio group takes: the checked dot is the tab stop
      and the arrows move within the group, so Tab leaves the colours rather
      than walking through eight of them.
    -->
    <div
      role="radiogroup"
      :aria-label="props.label"
      class="flex flex-wrap items-center gap-2"
      @keydown.left.prevent="step(-1, { focus: true })"
      @keydown.up.prevent="step(-1, { focus: true })"
      @keydown.right.prevent="step(1, { focus: true })"
      @keydown.down.prevent="step(1, { focus: true })"
    >
      <button
        v-for="choice in CHOICES"
        :key="choice ?? 'default'"
        ref="dots"
        type="button"
        role="radio"
        :data-testid="`colorway-${choice ?? 'default'}`"
        :aria-checked="choice === model"
        :tabindex="choice === model ? 0 : -1"
        :aria-label="nameOf(choice)"
        :title="nameOf(choice)"
        :style="cardFillStyle(currencyHue(props.account.code), choice)"
        :class="
          cn(
            'bg-card-fill border-card-edge ring-offset-background size-8 rounded-full border',
            'outline-offset-2 focus-visible:outline-ring focus-visible:outline-2',
            'pointer-coarse:size-11',
            choice === model ? 'ring-ink ring-2 ring-offset-2' : '',
          )
        "
        @click="model = choice"
      />
    </div>
  </div>
</template>
