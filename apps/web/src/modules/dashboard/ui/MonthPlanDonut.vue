<script setup lang="ts">
/**
 * The reference's budget ring (slide 10), pointed at the question we can
 * actually answer. Moni draws spent against a limit; we have no record of what
 * was spent (CONTEXT.md, Spend), so the ring draws what the month is planned to
 * cost against what it is planned to bring, and the gap holds the one number
 * the owner opens the app for: what is left over.
 *
 * Past the income the ring is full and red, and says so in words as well —
 * colour is never the only carrier.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { DonutChart, formatAmountLockup, plainAmount, type AmountLocale } from '@magermoney/ui';
import type { MonthPlan } from '@magermoney/domain';

const { plan } = defineProps<{ plan: MonthPlan; empty: boolean }>();

const { t, locale } = useI18n();
const amountLocale = computed(() => locale.value as AmountLocale);

const code = computed(() => plan.remainder.currency.code);
const scale = computed(() => plan.remainder.currency.scale);

/** Drawing only: the ring's fill. Amounts stay decimal everywhere else (ADR 0001). */
const value = computed(() => plan.plannedOutgo.amount.toNumber());
const max = computed(() => plan.netIncome.amount.toNumber());

/* The caption is a sentence, so its amounts are the lockup written out flat. */
const flat = (amount: string) =>
  plainAmount(
    formatAmountLockup(amount, {
      code: code.value,
      locale: amountLocale.value,
      scale: scale.value,
    }),
  );
const caption = computed(() =>
  t('dashboard.budget.caption', {
    outgo: flat(plan.plannedOutgo.round().toString()),
    income: flat(plan.netIncome.round().toString()),
  }),
);
const names = computed(() => plan.unconvertible.map((r) => r.name).join(', '));
</script>

<template>
  <section data-testid="dash-plan" class="flex flex-col gap-3">
    <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('dashboard.plan.title') }}
    </h2>

    <div
      v-if="empty"
      class="bg-surface shadow-card flex flex-col items-start gap-2 rounded-xl p-4"
      data-testid="dash-plan-empty"
    >
      <p class="text-sm text-muted-foreground">
        {{ t('dashboard.plan.empty') }}
      </p>
      <RouterLink
        :to="{ name: 'plan', query: { tab: 'income' } }"
        class="inline-flex items-center text-sm text-primary underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      >
        {{ t('dashboard.plan.emptyCta') }}
      </RouterLink>
    </div>

    <div v-else class="bg-surface shadow-card flex flex-col gap-2 rounded-xl p-4">
      <DonutChart
        mode="progress"
        data-testid="dash-plan-donut"
        :label="t('dashboard.budget.label')"
        :amount="plan.remainder.toString()"
        :code="code"
        :scale="scale"
        :locale="amountLocale"
        :value="value"
        :max="max"
        :period="t('dashboard.budget.remainder')"
        :caption="caption"
        :over-label="t('dashboard.budget.over')"
        :empty-label="t('dashboard.budget.noIncome')"
      />
      <p
        v-if="plan.unconvertible.length > 0"
        class="text-xs text-muted-foreground"
        data-testid="dash-plan-unconvertible"
      >
        {{ t('dashboard.unconvertible', { codes: names }) }}
      </p>
    </div>
  </section>
</template>
