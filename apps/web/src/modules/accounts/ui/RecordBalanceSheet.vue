<script setup lang="ts">
/**
 * "How much is on it now." The same quick-action sheet the expense, the
 * transfer and the inflow are written in: the amount first and largest, the
 * account's currency beside it, the rest as rows. Editing the latest entry
 * reuses it.
 *
 * What makes it this sheet and no other is the line under the amount: what the
 * account held before, and how far the number being typed moves it. A balance
 * typed by hand is a correction, and a correction is read as a difference —
 * «на 2 500 больше, чем было» is what tells a typo from the truth.
 *
 * A date the server would refuse is said at the date field, not in a toast
 * that is gone before the field is found: the future is caught before it is
 * sent, and a date earlier than the entry before it comes back from the server
 * (it alone knows the previous entry when one is being edited) and lands on
 * the same field.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BalanceEntryDto } from '@magermoney/contracts';
import { Button, InputRow, QuickActionSheet, useToast } from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { ApiError } from '@/shared/api/client';
import { errorKeyFor } from '@/shared/api/error-messages';
import { fromLocalInput, toLocalInput, type DateLocale } from '@/shared/dates/format';
import { formatMoney } from '@/shared/money/format';
import { balanceChange } from '../application/balance-change';
import { useAccount } from '../application/use-accounts';
import {
  useDeleteBalance,
  useEditBalance,
  useRecordBalance,
} from '../application/use-record-balance';

const props = defineProps<{ accountId: string; open: boolean; entry?: BalanceEntryDto }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const { t, locale } = useI18n();
const { toast } = useToast();
const account = useAccount(() => props.accountId);
const currencies = useCurrencies();
/**
 * A plain computed rather than an inline `as 'ru' | 'en'` cast in the
 * template: the eslint-plugin-vue template parser misreads the union type's
 * `|` inside a bound attribute as a (deprecated) filter pipe.
 */
const uiLocale = computed(() => locale.value as DateLocale);
const currency = computed(() => currencies.value.find((c) => c.code === account.value?.currency));
const code = computed(() => account.value?.currency ?? '');
const scale = computed(() => currency.value?.scale ?? 2);
const allowNegative = computed(
  () => account.value?.kind === 'card' && account.value.cardType === 'credit',
);

const amount = ref('');
const recordedAt = ref(toLocalInput(new Date().toISOString()));
const note = ref('');
/**
 * The `datetime-local` field only has minute precision, so its default value
 * ("now") is coarser than the server's own `now()` — sending it unconditionally
 * can make a fresh entry appear earlier than a sub-minute-old sibling (e.g. the
 * account's opening balance) and lose the "latest" race. Send `recordedAt` only
 * once the person has actually touched the field; otherwise the server stamps
 * the real, full-precision time.
 */
const dateTouched = ref(false);
/** What the server said about the date, until the date is changed. */
const serverDateError = ref<string | undefined>();
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    amount.value = props.entry?.amount ?? '';
    recordedAt.value = toLocalInput(props.entry?.recordedAt ?? new Date().toISOString());
    note.value = props.entry?.note ?? '';
    dateTouched.value = false;
    serverDateError.value = undefined;
  },
  { immediate: true },
);
function setDate(value: string) {
  recordedAt.value = value;
  dateTouched.value = true;
  serverDateError.value = undefined;
}

const dateError = computed(() => {
  if (serverDateError.value) return serverDateError.value;
  if (!dateTouched.value || recordedAt.value === '') return undefined;
  const at = new Date(recordedAt.value).getTime();
  if (Number.isNaN(at)) return undefined;
  if (at > Date.now()) return t('errors.recordedInFuture');
  // A new entry goes after the newest one; an edited entry's neighbour is the server's to check.
  const latest = account.value?.balanceRecordedAt;
  if (!props.entry && latest && at < new Date(latest).getTime())
    return t('errors.recordedBeforePrevious');
  return undefined;
});

/** Editing the latest entry: the "before" is what that entry says now. */
const before = computed(() => props.entry?.amount ?? account.value?.balance ?? null);
const money = (value: string) =>
  formatMoney(value, code.value, uiLocale.value, {
    kind: currency.value?.kind,
    scale: scale.value,
    symbol: currency.value?.symbol,
  });
