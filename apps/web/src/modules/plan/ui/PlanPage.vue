<script setup lang="ts">
/**
 * What is planned to come in and go out, on the reference's report layout
 * (slide 14): tabs inside the screen, and under them the panel one of them
 * opened.
 *
 * Three ledgers, three panels, and the URL remembers which — so the screen
 * survives a reload and can be linked to, which a tab strip that only lived in
 * a `ref` could not do.
 *
 * The data stays where it is. The Plan owns no query of its own: it composes
 * three siblings through their public barrels, and each of them decides what
 * its own month, filters and empty screen are.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Motion } from 'motion-v';
import { TabBar, fadeUp } from '@magermoney/ui';
import { BudgetsSegment } from '@/modules/budgets';
import { ExpensesSegment } from '@/modules/expenses';
import { IncomeSegment } from '@/modules/income';
import { usePageAction } from '@/shared/layout/page-action';

const TABS = ['income', 'expenses', 'budgets'] as const;
type Tab = (typeof TABS)[number];
const ADD_ROUTE: Record<Tab, string> = {
  income: 'income-source-new',
  expenses: 'expense-new',
  budgets: 'budget-new',
};
const PANEL_ID = 'plan-panel';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const isTab = (v: string): v is Tab => (TABS as readonly string[]).includes(v);
const tab = computed<Tab>(() => {
  const q = String(route.query.tab ?? '');
  return isTab(q) ? q : 'income';
});
/** `TabBar` emits a plain string; anything that is not a tab is ignored. */
function openTab(value: string) {
  if (isTab(value)) void router.replace({ name: 'plan', query: { tab: value } });
}
const tabs = computed(() => TABS.map((value) => ({ value, label: t(`plan.tabs.${value}`) })));

/*
 * Adding is this screen's action, and what it adds is whichever ledger is open
 * — so the bar says "Add" and the open tab says the rest. A screen reader gets
 * the whole phrase, because it lands on the button without the tab strip above
 * it.
 */
usePageAction(() => ({
  label: t('action.add'),
  ariaLabel: t(`plan.add.${tab.value}`),
  onSelect: () => void router.push({ name: ADD_ROUTE[tab.value] }),
  testid: 'plan-add',
}));
</script>

<template>
  <section class="flex flex-col gap-4 pb-8">
    <header class="pt-1">
      <h1 class="text-2xl font-semibold tracking-[-0.01em]">
        {{ t('plan.title') }}
      </h1>
    </header>

    <TabBar
      :model-value="tab"
      :tabs="tabs"
      :panel-id="PANEL_ID"
      :aria-label="t('plan.sections')"
      data-testid="plan-tabs"
      @update:model-value="openTab"
    />

    <!--
      One panel, named by whichever tab is open. The key remounts it, which is
      what makes the change of ledger read as a change of screen rather than as
      rows quietly swapping underneath.
    -->
    <Motion
      :id="PANEL_ID"
      :key="tab"
      tag="div"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="`tab-${tab}`"
      class="rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      :data-testid="`plan-segment-${tab}`"
      v-bind="fadeUp"
    >
      <IncomeSegment v-if="tab === 'income'" />
      <ExpensesSegment v-else-if="tab === 'expenses'" />
      <BudgetsSegment v-else />
    </Motion>
  </section>
</template>
