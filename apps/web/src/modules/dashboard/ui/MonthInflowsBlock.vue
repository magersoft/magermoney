<script setup lang="ts">
/** Did the money arrive: received of expected, per source, this month. */
import { useI18n } from 'vue-i18n';
import type { InflowsVsPlan, InflowsVsPlanRow } from '@magermoney/domain';
import { Button, ProgressRule } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';

defineProps<{ inflows: InflowsVsPlan; empty: boolean }>();
const emit = defineEmits<{ record: [] }>();
const { t } = useI18n();
/** Drawing only: the bar's length. Amounts stay decimal everywhere else (ADR 0001). */
const ratio = (r: InflowsVsPlanRow) => ({
  value: r.received.amount.toNumber(),
  max: Math.max(r.expected.amount.toNumber(), r.received.amount.toNumber(), 1),
});
</script>

<template>
  <section class="mt-8 border-t border-border pt-3">
    <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('dashboard.inflows.title') }}
    </h2>
    <div v-if="empty" class="mt-3 text-sm text-muted-foreground" data-testid="dash-inflows-empty">
      <p>{{ t('dashboard.inflows.empty') }}</p>
      <RouterLink
        :to="{ name: 'plan', query: { tab: 'income' } }"
        class="mt-1 inline-flex items-center text-primary underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      >
        {{ t('dashboard.inflows.emptyCta') }}
      </RouterLink>
    </div>
    <template v-else>
      <ul class="divide-y divide-border/60">
        <li v-for="r in inflows.rows" :key="r.sourceId">
          <RouterLink
            :to="{ name: 'income-source', params: { id: r.sourceId } }"
            :data-testid="`dash-inflow-row-${r.sourceId}`"
            class="block min-h-13 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span class="flex items-baseline justify-between gap-3">
              <span class="min-w-0 truncate text-base">{{ r.name }}</span>
              <span class="text-sm">
                <MoneyText :amount="r.received.toString()" :currency="r.received.currency.code" />
                <span class="text-xs text-muted-foreground"> {{ t('dashboard.inflows.of') }} </span>
                <MoneyText
                  class="text-muted-foreground"
                  :amount="r.expected.toString()"
                  :currency="r.expected.currency.code"
                />
              </span>
            </span>
            <ProgressRule class="mt-2" :label="r.name" v-bind="ratio(r)" />
          </RouterLink>
        </li>
      </ul>
      <Button
        variant="outline"
        class="mt-3 min-h-9 w-full pointer-coarse:min-h-11"
        data-testid="dash-record-inflow"
        @click="emit('record')"
      >
        {{ t('dashboard.inflows.record') }}
      </Button>
    </template>
  </section>
</template>
