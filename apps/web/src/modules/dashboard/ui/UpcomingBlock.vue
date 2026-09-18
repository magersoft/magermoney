<script setup lang="ts">
/** What is next: payouts and charges for thirty days, in their own currency first. */
import { useI18n } from 'vue-i18n';
import type { Money } from '@magermoney/domain';
import { MoneyText, useDisplayCurrency } from '@/modules/rates';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import type { UpcomingDay } from '../application/build-dashboard';

defineProps<{ days: UpcomingDay[]; undated: number }>();
const { t, locale } = useI18n();
const { current } = useDisplayCurrency();
/** `formatDay` (Task 21) formats a calendar date at local noon, so no zone moves it a day back. */
const day = (iso: string) => formatDay(iso, locale.value as DateLocale);
const own = (m: Money) => `${m.round().toString()} ${m.currency.code}`;
</script>

<template>
  <section class="mt-8 border-t border-border pt-3">
    <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('dashboard.upcoming.title') }}
    </h2>
    <div
      v-if="days.length === 0"
      class="mt-3 text-sm text-muted-foreground"
      data-testid="dash-upcoming-empty"
    >
      <p>{{ t('dashboard.upcoming.empty') }}</p>
      <RouterLink
        :to="{ name: 'plan', query: { tab: 'expenses' } }"
        class="mt-1 inline-flex items-center text-primary underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      >
        {{ t('dashboard.upcoming.emptyCta') }}
      </RouterLink>
    </div>
    <div v-for="d in days" :key="d.date" class="mt-3" :data-testid="`dash-upcoming-day-${d.date}`">
      <h3 class="font-mono text-xs tabular-nums text-muted-foreground">
        {{ day(d.date) }}
      </h3>
      <ul class="divide-y divide-border/60">
        <li
          v-for="(e, i) in d.events"
          :key="`${e.kind}-${e.refId}-${i}`"
          class="flex min-h-13 items-center gap-3 py-2"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base">{{ e.name }}</span>
            <span class="block text-xs text-muted-foreground">{{
              t(`dashboard.upcoming.${e.kind}`)
            }}</span>
          </span>
          <span class="text-right">
            <span class="block font-mono text-base tabular-nums"
              >{{ e.kind === 'payout' ? '+' : '−' }}{{ own(e.amount) }}</span
            >
            <MoneyText
              v-if="e.amount.currency.code !== current"
              class="text-xs text-muted-foreground"
              :amount="e.amount.toString()"
              :currency="e.amount.currency.code"
            />
          </span>
        </li>
      </ul>
    </div>
    <p
      v-if="undated > 0 && days.length > 0"
      class="mt-3 text-xs text-muted-foreground"
      data-testid="dash-upcoming-undated"
    >
      {{ t('dashboard.upcoming.undated', { n: undated }) }}
    </p>
  </section>
</template>
