<script setup lang="ts">
/**
 * A category, as a chip you can pick (reference slide 16). Chosen, it fills
 * with the brand blue; unchosen, it sits on the sunken surface — the same pair
 * the palette declares, so the chip never invents a colour of its own.
 *
 * It is a toggle button, so the keyboard reaches it and Enter and Space work
 * without a line of code here, and the state is in `aria-pressed`: the fill
 * alone says nothing to a screen reader, and nothing to anyone who cannot tell
 * blue from beige.
 *
 * Whether picking one category excludes the others is the screen's business.
 * The chip owns no state; it asks for the opposite of what it was given.
 */
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{
    label: string;
    /** The category's own emoji. Decoration: the name is what is announced. */
    emoji?: string;
    selected?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  { emoji: undefined, selected: false, class: '' },
);

const emit = defineEmits<{ 'update:selected': [selected: boolean] }>();
</script>

<template>
  <button
    type="button"
    data-slot="category-chip"
    :aria-pressed="props.selected ? 'true' : 'false'"
    :class="
      cn(
        'inline-flex max-w-full min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5',
        'duration-fast ease-out-quart text-sm font-medium transition-colors',
        'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
        'pointer-coarse:min-h-11',
        props.selected
          ? 'bg-accent-fill text-primary-foreground'
          : 'bg-surface-sunken text-ink hover:bg-surface-sunken/70',
        props.class,
      )
    "
    @click="emit('update:selected', !props.selected)"
  >
    <span v-if="props.emoji" data-slot="category-chip-emoji" aria-hidden="true" class="text-base">
      {{ props.emoji }}
    </span>
    <span class="min-w-0 truncate">{{ props.label }}</span>
  </button>
</template>
