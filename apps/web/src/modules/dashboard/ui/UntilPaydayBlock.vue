<script setup lang="ts">
/** How much can be spent, for how long, and what that comes to per day. */
import { useI18n } from 'vue-i18n';
import type { Money } from '@magermoney/domain';
import { MoneyText } from '@/modules/rates';

defineProps<{ available: Money; days: number | null; perDay: Money | null }>();
const { t } = useI18n();
</script>

<template>
  <section class="mt-5 border-t border-border pt-3">
    <div class="flex items-baseline justify-between gap-3">
      <span class="text-sm text-muted-foreground">{{ t('dashboard.payday.available') }}</span>
      <MoneyText
        data-testid="dash-available"
        class="text-base"
        :amount="available.toString()"
        :currency="available.currency.code"
      />
    </div>
    <div
      v-if="days !== null && perDay"
      class="mt-1 flex items-baseline justify-between gap-3 text-sm"
    >
      <span data-testid="dash-days" class="text-muted-foreground">{{
        days === 0 ? t('dashboard.payday.today') : t('dashboard.payday.days', { n: days }, days)
      }}</span>
      <span data-testid="dash-per-day">
        <MoneyText :amount="perDay.toString()" :currency="perDay.currency.code" />
        <span class="text-xs text-muted-foreground"> {{ t('dashboard.payday.perDay') }}</span>
      </span>
    </div>
    <RouterLink
      v-else
      :to="{ name: 'plan', query: { tab: 'income' } }"
      data-testid="dash-payday-setup"
      class="mt-1 flex items-center text-xs text-primary underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
    >
      {{ t('dashboard.payday.setup') }}
    </RouterLink>
  </section>
</template>
