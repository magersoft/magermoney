<script setup lang="ts">
/** A provider and its accounts: a quiet header with the group total, then the rows. */
import { computed } from 'vue';
import { Motion } from 'motion-v';
import { CurrencyIcon, listStagger } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import type { GroupSummary } from '../application/use-capital-summary';
import AccountRow from './AccountRow.vue';

const { group, index } = defineProps<{ group: GroupSummary; index: number }>();

/**
 * A bank header is a label, not a currency. A crypto or cash "provider" is not
 * a bank at all, so the mark that actually orients the reader there is the
 * account's currency, not a name; everywhere else the header stays plain text.
 */
const headerIcon = computed(() => {
  const first = group.accounts[0];
  if (!first || !group.accounts.every((a) => a.kind === 'crypto_wallet' || a.kind === 'cash')) {
    return null;
  }
  return first.balance.currency;
});
</script>

<template>
  <Motion tag="section" v-bind="listStagger(index)" class="border-t border-border pt-3">
    <header class="flex items-baseline justify-between gap-3">
      <h2
        class="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground"
      >
        <CurrencyIcon
          v-if="headerIcon"
          :code="headerIcon.code"
          :kind="headerIcon.kind"
          :size="16"
        />
        <span class="truncate">{{ group.bank }}</span>
      </h2>
      <MoneyText
        class="text-sm"
        :amount="group.total.toString()"
        :currency="group.total.currency.code"
      />
    </header>
    <ul class="divide-y divide-border/60">
      <li v-for="a in group.accounts" :key="a.id">
        <AccountRow :account="a" />
      </li>
    </ul>
  </Motion>
</template>
