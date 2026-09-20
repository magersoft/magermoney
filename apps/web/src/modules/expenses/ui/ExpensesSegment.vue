<script setup lang="ts">
/**
 * The Expenses segment of the Plan screen, on the reference's report layout
 * (slide 14): the filters the month is read under, the ring that splits it by
 * category with an arrow on each side, and the obligations themselves grouped
 * under a heading that carries the group's subtotal.
 *
 * The month is the whole frame. A fixed obligation has an active period, so
 * what a month costs is the obligations that were live in it — and paging back
 * is how a plan that has changed is read as it stood. Nothing falls off the
 * edge: what ended before this month and what starts after it are two
 * disclosures under the list, not omissions.
 *
 * Every row states its amount in its own currency, as it is charged. The
 * subtotals are the converted figures, so they carry the footnote saying at
 * which rates and for which day (docs/design/direction.md).
 *
 * Picking a slice of the ring narrows the list to that category and says so
 * with a chip that drops it again — colour is never the only thing that marks
 * a choice.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Motion } from 'motion-v';
import type { Expense } from '@magermoney/domain';
import { addDays, firstOfMonth, lastOfMonth } from '@magermoney/domain';
import {
  AmountLockup,
  Button,
  DonutChart,
  FilterChipRow,
  RouteError,
  RowGroup,
  Skeleton,
  TransactionRow,
  listStagger,
  type AmountLocale,
  type DonutSegment,
  type FilterChipItem,
} from '@magermoney/ui';
import { useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { formatDay, formatMonth, type DateLocale } from '@/shared/dates/format';
import { groupExpenses } from '../application/expense-groups';
import { useExpenseCategories } from '../application/use-expense-categories';
import { useExpenses } from '../application/use-expenses';

const { t, locale } = useI18n();
const { dtos, isLoading, isError, refetch } = useExpenses();
const { categories } = useExpenseCategories();
const rates = useRates();
const registry = useCurrencyRegistry();
const { current } = useDisplayCurrency();
const showEnded = ref(false);
const showUpcoming = ref(false);

const amountLocale = computed(() => locale.value as AmountLocale);
const uiLocale = computed(() => locale.value as DateLocale);

/* The month being read, as its first day. The segment opens on the current one. */
const thisMonth = firstOfMonth(todayIso());
const month = ref(thisMonth);
/** The category picked in the ring, which narrows the list under it. */
const categoryId = ref<string | null>(null);
const monthLabel = computed(() => formatMonth(month.value, uiLocale.value));

const model = computed(() =>
  groupExpenses(
    dtos.value,
    categories.value,
    rates.table.value,
    registry.value,
    current.value,
    todayIso(),
    month.value,
  ),
);
/* A failed list also answers with no rows, and "no expenses yet" would be a lie
 * about the plan rather than about the request. */
const isEmpty = computed(
  () => !isLoading.value && !isError.value && model.value !== undefined && dtos.value.length === 0,
);
const unconvertibleNames = computed(() => model.value?.unconvertible.map((e) => e.name).join(', '));
/** Only rendered while open: a collapsed list must not answer a row query. */
const endedShown = computed(() => (showEnded.value ? (model.value?.ended ?? []) : []));
const upcomingShown = computed(() => (showUpcoming.value ? (model.value?.upcoming ?? []) : []));

/** Biggest slice first: the ring is read from the thing that costs most. */
const segments = computed<DonutSegment[]>(() =>
  [...(model.value?.groups ?? [])]
    .sort((a, b) => b.total.amount.comparedTo(a.total.amount))
    .map((g) => ({
      id: g.category.id,
      label: g.category.name,
      value: g.total.amount.toNumber(),
      amount: g.total.toString(),
      emoji: g.category.icon ?? undefined,
    })),
);
const shown = computed(() =>
  (model.value?.groups ?? []).filter(
    (g) => categoryId.value === null || g.category.id === categoryId.value,
  ),
);

/*
 * A chip is a filter that is *on*: the month appears only once it is not the
 * one the segment opens on, so the row is empty on arrival rather than carrying
 * a filter nobody set.
 */
const chips = computed<FilterChipItem[]>(() => {
  const list: FilterChipItem[] = [];
  if (month.value !== thisMonth)
    list.push({
      id: 'month',
      label: monthLabel.value,
      removeLabel: t('expenses.month.remove', { period: monthLabel.value }),
    });
  const picked = model.value?.groups.find((g) => g.category.id === categoryId.value);
  if (picked)
    list.push({
      id: 'category',
      label: picked.category.name,
      removeLabel: t('expenses.category.remove', { name: picked.category.name }),
    });
  return list;
});

