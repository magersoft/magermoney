<script setup lang="ts">
/**
 * A field that looks like a row (reference slide 13): icon, label, the value it
 * currently holds, chevron. The reference's forms are built out of these
 * instead of bordered inputs, and the reason it works is that most of what a
 * money form asks for is a choice rather than something to type — an account, a
 * category, a date.
 *
 * It is a real control, not a styled line of text. Its accessible name is the
 * label and the value together, because «Продукты» three rows into a form is a
 * value nobody can place; an error is announced rather than only reddened; and
 * the whole row, 56px of it, is the target.
 *
 * It owns no picker. Pressing it asks the screen to open one, which is what
 * lets the same row stand in front of a sheet, a select and a calendar.
 */
import { useId } from 'vue';
import type { HTMLAttributes } from 'vue';
import { ChevronRightIcon } from '@lucide/vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{
    /** What the field is: «Категория». */
    label: string;
    /** What it holds now, as the screen formats it. */
    value?: string;
    /** Stands in for the value while there is none: «Выбрать». */
    placeholder?: string;
    /** What is wrong, in the screen's words. Announced, not only coloured. */
    error?: string;
    disabled?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  {
    value: undefined,
    placeholder: undefined,
    error: undefined,
    disabled: false,
    class: '',
  },
);

const emit = defineEmits<{ open: [] }>();

const id = useId();
const labelId = `${id}-label`;
const valueId = `${id}-value`;
const errorId = `${id}-error`;
</script>

<template>
  <button
    type="button"
    data-slot="field-row"
    :disabled="props.disabled"
    :data-empty="props.value ? 'false' : 'true'"
    :aria-labelledby="`${labelId} ${valueId}`"
    :aria-invalid="props.error ? 'true' : undefined"
    :aria-describedby="props.error ? errorId : undefined"
    :class="
      cn(
        'bg-surface text-ink flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
        'duration-fast ease-out-quart transition-colors outline-offset-[-2px]',
        'hover:bg-surface-sunken/60 focus-visible:outline-ring focus-visible:outline-2',
        'disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
        props.error && 'ring-negative ring-1',
        props.class,
      )
    "
    @click="emit('open')"
  >
    <span
      v-if="$slots.icon"
      data-slot="field-row-icon"
      aria-hidden="true"
      class="text-muted-foreground grid size-6 shrink-0 place-items-center"
    >
      <slot name="icon" />
    </span>

    <span class="flex min-w-0 flex-1 flex-col">
      <span :id="labelId" data-slot="field-row-label" class="text-muted-foreground text-xs">{{
        props.label
      }}</span>
      <span
        :id="valueId"
        data-slot="field-row-value"
        :class="
          cn('truncate text-sm font-medium', !props.value && 'text-muted-foreground font-normal')
        "
        >{{ props.value ?? props.placeholder }}</span
      >
      <!-- Red says something is wrong; only the words say what. -->
      <span
        v-if="props.error"
        :id="errorId"
        data-slot="field-row-error"
        class="text-negative text-xs"
        >{{ props.error }}</span
      >
    </span>

    <ChevronRightIcon
      data-slot="row-chevron"
      aria-hidden="true"
      class="text-muted-foreground pointer-events-none size-5 shrink-0"
    />
  </button>
</template>
