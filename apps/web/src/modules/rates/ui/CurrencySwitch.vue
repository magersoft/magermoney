<script setup lang="ts">
/**
 * Which currency the app shows amounts in. A segmented control rather than a
 * select: there are two to four options, they are the point of the app, and one
 * tap is the whole interaction.
 *
 * The indicator is a single element that moves between segments, so the change
 * reads as the same thing relocating rather than two things blinking.
 *
 * The segment is 36px under a mouse, where the header would otherwise grow for
 * no one, and 44px under a finger. `pointer-coarse:` rather than the design
 * system's base-layer rule for touch targets: a `min-h-*` utility sits in the
 * `utilities` layer and would win against `base` on the same property.
 *
 * The arrows at the end open the rates screen — it lost its tab in phase 3, and
 * this is where a person wonders what rate they are looking at. The settings
 * screen switches them off: the rates row sits a few lines below the switch
 * there, and two ways into the same screen within one glance is one too many.
 *
 * Two currencies is the common case and both codes fit on a 375px phone. Three
 * or four do not, so below `sm:` the codes drop to the screen reader and each
 * currency's own mark identifies its segment — except the selected one, which
 * keeps its code at every width. Three flags in a row say which currencies
 * there are and nothing about which one is on; the word is what answers that,
 * and answering it is the whole job of the control.
 */
import { useI18n } from 'vue-i18n';
import { CurrencyIcon, EASE_OUT_QUART } from '@magermoney/ui';
import { Motion } from 'motion-v';
import { computed } from 'vue';
import { useCurrencies } from '@/modules/currencies';
import { useDisplayCurrency } from '../application/use-display-currency';

/* The default sits at the declaration: an absent Boolean prop arrives as `false`. */
const { ratesLink = true } = defineProps<{ ratesLink?: boolean }>();

const { t } = useI18n();
const currencies = useCurrencies();
const { current, options, set } = useDisplayCurrency();

const kindOf = computed(
  () => (code: string) => currencies.value.find((c) => c.code === code)?.kind ?? ('fiat' as const),
);
</script>

<template>
  <div
    v-if="options.length > 1"
    data-testid="currency-switch"
    role="group"
    :aria-label="t('a11y.displayCurrency')"
    class="flex items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5"
  >
    <button
      v-for="code in options"
      :key="code"
      type="button"
      :aria-pressed="code === current"
      :title="t('a11y.showIn', { code })"
      data-slot="button"
      class="relative flex min-h-9 items-center gap-1.5 pointer-coarse:min-h-11 rounded-lg px-2 py-1 text-xs outline-offset-2 transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring"
      :class="code === current ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
      @click="set(code)"
    >
      <Motion
        v-if="code === current"
        layout-id="currency-switch-indicator"
        class="absolute inset-0 -z-10 rounded-lg bg-surface-raised shadow-card ring-1 ring-card-edge"
        :transition="{ duration: 0.18, ease: EASE_OUT_QUART }"
      />
      <CurrencyIcon :code="code" :kind="kindOf(code)" :size="16" />
      <span
        class="font-mono uppercase tracking-[0.08em]"
        :class="[
          { 'max-sm:sr-only': options.length > 2 && code !== current },
          code === current ? 'font-semibold' : undefined,
        ]"
        >{{ code }}</span
      >
    </button>
    <RouterLink
      v-if="ratesLink"
      to="/settings/rates"
      :aria-label="t('a11y.openRates')"
      :title="t('a11y.openRates')"
      data-testid="currency-switch-rates"
      class="flex min-h-9 items-center rounded-lg px-2 text-muted-foreground outline-offset-2 transition-colors duration-fast hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4"
        aria-hidden="true"
      >
        <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
      </svg>
    </RouterLink>
  </div>
</template>
