<script setup lang="ts">
/**
 * The row of accounts (reference slide 10). The cards come from the capital
 * summary rather than from the accounts list, because the summary has already
 * grouped and sorted them — the strip is the same order the Accounts screen
 * reads in, flattened.
 *
 * Only the accounts the user pinned are here. Everything else lives on the
 * Accounts screen: a home that grew a card per account stopped being an
 * overview. Nothing pinned is not the same as nothing owned, so the two cases
 * say different things — with no accounts at all the strip is the add tile and
 * a line saying what it is for, and with accounts but no pin it says where the
 * switch is instead. Neither one silently falls back to showing everything:
 * that would undo the choice and make the switch look broken.
 */
import { computed, markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { AccountCardStrip, type AccountCardItem, type AmountLocale } from '@magermoney/ui';
import type { CapitalSummary } from '@/modules/accounts';

const { capital } = defineProps<{ capital: CapitalSummary; baseCode: string }>();

const { t, locale } = useI18n();
const amountLocale = computed(() => locale.value as AmountLocale);
/* A component handed through a prop, so it must not be made reactive on the way. */
const link = markRaw(RouterLink);

const all = computed(() => capital.groups.flatMap((g) => g.accounts));
const accounts = computed<AccountCardItem[]>(() =>
  all.value
    .filter((a) => a.isPinned)
    .map((a) => ({
      id: a.id,
      name: a.name,
      href: `/accounts/${a.id}`,
      amount: a.balance.toString(),
      code: a.balance.currency.code,
      kind: a.balance.currency.kind,
      country: a.country,
      scale: a.balance.currency.scale,
    })),
);
</script>

<template>
  <section data-testid="dash-accounts" class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('dashboard.accounts.title') }}
      </h2>
      <RouterLink
        v-if="all.length > 0"
        :to="{ name: 'accounts' }"
        data-testid="dash-accounts-all"
        class="inline-flex items-center text-sm text-primary underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
      >
        {{ t('dashboard.accounts.all') }}
      </RouterLink>
    </div>

    <p
      v-if="all.length === 0"
      class="text-sm text-muted-foreground"
      data-testid="dash-accounts-empty"
    >
      {{ t('dashboard.accounts.empty') }}
    </p>

    <!--
      Accounts, but none of them here. The add tile would be the wrong offer:
      the account already exists, it is the switch that is off.
    -->
    <p
      v-else-if="accounts.length === 0"
      class="text-sm text-muted-foreground"
      data-testid="dash-accounts-unpinned"
    >
      {{ t('dashboard.accounts.unpinned') }}
    </p>

    <AccountCardStrip
      v-if="accounts.length > 0 || all.length === 0"
      :accounts="accounts"
      :base-code="baseCode"
      :locale="amountLocale"
      :as="link"
      add-href="/accounts/new"
      :add-label="t('dashboard.accounts.add')"
    />
  </section>
</template>
