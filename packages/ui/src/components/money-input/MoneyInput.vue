<script setup lang="ts">
/**
 * An amount field. Shows the number the way the locale writes it, emits the
 * exact decimal string, and never lets a float in between. Invalid text stays
 * in the field, marked invalid, and the last good value stays emitted — so a
 * half-typed number never becomes a wrong balance.
 */
import { ref, watch } from 'vue';
import { cn } from '../../lib/utils';
import { formatAmountInput, parseAmountInput } from './parse';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    scale: number;
    locale: 'ru' | 'en';
    allowNegative?: boolean;
    class?: string;
  }>(),
  { allowNegative: false, class: '' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const text = ref(formatAmountInput(props.modelValue, props.locale));
const invalid = ref(false);

watch(
  () => props.modelValue,
  (v) => {
    if (parseAmountInput(text.value, props.scale, props.allowNegative) !== v) {
      text.value = formatAmountInput(v, props.locale);
      invalid.value = false;
    }
  },
);

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  text.value = raw;
  const parsed = parseAmountInput(raw, props.scale, props.allowNegative);
  invalid.value = parsed === null;
  if (parsed !== null) emit('update:modelValue', parsed);
}

function onBlur() {
  if (!invalid.value) text.value = formatAmountInput(props.modelValue, props.locale);
}
</script>

<template>
  <input
    :value="text"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    :aria-invalid="invalid ? 'true' : undefined"
    data-slot="money-input"
    :class="
      cn(
        'h-12 w-full rounded-lg border border-border bg-background px-3 font-mono text-2xl tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        props.class,
      )
    "
    @input="onInput"
    @blur="onBlur"
  />
</template>
