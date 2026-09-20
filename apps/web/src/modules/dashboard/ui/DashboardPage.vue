<script setup lang="ts">
/**
 * Home. A read model and nothing else (CONTEXT.md, Dashboard): every number is
 * derived on the client from what the other modules hold (ADR 0003).
 *
 * The order is the reference's (slide 10) and it is the order the questions are
 * asked in: who am I and in what currency, how much in total, where it is, what
 * this month did, what is left of it, what is coming.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Motion } from 'motion-v';
import { PullToRefresh, RouteError, Skeleton, listStagger, useToast } from '@magermoney/ui';
import { useDisplayCurrency, useRefreshRates } from '@/modules/rates';
import { useScreenRefresh } from '@/shared/query/use-screen-refresh';
import { useDashboard } from '../application/use-dashboard';
import AccountsStripBlock from './AccountsStripBlock.vue';
import HomeHeader from './HomeHeader.vue';
import MonthPlanDonut from './MonthPlanDonut.vue';
import MonthStatsBlock from './MonthStatsBlock.vue';
import TotalBalanceBlock from './TotalBalanceBlock.vue';
import UpcomingBlock from './UpcomingBlock.vue';

const { t } = useI18n();
const { model, isError, refetch, rateDate } = useDashboard();
const { current } = useDisplayCurrency();
const planEmpty = computed(() => !model.value?.has.sources && !model.value?.has.outgo);

/*
 * Home is every module's numbers at once, so the gesture reloads the screen
 * rather than any one list — and asks for today's rates first, since every
 * total on it is converted. A wide window has no gesture and does not need
 * one: the queries refetch when the window is focused again.
 */
const { toast } = useToast();
const { refresh: refreshRates } = useRefreshRates();
const { refresh, isPending: refreshing } = useScreenRefresh(refreshRates);
async function refreshHome() {
  if (!(await refresh())) toast(t('rates.refreshFailed'));
}
</script>

<template>
  <!-- The whole screen is one answer, so the whole screen is what is pulled. -->
  <PullToRefresh :refreshing="refreshing" :busy-label="t('a11y.refreshing')" @refresh="refreshHome">
    <section class="flex flex-col gap-8 pb-8">
      <h1 class="sr-only">
        {{ t('dashboard.title') }}
      </h1>

      <HomeHeader />

      <div v-if="isError" data-testid="dash-error">
        <RouteError
          :title="t('dashboard.error.title')"
          :action-label="t('dashboard.error.retry')"
          @retry="refetch"
        />
      </div>

      <div v-else-if="!model" class="flex flex-col gap-4">
        <Skeleton class="h-11 w-56" />
        <Skeleton class="h-5 w-40" />
        <Skeleton class="h-28 w-full" />
        <Skeleton class="h-28 w-full" />
      </div>

      <!-- The blocks arrive in reading order once the numbers exist: one
         orchestrated entry, the same preset the account groups use. -->
      <template v-else>
        <Motion v-bind="listStagger(0)">
          <TotalBalanceBlock
            :capital="model.capital"
            :rate-date="rateDate"
            :days="model.payday.days"
            :per-day="model.payday.perDay"
          />
        </Motion>
        <Motion v-bind="listStagger(1)">
          <AccountsStripBlock :capital="model.capital" :base-code="current" />
        </Motion>
        <!--
        The reference sets Statistics and Budget side by side (slide 10). On a
        phone they stack, because a ring beside two tiles at 375px is three
        things fighting for the same column.
      -->
        <Motion v-bind="listStagger(2)">
          <div class="grid gap-8 md:grid-cols-2 md:items-start md:gap-6">
            <MonthStatsBlock
              :stats="model.stats"
              :unconvertible="model.inflows.unconvertible.map((r) => r.name)"
            />
            <MonthPlanDonut :plan="model.plan" :empty="planEmpty" />
          </div>
        </Motion>
        <Motion v-bind="listStagger(3)">
          <UpcomingBlock :days="model.upcoming" :undated="model.undatedExpenses" />
        </Motion>
      </template>
    </section>
  </PullToRefresh>
</template>
