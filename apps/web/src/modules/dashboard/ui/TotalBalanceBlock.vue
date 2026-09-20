<script setup lang="ts">
/**
 * The one number, and the two things that keep it honest.
 *
 * The reference sets Total Balance and stops there. It can: it counts one
 * currency. This total is summed from a dozen at today's rates, so the footnote
 * under it — which rate, which date — is not a caption but part of the figure
 * (docs/design/direction.md). Without it the number is a guess presented as a
 * fact.
 *
 * The second line is what the balance cannot answer on its own: how much of it
 * is spendable before the next payday, and what that leaves per day.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AmountLockup } from '@magermoney/ui';
import type { Money } from '@magermoney/domain';
import type { CapitalSummary } from '@/modules/accounts';
import type { AmountLocale } from '@magermoney/ui';

const { capital, days, perDay } = defineProps<{
  capital: CapitalSummary;
  rateDate: string;
  days: number | null;
  perDay: Money | null;
}>();

const { t, locale } = useI18n();
const amountLocale = computed(() => locale.value as AmountLocale);
const codes = computed(() =>
  [...new Set(capital.unconvertible.map((a) => a.balance.currency.code))].join(', '),
);
</script>

<template>
  <section data-testid="dash-capital" class="flex flex-col gap-1">
    <RouterLink
      :to="{ name: 'accounts' }"
      :aria-label="t('dashboard.capital.open')"
      class="outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring flex flex-col gap-1 rounded-xl"
    >
      <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('dashboard.capital.total') }}
      </h2>
      <AmountLockup
        data-testid="capital-total"
        class="text-[40px] leading-[46px] tracking-[-0.01em]"
        :amount="capital.total.toString()"
        :code="capital.total.currency.code"
        :scale="capital.total.currency.scale"
        :locale="amountLocale"
      />
      <p class="text-xs text-muted-foreground" data-testid="dash-rate-note">
        {{ t('dashboard.capital.rateDate', { date: rateDate }) }}
      </p>
    </RouterLink>

    <p
      v-if="capital.unconvertible.length > 0"
      class="mt-1 text-xs text-muted-foreground"
      data-testid="dash-unconvertible"
    >
      {{ t('dashboard.unconvertible', { codes }) }}
    </p>

    <!--
      One line, not a block: it is a footnote to the balance above it, and the
      cards below are the next thing worth looking at.
    -->
    <p
      v-if="days !== null && perDay"
      class="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-sm text-muted-foreground"
      data-testid="dash-available"
    >
      <span>{{ t('dashboard.payday.available') }}</span>
      <AmountLockup
        class="text-ink"
        :amount="capital.availableUntilPayday.toString()"
        :code="capital.availableUntilPayday.currency.code"
        :scale="capital.availableUntilPayday.currency.scale"
        :locale="amountLocale"
      />
      <span aria-hidden="true">·</span>
      <span data-testid="dash-days">{{
        days === 0 ? t('dashboard.payday.today') : t('dashboard.payday.days', { n: days }, days)
      }}</span>
      <span aria-hidden="true">·</span>
      <span data-testid="dash-per-day" class="flex items-baseline gap-1">
        <AmountLockup
          class="text-ink"
          :amount="perDay.toString()"
          :code="perDay.currency.code"
          :scale="perDay.currency.scale"
          :locale="amountLocale"
        />
        {{ t('dashboard.payday.perDay') }}
      </span>
    </p>
    <RouterLink
      v-else
      :to="{ name: 'plan', query: { tab: 'income' } }"
      data-testid="dash-payday-setup"
      class="mt-2 inline-flex items-center text-sm text-primary underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
    >
      {{ t('dashboard.payday.setup') }}
    </RouterLink>
  </section>
</template>