const change = computed(() => {
  const diff = balanceChange(before.value, amount.value);
  if (diff === null) return null;
  if (/^-?0(\.0+)?$/.test(diff)) return { tone: 'none', text: t('accounts.balance.unchanged') };
  const negative = diff.startsWith('-');
  return {
    tone: negative ? 'down' : 'up',
    text: `${negative ? '−' : '+'}${money(diff.replace(/^-/, ''))}`,
  };
});

const { record, isPending: recording } = useRecordBalance();
const { edit, isPending: editing } = useEditBalance();
const { remove } = useDeleteBalance();
const busy = computed(() => recording.value || editing.value);

const DATE_CODES = new Set(['recorded_in_future', 'recorded_before_previous']);

async function submit() {
  if (amount.value === '' || dateError.value) return;
  const input = {
    amount: amount.value,
    ...(dateTouched.value ? { recordedAt: fromLocalInput(recordedAt.value) } : {}),
    note: note.value.trim() || null,
  };
  try {
    // A write made with no network is parked on the device rather than lost, so
    // the sheet closes and says so instead of waiting for a connection.
    let parked = false;
    if (props.entry) await edit(props.accountId, props.entry.id, input);
    else parked = (await record(props.accountId, input)) === 'parked';
    emit('update:open', false);
    if (parked) toast(t('offline.saved'));
  } catch (e) {
    const key = errorKeyFor(e, 'accounts.balance.failed');
    if (e instanceof ApiError && DATE_CODES.has(e.code)) serverDateError.value = t(key);
    else toast(t(key));
  }
}
async function del() {
  if (!props.entry) return;
  try {
    await remove(props.accountId, props.entry.id);
    emit('update:open', false);
  } catch (e) {
    toast(t(errorKeyFor(e, 'accounts.balance.failed')));
  }
}
</script>

<template>
  <QuickActionSheet
    :open="props.open"
    :title="props.entry ? t('accounts.balance.editTitle') : t('accounts.balance.title')"
    :description="account?.name"
    :amount="amount"
    :amount-label="t('accounts.balance.amount')"
    :code="code"
    :scale="scale"
    :locale="uiLocale"
    :allow-negative="allowNegative"
    :confirm-label="t('accounts.balance.save')"
    :close-label="t('accounts.balance.close')"
    :confirm-disabled="busy || amount === '' || Boolean(dateError)"
    data-testid="balance-form"
    @update:open="emit('update:open', $event)"
    @update:amount="amount = $event"
    @confirm="submit"
  >
    <template #currency>
      <p
        data-testid="balance-currency"
        class="text-muted-foreground flex min-h-11 items-center px-1 font-mono text-sm font-medium tracking-[0.06em] uppercase"
      >
        <span class="sr-only">{{ t('accounts.balance.currency') }}: </span>
        {{ code }}
      </p>
    </template>

    <template #fields>
      <!--
        Before and after, on one line: the old balance quiet on the left, the
        change it makes on the right in the colour of its direction. Announced
        politely, so a screen reader hears the change once typing settles.
      -->
      <p
        v-if="before !== null"
        class="text-muted-foreground -mt-2 mb-1 flex min-h-6 items-baseline justify-between gap-3 px-1 text-sm"
        aria-live="polite"
      >
        <span data-testid="balance-before"
          >{{ t('accounts.balance.before') }}
          <span class="text-ink font-mono tabular-nums">{{ money(before) }}</span></span
        >
        <span
          v-if="change"
          data-testid="balance-change"
          class="font-mono font-medium tabular-nums"
          :class="{
            'text-positive': change.tone === 'up',
            'text-negative': change.tone === 'down',
          }"
          >{{ change.text }}</span
        >
      </p>

      <InputRow
        :model-value="recordedAt"
        :label="t('accounts.balance.recordedAt')"
        type="datetime-local"
        :error="dateError"
        data-testid="balance-recorded-at"
        @update:model-value="setDate"
      />
      <InputRow
        v-model="note"
        :label="t('accounts.balance.note')"
        :placeholder="t('accounts.balance.notePlaceholder')"
        maxlength="1000"
        data-testid="balance-note"
      />
    </template>

    <div v-if="props.entry" class="border-border/60 grid gap-2 border-t pt-3">
      <Button
        type="button"
        variant="ghost"
        class="text-destructive min-h-11"
        data-testid="balance-delete"
        @click="del"
      >
        {{ t('accounts.balance.delete') }}
      </Button>
    </div>
  </QuickActionSheet>
</template>
