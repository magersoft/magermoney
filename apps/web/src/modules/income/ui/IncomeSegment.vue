<script setup lang="ts">
/**
 * The Income segment of the Plan screen: what is coming in, and what used to.
 *
 * Grouped the way the reference groups its report (slide 14) — a heading with
 * the subtotal on its right — and grouped by the only thing that makes two
 * sources plan differently: whether the money has a date on it. Scheduled first,
 * because those are the days the rest of the app counts from.
 *
 * Each source states what it brings in its own currency; the subtotal is the
 * one converted figure, so it carries the footnote saying at which rates and
 * for which day — without it the number is a guess presented as a fact
 * (docs/design/direction.md).
 *
 * A source counts as ended once its `activeTo` is behind today; one that starts
 * next month is already listed — it is part of the plan, just not of this
 * month's numbers.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Motion } from 'motion-v';
import { netMonthly } from '@magermoney/domain';
import {
  AmountLockup,
  Button,
  RowGroup,
  Skeleton,
  TransactionRow,
  listStagger,
  type AmountLocale,
} from '@magermoney/ui';
import { useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import { payDaysLabel } from '../domain/labels';
import { groupIncome } from '../application/income-groups';
import { useIncomeSources } from '../application/use-income-sources';

const { t, locale } = useI18n();
const { dtos, isLoading } = useIncomeSources();
const rates = useRates();
const registry = useCurrencyRegistry();
const { current } = useDisplayCurrency();
const showEnded = ref(false);

const amountLocale = computed(() => locale.value as AmountLocale);
const uiLocale = computed(() => locale.value as DateLocale);
const model = computed(() =>
  groupIncome(dtos.value, rates.table.value, registry.value, current.value, todayIso()),
);
const isEmpty = computed(() => !isLoading.value && dtos.value.length === 0);
const unconvertibleNames = computed(() => model.value?.unconvertible.map((s) => s.name).join(', '));
/** Only rendered while open: a collapsed list must not answer a row query. */
const endedShown = computed(() => (showEnded.value ? (model.value?.ended ?? []) : []));
const schedule = (payDays: number[]) => {
  const days = payDaysLabel(payDays);
  return days ? t('income.payDays', { days }) : t('income.irregular');
};
</script>

<template>
  <section class="flex flex-col gap-5" data-testid="income-segment">
    <h2 class="sr-only">
      {{ t('income.title') }}
    </h2>

    <div v-if="isLoading || !model" class="flex flex-col gap-3">
      <Skeleton v-for="i in 2" :key="i" class="h-24 w-full rounded-xl" />
    </div>

    <div
      v-else-if="isEmpty"
      class="bg-surface shadow-card mt-4 flex flex-col items-start gap-2 rounded-xl p-5"
      data-testid="income-empty"
    >
      <p class="text-base font-semibold">
        {{ t('income.empty.title') }}
      </p>
      <p class="text-muted-foreground max-w-prose text-sm">
        {{ t('income.empty.body') }}
      </p>
      <Button as-child class="mt-2 min-h-11 rounded-xl px-4">
        <RouterLink to="/plan/income/new" data-testid="income-add">
          {{ t('income.add') }}
        </RouterLink>
      </Button>
    </div>

    <template v-else>
      <Motion
        v-for="(g, i) in model.groups"
        :key="g.kind"
        tag="div"
        v-bind="listStagger(i)"
        :data-testid="`income-group-${g.kind}`"
      >
        <RowGroup
          :title="t(`income.groups.${g.kind}`)"
          :amount="g.total.toString()"
          :code="g.total.currency.code"
          :scale="g.total.currency.scale"
          :locale="amountLocale"
        >
          <li v-for="{ source, net } in g.rows" :key="source.id">
            <TransactionRow
              :as="RouterLink"
              :href="`/plan/income/${source.id}`"
              :title="source.name"
              :category="
                source.isPrimary
                  ? `${t('income.primary')} · ${schedule(source.payDays)}`
                  : schedule(source.payDays)
              "
              :amount="net.toString()"
              :code="net.currency.code"
              :scale="net.currency.scale"
              :locale="amountLocale"
              :show-code="net.currency.code !== current"
              :data-testid="`source-row-${source.id}`"
            />
          </li>
        </RowGroup>
      </Motion>

      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3 px-2">
          <span class="text-sm font-medium">{{ t('income.netTotal') }}</span>
          <AmountLockup
            data-testid="income-net"
            :amount="model.net.toString()"
            :code="model.net.currency.code"
            :scale="model.net.currency.scale"
            :locale="amountLocale"
            class="text-base"
          />
        </div>
        <p class="text-muted-foreground px-2 text-xs" data-testid="income-rate-note">
          {{ t('income.rateDate', { date: formatDay(rates.date.value, uiLocale) }) }}
        </p>
        <p v-if="model.unconvertible.length > 0" class="text-muted-foreground px-2 text-xs">
          {{ t('income.unconvertible', { names: unconvertibleNames }) }}
        </p>
      </div>

      <div>
        <Button as-child variant="outline" class="min-h-11 rounded-xl px-4">
          <RouterLink to="/plan/income/new" data-testid="income-add">
            {{ t('income.add') }}
          </RouterLink>
        </Button>
      </div>

      <div v-if="model.ended.length > 0" class="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-11 self-start px-2"
          :aria-expanded="showEnded"
          aria-controls="ended-income"
          data-testid="income-ended-toggle"
          @click="showEnded = !showEnded"
        >
          {{
            showEnded ? t('income.ended.hide') : t('income.ended.show', { n: model.ended.length })
          }}
        </Button>
        <RowGroup v-show="showEnded" id="ended-income" :aria-label="t('income.ended.hide')">
          <li v-for="s in endedShown" :key="s.id">
            <TransactionRow
              :as="RouterLink"
              :href="`/plan/income/${s.id}`"
              :title="s.name"
              :category="
                t('income.periodEnded', {
                  from: formatDay(s.activeFrom, uiLocale),
                  to: formatDay(s.activeTo ?? s.activeFrom, uiLocale),
                })
              "
              :amount="netMonthly(s).toString()"
              :code="netMonthly(s).currency.code"
              :scale="netMonthly(s).currency.scale"
              :locale="amountLocale"
              :show-code="netMonthly(s).currency.code !== current"
              class="opacity-70"
              :data-testid="`source-row-${s.id}`"
            />
          </li>
        </RowGroup>
      </div>
    </template>
  </section>
</template>
