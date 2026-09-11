<script setup lang="ts">
/**
 * Which currency the app shows amounts in. A segmented control rather than a
 * select: there are two to four options, they are the point of the app, and one
 * tap is the whole interaction.
 *
 * The indicator is a single element that moves between segments, so the change
 * reads as the same thing relocating rather than two things blinking.
 */
import { useI18n } from 'vue-i18n';
import { CurrencyIcon, EASE_OUT_QUART } from '@magermoney/ui';
import { Motion } from 'motion-v';
import { computed } from 'vue';
import { useCurrencies } from '../application/use-currencies';
import { useDisplayCurrency } from '../application/use-display-currency';

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
    class="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
  >
    <button
      v-for="code in options"
      :key="code"
      type="button"
      :aria-pressed="code === current"
      :title="t('a11y.showIn', { code })"
      class="relative flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 text-xs outline-offset-2 transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring"
      :class="code === current ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
      @click="set(code)"
    >
      <Motion
        v-if="code === current"
        layout-id="currency-switch-indicator"
        class="absolute inset-0 -z-10 rounded-lg bg-surface-raised ring-1 ring-foreground/10"
        :transition="{ duration: 0.18, ease: EASE_OUT_QUART }"
      />
      <CurrencyIcon
        :code="code"
        :kind="kindOf(code)"
        :size="16"
      />
      <span class="font-mono uppercase tracking-[0.08em]">{{ code }}</span>
    </button>
  </div>
</template>
