<script setup lang="ts">
/** One source: what it is on the left, what it brings per month on the right, in its own currency first. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { netMonthly, type IncomeSource } from '@magermoney/domain';
import { Badge } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import { payDaysLabel } from '../domain/labels';

const { source } = defineProps<{ source: IncomeSource }>();
const { t } = useI18n();
const net = computed(() => netMonthly(source));
/** Padded to the currency's scale, as every own-currency amount in the app is: `Money.toString()` prints 765, a ledger prints 765.00. */
const netText = computed(() => net.value.amount.toFixed(net.value.currency.scale));
const days = computed(() => payDaysLabel(source.payDays));
</script>

<template>
  <RouterLink
    :to="`/plan/income/${source.id}`"
    :data-testid="`source-row-${source.id}`"
    class="flex min-h-14 items-center gap-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
  >
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2">
        <span class="truncate text-[15px]">{{ source.name }}</span>
        <Badge v-if="source.isPrimary" variant="secondary">{{ t('income.primary') }}</Badge>
      </span>
      <span class="block text-xs text-muted-foreground">
        {{ days ? t('income.payDays', { days }) : t('income.irregular') }}
      </span>
    </span>
    <span class="text-right">
      <span class="block font-mono text-[15px] tabular-nums"
        >{{ netText }} {{ net.currency.code }}</span
      >
      <MoneyText
        class="text-xs text-muted-foreground"
        :amount="net.toString()"
        :currency="net.currency.code"
      />
    </span>
  </RouterLink>
</template>
