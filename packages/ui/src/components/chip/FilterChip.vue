<script setup lang="ts">
/**
 * One filter that is on, with the × that takes it off (reference slides 12, 14).
 * The chip is the only place a filter is both visible and reversible, so the
 * remove control is a real button with a name of its own — a screen reader
 * hears «Снять фильтр: Апрель», not «кнопка».
 *
 * The pill stays compact: a row of 44px pills would push the data it filters
 * off the screen. The touch target is the icon's reach instead — 24px of glyph
 * plus 10px on every side is exactly 44 — so the thumb gets its target and the
 * row keeps its height.
 */
import type { HTMLAttributes } from 'vue';
import { XIcon } from '@lucide/vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{
    /** The value, as the user set it. */
    label: string;
    /** The accessible name of the remove control. Written by the screen. */
    removeLabel: string;
    class?: HTMLAttributes['class'];
  }>(),
  { class: '' },
);

const emit = defineEmits<{ remove: [] }>();
</script>

<template>
  <span
    data-slot="filter-chip"
    :class="
      cn(
        'bg-surface-sunken text-ink inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3',
        'max-w-full text-sm font-medium',
        props.class,
      )
    "
  >
    <span class="min-w-0 truncate">{{ props.label }}</span>
    <button
      type="button"
      data-slot="filter-chip-remove"
      :aria-label="props.removeLabel"
      class="text-muted-foreground duration-fast hover:text-ink focus-visible:outline-ring relative grid size-6 shrink-0 place-items-center rounded-full transition-colors outline-offset-2 after:absolute after:-inset-2.5 after:content-[''] focus-visible:outline-2"
      @click="emit('remove')"
    >
      <XIcon aria-hidden="true" class="size-3.5" />
    </button>
  </span>
</template>
