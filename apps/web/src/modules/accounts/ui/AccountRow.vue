<script setup lang="ts">
/** One account: what it is on the left, what it holds on the right, in its own currency first. */
import { useI18n } from 'vue-i18n';
import type { Account } from '@magermoney/domain';
import { CurrencyIcon } from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';

const { account } = defineProps<{ account: Account }>();
const { t } = useI18n();
</script>

<template>
  <RouterLink
    :to="`/accounts/${account.id}`"
    :data-testid="`account-row-${account.id}`"
    class="flex min-h-14 items-center gap-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
  >
    <CurrencyIcon
      :code="account.balance.currency.code"
      :kind="account.balance.currency.kind"
      :country="account.country"
      :size="28"
    />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-[15px]">{{ account.name }}</span>
      <span class="block text-xs text-muted-foreground">
        {{ t(ACCOUNT_KIND_KEYS[account.kind])
        }}<template v-if="account.cardType">
          · {{ t(`accounts.cardType.${account.cardType}`) }}</template
        ><template v-if="account.isSpending"> · {{ t('accounts.spending') }}</template>
      </span>
    </span>
    <span class="text-right">
      <span class="block font-mono text-[15px] tabular-nums"
        >{{ account.balance.round().toString() }} {{ account.balance.currency.code }}</span
      >
      <MoneyText
        class="text-xs text-muted-foreground"
        :amount="account.balance.toString()"
        :currency="account.balance.currency.code"
      />
    </span>
  </RouterLink>
</template>
