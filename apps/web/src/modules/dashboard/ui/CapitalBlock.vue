<script setup lang="ts">
/** The one number. The whole block is the way into Accounts. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CapitalSummary } from '@/modules/accounts';
import { MoneyText } from '@/modules/rates';

const { capital } = defineProps<{ capital: CapitalSummary; rateDate: string }>();
const { t } = useI18n();
const codes = computed(() =>
  [...new Set(capital.unconvertible.map((a) => a.balance.currency.code))].join(', '),
);
</script>

<template>
  <section data-testid="dash-capital">
    <RouterLink
      :to="{ name: 'accounts' }"
      :aria-label="t('dashboard.capital.open')"
      class="block pt-1 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('dashboard.capital.total') }}
      </h2>
      <MoneyText
        data-testid="capital-total"
        class="mt-1 text-[40px] font-semibold tracking-[-0.01em]"
        :amount="capital.total.toString()"
        :currency="capital.total.currency.code"
      />
      <p class="mt-1 text-xs text-muted-foreground">
        {{ t('dashboard.capital.rateDate', { date: rateDate }) }}
      </p>
    </RouterLink>
    <p
      v-if="capital.unconvertible.length > 0"
      class="mt-3 text-xs text-muted-foreground"
      data-testid="dash-unconvertible"
    >
      {{ t('dashboard.unconvertible', { codes }) }}
    </p>
  </section>
</template>
