<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { Icon, iconLoaded } from '@iconify/vue';
import { countryFlagsReady, loadCountryFlags } from '../../icons/country-flags';
import { resolveCurrencyIcon } from './resolve-icon';

const props = withDefaults(
  defineProps<{
    /** ISO 4217 code or crypto ticker, e.g. `USD`, `BTC`. */
    code: string;
    kind: 'fiat' | 'crypto';
    /** Explicit Iconify name, for currencies the resolver does not know. */
    icon?: string | null;
    /** ISO 3166-1 alpha-2 country the account is held in. Outranks the currency. */
    country?: string | null;
    /** Rendered size in px. Stays square. */
    size?: number;
  }>(),
  { icon: null, country: null, size: 24 },
);

/*
 * Only a country can name a flag we have not registered yet, so only a country
 * sends for the chunk — and it does so from the component rather than from the
 * screens, which would each have to remember to.
 */
const wantsCountryFlag = computed(() => props.kind === 'fiat' && !props.icon && !!props.country);
onMounted(() => {
  watch(wantsCountryFlag, (wants) => wants && void loadCountryFlags(), { immediate: true });
});

/**
 * What to draw, and what to draw until the country's flag is here. Asking
 * Iconify for an unregistered name would send it to the Iconify API — a
 * request over the network, from an app that is meant to work without one — so
 * an unavailable flag is stepped back to the currency's, which is always
 * registered, and redraws when `countryFlagsReady` flips.
 */
const resolved = computed(() => {
  const withoutCountry = { code: props.code, kind: props.kind, icon: props.icon };
  const wanted = resolveCurrencyIcon({ ...withoutCountry, country: props.country });
  if (!wantsCountryFlag.value) return wanted;
  /* `iconLoaded` is a lookup, not a signal; the ready flag is what re-runs this. */
  void countryFlagsReady.value;
  const available = wanted.kind === 'iconify' && iconLoaded(wanted.name);
  return available ? wanted : resolveCurrencyIcon(withoutCountry);
});

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
    aria-hidden="false"
    class="shrink-0 rounded-full"
  />
  <span
    v-else
    role="img"
    :aria-label="code"
    :style="initialsStyle"
    class="bg-line text-ink inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden font-mono leading-none font-medium tracking-tight"
    >{{ resolved.text }}</span
  >
</template>
