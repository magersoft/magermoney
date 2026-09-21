<script setup lang="ts">
/**
 * The Assets segment: money that has already become a thing.
 *
 * The total is the one converted figure on the screen, so it carries the
 * footnote saying at which day's rates — and it counts only the assets marked
 * for the capital, which is the same number the Home screen adds to the
 * accounts.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Motion } from 'motion-v';
import { assetsTotal } from '@magermoney/domain';
import {
  AmountLockup,
  Button,
  RouteError,
  RowGroup,
  Skeleton,
  listStagger,
  type AmountLocale,
} from '@magermoney/ui';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useDisplayCurrency, useRates } from '@/modules/rates';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import { useAssets } from '../application/use-assets';
import AssetRow from './AssetRow.vue';

const { t, locale } = useI18n();
const { assets, isLoading, isError, refetch } = useAssets();
const rates = useRates();
const registry = useCurrencyRegistry();
const { current } = useDisplayCurrency();

const amountLocale = computed(() => locale.value as AmountLocale);
const uiLocale = computed(() => locale.value as DateLocale);

const listed = computed(() => assets.value.filter((a) => !a.archived));
const isEmpty = computed(() => !isLoading.value && !isError.value && listed.value.length === 0);

const total = computed(() => {
  const table = rates.table.value;
  const display = registry.value.get(current.value);
  if (!table || display.isErr()) return undefined;
  return assetsTotal(listed.value, table, display.value);
});
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="assets-segment">
    <h2 class="sr-only">
      {{ t('assets.title') }}
    </h2>

    <div v-if="isError" data-testid="assets-error">
      <RouteError
        :title="t('assets.error.title')"
        :action-label="t('assets.error.retry')"
        @retry="refetch"
      />
    </div>

    <div v-else-if="isLoading" class="flex flex-col gap-3">
      <Skeleton class="h-24 w-full rounded-xl" />
      <Skeleton class="h-24 w-full rounded-xl" />
    </div>

    <div
      v-else-if="isEmpty"
      class="bg-surface shadow-card mt-4 flex flex-col items-start gap-2 rounded-xl p-5"
      data-testid="assets-empty"
    >
      <p class="text-base font-semibold">
        {{ t('assets.empty.title') }}
      </p>
      <p class="text-muted-foreground max-w-prose text-sm">
        {{ t('assets.empty.body') }}
      </p>
      <Button as-child class="mt-2 min-h-11 rounded-xl px-4">
        <RouterLink :to="{ name: 'asset-new' }" data-testid="assets-add">
          {{ t('assets.add') }}
        </RouterLink>
      </Button>
    </div>

    <template v-else>
      <RowGroup :aria-label="t('assets.title')">
        <Motion
          v-for="(a, i) in listed"
          :key="a.id"
          tag="li"
          v-bind="listStagger(i)"
          class="min-w-0"
        >
          <RouterLink
            :to="{ name: 'asset', params: { id: a.id } }"
            class="block outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <AssetRow :asset="a" />
          </RouterLink>
        </Motion>
      </RowGroup>

      <div v-if="total" class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3 px-2">
          <span class="text-sm font-medium">{{ t('assets.total') }}</span>
          <AmountLockup
            data-testid="assets-total"
            :amount="total.total.toString()"
            :code="total.total.currency.code"
            :scale="total.total.currency.scale"
            :locale="amountLocale"
            class="text-base"
          />
        </div>
        <p class="text-muted-foreground px-2 text-xs" data-testid="assets-rate-note">
          {{ t('assets.rateDate', { date: formatDay(rates.date.value, uiLocale) }) }}
        </p>
        <p
          v-if="total.unconvertible.length > 0"
          class="text-muted-foreground px-2 text-xs"
          data-testid="assets-unconvertible"
        >
          {{
            t('assets.unconvertible', { names: total.unconvertible.map((a) => a.name).join(', ') })
          }}
        </p>
      </div>

      <div>
        <Button as-child variant="outline" class="min-h-11 rounded-xl px-4">
          <RouterLink :to="{ name: 'asset-new' }" data-testid="assets-add">
            {{ t('assets.add') }}
          </RouterLink>
        </Button>
      </div>
    </template>
  </section>
</template>
