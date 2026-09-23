<script setup lang="ts">
/**
 * Every account there is, as the reference's wallet stack (slide 12): the total
 * on top, the filter next to it, and under them the cards dealt so each one
 * peeks out from behind the next.
 *
 * Two things the reference never had to answer. Its total counts one currency
 * and ours is summed from a dozen, so the footnote — which rate, which date —
 * is part of the figure rather than a caption (docs/design/direction.md). And
 * its «All cards» filters payment cards; here a wallet is narrowed by currency,
 * country, kind, card and balance, which is too much for one control beside
 * the total — so the control is one button, and the questions live in a sheet.
 *
 * The filter is stated twice on purpose: the sheet is how it is set, the chips
 * are how it is read and dropped one at a time. What a screen of numbers is
 * filtered by is half of what the numbers mean, and the total, the count and
 * the stack all answer to it together.
 */
import { computed, markRaw, ref, useTemplateRef } from 'vue';
import { SlidersHorizontalIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';
import {
  AccountCardStack,
  AmountLockup,
  Button,
  FilterChipRow,
  PullToRefresh,
  Skeleton,
  useToast,
  type AccountCardItem,
  type AmountLocale,
  type FilterChipItem,
} from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { useDisplayCurrency, useRefreshRates } from '@/modules/rates';
import { formatMoney } from '@/shared/money/format';
import { usePageAction, usePageTitle } from '@/shared/layout/page-bar';
import { useScreenRefresh } from '@/shared/query/use-screen-refresh';
import { useCapitalSummary } from '../application/use-capital-summary';
import { useAccountCards } from '../application/use-account-cards';
import { useFilteredAccounts } from '../application/use-filtered-accounts';
import { EMPTY_FILTER, activeFilterCount, type AccountFilter } from '../domain/account-filter';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';
import AccountsFilterSheet from './AccountsFilterSheet.vue';
import AccountRow from './AccountRow.vue';

const { t, locale } = useI18n();
const router = useRouter();
const { summary, rateDate } = useCapitalSummary();
const { current: baseCode } = useDisplayCurrency();
const amountLocale = computed(() => locale.value as AmountLocale);
/* A component handed through a prop, so it must not be made reactive on the way. */
const link = markRaw(RouterLink);

const showArchived = ref(false);
const filter = ref<AccountFilter>(EMPTY_FILTER);
const filterOpen = ref(false);
/* Where focus goes back to when the sheet closes, whichever way it was closed. */
const filterButton = useTemplateRef<{ $el: HTMLElement }>('filterButton');
const filterCount = computed(() => activeFilterCount(filter.value));

const active = computed(() => (summary.value?.groups ?? []).flatMap((g) => g.accounts));
const { shown, choices, total, unconvertible } = useFilteredAccounts(summary, filter);
const currencies = useCurrencies();
const displayScale = computed(
  () => currencies.value.find((c) => c.code === baseCode.value)?.scale ?? 2,
);

function applyFilter(next: AccountFilter) {
  filter.value = next;
  filterOpen.value = false;
}

/*
 * The summary decides the order, the cards decide what is on them — the colour
 * the owner painted, the scheme, the last digits. Both read the same query, so
 * a card that is still on its way is simply not dealt yet.
 */
const cardsById = useAccountCards();
const cards = computed<AccountCardItem[]>(() =>
  shown.value.flatMap((a) => {
    const card = cardsById.value.get(a.id);
    return card ? [card] : [];
  }),
);
/*
 * One chip per value, so each can be dropped on its own. The id says which
 * group the value came from, because «RU» is both a country and, in some
 * wallets, nothing else.
 */
const chips = computed<FilterChipItem[]>(() => {
  const f = filter.value;
  const money = (amount: string) => formatMoney(amount, baseCode.value, amountLocale.value);
  const labelled = [
    ...f.currencies.map((code) => ({ id: `currencies:${code}`, label: code })),
    ...f.countries.map((code) => ({ id: `countries:${code}`, label: t(`country.${code}`) })),
    ...f.kinds.map((kind) => ({ id: `kinds:${kind}`, label: t(ACCOUNT_KIND_KEYS[kind]) })),
    ...f.cardTypes.map((type) => ({
      id: `cardTypes:${type}`,
      label: t(`accounts.filter.cardTypes.${type}`),
    })),
    ...(f.expiry === 'any'
      ? []
      : [{ id: 'expiry', label: t(`accounts.filter.expiry.${f.expiry}`) }]),
    ...(f.min
      ? [{ id: 'min', label: t('accounts.filter.minChip', { amount: money(f.min) }) }]
      : []),
    ...(f.max
      ? [{ id: 'max', label: t('accounts.filter.maxChip', { amount: money(f.max) }) }]
      : []),
  ];
  return labelled.map((c) => ({
    ...c,
    removeLabel: t('accounts.filter.remove', { label: c.label }),
  }));
});

function dropChip(id: string) {
  const [group, value] = id.split(':') as [string, string | undefined];
  const f = filter.value;
  if (group === 'expiry') filter.value = { ...f, expiry: 'any' };
  else if (group === 'min' || group === 'max') filter.value = { ...f, [group]: '' };
  else {
    const key = group as 'currencies' | 'countries' | 'kinds' | 'cardTypes';
    filter.value = { ...f, [key]: (f[key] as readonly string[]).filter((v) => v !== value) };
  }
}

const unconvertibleCodes = computed(() =>
  [...new Set(unconvertible.value.map((a) => a.balance.currency.code))].join(', '),
);
const isEmpty = computed(
  () =>
    summary.value !== undefined && active.value.length === 0 && summary.value.archived.length === 0,
);

/*
 * Alone among the tabs, this screen never says its own name: it leads with the
 * total, the way the reference does, and «Счета» would fight that. So the bar
 * says it. The Plan and the settings screen carry a heading of their own and
 * leave the bar's middle alone rather than saying it twice.
 */
usePageTitle(() => t('accounts.title'));

/*
 * The list's one action. The empty screen keeps its own button — there the
 * invitation is the whole screen, and a word in the corner is not one.
 */
usePageAction(() => ({
  label: t('action.add'),
  ariaLabel: t('accounts.add'),
  onSelect: () => void router.push('/accounts/new'),
  testid: 'accounts-add-action',
}));

/*
 * The total on this screen is every account converted, so the gesture asks for
 * today's rates before it re-reads the accounts themselves.
 */
const { toast } = useToast();
const { refresh: refreshRates } = useRefreshRates();
const { refresh, isPending: refreshing } = useScreenRefresh(refreshRates);
async function refreshAccounts() {
  if (!(await refresh())) toast(t('rates.refreshFailed'));
}
</script>

<template>
  <PullToRefresh
    :refreshing="refreshing"
    :busy-label="t('a11y.refreshing')"
    @refresh="refreshAccounts"
  >
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
          One quiet button where the select stood: it opens every question at
          once, and says how many are answered, so a narrowed total is never
          mistaken for all of it.
        -->
          <Button
            v-if="active.length > 1"
            ref="filterButton"
            variant="outline"
            size="sm"
            data-testid="accounts-filter-open"
            aria-haspopup="dialog"
            :aria-expanded="filterOpen"
            :aria-label="
              filterCount > 0
                ? t('accounts.filter.openActive', { n: filterCount }, filterCount)
                : undefined
            "
            class="min-h-11 shrink-0 gap-2 rounded-full px-4"
            @click="filterOpen = true"
          >
            <SlidersHorizontalIcon aria-hidden="true" class="size-4" />
            {{ t('accounts.filter.open') }}
            <span
              v-if="filterCount > 0"
              data-testid="accounts-filter-count"
              aria-hidden="true"
              class="bg-primary text-primary-foreground grid min-w-5 place-items-center rounded-full px-1.5 font-mono text-xs leading-5 tabular-nums"
              >{{ filterCount }}</span
            >
          </Button>
        </div>

        <Skeleton v-if="!summary || !total" class="mt-1 h-10 w-48" />
        <AmountLockup
          v-else
          data-testid="capital-total"
          class="text-[40px] leading-[46px] tracking-[-0.01em]"
          :amount="total.toString()"
          :code="total.currency.code"
          :scale="total.currency.scale"
          :locale="amountLocale"
        />
        <p class="text-xs text-muted-foreground" data-testid="accounts-rate-note">
          {{ t('accounts.rateDate', { date: rateDate }) }}
        </p>
        <p
          v-if="summary && unconvertible.length > 0"
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
        :clear-label="chips.length > 1 && cards.length > 0 ? t('accounts.filter.clear') : undefined"
        @remove="dropChip"
        @clear="filter = EMPTY_FILTER"
      />

      <!--
      Three cards' worth of space while the accounts and the rates are still
      coming: the stack is the shape of this screen, and a page that jumps from
      nothing to a stack reads as two different screens.
    -->
      <div v-if="!summary" class="flex flex-col gap-2" data-testid="accounts-loading">
        <Skeleton v-for="i in 3" :key="i" class="h-25 w-full rounded-xl" />
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

      <!--
        Nothing left is a state of the filter, not of the wallet: it says so,
        and the way back is one tap rather than a chip at a time.
      -->
      <div
        v-else-if="filterCount > 0 && cards.length === 0"
        class="flex flex-col items-start gap-3"
        data-testid="accounts-filter-empty"
      >
        <p class="text-sm text-muted-foreground">
          {{ t('accounts.filter.empty') }}
        </p>
        <Button
          variant="outline"
          class="min-h-11 rounded-xl px-4"
          data-testid="accounts-filter-empty-reset"
          @click="filter = EMPTY_FILTER"
        >
          {{ t('accounts.filter.clear') }}
        </Button>
      </div>

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

    <AccountsFilterSheet
      v-model:open="filterOpen"
      :filter="filter"
      :choices="choices"
      :display-code="baseCode"
      :display-scale="displayScale"
      @apply="applyFilter"
      @closed="filterButton?.$el.focus()"
    />
  </PullToRefresh>
</template>
