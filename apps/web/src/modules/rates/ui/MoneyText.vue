<script setup lang="ts">
/**
 * The amount lockup (docs/design/direction.md): the converted amount in tabular
 * figures with its currency code beside it in mono small-caps. One component, so
 * every amount in the app is the same object at every size.
 *
 * A changing amount cross-fades and slides 4px. It never counts up: the number
 * is the point, and counting makes it slower to read.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Money, type Currency } from '@magermoney/domain';
import { toCurrency, useCurrencies } from '@/modules/currencies';
import { formatMoney, type MoneyLocale } from '@/shared/money/format';
import { useConvertToDisplay } from '../application/convert-to-display';

const props = defineProps<{
  /** A decimal string. Never a number: amounts are exact end to end (ADR 0001). */
  amount: string;
  currency: string;
}>();

const { t, locale } = useI18n();
const currencies = useCurrencies();
const { convertToDisplay, current, date } = useConvertToDisplay();

const fallbackCurrency = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

const known = computed(() => {
  const dto = currencies.value.find((c) => c.code === props.currency);
  return dto ? toCurrency(dto) : fallbackCurrency(props.currency);
});

const target = computed(() => {
  const dto = currencies.value.find((c) => c.code === current.value);
  return dto ? toCurrency(dto) : fallbackCurrency(current.value);
});

const converted = computed(() => convertToDisplay(Money.of(props.amount, known.value)));

const shown = computed(() =>
  converted.value.match(
    (money) => ({
      text: formatMoney(money.round().toString(), target.value.code, locale.value as MoneyLocale, {
        scale: target.value.scale,
        symbol: target.value.symbol ?? null,
      }),
      title: undefined as string | undefined,
    }),
    () => ({ text: '—', title: t('money.noRate', { code: current.value, date: date.value }) }),
  ),
);
</script>

<template>
  <span class="money inline-flex items-baseline gap-1.5">
    <Transition
      mode="out-in"
      name="money"
    >
      <span
        :key="shown.text"
        data-amount
        :title="shown.title"
        class="text-[inherit] font-semibold leading-[1.1]"
      >{{ shown.text }}</span>
    </Transition>
    <span class="font-mono text-[0.6em] uppercase tracking-[0.08em] text-muted-foreground">
      {{ current }}
    </span>
  </span>
</template>

<style scoped>
/* Enter rises 4px and fades; the leave only fades, and faster, so nothing waits. */
.money-enter-active {
  transition:
    opacity 200ms linear,
    transform 200ms cubic-bezier(0.25, 1, 0.5, 1);
}

.money-leave-active {
  transition: opacity 120ms linear;
}

.money-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.money-leave-to {
  opacity: 0;
}
</style>
