<script setup lang="ts">
/** What is planned to come in and go out. One screen, three ledgers; the URL remembers which. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Motion } from 'motion-v';
import { Button, SegmentedControl, fadeUp } from '@magermoney/ui';
import { BudgetsSegment } from '@/modules/budgets';
import { ExpensesSegment } from '@/modules/expenses';
import { IncomeSegment } from '@/modules/income';

const TABS = ['income', 'expenses', 'budgets'] as const;
type Tab = (typeof TABS)[number];
const ADD_ROUTE: Record<Tab, string> = {
  income: 'income-source-new',
  expenses: 'expense-new',
  budgets: 'budget-new',
};

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const isTab = (v: string): v is Tab => (TABS as readonly string[]).includes(v);
const tab = computed<Tab>(() => {
  const q = String(route.query.tab ?? '');
  return isTab(q) ? q : 'income';
});
/** `SegmentedControl` emits a plain string; anything that is not a tab is ignored. */
function selectTab(value: string) {
  if (isTab(value)) void router.replace({ name: 'plan', query: { tab: value } });
}
const options = computed(() => TABS.map((value) => ({ value, label: t(`plan.tabs.${value}`) })));
</script>

<template>
  <section>
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-[-0.01em]">
        {{ t('plan.title') }}
      </h1>
      <Button
        size="icon"
        variant="outline"
        class="pointer-coarse:size-11"
        :aria-label="t(`plan.add.${tab}`)"
        :title="t(`plan.add.${tab}`)"
        data-testid="plan-add"
        @click="router.push({ name: ADD_ROUTE[tab] })"
      >
        +
      </Button>
    </header>

    <SegmentedControl
      :model-value="tab"
      :options="options"
      :aria-label="t('plan.title')"
      class="mt-4 w-full"
      data-testid="plan-tabs"
      @update:model-value="selectTab"
    />

    <Motion :key="tab" tag="div" class="mt-2" :data-testid="`plan-segment-${tab}`" v-bind="fadeUp">
      <IncomeSegment v-if="tab === 'income'" />
      <ExpensesSegment v-else-if="tab === 'expenses'" />
      <BudgetsSegment v-else />
    </Motion>
  </section>
</template>
