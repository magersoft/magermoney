<script setup lang="ts">
/**
 * One country's flag, by alpha-2 code.
 *
 * The flags live in their own chunk (`icons/country-flags.ts`), so the mark
 * asks for them itself and holds a blank disc of the same size until they
 * land — the list must not reflow under a finger already moving toward a row.
 */
import { computed, onMounted } from 'vue';
import { Icon, iconLoaded } from '@iconify/vue';
import { countryFlagsReady, loadCountryFlags } from '../../icons/country-flags';

const props = withDefaults(defineProps<{ code: string; size?: number }>(), { size: 20 });

onMounted(() => void loadCountryFlags());

const name = computed(() => `circle-flags:${props.code.toLowerCase()}`);
const drawable = computed(() => {
  /* `iconLoaded` is a lookup, not a signal; the ready flag is what re-runs this. */
  void countryFlagsReady.value;
  return iconLoaded(name.value);
});
</script>

<template>
  <Icon
    v-if="drawable"
    :icon="name"
    :width="props.size"
    :height="props.size"
    aria-hidden="true"
    class="shrink-0 rounded-full"
  />
  <span
    v-else
    aria-hidden="true"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    class="bg-line inline-block shrink-0 rounded-full"
  />
</template>
