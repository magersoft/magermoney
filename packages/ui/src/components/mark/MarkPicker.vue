<script setup lang="ts">
/**
 * Choosing what a goal or an asset is marked with: an emoji and a colour.
 *
 * Two radio groups, not rows of toggles — one emoji and one colour at a time,
 * announced as «checked» and walked with the arrow keys from a single tab stop
 * each, the pattern the profile disc and the card colour already use. The first
 * choice in each is the one with nothing picked (the first letter of the name,
 * the plain surface), so going back is a choice like any other rather than a
 * hidden «reset».
 *
 * It owns no words: every label comes in through `labels`, since the design
 * system has no locale of its own.
 */
import { computed, nextTick, useId } from 'vue';
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import { ACCOUNT_COLORWAYS, cardFillStyle } from '../account-card/palette';

export interface MarkPickerLabels {
  /** The emoji group's legend. */
  emoji: string;
  /** The colour group's legend. */
  color: string;
  /** How the «first letter» choice is announced. */
  initial: string;
  /** How the «no colour» choice is announced. */
  none: string;
  /** One name per palette colour. */
  colors: Record<string, string>;
}

const props = withDefaults(
  defineProps<{
    /** The emoji the grid deals, in order. */
    emojis: readonly string[];
    /** The name the «first letter» choice previews. */
    name: string;
    labels: MarkPickerLabels;
    class?: HTMLAttributes['class'];
  }>(),
  { class: '' },
);

const emoji = defineModel<string | null>('emoji', { default: null });
const color = defineModel<string | null>('color', { default: null });

/*
 * A stored emoji the grid no longer deals still shows up, checked, after the
 * initial — otherwise nothing in the group would be checked and the person
 * could not see what they have.
 */
const emojiChoices = computed<(string | null)[]>(() => {
  const stored = emoji.value;
  return stored && !props.emojis.includes(stored)
    ? [null, stored, ...props.emojis]
    : [null, ...props.emojis];
});
const colorChoices: (string | null)[] = [null, ...ACCOUNT_COLORWAYS];

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const initial = computed(() => {
  const first = graphemes.segment(props.name.trim())[Symbol.iterator]().next();
  return first.done ? '' : first.value.segment.toUpperCase();
});

function pickEmoji(next: string | null): void {
  if (next !== emoji.value) emoji.value = next;
}
function pickColor(next: string | null): void {
  if (next !== color.value) color.value = next;
}

/**
 * All four arrows step through the list in reading order, wrapping; Home and
 * End jump to the ends. Focus follows the selection, found among the group's
 * own radios by position rather than through a `v-for` ref, whose array Vue
 * does not promise to keep in order.
 */
function onKey(
  event: KeyboardEvent,
  choices: readonly (string | null)[],
  current: string | null,
  pick: (value: string | null) => void,
): void {
  const group = event.currentTarget as HTMLElement;
  const at = Math.max(0, choices.indexOf(current));
  const last = choices.length - 1;
  const target =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? at === last
        ? 0
        : at + 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? at === 0
          ? last
          : at - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined;
  if (target === undefined) return;
  event.preventDefault();
  pick(choices[target] ?? null);
  void nextTick(() => group.querySelectorAll<HTMLElement>('[role="radio"]')[target]?.focus());
}

const LEGEND = 'text-muted-foreground mb-2 text-xs font-medium';
const CHOICE = [
  'grid place-items-center rounded-full outline-offset-2',
  'focus-visible:outline-ring focus-visible:outline-2',
  'duration-fast ease-out-quart transition-shadow motion-reduce:transition-none',
];
const CHECKED = 'ring-ink ring-offset-background ring-2 ring-offset-2';
/* Each picker's legends need ids of their own; two forms may be mounted at once in a test. */
const uid = `mark-${useId()}`;
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)" data-slot="mark-picker">
    <div>
      <p :id="`${uid}-emoji`" :class="LEGEND">
        {{ props.labels.emoji }}
      </p>
      <div
        role="radiogroup"
        :aria-labelledby="`${uid}-emoji`"
        class="grid grid-cols-6 gap-2 sm:grid-cols-9"
        data-testid="mark-emoji"
        @keydown="(e: KeyboardEvent) => onKey(e, emojiChoices, emoji, pickEmoji)"
      >
        <button
          v-for="choice in emojiChoices"
          :key="choice ?? 'initial'"
          type="button"
          role="radio"
          :data-testid="`mark-emoji-${choice ?? 'initial'}`"
          :aria-checked="choice === emoji"
          :tabindex="choice === emoji ? 0 : -1"
          :aria-label="choice === null ? props.labels.initial : undefined"
          :class="
            cn(
              CHOICE,
              'bg-surface-sunken text-ink aspect-square w-full text-2xl',
              choice === emoji && CHECKED,
            )
          "
          @click="pickEmoji(choice)"
        >
          <span v-if="choice === null" class="text-base font-medium" aria-hidden="true">{{
            initial || '–'
          }}</span>
          <template v-else>
            {{ choice }}
          </template>
        </button>
      </div>
    </div>

    <div>
      <p :id="`${uid}-color`" :class="LEGEND">
        {{ props.labels.color }}
      </p>
      <!--
        Each dot is painted in the colour it sets, so the row is its own
        legend; the ring, not a size change, marks the one that is on — a size
        difference is not a state a colour-blind eye can read.
      -->
      <div
        role="radiogroup"
        :aria-labelledby="`${uid}-color`"
        class="flex flex-wrap items-center gap-3"
        data-testid="mark-color"
        @keydown="(e: KeyboardEvent) => onKey(e, colorChoices, color, pickColor)"
      >
        <button
          v-for="choice in colorChoices"
          :key="choice ?? 'none'"
          type="button"
          role="radio"
          :data-testid="`mark-color-${choice ?? 'none'}`"
          :aria-checked="choice === color"
          :tabindex="choice === color ? 0 : -1"
          :aria-label="choice ? (props.labels.colors[choice] ?? choice) : props.labels.none"
          :title="choice ? (props.labels.colors[choice] ?? choice) : props.labels.none"
          :style="choice ? cardFillStyle(0, choice) : undefined"
          :class="
            cn(
              CHOICE,
              'size-9 pointer-coarse:size-11',
              choice ? 'bg-card-fill' : 'border-line-strong bg-surface border',
              choice === color && CHECKED,
            )
          "
          @click="pickColor(choice)"
        />
      </div>
    </div>
  </div>
</template>
