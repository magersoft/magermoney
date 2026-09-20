<script setup lang="ts">
/**
 * Every account there is, as the reference's wallet stack (slide 12): the total
 * on top, the filter next to it, and under them the cards dealt so each one
 * peeks out from behind the next.
 *
 * Two things the reference never had to answer. Its total counts one currency
 * and ours is summed from a dozen, so the footnote — which rate, which date —
 * is part of the figure rather than a caption (docs/design/direction.md). And
 * its «All cards» filters payment cards; here the only filter worth having is
 * the currency an account is held in, which is also what the stack is coloured
 * by.
 *
 * The filter is stated twice on purpose: the select is how it is set, the chip
 * is how it is read and dropped. What a screen of numbers is filtered by is
 * half of what the numbers mean, and a `<select>` collapsed to a code is easy
 * to walk past.
 */
import { computed, markRaw, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';
import { PlusIcon } from '@lucide/vue';
import {
  AccountCardStack,
  AmountLockup,
  Button,
  FilterChipRow,
  Skeleton,
  type AccountCardItem,
  type AmountLocale,
  type FilterChipItem,
} from '@magermoney/ui';
import { useDisplayCurrency } from '@/modules/rates';
import { usePageAction } from '@/shared/layout/page-action';
import { useCapitalSummary } from '../application/use-capital-summary';
import AccountRow from './AccountRow.vue';

const { t, locale } = useI18n();
const router = useRouter();
const { summary, rateDate } = useCapitalSummary();
const { current: baseCode } = useDisplayCurrency();
const amountLocale = computed(() => locale.value as AmountLocale);
/* A component handed through a prop, so it must not be made reactive on the way. */
const link = markRaw(RouterLink);

const showArchived = ref(false);
/** The code the stack is filtered to, or `''` for all of them. */
const currency = ref('');

/*
 * The groups are flattened rather than kept: on this screen the bank an account
 * belongs to is a detail of the account, and the stack reads as one wallet. The
 * order the summary grouped them in survives, so the cards sit the same way
 * they do in the strip on the home screen.
 */
const active = computed(() => (summary.value?.groups ?? []).flatMap((g) => g.accounts));
const codes = computed(() => [...new Set(active.value.map((a) => a.balance.currency.code))].sort());
const shown = computed(() =>
  currency.value
    ? active.value.filter((a) => a.balance.currency.code === currency.value)
    : active.value,
);

const cards = computed<AccountCardItem[]>(() =>
  shown.value.map((a) => ({
    id: a.id,
    name: a.name,
    href: `/accounts/${a.id}`,
    amount: a.balance.toString(),
    code: a.balance.currency.code,
    kind: a.balance.currency.kind,
    country: a.country,
    scale: a.balance.currency.scale,
    pinned: a.isPinned,
    pinnedLabel: t('accounts.pinned'),
  })),
);
const chips = computed<FilterChipItem[]>(() =>
  currency.value
    ? [
        {
          id: currency.value,
          label: t('accounts.filter.chip', { code: currency.value }),
          removeLabel: t('accounts.filter.remove', { code: currency.value }),
        },
      ]
    : [],
);

const unconvertibleCodes = computed(() =>
  [...new Set(summary.value?.unconvertible.map((a) => a.balance.currency.code))].join(', '),
);
const isEmpty = computed(
  () =>
    summary.value !== undefined && active.value.length === 0 && summary.value.archived.length === 0,
);

/*
 * The list's one action. The empty screen keeps its own worded button — there
 * the invitation is the whole screen, and a glyph in the corner is not an
 * invitation.
 */
usePageAction(() => ({
  label: t('accounts.add'),
  onSelect: () => void router.push('/accounts/new'),
  icon: PlusIcon,
  testid: 'accounts-add-action',
}));
</script>

<template>
  <section class="flex flex-col gap-6 pb-8">
    <h1 class="sr-only">
      {{ t('accounts.title') }}
    </h1>

    <header class="flex flex-col gap-1 pt-1">
      <div class="flex items-start justify-between gap-3">
        <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {{ t('accounts.total') }}
        </h2>

        <!--
          A native select: the filter is a list of codes, and nothing about it
          is worth the keyboard and screen-reader work of rebuilding a listbox.
        -->
        <select
          v-if="codes.length > 1"
          v-model="currency"
          data-testid="accounts-currency-filter"
          :aria-label="t('accounts.filter.label')"
          class="h-11 shrink-0 rounded-full border border-input bg-surface px-3 font-mono text-xs uppercase tracking-[0.08em] text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="">
            {{ t('accounts.filter.all') }}
          </option>
          <option v-for="code in codes" :key="code" :value="code">
            {{ code }}
          </option>
        </select>
      </div>

      <Skeleton v-if="!summary" class="mt-1 h-10 w-48" />
      <AmountLockup
        v-else
        data-testid="capital-total"
        class="text-[40px] leading-[46px] tracking-[-0.01em]"
        :amount="summary.total.toString()"
        :code="summary.total.currency.code"
        :scale="summary.total.currency.scale"
        :locale="amountLocale"
      />
      <p class="text-xs text-muted-foreground" data-testid="accounts-rate-note">
        {{ t('accounts.rateDate', { date: rateDate }) }}
      </p>
      <p
        v-if="summary && summary.unconvertible.length > 0"
        class="text-xs text-muted-foreground"
        data-testid="accounts-unconvertible"
      >
        {{ t('accounts.unconvertible', { codes: unconvertibleCodes }) }}
      </p>
      <!--
        The reference's «3 active cards», in the only unit we have. It counts
        what the stack below actually shows rather than everything there is:
        «4 счёта» over a single card is the screen contradicting itself.
      -->
      <p
        v-if="shown.length > 0"
        class="mt-1 text-sm text-muted-foreground"
        data-testid="accounts-count"
      >
        {{ t('accounts.count', { n: shown.length }, shown.length) }}
      </p>
    </header>

    <FilterChipRow
      :chips="chips"
      :aria-label="t('accounts.filter.label')"
      @remove="currency = ''"
    />

    <!--
      Three cards' worth of space while the accounts and the rates are still
      coming: the stack is the shape of this screen, and a page that jumps from
      nothing to a stack reads as two different screens.
    -->
    <div v-if="!summary" class="flex flex-col gap-2" data-testid="accounts-loading">
      <Skeleton v-for="i in 3" :key="i" class="h-[5.5rem] w-full rounded-xl" />
    </div>

    <div v-else-if="isEmpty" class="mt-4 text-center">
      <p class="text-lg font-semibold">
        {{ t('accounts.empty.title') }}
      </p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t('accounts.empty.body') }}
      </p>
      <Button as-child size="lg" class="mt-4 min-h-11 rounded-xl px-5">
        <RouterLink to="/accounts/new" data-testid="accounts-add">
          {{ t('accounts.empty.cta') }}
        </RouterLink>
      </Button>
    </div>

    <p
      v-else-if="currency && cards.length === 0"
      class="text-sm text-muted-foreground"
      data-testid="accounts-filter-empty"
    >
      {{ t('accounts.filter.empty', { code: currency }) }}
    </p>

    <AccountCardStack
      v-else
      :accounts="cards"
      :base-code="baseCode"
      :locale="amountLocale"
      :as="link"
    />

    <div v-if="summary && summary.archived.length > 0">
      <Button
        variant="ghost"
        size="sm"
        class="min-h-9 pointer-coarse:min-h-11"
        :aria-expanded="showArchived"
        aria-controls="archived-accounts"
        @click="showArchived = !showArchived"
      >
        {{
          showArchived
            ? t('accounts.archived.hide')
            : t('accounts.archived.show', { n: summary.archived.length })
        }}
      </Button>
      <ul v-if="showArchived" id="archived-accounts" class="mt-2 divide-y divide-border/60">
        <li v-for="a in summary.archived" :key="a.id" class="grayscale">
          <AccountRow :account="a" />
        </li>
      </ul>
    </div>
  </section>
</template>
