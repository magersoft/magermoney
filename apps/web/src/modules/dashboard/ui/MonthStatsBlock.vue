<script setup lang="ts">
/**
 * The reference's two statistics tiles (slide 10), told apart by what we can
 * actually know. Income is fact: the Inflows that arrived this month, against
 * the ones that arrived last month. Spending is plan — there is no record of
 * what was actually spent until Spend exists (CONTEXT.md) — so the tile says
 * «плановые траты» and compares plan with plan. Naming it anything shorter
 * would be a number pretending to be a measurement.
 */
import { computed, markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { StatTile, type AmountLocale } from '@magermoney/ui';
import type { DashboardModel } from '../application/build-dashboard';

const { unconvertible } = defineProps<{
  stats: DashboardModel['stats'];
  /** Receipts today's rates cannot price. Named, never silently left out of the tile. */
  unconvertible: readonly string[];
}>();

const { t, locale } = useI18n();
const amountLocale = computed(() => locale.value as AmountLocale);
const names = computed(() => [...new Set(unconvertible)].join(', '));
/* A component handed through a prop, so it must not be made reactive on the way. */
const link = markRaw(RouterLink);
</script>

<template>
  <section class="flex flex-col gap-2" :aria-label="t('dashboard.stats.title')">
    <div class="grid grid-cols-2 gap-3">
      <StatTile
        data-testid="dash-stat-income"
        :as="link"
        href="/plan?tab=income"
        :label="t('dashboard.stats.income')"
        :amount="stats.income.amount.toString()"
        :code="stats.income.amount.currency.code"
        :scale="stats.income.amount.currency.scale"
        :locale="amountLocale"
        :delta="stats.income.delta"
        :delta-caption="t('dashboard.stats.vsLastMonth')"
      >
        <template #icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-5"
          >
            <path d="M12 5v14m0 0-5-5m5 5 5-5" />
          </svg>
        </template>
      </StatTile>

      <StatTile
        data-testid="dash-stat-outgo"
        :as="link"
        href="/plan?tab=expenses"
        :label="t('dashboard.stats.outgo')"
        :amount="stats.outgo.amount.toString()"
        :code="stats.outgo.amount.currency.code"
        :scale="stats.outgo.amount.currency.scale"
        :locale="amountLocale"
        :delta="stats.outgo.delta"
        :up-is-good="false"
        :delta-caption="t('dashboard.stats.vsLastMonth')"
      >
        <template #icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-5"
          >
            <path d="M12 19V5m0 0-5 5m5-5 5 5" />
          </svg>
        </template>
      </StatTile>
    </div>

    <p
      v-if="unconvertible.length > 0"
      class="text-xs text-muted-foreground"
      data-testid="dash-stats-unconvertible"
    >
      {{ t('dashboard.unconvertible', { codes: names }) }}
    </p>
  </section>
</template>
