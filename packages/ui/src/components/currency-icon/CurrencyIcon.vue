<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { Icon, iconLoaded } from '@iconify/vue';
import { countryFlagsReady, loadCountryFlags } from '../../icons/country-flags';
import { EAGER_FLAGS, fiatFlag, resolveCurrencyIcon } from './resolve-icon';

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
 * A flag that is not in the eagerly-registered subset lives in the lazy country
 * chunk, so the component sends for it itself rather than leaving every screen
 * to remember. Two cases reach it: an account held in a named country, and any
 * fiat currency outside the two dozen the entry bundle carries — which is most
 * of the catalogue, and so most of the currency picker.
 */
const wantsCountryFlag = computed(() => {
  if (props.kind !== 'fiat' || props.icon) return false;
  const flag = props.country ? props.country.toLowerCase() : fiatFlag(props.code);
  return !!flag && !EAGER_FLAGS.has(flag);
});
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
  if (available) return wanted;
  /*
   * Until the chunk lands, step back to whatever is registered already — the
   * currency's own flag for an account abroad, initials for a currency whose
   * flag is in that chunk too. Never the unregistered name: Iconify would go to
   * its API for it, over a network this app is built to do without.
   */
  const fallback = resolveCurrencyIcon(withoutCountry);
  return fallback.kind === 'iconify' && iconLoaded(fallback.name)
    ? fallback
    : { kind: 'initials' as const, text: props.code.slice(0, 2).toUpperCase() };
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
