<script setup lang="ts">
/**
 * The days of a month something happens on: 31 toggles in a week-wide grid.
 * Two shapes of one control: several days (a pay schedule) or exactly one or
 * none (a billing day). What the multiple mode emits is always sorted and
 * unique, so the caller can send it as is.
 */
import { computed } from 'vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{
    modelValue: number[] | number | null;
    multiple?: boolean;
    ariaLabel?: string;
    class?: string;
  }>(),
  { multiple: true, ariaLabel: undefined, class: '' },
);
const emit = defineEmits<{ 'update:modelValue': [value: number[] | number | null] }>();

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const chosen = computed(
  () =>
    new Set(
      Array.isArray(props.modelValue)
        ? props.modelValue
        : props.modelValue === null
          ? []
          : [props.modelValue],
    ),
);

function toggle(day: number) {
  if (!props.multiple) {
    emit('update:modelValue', chosen.value.has(day) ? null : day);
    return;
  }
  const next = new Set(chosen.value);
  if (next.has(day)) next.delete(day);
  else next.add(day);
  emit(
    'update:modelValue',
    [...next].sort((a, b) => a - b),
  );
}
</script>

<template>
  <div
    role="group"
    :aria-label="ariaLabel"
    data-slot="day-of-month-picker"
    :class="cn('grid grid-cols-7 gap-1', props.class)"
  >
    <button
      v-for="day in DAYS"
      :key="day"
      type="button"
      :aria-pressed="chosen.has(day) ? 'true' : 'false'"
      :data-testid="`day-${day}`"
      class="flex min-h-9 items-center justify-center rounded-lg font-mono text-sm tabular-nums select-none outline-offset-2 transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      :class="
        chosen.has(day)
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      "
      @click="toggle(day)"
    >
      {{ day }}
    </button>
  </div>
</template>
