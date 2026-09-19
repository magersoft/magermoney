<script setup lang="ts">
/**
 * The Income segment of the Plan screen: what is coming in, and what used to.
 * A source counts as ended once its `activeTo` is behind today; one that starts
 * next month is already listed — it is part of the plan, just not of this
 * month's numbers, which the domain's `isActiveOn` decides on the dashboard.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Motion } from 'motion-v';
import { Button, Skeleton, listStagger } from '@magermoney/ui';
import { todayIso } from '@/modules/rates';
import { useIncomeSources } from '../application/use-income-sources';
import IncomeSourceRow from './IncomeSourceRow.vue';

const { t } = useI18n();
const { sources, isLoading } = useIncomeSources();
const showEnded = ref(false);

const today = todayIso();
/** Primary first, then by name: the primary source is the one the dashboard counts from. */
const byPrimaryThenName = (a: { isPrimary: boolean; name: string }, b: typeof a) =>
  Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name);
const current = computed(() =>
  sources.value.filter((s) => s.activeTo === null || s.activeTo >= today).sort(byPrimaryThenName),
);
const ended = computed(() =>
  sources.value.filter((s) => s.activeTo !== null && s.activeTo < today).sort(byPrimaryThenName),
);
</script>

<template>
  <section data-testid="income-segment">
    <div v-if="isLoading" class="space-y-3">
      <Skeleton class="h-14 w-full" />
      <Skeleton class="h-14 w-full" />
    </div>

    <div v-else-if="sources.length === 0" class="mt-10 text-center" data-testid="income-empty">
      <p class="text-lg font-semibold">
        {{ t('income.empty.title') }}
      </p>
      <p class="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">
        {{ t('income.empty.body') }}
      </p>
    </div>

    <ul v-else class="divide-y divide-border/60 border-t border-border">
      <Motion v-for="(s, i) in current" :key="s.id" tag="li" v-bind="listStagger(i)">
        <IncomeSourceRow :source="s" />
      </Motion>
    </ul>

    <div class="mt-4" :class="sources.length === 0 ? 'text-center' : ''">
      <Button as-child variant="outline" class="min-h-9 pointer-coarse:min-h-11">
        <RouterLink to="/plan/income/new" data-testid="income-add">
          {{ t('income.add') }}
        </RouterLink>
      </Button>
    </div>

    <div v-if="ended.length > 0" class="mt-8">
      <Button
        variant="ghost"
        size="sm"
        class="min-h-9 pointer-coarse:min-h-11"
        :aria-expanded="showEnded"
        :aria-controls="showEnded ? 'ended-sources' : undefined"
        data-testid="income-ended-toggle"
        @click="showEnded = !showEnded"
      >
        {{ showEnded ? t('income.ended.hide') : t('income.ended.show', { n: ended.length }) }}
      </Button>
      <ul
        v-if="showEnded"
        id="ended-sources"
        class="mt-2 divide-y divide-border/60 border-t border-border"
      >
        <li v-for="s in ended" :key="s.id">
          <IncomeSourceRow :source="s" />
        </li>
      </ul>
    </div>
  </section>
</template>
