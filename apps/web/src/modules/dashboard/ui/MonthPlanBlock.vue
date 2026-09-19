<script setup lang="ts">
/** Does the month add up. The remainder is the only number on the home screen allowed a colour. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MonthPlan } from '@magermoney/domain';
import { MoneyText } from '@/modules/rates';

const { plan } = defineProps<{ plan: MonthPlan; empty: boolean }>();
const { t } = useI18n();
const sign = computed(() =>
  plan.remainder.isZero() ? 'zero' : plan.remainder.isNegative() ? 'negative' : 'positive',
);
const names = computed(() => plan.unconvertible.map((r) => r.name).join(', '));
</script>

<template>
  <section class="mt-8 border-t border-border pt-3">
    <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('dashboard.plan.title') }}
    </h2>
    <div v-if="empty" class="mt-3 text-sm text-muted-foreground" data-testid="dash-plan-empty">
      <p>{{ t('dashboard.plan.empty') }}</p>
      <RouterLink
        :to="{ name: 'plan', query: { tab: 'income' } }"
        class="mt-1 inline-flex items-center text-primary underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      >
        {{ t('dashboard.plan.emptyCta') }}
      </RouterLink>
    </div>
    <dl v-else class="mt-2 text-sm">
      <div class="flex items-baseline justify-between py-1">
        <dt>{{ t('dashboard.plan.netIncome') }}</dt>
        <dd data-testid="dash-net-income">
          <MoneyText :amount="plan.netIncome.toString()" :currency="plan.netIncome.currency.code" />
        </dd>
      </div>
      <div class="flex items-baseline justify-between py-1">
        <dt>{{ t('dashboard.plan.outgo') }}</dt>
        <dd data-testid="dash-outgo">
          <MoneyText
            :amount="plan.plannedOutgo.toString()"
            :currency="plan.plannedOutgo.currency.code"
          />
        </dd>
      </div>
      <div class="flex items-baseline justify-between pb-1 text-xs text-muted-foreground">
        <dt>{{ t('dashboard.plan.essential') }}</dt>
        <dd data-testid="dash-essential">
          <MoneyText :amount="plan.essential.toString()" :currency="plan.essential.currency.code" />
        </dd>
      </div>
      <div class="flex items-baseline justify-between border-t border-border/60 py-2 text-base">
        <dt>{{ t('dashboard.plan.remainder') }}</dt>
        <dd
          data-testid="dash-remainder"
          :data-sign="sign"
          :class="{ 'text-positive': sign === 'positive', 'text-negative': sign === 'negative' }"
        >
          <MoneyText :amount="plan.remainder.toString()" :currency="plan.remainder.currency.code" />
        </dd>
      </div>
    </dl>
    <p v-if="!empty && plan.unconvertible.length > 0" class="mt-1 text-xs text-muted-foreground">
      {{ t('dashboard.unconvertible', { codes: names }) }}
    </p>
  </section>
</template>
