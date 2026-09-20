<script setup lang="ts">
/** What one unit of each reporting currency is worth in the display currency today, and which of those numbers were typed by hand. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Badge, Button, CurrencyIcon, Skeleton, useToast } from '@magermoney/ui';
import { toCurrency, useCurrencies } from '@/modules/currencies';
import { Money } from '@magermoney/domain';
import { formatMoney, type MoneyLocale } from '@/shared/money/format';
import { usePageTitle } from '@/shared/layout/page-bar';
import { useDisplayCurrency } from '../application/use-display-currency';
import { useRates } from '../application/use-rates';
import { useManualRate } from '../application/use-manual-rate';
import ManualRateSheet from './ManualRateSheet.vue';

const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { current } = useDisplayCurrency();
const { table, date, rows } = useRates();

usePageTitle(() => t('rates.title'));
const { remove } = useManualRate();
const manualBases = computed(
  () => new Set(rows.value.filter((r) => r.source === 'manual').map((r) => r.base)),
);
const manualDate = (base: string) =>
  rows.value.find((r) => r.base === base && r.source === 'manual')?.date;

const uiLocale = computed(() => locale.value as MoneyLocale);

const rowList = computed(() =>
  currencies.value
    .filter((c) => c.code !== current.value)
    .map((c) => {
      const one = table.value?.convert(Money.of('1', toCurrency(c)), current.value);
      const target = currencies.value.find((x) => x.code === current.value);
      const text =
        one?.isOk() && target
          ? formatMoney(
              one.value.amount.toSignificantDigits(6).toFixed(),
              current.value,
              uiLocale.value,
              {
                kind: target.kind,
                scale: Math.max(target.scale, 4),
                symbol: target.symbol,
              },
            )
          : t('rates.noRate');
      return { code: c.code, kind: c.kind, text, manual: manualBases.value.has(c.code) };
    }),
);
const open = ref(false);
const base = ref<string | undefined>();
function edit(code: string) {
  base.value = code;
  open.value = true;
}
async function removeManual(code: string) {
  try {
    await remove(code, manualDate(code) ?? date.value);
  } catch {
    toast(t('rates.failed'));
  }
}
</script>

<template>
  <section class="pb-8">
    <!-- The bar carries this on a phone; a wide window's bar carries the links. -->
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ t('rates.title') }}
    </h1>
    <p class="mt-1 text-xs text-muted-foreground">
      {{ t('rates.asOf', { date, code: current }) }}
    </p>
    <Skeleton v-if="!table" class="mt-4 h-12 w-full" />
    <ul v-else class="mt-4 divide-y divide-border/60">
      <li
        v-for="r in rowList"
        :key="r.code"
        :data-testid="`rate-row-${r.code}`"
        class="flex min-h-12 items-center gap-3 py-2"
      >
        <CurrencyIcon :code="r.code" :kind="r.kind" :size="24" />
        <span class="flex-1 text-sm">{{ t('rates.one', { code: r.code }) }}</span>
        <Badge v-if="r.manual" variant="secondary">
          {{ t('rates.manual') }}
        </Badge>
        <button
          type="button"
          class="min-h-9 font-mono text-sm tabular-nums pointer-coarse:min-h-11"
          :aria-label="t('rates.one', { code: r.code })"
          @click="edit(r.code)"
        >
          {{ r.text }}
        </button>
        <Button
          v-if="r.manual"
          variant="ghost"
          size="xs"
          class="min-h-9 pointer-coarse:min-h-11"
          :aria-label="t('rates.remove')"
          @click="removeManual(r.code)"
        >
          ×
        </Button>
      </li>
    </ul>
    <Button
      class="mt-6 w-full"
      variant="outline"
      size="lg"
      data-testid="rates-set-manual"
      @click="edit(current === 'USD' ? 'EUR' : (rowList[0]?.code ?? 'EUR'))"
    >
      {{ t('rates.setManual') }}
    </Button>
    <ManualRateSheet v-model:open="open" :base="base" />
  </section>
</template>
