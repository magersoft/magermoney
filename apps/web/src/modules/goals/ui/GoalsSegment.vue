<script setup lang="ts">
/**
 * The Goals segment: what the money is still on its way to.
 *
 * Archived goals are served with the rest and filtered out here — the API has
 * no opinion about what a screen shows, and the same list feeds the picker on
 * an account's screen.
 *
 * A failed request answers with no rows exactly as an empty account does, so
 * the error state comes first: "no goals yet" would be a lie about the plan
 * rather than about the request.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Motion } from 'motion-v';
import { Button, RouteError, Skeleton, listStagger } from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useRates } from '@/modules/rates';
import { progressOf } from '../application/use-goal-progress';
import { useGoals } from '../application/use-goals';
import GoalCard from './GoalCard.vue';

const { t } = useI18n();
const { goals, isLoading, isError, refetch } = useGoals();
const accounts = useAccounts();
const rates = useRates();
const registry = useCurrencyRegistry();

const active = computed(() => goals.value.filter((g) => g.archivedAt === null));
const isEmpty = computed(() => !isLoading.value && !isError.value && active.value.length === 0);

/**
 * Progress for every goal at once, from one accounts query — a per-card query
 * would be one request per goal for the same list.
 */
const progressById = computed(() => {
  const table = rates.table.value;
  return new Map(
    active.value.map((g) => [g.id, progressOf(g, accounts.accounts.value, table, registry.value)]),
  );
});
const linkedOf = (goalId: string) => accounts.accounts.value.filter((a) => a.goalId === goalId);
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="goals-segment">
    <h2 class="sr-only">
      {{ t('goals.title') }}
    </h2>

    <div v-if="isError" data-testid="goals-error">
      <RouteError
        :title="t('goals.error.title')"
        :action-label="t('goals.error.retry')"
        @retry="refetch"
      />
    </div>

    <div v-else-if="isLoading" class="flex flex-col gap-3">
      <Skeleton class="h-40 w-full rounded-xl" />
      <Skeleton class="h-40 w-full rounded-xl" />
    </div>

    <div
      v-else-if="isEmpty"
      class="bg-surface shadow-card mt-4 flex flex-col items-start gap-2 rounded-xl p-5"
      data-testid="goals-empty"
    >
      <p class="text-base font-semibold">
        {{ t('goals.empty.title') }}
      </p>
      <p class="text-muted-foreground max-w-prose text-sm">
        {{ t('goals.empty.body') }}
      </p>
      <Button as-child class="mt-2 min-h-11 rounded-xl px-4">
        <RouterLink :to="{ name: 'goal-new' }" data-testid="goals-add">
          {{ t('goals.add') }}
        </RouterLink>
      </Button>
    </div>

    <template v-else>
      <ul class="flex list-none flex-col gap-3 p-0">
        <Motion v-for="(g, i) in active" :key="g.id" tag="li" v-bind="listStagger(i)">
          <RouterLink
            :to="{ name: 'goal', params: { id: g.id } }"
            class="block rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <GoalCard :goal="g" :progress="progressById.get(g.id)" :linked="linkedOf(g.id)" />
          </RouterLink>
        </Motion>
      </ul>

      <div>
        <Button as-child variant="outline" class="min-h-11 rounded-xl px-4">
          <RouterLink :to="{ name: 'goal-new' }" data-testid="goals-add">
            {{ t('goals.add') }}
          </RouterLink>
        </Button>
      </div>
    </template>
  </section>
</template>
