<script setup lang="ts">
/**
 * A choice in the shape of a row (reference slide 13), over a native
 * `<select>`. The reference draws a row that opens its own sheet; on a phone
 * the platform's own picker beats any sheet we could build, and it is the
 * control a test and an e2e run can actually drive.
 *
 * So the row is the look and the select is the control: one element, labelled,
 * 56px tall, with its error announced rather than only reddened.
 */
import { useId } from 'vue';
import type { HTMLAttributes } from 'vue';
import { ChevronDownIcon } from '@lucide/vue';
import { cn } from '../../lib/utils';

export interface SelectRowOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string;
    options: readonly SelectRowOption[];
    /** Stands in front of the list while nothing is chosen: «Выбрать». */
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  { placeholder: undefined, error: undefined, disabled: false, class: '' },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const id = useId();
const selectId = `${id}-select`;
const errorId = `${id}-error`;
</script>

<template>
  <div
    data-slot="select-row"
    :data-invalid="props.error ? 'true' : undefined"
    :class="
      cn(
        'bg-surface-sunken text-ink relative flex min-h-14 w-full flex-col justify-center gap-0.5 rounded-lg px-3 py-2',
        'focus-within:outline-ring outline-offset-[-2px] focus-within:outline-2',
        props.disabled && 'pointer-events-none opacity-50',
        props.error && 'ring-negative ring-1',
        props.class,
      )
    "
  >
    <label :for="selectId" data-slot="field-row-label" class="text-muted-foreground text-xs">{{
      props.label
    }}</label>
    <select
      :id="selectId"
      data-slot="select-row-select"
      :value="props.modelValue"
      :disabled="props.disabled"
      :aria-invalid="props.error ? 'true' : undefined"
      :aria-describedby="props.error ? errorId : undefined"
      class="text-ink w-full appearance-none border-0 bg-transparent p-0 pr-6 text-sm font-medium outline-none"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="props.placeholder" value="" disabled>
        {{ props.placeholder }}
      </option>
      <option v-for="option in props.options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <ChevronDownIcon
      aria-hidden="true"
      class="text-muted-foreground pointer-events-none absolute right-3 size-4"
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
