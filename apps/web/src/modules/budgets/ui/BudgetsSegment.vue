<script setup lang="ts">
/**
 * The Budgets segment of the Plan screen, on the reference's budget layout
 * (slide 16): the month's budget as a ring, and under it the categories, each
 * with its own bar and the pair it is measured by.
 *
 * What is missing is the half that matters, and the screen says so rather than
 * implying it. A Spend — what a category actually cost — is entered once, when
 * the month is closed (CONTEXT.md), and that arrives in phase 5. Until then
 * every bar stands at zero and a line under the list states why, so a full row
 * of empty bars reads as "nothing counted yet" and not as "nothing spent".
 * When Spends exist, they replace the zero here and everything else — the bar,
 * the red past the limit, the ring — already works.
 *
 * A budget may be kept in a currency that is not the base one, so each row
 * carries its own; the subtotal is the one converted figure and therefore the
 * one that needs the footnote saying at which rates and for which day.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Motion } from 'motion-v';
import type { Budget } from '@magermoney/domain';
import {
  AmountLockup,
  Button,
  CategoryRow,
  DonutChart,
  RouteError,
  RowGroup,
  Skeleton,
  TransactionRow,
  listStagger,
  type AmountLocale,
} from '@magermoney/ui';
import { useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { formatDay, formatMonth, type DateLocale } from '@/shared/dates/format';
import { summariseBudgets } from '../application/budget-summary';
import { useBudgets } from '../application/use-budgets';

/** No Spends before phase 5: every figure that would be one is this. */
const NOTHING_SPENT = '0';

const { t, locale } = useI18n();
const { dtos, isLoading, isError, refetch } = useBudgets();
const rates = useRates();
const registry = useCurrencyRegistry();
const { current } = useDisplayCurrency();
const showEnded = ref(false);

const amountLocale = computed(() => locale.value as AmountLocale);
const uiLocale = computed(() => locale.value as DateLocale);
const monthLabel = computed(() => formatMonth(todayIso(), uiLocale.value));

const model = computed(() =>
  summariseBudgets(dtos.value, rates.table.value, registry.value, current.value, todayIso()),
);
/* A failed list also answers with no rows, and "no budgets yet" would be a lie
 * about the plan rather than about the request. */
const isEmpty = computed(
  () => !isLoading.value && !isError.value && model.value !== undefined && dtos.value.length === 0,
);
const unconvertibleNames = computed(() => model.value?.unconvertible.map((b) => b.name).join(', '));
/** Only rendered while open: a collapsed list must not answer a row query. */
const endedShown = computed(() => (showEnded.value ? (model.value?.ended ?? []) : []));
const limit = (b: Budget) => b.monthlyLimit.toString();
</script>

