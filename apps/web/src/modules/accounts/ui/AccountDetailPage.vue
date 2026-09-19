<script setup lang="ts">
/**
 * One account, on the reference's wallet-detail layout (slide 12): its card at
 * the top, the filters it is being read under, what came in and what went out
 * this month, the ring that splits that month, and the operations themselves
 * grouped by day.
 *
 * Three things the reference never had to answer.
 *
 * It breaks its ring down by spending category; an account has none. What an
 * account's month is made of is where its movements came from — a transfer, an
 * inflow, or the owner writing the balance down — so that is what the ring
 * splits, and the figure in its gap is the turnover those slices add up to.
 *
 * Balances are declared, not computed (CONTEXT.md), so an «operation» here is
 * the difference between one entry and the one before it. The entry is still
 * the thing that can be edited, and only while it is the newest and a person
 * wrote it — which is why the newest manual row, and only it, is a button.
 *
 * The account holds one currency, so no rate and no footnote: every figure on
 * this screen is already in the currency the account is kept in.
 */
import { computed, defineAsyncComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { BalanceEntryDto } from '@magermoney/contracts';
import { addDays, firstOfMonth, lastOfMonth } from '@magermoney/domain';
import {
  AccountCard,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DonutChart,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FilterChipRow,
  RowGroup,
  Skeleton,
  StatTile,
  TransactionRow,
  formatAmountLockup,
  plainAmount,
  useToast,
  type AmountLocale,
  type DonutSegment,
  type FilterChipItem,
} from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import {
  formatDate,
  formatDayAndMonth,
  formatMonth,
  formatTime,
  type DateLocale,
} from '@/shared/dates/format';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';
import {
  accountPeriod,
  movementDays,
  periodShare,
  type MovementOrigin,
} from '../application/account-period';
import { useAccount } from '../application/use-accounts';
import { useAccountBalances } from '../application/use-account-balances';
import { useArchiveAccount, useDeleteAccount } from '../application/use-account-mutations';
import PeriodSheet from './PeriodSheet.vue';
import RecordBalanceSheet from './RecordBalanceSheet.vue';

/**
 * Loaded lazily rather than imported from `@/modules/transfers`: a static
 * import there would create an ESM cycle (accounts <-> transfers), since
 * transfers will need account data too.
 */
const TransferSheet = defineAsyncComponent(() =>
  import('@/modules/transfers').then((m) => m.TransferSheet),
);

/** What each slice of the ring, and each row under it, is called. */
const ORIGIN_KEYS: Record<MovementOrigin, string> = {
  manual: 'accounts.origin.manual',
  transfer: 'accounts.origin.transfer',
  inflow: 'accounts.origin.inflow',
};

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const id = computed(() => String(route.params.id));
const account = useAccount(id);
const currencies = useCurrencies();
const uiLocale = computed(() => locale.value as DateLocale);
const amountLocale = computed(() => locale.value as AmountLocale);
/** The account's own currency decides how many digits belong on screen; the stored amount keeps all of them. */
const currency = computed(() => currencies.value.find((c) => c.code === account.value?.currency));
const scale = computed(() => currency.value?.scale ?? 2);
/** Fiat until the catalogue says otherwise, which is what the mark falls back to anyway. */
const currencyKind = computed(() => currency.value?.kind ?? 'fiat');
const { entries, isLoading } = useAccountBalances(id);
const { setArchived } = useArchiveAccount();
const { remove } = useDeleteAccount();

const balanceOpen = ref(false);
const transferOpen = ref(false);
const periodOpen = ref(false);
const editing = ref<BalanceEntryDto | undefined>();
const confirmDelete = ref(false);

/* The month being read, as its first day. The screen opens on the current one. */
const thisMonth = firstOfMonth(todayIso());
const month = ref(thisMonth);
/** The slice picked in the ring, which narrows the list under it. */
const origin = ref<MovementOrigin | null>(null);

const period = computed(() => accountPeriod(entries.value, month.value));
/* The month before, read the same way: what the tiles' badges measure against. */
const previous = computed(() =>
  accountPeriod(entries.value, addDays(firstOfMonth(month.value), -1)),
);
const days = computed(() => movementDays(period.value, origin.value));
const monthLabel = computed(() => formatMonth(month.value, uiLocale.value));

const segments = computed<DonutSegment[]>(() =>
  period.value.byOrigin.map((slice) => ({
    id: slice.origin,
    label: t(ORIGIN_KEYS[slice.origin]),
    value: slice.value,
    amount: slice.amount,
  })),
);

/*
 * A chip is a filter that is *on*: the month appears only once it is not the
 * one the screen opens on, so the row is empty on arrival rather than carrying
 * a filter nobody set.
 */
const chips = computed<FilterChipItem[]>(() => {
  const list: FilterChipItem[] = [];
  if (month.value !== thisMonth)
    list.push({
      id: 'month',
      label: monthLabel.value,
      removeLabel: t('accounts.period.remove', { period: monthLabel.value }),
    });
  if (origin.value) {
    const label = t(ORIGIN_KEYS[origin.value]);
    list.push({
      id: 'origin',
      label,
      removeLabel: t('accounts.origin.remove', { origin: label }),
    });
  }
  return list;
});

/*
 * The line under the ring is a sentence, so its amount is the lockup written
 * out flat — and signed, because what a month did to a balance has a direction.
 */
const netCaption = computed(() =>
  t('accounts.detail.netChange', {
    amount: plainAmount(
      formatAmountLockup(period.value.net, {
        code: account.value?.currency ?? '',
        locale: amountLocale.value,
        scale: scale.value,
        signed: true,
      }),
    ),
  }),
);

/** Newest first, so the head of the journal is the entry that may still be edited. */
const latestManualId = computed(() =>
  entries.value[0]?.origin === 'manual' ? entries.value[0].id : null,
);
const entryOf = (entryId: string) => entries.value.find((e) => e.id === entryId);

function dropChip(chipId: string) {
  if (chipId === 'month') month.value = thisMonth;
  else origin.value = null;
}
function applyMonth(picked: string) {
  month.value = firstOfMonth(picked);
  periodOpen.value = false;
}
function stepMonth(by: -1 | 1) {
  month.value =
    by === -1
      ? firstOfMonth(addDays(firstOfMonth(month.value), -1))
      : firstOfMonth(addDays(lastOfMonth(month.value), 1));
}
/** The ring hands back `null` when the slice that was on is picked again. */
function pickSlice(sliceId: string | null) {
  origin.value = sliceId as MovementOrigin | null;
}

function openRecord(entry?: BalanceEntryDto) {
  editing.value = entry;
  balanceOpen.value = true;
}
async function archive() {
  if (!account.value) return;
  try {
    await setArchived(account.value.id, account.value.archivedAt === null);
  } catch (e) {
    toast(t(errorKeyFor(e, 'accounts.form.saveFailed')));
  }
}
async function del() {
  if (!account.value) return;
  try {
    await remove(account.value.id);
    await router.replace('/accounts');
  } catch (e) {
    toast(t(errorKeyFor(e, 'accounts.form.saveFailed')));
  }
}
</script>

<template>
  <section v-if="account" class="flex flex-col gap-6 pb-8">
    <header class="flex items-start gap-3 pt-1">
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-2xl font-semibold tracking-[-0.01em]" data-testid="account-name">
          {{ account.name }}
        </h1>
        <p class="text-muted-foreground text-sm">
          {{ t(ACCOUNT_KIND_KEYS[account.kind]) }} · {{ account.bank }} · {{ account.country }}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-11"
            :aria-label="t('accounts.detail.menu')"
            data-testid="account-menu"
          >
            <span aria-hidden="true">⋯</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @select="router.push(`/accounts/${account.id}/edit`)">
            {{ t('accounts.detail.edit') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="archive">
            {{ account.archivedAt ? t('accounts.detail.unarchive') : t('accounts.detail.archive') }}
          </DropdownMenuItem>
          <DropdownMenuItem
            @select="router.push({ path: '/transfers', query: { accountId: account.id } })"
          >
            {{ t('accounts.detail.transfers') }}
          </DropdownMenuItem>
          <DropdownMenuItem class="text-destructive" @select="confirmDelete = true">
            {{ t('accounts.detail.delete') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <!-- The same card the accounts stack deals, alone and at full size. -->
    <AccountCard
      as="div"
      data-testid="account-card"
      :account="{
        id: account.id,
        name: account.name,
        amount: account.balance ?? '0',
        code: account.currency,
        kind: currencyKind,
        country: account.country,
        scale,
      }"
      :locale="amountLocale"
    />
    <p v-if="!account.balance" class="text-muted-foreground -mt-4 text-sm">
      {{ t('accounts.noBalance') }}
    </p>

    <div class="grid grid-cols-2 gap-2">
      <Button size="lg" class="min-h-11" data-testid="account-record" @click="openRecord()">
        {{ t('accounts.detail.recordBalance') }}
      </Button>
      <Button
        size="lg"
        variant="outline"
        class="min-h-11"
        data-testid="account-transfer"
        @click="transferOpen = true"
      >
        {{ t('accounts.detail.transfer') }}
      </Button>
    </div>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-muted-foreground font-mono text-xs tracking-[0.08em] uppercase">
          {{ t('accounts.detail.overview') }}
        </h2>
        <!-- The period is stated where it is changed, so the button is the month itself. -->
        <Button
          variant="outline"
          size="sm"
          class="min-h-11 rounded-full px-4"
          :aria-label="t('accounts.period.change', { period: monthLabel })"
          data-testid="account-period-open"
          @click="periodOpen = true"
        >
          {{ monthLabel }}
        </Button>
      </div>

      <FilterChipRow
        :chips="chips"
        :aria-label="t('accounts.detail.filters')"
        data-testid="account-filters"
        @remove="dropChip"
      />

      <!--
        The overview keeps its shape while the journal is on its way: tiles and
        a ring reading zero would be a month that looks empty and then is not.
      -->
      <template v-if="isLoading">
        <div class="grid grid-cols-2 gap-3">
          <Skeleton v-for="i in 2" :key="i" class="h-28 w-full rounded-xl" />
        </div>
        <Skeleton class="h-72 w-full rounded-xl" />
      </template>

      <div v-else class="grid grid-cols-2 gap-3">
        <StatTile
          data-testid="account-incoming"
          :label="t('accounts.detail.incoming')"
          :amount="period.incoming"
          :code="account.currency"
          :scale="scale"
          :locale="amountLocale"
          :delta="periodShare(period.incoming, previous.incoming)"
          :delta-caption="t('accounts.detail.vsLastMonth')"
        />
        <StatTile
          data-testid="account-outgoing"
          :label="t('accounts.detail.outgoing')"
          :amount="period.outgoing"
          :code="account.currency"
          :scale="scale"
          :locale="amountLocale"
          :delta="periodShare(period.outgoing, previous.outgoing)"
          :up-is-good="false"
          :delta-caption="t('accounts.detail.vsLastMonth')"
        />
      </div>

      <div v-if="!isLoading" class="bg-surface shadow-card rounded-xl p-4">
        <DonutChart
          data-testid="account-donut"
          :label="t('accounts.detail.turnover')"
          :amount="period.turnover"
          :code="account.currency"
          :scale="scale"
          :locale="amountLocale"
          :segments="segments"
          :period="monthLabel"
          :prev-label="t('accounts.period.prev')"
          :next-label="t('accounts.period.next')"
          :next-disabled="month >= thisMonth"
          :caption="netCaption"
          :empty-label="t('accounts.detail.emptyMonth')"
          :active-id="origin"
          :legend-label="t('accounts.detail.turnover')"
          @prev="stepMonth(-1)"
          @next="stepMonth(1)"
          @update:active-id="pickSlice"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-muted-foreground font-mono text-xs tracking-[0.08em] uppercase">
        {{ t('accounts.detail.operations') }}
      </h2>

      <Skeleton v-if="isLoading" class="h-24 w-full rounded-xl" />

      <!-- An account with no journal at all is a different screen from a quiet month. -->
      <div
        v-else-if="entries.length === 0"
        class="bg-surface shadow-card flex flex-col items-start gap-2 rounded-xl p-4"
        data-testid="account-no-history"
      >
        <p class="text-sm font-medium">
          {{ t('accounts.detail.noHistory') }}
        </p>
        <p class="text-muted-foreground text-sm">
          {{ t('accounts.detail.noHistoryBody') }}
        </p>
        <Button size="sm" class="mt-1 min-h-11 rounded-xl px-4" @click="openRecord()">
          {{ t('accounts.detail.recordBalance') }}
        </Button>
      </div>

      <div
        v-else-if="days.length === 0"
        class="bg-surface shadow-card flex flex-col items-start gap-2 rounded-xl p-4"
        data-testid="account-empty-period"
      >
        <p class="text-sm font-medium">
          {{ origin ? t('accounts.detail.emptySlice') : t('accounts.detail.emptyPeriod') }}
        </p>
        <Button
          v-if="origin || month !== thisMonth"
          variant="ghost"
          size="sm"
          class="min-h-11 px-2"
          data-testid="account-reset-filters"
          @click="
            origin = null;
            month = thisMonth;
          "
        >
          {{ t('accounts.detail.resetFilters') }}
        </Button>
      </div>

      <RowGroup
        v-for="day in days"
        v-else
        :key="day.day"
        :title="formatDayAndMonth(day.day, uiLocale)"
        :amount="day.subtotal"
        :code="account.currency"
        :scale="scale"
        :locale="amountLocale"
        variant="change"
        :data-testid="`account-day-${day.day}`"
      >
        <li v-for="m in day.movements" :key="m.id">
          <!--
            The entry behind a movement can be edited only while it is the
            newest and a person wrote it; every other row is a record, and a
            record that looked tappable would be a promise the screen cannot
            keep.
          -->
          <TransactionRow
            :as="m.id === latestManualId ? 'button' : 'div'"
            :type="m.id === latestManualId ? 'button' : undefined"
            :title="m.note ?? t(ORIGIN_KEYS[m.origin])"
            :category="m.note ? t(ORIGIN_KEYS[m.origin]) : undefined"
            :amount="m.delta"
            :code="account.currency"
            :scale="scale"
            :locale="amountLocale"
            variant="change"
            :time="formatTime(m.recordedAt, uiLocale)"
            :data-testid="`balance-entry-${m.id}`"
            @click="m.id === latestManualId && openRecord(entryOf(m.id))"
          />
        </li>
      </RowGroup>
    </section>

    <section v-if="account.kind === 'card' || account.note" class="flex flex-col gap-2">
      <h2 class="text-muted-foreground font-mono text-xs tracking-[0.08em] uppercase">
        {{ t('accounts.detail.details') }}
      </h2>
      <p v-if="account.kind === 'card'" class="text-sm">
        {{
          t('accounts.detail.card', {
            network: account.cardNetwork ?? '',
            tier: account.cardTier ?? '',
            last4: account.cardLast4 ? `•••• ${account.cardLast4}` : '',
          })
        }}
        <span v-if="account.cardExpires" class="text-muted-foreground">
          ·
          {{
            t('accounts.detail.expires', {
              date: formatDate(account.cardExpires, uiLocale),
            })
          }}</span
        >
      </p>
      <pre
        v-if="account.note"
        class="text-muted-foreground font-sans text-sm whitespace-pre-wrap"
        >{{ account.note }}</pre>
    </section>

    <RecordBalanceSheet v-model:open="balanceOpen" :account-id="account.id" :entry="editing" />
    <TransferSheet v-model:open="transferOpen" :from-account-id="account.id" />
    <PeriodSheet v-model:open="periodOpen" :month="month" :latest="thisMonth" @apply="applyMonth" />

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('accounts.detail.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('accounts.detail.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('accounts.detail.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="del">
            {{ t('accounts.detail.deleteConfirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
  <Skeleton v-else class="h-24 w-full" />
</template>
