<script setup lang="ts">
/**
 * Home. The one number that matters, the one that matters until payday, and
 * where all of it is. Everything on this screen is derived on the client from
 * the account list and the day's rates (ADR 0003).
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, Skeleton } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import { useCapitalSummary } from '../application/use-capital-summary';
import AccountRow from './AccountRow.vue';
import ProviderGroup from './ProviderGroup.vue';

const { t } = useI18n();
const { summary, isLoading, rateDate } = useCapitalSummary();
const showArchived = ref(false);
const unconvertibleCodes = computed(() =>
  [...new Set(summary.value?.unconvertible.map((a) => a.balance.currency.code))].join(', '),
);
const isEmpty = computed(
  () =>
    !isLoading.value &&
    summary.value !== undefined &&
    summary.value.groups.length === 0 &&
    summary.value.archived.length === 0,
);
</script>

<template>
  <section class="pb-8">
    <h1 class="sr-only">
      {{ t('accounts.title') }}
    </h1>

    <div class="pt-1">
      <p class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('accounts.total') }}
      </p>
      <Skeleton v-if="!summary" class="mt-2 h-10 w-48" />
      <MoneyText
        v-else
        data-testid="capital-total"
        class="mt-1 text-[40px] font-semibold tracking-[-0.01em]"
        :amount="summary.total.toString()"
        :currency="summary.total.currency.code"
      />
      <p class="mt-1 text-xs text-muted-foreground">
        {{ t('accounts.rateDate', { date: rateDate }) }}
      </p>
    </div>

    <div class="mt-5 flex items-baseline justify-between border-t border-border pt-3">
      <span class="text-sm text-muted-foreground">{{ t('accounts.payday') }}</span>
      <Skeleton v-if="!summary" class="h-5 w-24" />
      <MoneyText
        v-else
        data-testid="capital-payday"
        class="text-base"
        :amount="summary.availableUntilPayday.toString()"
        :currency="summary.availableUntilPayday.currency.code"
      />
    </div>

    <p
      v-if="summary && summary.unconvertible.length > 0"
      class="mt-3 text-xs text-muted-foreground"
    >
      {{ t('accounts.unconvertible', { codes: unconvertibleCodes }) }}
    </p>

    <div v-if="isEmpty" class="mt-10 text-center">
      <p class="text-lg font-semibold">
        {{ t('accounts.empty.title') }}
      </p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t('accounts.empty.body') }}
      </p>
      <Button class="mt-4" data-testid="accounts-add" @click="$router.push('/accounts/new')">
        {{ t('accounts.empty.cta') }}
      </Button>
    </div>

    <div v-else class="mt-6 space-y-6">
      <ProviderGroup v-for="(g, i) in summary?.groups ?? []" :key="g.bank" :group="g" :index="i" />
    </div>

    <div v-if="summary && summary.archived.length > 0" class="mt-8">
      <Button variant="ghost" size="sm" class="min-h-11" @click="showArchived = !showArchived">
        {{
          showArchived
            ? t('accounts.archived.hide')
            : t('accounts.archived.show', { n: summary.archived.length })
        }}
      </Button>
      <ul v-if="showArchived" class="mt-2 divide-y divide-border/60">
        <li v-for="a in summary.archived" :key="a.id" class="grayscale">
          <AccountRow :account="a" />
        </li>
      </ul>
    </div>
  </section>
</template>
