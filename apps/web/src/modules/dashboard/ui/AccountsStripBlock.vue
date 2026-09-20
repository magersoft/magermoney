<script setup lang="ts">
/**
 * The row of accounts (reference slide 10). The cards come from the capital
 * summary rather than from the accounts list, because the summary has already
 * grouped and sorted them — the strip is the same order the Accounts screen
 * reads in, flattened.
 *
 * Once the user has starred accounts, those are the strip and the rest live on
 * the Accounts screen: a home that grew a card per account stopped being an
 * overview. Until then the strip shows the first few instead of nothing —
 * arriving at a blank row is a worse first impression than a pick the user did
 * not make, and the line under it says the pick is theirs to change. The
 * fallback is only ever a stand-in, so it ends the moment one star is on.
 *
 * With no accounts at all there is nothing to stand in for, and the strip is
 * the add tile and a line saying what it is for.
 */
import { computed, markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { AccountCardStrip, type AccountCardItem, type AmountLocale } from '@magermoney/ui';
import type { CapitalSummary } from '@/modules/accounts';

/** How many accounts stand in while none is starred: a strip you take in at a glance. */
const FALLBACK = 3;

const { capital } = defineProps<{ capital: CapitalSummary; baseCode: string }>();

const { t, locale } = useI18n();
const amountLocale = computed(() => locale.value as AmountLocale);
/* A component handed through a prop, so it must not be made reactive on the way. */
const link = markRaw(RouterLink);

const all = computed(() => capital.groups.flatMap((g) => g.accounts));
const pinned = computed(() => all.value.filter((a) => a.isPinned));
/** The user's pick when there is one, the first few standing in when there is not. */
const standingIn = computed(() => pinned.value.length === 0 && all.value.length > 0);
const accounts = computed<AccountCardItem[]>(() =>
  (standingIn.value ? all.value.slice(0, FALLBACK) : pinned.value).map((a) => ({
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

    <AccountCardStrip
      :accounts="accounts"
      :base-code="baseCode"
      :locale="amountLocale"
      :as="link"
      add-href="/accounts/new"
      :add-label="t('dashboard.accounts.add')"
    />

    <!--
      Under the cards rather than above them: the strip is the answer, and this
      only says the answer is a stand-in. It goes the moment a star is on.
    -->
    <p v-if="standingIn" class="text-sm text-muted-foreground" data-testid="dash-accounts-unpinned">
      {{ t('dashboard.accounts.unpinned') }}
    </p>
  </section>
</template>
