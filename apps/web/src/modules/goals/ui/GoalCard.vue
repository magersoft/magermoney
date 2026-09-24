<script setup lang="ts">
/**
 * One goal, led by what is *left* of it.
 *
 * Every savings screen leads with the amount saved, and the saved amount is the
 * one a person already knows. What governs the next decision is the remainder,
 * and the remainder is what the forecast line underneath is a sentence about —
 * so the remainder is the lockup, and saved-against-target is the quiet line
 * under the rule.
 *
 * The forecast is this screen's one piece of knowledge no other screen has, so
 * it always occupies its slot: when there is no date, the line says which of
 * the four reasons, never nothing. A blank there would read as a goal the app
 * has no opinion about.
 */
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { AmountLockup, MarkDisc, ProgressRule, type AmountLocale } from '@magermoney/ui';
import type { AccountDto } from '@magermoney/contracts';
import type { Goal, GoalProgress } from '@magermoney/domain';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import { useGoalForecast } from '../application/use-goal-forecast';

const props = defineProps<{
  goal: Goal;
  progress: GoalProgress | undefined;
  /** The accounts funding this goal — the card measures its own rate from their journals. */
  linked: AccountDto[];
}>();

const { forecast } = useGoalForecast(
  toRef(props, 'goal'),
  toRef(props, 'progress'),
  toRef(props, 'linked'),
);

const { t, locale } = useI18n();
const amountLocale = computed(() => locale.value as AmountLocale);
const uiLocale = computed(() => locale.value as DateLocale);

const achieved = computed(() => props.goal.achievedAt !== null);
const percent = computed(() => Math.round((props.progress?.ratio ?? 0) * 100));

/** One line, always filled: a date, or the reason there is none. */
const forecastLine = computed(() => {
  if (achieved.value) return t('goals.forecast.achieved');
  const f = forecast.value;
  if (!f) return t('goals.forecast.pending');
  return f.kind === 'date'
    ? t('goals.forecast.on', { date: formatDay(f.on, uiLocale.value) })
    : t(`goals.forecast.${f.reason}`);
});
</script>

<template>
  <article
    class="bg-surface shadow-card flex flex-col gap-3 rounded-xl p-4"
    :data-testid="`goal-card-${goal.id}`"
  >
    <header class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <MarkDisc :emoji="goal.icon" :color="goal.color" :name="goal.name" class="size-9" />
        <h3 class="min-w-0 truncate text-base font-semibold">
          {{ goal.name }}
        </h3>
      </div>
      <span
        v-if="achieved"
        class="text-xs font-medium text-muted-foreground"
        data-testid="goal-achieved"
      >
        {{ t('goals.achieved') }}
      </span>
    </header>

    <div class="flex flex-col gap-1">
      <p class="text-muted-foreground text-xs">
        {{ achieved ? t('goals.reachedLabel') : t('goals.remainingLabel') }}
      </p>
      <AmountLockup
        v-if="progress"
        :data-testid="`goal-remaining-${goal.id}`"
        :amount="(achieved ? progress.funded : progress.remaining).toString()"
        :code="goal.target.currency.code"
        :scale="goal.target.currency.scale"
        :locale="amountLocale"
        class="text-2xl"
      />
      <p v-else class="text-muted-foreground text-sm">
        {{ t('goals.progressPending') }}
      </p>
    </div>

    <ProgressRule
      :value="percent"
      :max="100"
      :label="t('goals.progressLabel', { name: goal.name, percent })"
    />

    <p v-if="progress" class="text-muted-foreground text-xs" :data-testid="`goal-of-${goal.id}`">
      {{
        t('goals.fundedOf', {
          funded: progress.funded.round().toString(),
          target: goal.target.round().toString(),
          code: goal.target.currency.code,
        })
      }}
    </p>

    <p class="text-sm" :data-testid="`goal-forecast-${goal.id}`">
      {{ forecastLine }}
    </p>

    <p
      v-if="progress && progress.unconvertible.length > 0"
      class="text-muted-foreground text-xs"
      :data-testid="`goal-unconvertible-${goal.id}`"
    >
      {{
        t('goals.unconvertible', { names: progress.unconvertible.map((a) => a.name).join(', ') })
      }}
    </p>
  </article>
</template>
