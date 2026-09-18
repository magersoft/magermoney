<script setup lang="ts">
/**
 * Two to four mutually exclusive views of one screen. A radio group, not tabs:
 * the caller decides what the choice shows, and the control promises only that
 * exactly one segment is chosen and that the arrow keys move between them.
 */
import { cn } from '../../lib/utils';
import type { SegmentedOption } from './types';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SegmentedOption[];
    ariaLabel?: string;
    class?: string;
  }>(),
  { ariaLabel: undefined, class: '' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function onKeydown(e: KeyboardEvent, index: number) {
  const step = STEP[e.key];
  if (!step) return;
  e.preventDefault();
  const count = props.options.length;
  const nextIndex = (index + step + count) % count;
  const next = props.options[nextIndex];
  if (!next) return;
  emit('update:modelValue', next.value);
  // Focus follows selection, as in a native radio group.
  const group = (e.currentTarget as HTMLElement).parentElement;
  (group?.children[nextIndex] as HTMLElement | undefined)?.focus();
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="ariaLabel"
    data-slot="segmented-control"
    :class="cn('flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5', props.class)"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue ? 'true' : 'false'"
      :tabindex="option.value === modelValue ? 0 : -1"
      :data-value="option.value"
      :data-testid="`segment-${option.value}`"
      class="min-h-9 min-w-0 flex-1 truncate rounded-lg px-3 py-1 text-sm select-none outline-offset-2 transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      :class="
        option.value === modelValue
          ? 'bg-surface-raised text-foreground ring-1 ring-foreground/10'
          : 'text-muted-foreground hover:text-foreground'
      "
      @click="emit('update:modelValue', option.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
