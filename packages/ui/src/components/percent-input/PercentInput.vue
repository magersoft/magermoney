<script setup lang="ts">
/**
 * A rate typed as a percentage and emitted as a fraction ("15" → "0.15").
 * Invalid text stays in the field, marked invalid, and the last good value
 * stays emitted — the same contract as `MoneyInput`.
 */
import { ref, watch } from 'vue';
import { cn } from '../../lib/utils';
import { fractionToPercent, percentToFraction } from './percent';

const props = withDefaults(
  defineProps<{ modelValue: string; locale: 'ru' | 'en'; class?: string }>(),
  { class: '' },
);
const emit = defineEmits<{ 'update:modelValue': [fraction: string] }>();

const show = (fraction: string) =>
  props.locale === 'ru'
    ? fractionToPercent(fraction).replace('.', ',')
    : fractionToPercent(fraction);

const text = ref(show(props.modelValue));
const invalid = ref(false);

watch(
  () => props.modelValue,
  (v) => {
    if (percentToFraction(text.value) !== v) {
      text.value = show(v);
      invalid.value = false;
    }
  },
);

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  text.value = raw;
  const parsed = percentToFraction(raw);
  invalid.value = parsed === null;
  if (parsed !== null) emit('update:modelValue', parsed);
}

function onBlur() {
  if (!invalid.value) text.value = show(props.modelValue);
}
</script>

<template>
  <span :class="cn('relative block', props.class)">
    <input
      :value="text"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      :aria-invalid="invalid ? 'true' : undefined"
      data-slot="percent-input"
      class="h-11 w-full rounded-lg border border-border bg-background pl-3 pr-8 font-mono text-base tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
      @input="onInput"
      @blur="onBlur"
    />
    <span
      class="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-sm text-muted-foreground"
      aria-hidden="true"
      >%</span
    >
  </span>
</template>
