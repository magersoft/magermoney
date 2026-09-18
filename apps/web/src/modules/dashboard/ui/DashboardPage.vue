<script setup lang="ts">
/**
 * Home. A read model and nothing else (CONTEXT.md, Dashboard): every number is
 * derived on the client from what the other modules hold (ADR 0003).
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Motion } from 'motion-v';
import { Skeleton, listStagger } from '@magermoney/ui';
import { InflowSheet } from '@/modules/income';
import { useDashboard } from '../application/use-dashboard';
import CapitalBlock from './CapitalBlock.vue';
import MonthInflowsBlock from './MonthInflowsBlock.vue';
import MonthPlanBlock from './MonthPlanBlock.vue';
import UntilPaydayBlock from './UntilPaydayBlock.vue';
import UpcomingBlock from './UpcomingBlock.vue';

const { t } = useI18n();
const { model, rateDate } = useDashboard();
const inflowOpen = ref(false);
</script>

<template>
  <section class="pb-8">
    <h1 class="sr-only">
      {{ t('dashboard.title') }}
    </h1>
    <div v-if="!model" class="space-y-4 pt-1">
      <Skeleton class="h-10 w-48" />
      <Skeleton class="h-5 w-full" />
      <Skeleton class="h-24 w-full" />
    </div>
    <template v-else>
      <!-- The blocks arrive in reading order once the numbers exist: one
           orchestrated entry, the same preset the account groups use. -->
      <Motion v-bind="listStagger(0)">
        <CapitalBlock :capital="model.capital" :rate-date="rateDate" />
      </Motion>
      <Motion v-bind="listStagger(1)">
        <UntilPaydayBlock
          :available="model.capital.availableUntilPayday"
          :days="model.payday.days"
          :per-day="model.payday.perDay"
        />
      </Motion>
      <Motion v-bind="listStagger(2)">
        <MonthPlanBlock :plan="model.plan" :empty="!model.has.sources && !model.has.outgo" />
      </Motion>
      <Motion v-bind="listStagger(3)">
        <MonthInflowsBlock
          :inflows="model.inflows"
          :empty="model.inflows.rows.length === 0"
          @record="inflowOpen = true"
        />
      </Motion>
      <Motion v-bind="listStagger(4)">
        <UpcomingBlock :days="model.upcoming" :undated="model.undatedExpenses" />
      </Motion>
    </template>
    <InflowSheet v-model:open="inflowOpen" />
  </section>
</template>
