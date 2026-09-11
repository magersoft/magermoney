<script lang="ts" setup>
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { resolveCurrencyIcon } from './resolve-icon';

const props = withDefaults(
  defineProps<{
    /** ISO 4217 code or crypto ticker, e.g. `USD`, `BTC`. */
    code: string;
    kind: 'fiat' | 'crypto';
    /** Explicit Iconify name, for currencies the resolver does not know. */
    icon?: string | null;
    /** Rendered size in px. Stays square. */
    size?: number;
  }>(),
  { icon: null, size: 24 },
);

const resolved = computed(() => resolveCurrencyIcon({ code: props.code, kind: props.kind, icon: props.icon }));

/**
 * Two letters have to stay legible inside a small circle, so the type scales
 * with the mark — but never below 10px, under which the fallback stops being
 * readable and the mark may as well be blank.
 */
const initialsStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(10, Math.round(props.size * 0.42))}px`,
}));
</script>

<template>
  <Icon
    v-if="resolved.kind === 'iconify'"
    :icon="resolved.name"
    :width="size"
    :height="size"
    role="img"
    :aria-label="code"
    class="shrink-0 rounded-full"
  />
  <span
    v-else
    role="img"
    :aria-label="code"
    :style="initialsStyle"
    class="bg-line text-ink inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden font-mono leading-none font-medium tracking-tight"
  >{{ resolved.text }}</span>
</template>