<template>
  <section class="flex flex-col gap-5" data-testid="budgets-segment">
    <h2 class="sr-only">
      {{ t('budgets.title') }}
    </h2>

    <div v-if="isError" data-testid="budgets-error">
      <RouteError
        :title="t('budgets.error.title')"
        :action-label="t('budgets.error.retry')"
        @retry="refetch"
      />
    </div>

    <div v-else-if="!model" class="flex flex-col gap-3">
      <Skeleton class="h-64 w-full rounded-xl" />
      <Skeleton class="h-24 w-full rounded-xl" />
    </div>

    <div
      v-else-if="isEmpty"
      class="bg-surface shadow-card mt-4 flex flex-col items-start gap-2 rounded-xl p-5"
      data-testid="budgets-empty"
    >
      <p class="text-base font-semibold">
        {{ t('budgets.empty.title') }}
      </p>
      <p class="text-muted-foreground max-w-prose text-sm">
        {{ t('budgets.empty.body') }}
      </p>
      <Button as-child class="mt-2 min-h-11 rounded-xl px-4">
        <RouterLink :to="{ name: 'budget-new' }" data-testid="budgets-add">
          {{ t('budgets.add') }}
        </RouterLink>
      </Button>
    </div>

    <template v-else>
      <div class="bg-surface shadow-card rounded-xl p-4">
        <DonutChart
          mode="progress"
          data-testid="budgets-donut"
          :label="t('budgets.monthly')"
          :amount="model.total.toString()"
          :code="model.total.currency.code"
          :scale="model.total.currency.scale"
          :locale="amountLocale"
          :value="0"
          :max="model.total.amount.toNumber()"
          :period="monthLabel"
          :caption="
            t('budgets.spentOf', { spent: NOTHING_SPENT, limit: model.total.round().toString() })
          "
          :empty-label="t('budgets.noLimits')"
        />
        <p class="text-muted-foreground mt-3 text-center text-xs" data-testid="budgets-spend-note">
          {{ t('budgets.spendNote') }}
        </p>
      </div>

      <RowGroup :aria-label="t('budgets.categories')">
        <Motion
          v-for="(b, i) in model.active"
          :key="b.id"
          tag="li"
          v-bind="listStagger(i)"
          class="min-w-0"
        >
          <CategoryRow
            :as="RouterLink"
            :href="`/plan/budgets/${b.id}/edit`"
            :name="b.name"
            :emoji="b.icon ?? undefined"
            :spent="NOTHING_SPENT"
            :limit="limit(b)"
            :spent-value="0"
            :limit-value="b.monthlyLimit.amount.toNumber()"
            :code="b.monthlyLimit.currency.code"
            :base-code="current"
            :scale="b.monthlyLimit.currency.scale"
            :locale="amountLocale"
            :over-label="t('budgets.over')"
            :data-testid="`budget-row-${b.id}`"
          />
        </Motion>
      </RowGroup>

      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3 px-2">
          <span class="text-sm font-medium">{{ t('budgets.total') }}</span>
          <AmountLockup
            data-testid="budgets-total"
            :amount="model.total.toString()"
            :code="model.total.currency.code"
            :scale="model.total.currency.scale"
            :locale="amountLocale"
            class="text-base"
          />
        </div>
        <p class="text-muted-foreground px-2 text-xs" data-testid="budgets-rate-note">
          {{ t('budgets.rateDate', { date: formatDay(rates.date.value, uiLocale) }) }}
        </p>
        <p v-if="model.unconvertible.length > 0" class="text-muted-foreground px-2 text-xs">
          {{ t('budgets.unconvertible', { names: unconvertibleNames }) }}
        </p>
      </div>

      <div>
        <Button as-child variant="outline" class="min-h-11 rounded-xl px-4">
          <RouterLink :to="{ name: 'budget-new' }" data-testid="budgets-add">
            {{ t('budgets.add') }}
          </RouterLink>
        </Button>
      </div>

      <div v-if="model.ended.length > 0" class="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-11 self-start px-2"
          :aria-expanded="showEnded"
          aria-controls="ended-budgets"
          data-testid="budgets-ended-toggle"
          @click="showEnded = !showEnded"
        >
          {{
            showEnded ? t('budgets.ended.hide') : t('budgets.ended.show', { n: model.ended.length })
          }}
        </Button>
        <RowGroup v-show="showEnded" id="ended-budgets">
          <li v-for="b in endedShown" :key="b.id">
            <TransactionRow
              :as="RouterLink"
              :href="`/plan/budgets/${b.id}/edit`"
              :title="b.icon ? `${b.icon} ${b.name}` : b.name"
              :category="
                t('budgets.endedOn', { date: formatDay(b.activeTo ?? b.activeFrom, uiLocale) })
              "
              :amount="limit(b)"
              :code="b.monthlyLimit.currency.code"
              :scale="b.monthlyLimit.currency.scale"
              :locale="amountLocale"
              :show-code="b.monthlyLimit.currency.code !== current"
              class="opacity-70"
              :data-testid="`budget-row-${b.id}`"
            />
          </li>
        </RowGroup>
      </div>
    </template>
  </section>
</template>
