<script setup lang="ts">
/**
 * The other half of the reference's form row (slide 13). `FieldRow` stands in
 * front of a picker; this one holds what has to be typed — a name, a note, a
 * date — in the same 56px shape, so a form made of both reads as one list
 * rather than as rows with bordered fields wedged between them.
 *
 * The label is a real `<label>` tied to the input, not a caption above it: the
 * pair is what a screen reader announces, and the whole row is the target that
 * focuses the field.
 *
 * An error is announced, never only reddened.
 */
import { useId } from 'vue';
import type { HTMLAttributes, InputHTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{
    /** What the field is: «Название». */
    label: string;
    modelValue: string;
    type?: InputHTMLAttributes['type'];
    placeholder?: string;
    /** What is wrong, in the screen's words. */
    error?: string;
    disabled?: boolean;
    /** A `<datalist>` id, for a field that suggests without restricting. */
    list?: string;
    inputmode?: InputHTMLAttributes['inputmode'];
    maxlength?: number | string;
    min?: string;
    max?: string;
    class?: HTMLAttributes['class'];
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    error: undefined,
    disabled: false,
    list: undefined,
    inputmode: undefined,
    maxlength: undefined,
    min: undefined,
    max: undefined,
    class: '',
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const id = useId();
const inputId = `${id}-input`;
const errorId = `${id}-error`;
</script>

<template>
  <div
    data-slot="input-row"
    :data-invalid="props.error ? 'true' : undefined"
    :class="
      cn(
        'bg-surface-sunken text-ink flex min-h-14 w-full flex-col justify-center gap-0.5 rounded-lg px-3 py-2',
        'focus-within:outline-ring outline-offset-[-2px] focus-within:outline-2',
        props.disabled && 'pointer-events-none opacity-50',
        props.error && 'ring-negative ring-1',
        props.class,
      )
    "
  >
    <label :for="inputId" data-slot="field-row-label" class="text-muted-foreground text-xs">{{
      props.label
    }}</label>
    <input
      :id="inputId"
      data-slot="input-row-input"
      :type="props.type"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :list="props.list"
      :inputmode="props.inputmode"
      :maxlength="props.maxlength"
      :min="props.min"
      :max="props.max"
      :aria-invalid="props.error ? 'true' : undefined"
      :aria-describedby="props.error ? errorId : undefined"
      class="text-ink placeholder:text-muted-foreground w-full border-0 bg-transparent p-0 text-sm font-medium outline-none"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <!-- Red says something is wrong; only the words say what. -->
    <span
      v-if="props.error"
      :id="errorId"
      data-slot="field-row-error"
      class="text-negative text-xs"
    >
      {{ props.error }}
    </span>
  </div>
</template>
