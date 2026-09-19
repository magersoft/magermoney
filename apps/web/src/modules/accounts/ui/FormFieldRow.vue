<script setup lang="ts">
/**
 * A form field with the shape of `FieldRow`: the surface, the 56px height, the
 * label above the value it holds.
 *
 * `FieldRow` itself cannot serve here. It is a button that asks the screen to
 * open a picker, and half of what an account is — its name, its bank, a note —
 * has to be typed. So this is the same shape around a real control instead: a
 * `<label>` wrapping whatever the field puts in its slot, which means the whole
 * row is the target and the label names the control without an id to keep in
 * sync.
 *
 * The focus ring belongs to the row rather than to the input inside it, because
 * a 40px ring drawn inside a 56px row reads as a second, smaller field.
 */
import type { HTMLAttributes } from 'vue';
import { cn } from '@magermoney/ui';

const props = withDefaults(
  defineProps<{
    /** What the field is: «Название». */
    label: string;
    /** A word under the value: what is locked, what the unit is. */
    hint?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { hint: undefined, class: '' },
);
</script>

<template>
  <label
    data-slot="form-field-row"
    :class="
      cn(
        'flex min-h-14 w-full items-center gap-3 rounded-lg bg-surface px-3 py-2 text-ink',
        'outline-offset-[-2px] focus-within:outline-2 focus-within:outline-ring',
        props.class,
      )
    "
  >
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-xs text-muted-foreground">{{ props.label }}</span>
      <slot />
      <span v-if="props.hint" class="text-xs text-muted-foreground">{{ props.hint }}</span>
    </span>
    <slot name="trailing" />
  </label>
</template>
