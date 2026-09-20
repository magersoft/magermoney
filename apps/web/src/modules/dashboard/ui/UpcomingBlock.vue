<script setup lang="ts">
/**
 * What is next: payouts and charges for thirty days. The reference has no such
 * list — its money is one currency and already spent — so this is ours, written
 * in its language: a card per day, rows inside it, no rules between them.
 *
 * Each amount is in the currency it will actually be paid in, with its code, and
 * the sign carries the direction so the list stays ink rather than turning into
 * a traffic light (docs/design/direction.md). The converted figure follows
 * underneath only when the two currencies differ.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  RowGroup,
  TransactionRow,
  formatAmountLockup,
  plainAmount,
  type AmountLocale,
} from '@magermoney/ui';
import type { Money, UpcomingEvent } from '@magermoney/domain';
import { useConvertToDisplay } from '@/modules/rates';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import type { UpcomingDay } from '../application/build-dashboard';

defineProps<{ days: UpcomingDay[]; undated: number }>();

const { t, locale } = useI18n();
const { convertToDisplay, current } = useConvertToDisplay();
const amountLocale = computed(() => locale.value as AmountLocale);

/** `formatDay` formats a calendar date at local noon, so no zone moves it a day back. */
const day = (iso: string) => formatDay(iso, locale.value as DateLocale);

/** A charge leaves; the sign says so, and the row stays ink. */
const signed = (e: UpcomingEvent) =>
  (e.kind === 'expense' ? '-' : '') + e.amount.round().toString();

/** Only worth writing when it is not the same figure twice. */
const inDisplay = (amount: Money): string | undefined => {
  if (amount.currency.code === current.value) return undefined;
  return convertToDisplay(amount).match(
    (money) =>
      plainAmount(
        formatAmountLockup(money.round().toString(), {
          code: money.currency.code,
          locale: amountLocale.value,
          scale: money.currency.scale,
        }),
      ),
    () => undefined,
  );
};
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('dashboard.upcoming.title') }}
    </h2>

    <div
      v-if="days.length === 0"
      class="bg-surface shadow-card flex flex-col items-start gap-2 rounded-xl p-4"
      data-testid="dash-upcoming-empty"
    >
      <p class="text-sm text-muted-foreground">
        {{ t('dashboard.upcoming.empty') }}
      </p>
      <RouterLink
        :to="{ name: 'plan', query: { tab: 'expenses' } }"
        class="inline-flex items-center text-sm text-primary underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      >
        {{ t('dashboard.upcoming.emptyCta') }}
      </RouterLink>
    </div>

    <RowGroup
      v-for="d in days"
      :key="d.date"
      :title="day(d.date)"
      :data-testid="`dash-upcoming-day-${d.date}`"
    >
      <li v-for="(e, i) in d.events" :key="`${e.kind}-${e.refId}-${i}`">
        <TransactionRow
          :title="e.name"
          :category="t(`dashboard.upcoming.${e.kind}`)"
          :amount="signed(e)"
          :code="e.amount.currency.code"
          :scale="e.amount.currency.scale"
          :locale="amountLocale"
          show-code
          :time="inDisplay(e.amount)"
        />
      </li>
    </RowGroup>

    <p v-if="undated > 0" class="text-xs text-muted-foreground" data-testid="dash-upcoming-undated">
      {{ t('dashboard.upcoming.undated', { n: undated }) }}
    </p>
  </section>
</template>
