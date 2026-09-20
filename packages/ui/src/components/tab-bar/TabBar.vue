<script setup lang="ts">
/**
 * The tabs inside a screen (reference slide 14). Where `SegmentedControl` is a
 * radio group — one control, several values of one setting — these are tabs:
 * each one opens a different panel of the same screen, and the panel is named
 * by the tab that opened it. That difference is the whole reason both exist.
 *
 * The strip is the reference's: text on the baseline, the open tab underlined
 * in the accent rather than boxed. Weight and the rule carry the state together,
 * so it survives greyscale — and the underline is the same 2px rule that marks
 * focus, which is why the focus ring sits outside the tab, not on it.
 *
 * Selection follows focus: the panels here are views of one screen, already
 * loaded, so an arrow key that moved focus without opening anything would only
 * ask for a second keystroke.
 *
 * More tabs than fit is the normal case on a phone: the strip scrolls and never
 * widens its parent.
 */
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import type { TabItem } from './types';

const props = withDefaults(
  defineProps<{
    /** The tab that is open. */
    modelValue: string;
    tabs: readonly TabItem[];
    /** The id of the panel the tabs control. Without it they control nothing. */
    panelId: string;
    ariaLabel?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { ariaLabel: undefined, class: '' },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function open(value: string) {
  if (value !== props.modelValue) emit('update:modelValue', value);
}

function onKeydown(e: KeyboardEvent, index: number) {
  const count = props.tabs.length;
  const step = STEP[e.key];
  let nextIndex: number | undefined;
  if (step !== undefined) nextIndex = (index + step + count) % count;
  else if (e.key === 'Home') nextIndex = 0;
  else if (e.key === 'End') nextIndex = count - 1;
  if (nextIndex === undefined) return;
  e.preventDefault();
  const next = props.tabs[nextIndex];
  if (!next) return;
  open(next.value);
  const strip = (e.currentTarget as HTMLElement).parentElement;
  (strip?.children[nextIndex] as HTMLElement | undefined)?.focus();
}
</script>

<template>
  <div
    role="tablist"
    data-slot="tab-bar"
    :aria-label="props.ariaLabel"
    :class="
      cn(
        'border-border/60 flex items-stretch gap-1 overflow-x-auto border-b [scrollbar-width:none]',
        props.class,
      )
    "
  >
    <button
      v-for="(tab, index) in props.tabs"
      :id="`tab-${tab.value}`"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="tab.value === props.modelValue ? 'true' : 'false'"
      :aria-controls="props.panelId"
      :tabindex="tab.value === props.modelValue ? 0 : -1"
      :data-value="tab.value"
      :data-testid="`tab-${tab.value}`"
      :class="
        cn(
          'relative min-h-11 shrink-0 px-3 pb-2.5 text-sm font-medium whitespace-nowrap select-none',
          'duration-fast ease-out-quart transition-colors motion-reduce:transition-none',
          'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
          /*
           * The rule is drawn on the tab and sits on the strip's own border, so
           * the open tab covers the line it is part of rather than adding a
           * second one under it.
           */
          'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
          tab.value === props.modelValue
            ? 'text-ink after:bg-primary'
            : 'text-muted-foreground hover:text-ink after:bg-transparent',
        )
      "
      @click="open(tab.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