function dropChip(chipId: string) {
  if (chipId === 'month') month.value = thisMonth;
  else categoryId.value = null;
}
function stepMonth(by: -1 | 1) {
  month.value =
    by === -1
      ? firstOfMonth(addDays(firstOfMonth(month.value), -1))
      : firstOfMonth(addDays(lastOfMonth(month.value), 1));
}
/** The ring hands back `null` when the slice that was on is picked again. */
const pickSlice = (id: string | null) => {
  categoryId.value = id;
};

const own = (e: Expense) => e.amount.toString();
const periodLabel = (e: Expense) =>
  e.period === 'yearly' ? t('expenses.period.yearly') : t('expenses.period.monthly');
</script>

<template>
  <section class="flex flex-col gap-5" data-testid="expenses-segment">
    <h2 class="sr-only">
      {{ t('expenses.title') }}
    </h2>

    <div v-if="isError" data-testid="expenses-error">
      <RouteError
        :title="t('expenses.error.title')"
        :action-label="t('expenses.error.retry')"
        @retry="refetch"
      />
    </div>

    <div v-else-if="!model" class="flex flex-col gap-3">
      <Skeleton class="h-72 w-full rounded-xl" />
      <Skeleton class="h-24 w-full rounded-xl" />
    </div>

    <div
      v-else-if="isEmpty"
      class="bg-surface shadow-card mt-4 flex flex-col items-start gap-2 rounded-xl p-5"
      data-testid="expenses-empty"
    >
      <p class="text-base font-semibold">
        {{ t('expenses.empty.title') }}
      </p>
      <p class="text-muted-foreground max-w-prose text-sm">
        {{ t('expenses.empty.body') }}
      </p>
      <Button as-child class="mt-2 min-h-11 rounded-xl px-4">
        <RouterLink :to="{ name: 'expense-new' }" data-testid="expenses-add">
          {{ t('expenses.add') }}
        </RouterLink>
      </Button>
    </div>

    <template v-else>
      <FilterChipRow
        :chips="chips"
        :aria-label="t('expenses.filters')"
        data-testid="expenses-filters"
        @remove="dropChip"
      />

      <div class="bg-surface shadow-card rounded-xl p-4">
        <DonutChart
          data-testid="expenses-donut"
          :label="t('expenses.byCategory')"
          :amount="model.planned.toString()"
          :code="model.planned.currency.code"
          :scale="model.planned.currency.scale"
          :locale="amountLocale"
          :segments="segments"
          :period="monthLabel"
          :prev-label="t('expenses.month.prev')"
          :next-label="t('expenses.month.next')"
          :caption="t('expenses.essentialOf', { amount: model.essential.round().toString() })"
          :empty-label="t('expenses.emptyMonth')"
          :active-id="categoryId"
          :legend-label="t('expenses.byCategory')"
          @prev="stepMonth(-1)"
          @next="stepMonth(1)"
          @update:active-id="pickSlice"
        />
        <p class="text-muted-foreground mt-3 text-center text-xs" data-testid="expenses-rate-note">
          {{ t('expenses.rateDate', { date: formatDay(rates.date.value, uiLocale) }) }}
        </p>
      </div>

      <Motion
        v-for="(g, i) in shown"
        :key="g.category.id"
        tag="div"
        v-bind="listStagger(i)"
        :data-testid="`expense-group-${g.category.id}`"
      >
        <RowGroup
          :title="g.category.icon ? `${g.category.icon} ${g.category.name}` : g.category.name"
          :amount="g.total.toString()"
          :code="g.total.currency.code"
          :scale="g.total.currency.scale"
          :locale="amountLocale"
        >
          <li v-for="{ expense, monthly } in g.rows" :key="expense.id">
            <TransactionRow
              :as="RouterLink"
              :href="`/plan/expenses/${expense.id}/edit`"
              :title="expense.name"
              :category="
                expense.isEssential
                  ? `${periodLabel(expense)} · ${t('expenses.essential')}`
                  : periodLabel(expense)
              "
              :amount="expense.period === 'yearly' ? monthly.toString() : own(expense)"
              :code="expense.amount.currency.code"
              :scale="expense.amount.currency.scale"
              :locale="amountLocale"
              :show-code="expense.amount.currency.code !== current"
              :time="
                expense.period === 'yearly'
                  ? t('expenses.yearly', {
                      amount: `${own(expense)} ${expense.amount.currency.code}`,
                    })
                  : undefined
              "
              :data-testid="`expense-row-${expense.id}`"
            />
          </li>
        </RowGroup>
      </Motion>

      <div
        v-if="shown.length === 0"
        class="bg-surface shadow-card flex flex-col items-start gap-2 rounded-xl p-4"
        data-testid="expenses-empty-month"
      >
        <p class="text-sm font-medium">
          {{ categoryId ? t('expenses.emptyCategory') : t('expenses.emptyMonthBody') }}
        </p>
        <Button
          v-if="categoryId || month !== thisMonth"
          variant="ghost"
          size="sm"
          class="min-h-11 px-2"
          data-testid="expenses-reset-filters"
          @click="
            categoryId = null;
            month = thisMonth;
          "
        >
          {{ t('expenses.resetFilters') }}
        </Button>
        <Button v-else as-child class="mt-1 min-h-11 rounded-xl px-4">
          <RouterLink :to="{ name: 'expense-new' }" data-testid="expenses-add">
            {{ t('expenses.add') }}
          </RouterLink>
        </Button>
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3 px-2">
          <span class="text-sm font-medium">{{ t('expenses.planned') }}</span>
          <AmountLockup
            data-testid="expenses-planned"
            :amount="model.planned.toString()"
            :code="model.planned.currency.code"
            :scale="model.planned.currency.scale"
            :locale="amountLocale"
            class="text-base"
          />
        </div>
        <div class="text-muted-foreground flex items-baseline justify-between gap-3 px-2 text-sm">
          <span>{{ t('expenses.essentialTotal') }}</span>
          <AmountLockup
            data-testid="expenses-essential"
            :amount="model.essential.toString()"
            :code="model.essential.currency.code"
            :scale="model.essential.currency.scale"
            :locale="amountLocale"
            class="text-sm"
          />
        </div>
        <p v-if="model.unconvertible.length > 0" class="text-muted-foreground px-2 text-xs">
          {{ t('expenses.unconvertible', { names: unconvertibleNames }) }}
        </p>
      </div>

      <div>
        <Button as-child variant="outline" class="min-h-11 rounded-xl px-4">
          <RouterLink :to="{ name: 'expense-new' }" data-testid="expenses-add">
            {{ t('expenses.add') }}
          </RouterLink>
        </Button>
      </div>

      <div v-if="model.upcoming.length > 0" class="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-11 self-start px-2"
          :aria-expanded="showUpcoming"
          aria-controls="upcoming-expenses"
          data-testid="expenses-upcoming-toggle"
          @click="showUpcoming = !showUpcoming"
        >
          {{
            showUpcoming
              ? t('expenses.upcoming.hide')
              : t('expenses.upcoming.show', { n: model.upcoming.length })
          }}
        </Button>
        <RowGroup v-show="showUpcoming" id="upcoming-expenses">
          <li v-for="e in upcomingShown" :key="e.id">
            <TransactionRow
              :as="RouterLink"
              :href="`/plan/expenses/${e.id}/edit`"
              :title="e.name"
              :category="t('expenses.startsOn', { date: formatDay(e.activeFrom, uiLocale) })"
              :amount="own(e)"
              :code="e.amount.currency.code"
              :scale="e.amount.currency.scale"
              :locale="amountLocale"
              :show-code="e.amount.currency.code !== current"
              :data-testid="`expense-row-${e.id}`"
            />
          </li>
        </RowGroup>
      </div>

      <div v-if="model.ended.length > 0" class="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-11 self-start px-2"
          :aria-expanded="showEnded"
          aria-controls="ended-expenses"
          data-testid="expenses-ended-toggle"
          @click="showEnded = !showEnded"
        >
          {{
            showEnded
              ? t('expenses.ended.hide')
              : t('expenses.ended.show', { n: model.ended.length })
          }}
        </Button>
        <RowGroup v-show="showEnded" id="ended-expenses">
          <li v-for="e in endedShown" :key="e.id">
            <TransactionRow
              :as="RouterLink"
              :href="`/plan/expenses/${e.id}/edit`"
              :title="e.name"
              :category="
                t('expenses.endedOn', { date: formatDay(e.activeTo ?? e.activeFrom, uiLocale) })
              "
              :amount="own(e)"
              :code="e.amount.currency.code"
              :scale="e.amount.currency.scale"
              :locale="amountLocale"
              :show-code="e.amount.currency.code !== current"
              class="opacity-70"
              :data-testid="`expense-row-${e.id}`"
            />
          </li>
        </RowGroup>
      </div>
    </template>
  </section>
</template>
