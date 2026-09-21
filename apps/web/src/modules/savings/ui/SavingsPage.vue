<script setup lang="ts">
/**
 * What the money is for, and what it has already become: the two halves of
 * everything that is not a monthly flow. Goals are money still on its way
 * somewhere; Assets are money that has already arrived and turned into a thing.
 *
 * Built on the Plan screen's shape on purpose — tabs inside the screen, one
 * panel under them, the open tab in the URL — because a fifth section that
 * looked like a different app would read as one.
 *
 * It owns no data. Both segments come through their modules' barrels, and each
 * decides its own loading, its own empty screen and its own failure.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Motion } from 'motion-v';
import { TabBar, fadeUp } from '@magermoney/ui';
import { GoalsSegment } from '@/modules/goals';
import { AssetsSegment } from '@/modules/assets';
import { usePageAction, usePageTitle } from '@/shared/layout/page-bar';

const TABS = ['goals', 'assets'] as const;
type Tab = (typeof TABS)[number];
const ADD_ROUTE: Record<Tab, string> = { goals: 'goal-new', assets: 'asset-new' };
const PANEL_ID = 'savings-panel';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const isTab = (v: string): v is Tab => (TABS as readonly string[]).includes(v);
const tab = computed<Tab>(() => {
  const q = String(route.query.tab ?? '');
  return isTab(q) ? q : 'goals';
});
/** `TabBar` emits a plain string; anything that is not a tab is ignored. */
function openTab(value: string) {
  if (isTab(value)) void router.replace({ name: 'savings', query: { tab: value } });
}
const tabs = computed(() => TABS.map((value) => ({ value, label: t(`savings.tabs.${value}`) })));

usePageTitle(() => t('savings.title'));

/*
 * One action, and what it adds is whatever is open. The bar says "Add"; the
 * open tab says the rest, and a screen reader gets the whole phrase because it
 * lands on the button without the tab strip above it.
 */
usePageAction(() => ({
  label: t('action.add'),
  ariaLabel: t(`savings.add.${tab.value}`),
  onSelect: () => void router.push({ name: ADD_ROUTE[tab.value] }),
  testid: 'savings-add',
}));
</script>

<template>
  <section class="flex flex-col gap-4 pb-8">
    <header class="pt-1">
      <!-- The bar carries this on a phone; a wide window's bar carries the links. -->
      <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
        {{ t('savings.title') }}
      </h1>
    </header>

    <TabBar
      :model-value="tab"
      :tabs="tabs"
      :panel-id="PANEL_ID"
      :aria-label="t('savings.sections')"
      data-testid="savings-tabs"
      @update:model-value="openTab"
    />

    <!--
      One panel, named by whichever tab is open. The key remounts it, so the
      change reads as a change of screen rather than as rows quietly swapping.
    -->
    <Motion
      :id="PANEL_ID"
      :key="tab"
      tag="div"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="`tab-${tab}`"
      class="rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      :data-testid="`savings-segment-${tab}`"
      v-bind="fadeUp"
    >
      <GoalsSegment v-if="tab === 'goals'" />
      <AssetsSegment v-else />
    </Motion>
  </section>
</template>
