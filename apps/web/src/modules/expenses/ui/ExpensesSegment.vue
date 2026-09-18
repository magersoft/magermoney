<script setup lang="ts">
/** Fixed obligations by category: what each costs a month, what all of it costs, and how much of that is not optional. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Motion } from 'motion-v';
import type { Expense } from '@magermoney/domain';
import { Button, Skeleton, listStagger } from '@magermoney/ui';
import { useCurrencyRegistry } from '@/modules/currencies';
import { MoneyText, todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { groupExpenses } from '../application/expense-groups';
import { useExpenseCategories } from '../application/use-expense-categories';
import { useExpenses } from '../application/use-expenses';

const { t } = useI18n();
const { dtos, isLoading } = useExpenses();
const { categories } = useExpenseCategories();
const rates = useRates();
const registry = useCurrencyRegistry();
const { current } = useDisplayCurrency();
const showEnded = ref(false);

const model = computed(() =>
  groupExpenses(
    dtos.value,
    categories.value,
    rates.table.value,
    registry.value,
    current.value,
    todayIso(),
  ),
);
const isEmpty = computed(
  () => !isLoading.value && model.value !== undefined && dtos.value.length === 0,
);
const unconvertibleNames = computed(() => model.value?.unconvertible.map((e) => e.name).join(', '));
/** Only rendered while open: a collapsed list must not answer a row query. */
const endedShown = computed(() => (showEnded.value ? (model.value?.ended ?? []) : []));
const own = (e: Expense) => `${e.amount.round().toString()} ${e.amount.currency.code}`;
</script>

<template>
  <section class="pb-8" data-testid="expenses-segment">
    <h2 class="sr-only">
      {{ t('expenses.title') }}
    </h2>
    <Skeleton v-if="!model" class="h-24 w-full" />

    <div v-else-if="isEmpty" class="mt-10 text-center" data-testid="expenses-empty">
      <p class="text-lg font-semibold">
        {{ t('expenses.empty.title') }}
      </p>
      <p class="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">
        {{ t('expenses.empty.body') }}
      </p>
      <Button as-child class="mt-4">
        <RouterLink :to="{ name: 'expense-new' }" data-testid="expenses-add">
          {{ t('expenses.add') }}
        </RouterLink>
      </Button>
    </div>

    <template v-else>
      <Motion
        v-for="(g, i) in model.groups"
        :key="g.category.id"
        tag="section"
        class="mt-5 border-t border-border pt-3"
        v-bind="listStagger(i)"
      >
        <header class="flex items-baseline justify-between gap-3">
          <h3 class="truncate font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {{ g.category.name }}
          </h3>
          <span class="text-sm">
            <MoneyText :amount="g.total.toString()" :currency="g.total.currency.code" />
            <span class="text-xs text-muted-foreground"> {{ t('expenses.perMonth') }}</span>
          </span>
        </header>
        <ul class="divide-y divide-border/60">
          <li v-for="{ expense, monthly } in g.rows" :key="expense.id">
            <RouterLink
              :to="{ name: 'expense-edit', params: { id: expense.id } }"
              :data-testid="`expense-row-${expense.id}`"
              class="flex min-h-13 items-center gap-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base">{{ expense.name }}</span>
                <span v-if="expense.isEssential" class="block text-xs text-muted-foreground">{{
                  t('expenses.essential')
                }}</span>
              </span>
              <span class="text-right">
                <span class="block font-mono text-base tabular-nums">
                  <template v-if="expense.period === 'yearly'">{{
                    t('expenses.yearly', {
                      amount: own(expense),
                      monthly: monthly.round().toString(),
                    })
                  }}</template>
                  <template v-else>{{ own(expense) }}</template>
                </span>
                <MoneyText
                  v-if="expense.amount.currency.code !== current"
                  class="text-xs text-muted-foreground"
                  :amount="monthly.toString()"
                  :currency="monthly.currency.code"
                />
              </span>
            </RouterLink>
          </li>
        </ul>
      </Motion>

      <dl class="mt-6 border-t border-border pt-3 text-sm">
        <div class="flex items-baseline justify-between py-1">
          <dt>{{ t('expenses.planned') }}</dt>
          <dd data-testid="expenses-planned">
            <MoneyText :amount="model.planned.toString()" :currency="model.planned.currency.code" />
          </dd>
        </div>
        <div class="flex items-baseline justify-between py-1 text-muted-foreground">
          <dt>{{ t('expenses.essentialTotal') }}</dt>
          <dd data-testid="expenses-essential">
            <MoneyText
              :amount="model.essential.toString()"
              :currency="model.essential.currency.code"
            />
          </dd>
        </div>
      </dl>
      <p v-if="model.unconvertible.length > 0" class="mt-3 text-xs text-muted-foreground">
        {{ t('expenses.unconvertible', { names: unconvertibleNames }) }}
      </p>

      <div class="mt-4">
        <Button as-child variant="outline" class="min-h-9 pointer-coarse:min-h-11">
          <RouterLink :to="{ name: 'expense-new' }" data-testid="expenses-add">
            {{ t('expenses.add') }}
          </RouterLink>
        </Button>
      </div>

      <div v-if="model.ended.length > 0" class="mt-8">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-9 pointer-coarse:min-h-11"
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
        <ul id="ended-expenses" :hidden="!showEnded" class="mt-2 divide-y divide-border/60">
          <li v-for="e in endedShown" :key="e.id">
            <RouterLink
              :to="{ name: 'expense-edit', params: { id: e.id } }"
              :data-testid="`expense-row-${e.id}`"
              class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-muted-foreground"
            >
              <span class="truncate">{{ e.name }}</span>
              <span class="font-mono tabular-nums">{{ own(e) }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
