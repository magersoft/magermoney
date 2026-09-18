<script setup lang="ts">
/**
 * Variable categories and their ceilings. Limits only: a Budget has no Spend
 * until month close (phase 5), so nothing here draws progress — a bar with no
 * spend behind it would claim tracking the app does not do yet.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Budget } from '@magermoney/domain';
import { Button, RouteError, Skeleton } from '@magermoney/ui';
import { useCurrencyRegistry } from '@/modules/currencies';
import { MoneyText, todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { summariseBudgets } from '../application/budget-summary';
import { useBudgets } from '../application/use-budgets';

const { t } = useI18n();
const { dtos, isLoading, isError, refetch } = useBudgets();
const rates = useRates();
const registry = useCurrencyRegistry();
const { current } = useDisplayCurrency();
const showEnded = ref(false);

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
const own = (b: Budget) => `${b.monthlyLimit.round().toString()} ${b.monthlyLimit.currency.code}`;
</script>

<template>
  <section class="pb-8" data-testid="budgets-segment">
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

    <Skeleton v-else-if="!model" class="h-24 w-full" />

    <div v-else-if="isEmpty" class="mt-10 text-center" data-testid="budgets-empty">
      <p class="text-lg font-semibold">
        {{ t('budgets.empty.title') }}
      </p>
      <p class="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">
        {{ t('budgets.empty.body') }}
      </p>
      <Button as-child class="mt-4">
        <RouterLink :to="{ name: 'budget-new' }" data-testid="budgets-add">
          {{ t('budgets.add') }}
        </RouterLink>
      </Button>
    </div>

    <template v-else>
      <ul class="mt-5 divide-y divide-border/60 border-t border-border">
        <li v-for="b in model.active" :key="b.id">
          <RouterLink
            :to="{ name: 'budget-edit', params: { id: b.id } }"
            :data-testid="`budget-row-${b.id}`"
            class="flex min-h-13 items-center gap-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span class="min-w-0 flex-1 truncate text-base">{{ b.name }}</span>
            <span class="text-right">
              <span class="block font-mono text-base tabular-nums">
                {{ own(b) }}
                <span class="text-xs text-muted-foreground">{{ t('budgets.perMonth') }}</span>
              </span>
              <MoneyText
                v-if="b.monthlyLimit.currency.code !== current"
                class="text-xs text-muted-foreground"
                :amount="b.monthlyLimit.toString()"
                :currency="b.monthlyLimit.currency.code"
              />
            </span>
          </RouterLink>
        </li>
      </ul>

      <div
        class="mt-6 flex items-baseline justify-between gap-3 border-t border-border pt-3 text-sm"
      >
        <span>{{ t('budgets.total') }}</span>
        <span data-testid="budgets-total">
          <MoneyText :amount="model.total.toString()" :currency="model.total.currency.code" />
        </span>
      </div>
      <p v-if="model.unconvertible.length > 0" class="mt-3 text-xs text-muted-foreground">
        {{ t('budgets.unconvertible', { names: unconvertibleNames }) }}
      </p>

      <div class="mt-4">
        <Button as-child variant="outline" class="min-h-9 pointer-coarse:min-h-11">
          <RouterLink :to="{ name: 'budget-new' }" data-testid="budgets-add">
            {{ t('budgets.add') }}
          </RouterLink>
        </Button>
      </div>

      <div v-if="model.ended.length > 0" class="mt-8">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-9 pointer-coarse:min-h-11"
          :aria-expanded="showEnded"
          aria-controls="ended-budgets"
          data-testid="budgets-ended-toggle"
          @click="showEnded = !showEnded"
        >
          {{
            showEnded ? t('budgets.ended.hide') : t('budgets.ended.show', { n: model.ended.length })
          }}
        </Button>
        <ul id="ended-budgets" :hidden="!showEnded" class="mt-2 divide-y divide-border/60">
          <li v-for="b in endedShown" :key="b.id">
            <RouterLink
              :to="{ name: 'budget-edit', params: { id: b.id } }"
              :data-testid="`budget-row-${b.id}`"
              class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-muted-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span class="truncate">{{ b.name }}</span>
              <span class="font-mono tabular-nums">{{ own(b) }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
