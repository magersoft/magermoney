<script setup lang="ts">
/**
 * Money from one account to another, on the reference's add-operation layout
 * (slide 13): what is sent is the first and largest field, the kind of
 * operation is the segment under it, and the accounts are rows.
 *
 * When currencies match the person types one number; when they differ, two,
 * with the day's rate as a hint and the realised rate shown once both are in —
 * the fee hides inside that rate. That arithmetic is unchanged.
 *
 * The currency beside the amount is the sending account's and only ever that:
 * a transfer cannot be made in a currency the account is not kept in.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TransferDto } from '@magermoney/contracts';
import { Money, deriveTransfer } from '@magermoney/domain';
import {
  Button,
  InputRow,
  MoneyInput,
  QuickActionSheet,
  SelectRow,
  useToast,
  type AmountLocale,
  type SegmentedOption,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { useRates } from '@/modules/rates';
import { ApiError } from '@/shared/api/client';
import { errorKeyFor } from '@/shared/api/error-messages';
import { fromLocalInput, toLocalInput, type DateLocale } from '@/shared/dates/format';
import {
  useCreateTransfer,
  useDeleteTransfer,
  useUpdateTransfer,
} from '../application/use-transfer-mutations';

const props = withDefaults(
  defineProps<{
    open: boolean;
    fromAccountId?: string;
    transfer?: TransferDto;
    types?: readonly SegmentedOption[];
    type?: string;
  }>(),
  { fromAccountId: undefined, transfer: undefined, types: () => [], type: '' },
);
const emit = defineEmits<{ 'update:open': [open: boolean]; 'update:type': [type: string] }>();

const { t, locale } = useI18n();
/**
 * A plain computed rather than an inline `as 'ru' | 'en'` cast in the
 * template: the eslint-plugin-vue template parser misreads the union type's
 * `|` inside a bound attribute as a (deprecated) filter pipe.
 */
const uiLocale = computed(() => locale.value as DateLocale);
const amountLocale = computed(() => locale.value as AmountLocale);
const { toast } = useToast();
const { accounts } = useAccounts();
const currencies = useCurrencies();
const registry = useCurrencyRegistry();
const rates = useRates();
const { create, isPending: creating } = useCreateTransfer();
const { update, isPending: updating } = useUpdateTransfer();
const { remove } = useDeleteTransfer();

const from = ref('');
const to = ref('');
const sent = ref('');
const received = ref('');
const fee = ref('');
const occurredAt = ref(toLocalInput(new Date().toISOString()));
const note = ref('');
const showErrors = ref(false);
/**
 * The `datetime-local` field only has minute precision, so its default value
 * ("now") is coarser than the server's own `now()` — sending it unconditionally
 * can make a fresh transfer appear earlier than a sub-minute-old sibling entry
 * and lose the "latest" race. Send `occurredAt` only once the person has
 * actually touched the field; otherwise the server stamps the real time.
 */
const dateTouched = ref(false);
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    from.value = props.transfer?.fromAccountId ?? props.fromAccountId ?? '';
    to.value = props.transfer?.toAccountId ?? '';
    sent.value = props.transfer?.amountSent ?? '';
    received.value = props.transfer?.amountReceived ?? '';
    fee.value = props.transfer?.fee ?? '';
    occurredAt.value = toLocalInput(props.transfer?.occurredAt ?? new Date().toISOString());
    note.value = props.transfer?.note ?? '';
    dateTouched.value = false;
    showErrors.value = false;
  },
  { immediate: true },
);

const active = computed(() => accounts.value.filter((a) => a.archivedAt === null));
const fromAcc = computed(() => accounts.value.find((a) => a.id === from.value));
const toAcc = computed(() => accounts.value.find((a) => a.id === to.value));
const scaleOf = (code: string | undefined) =>
  currencies.value.find((c) => c.code === code)?.scale ?? 2;
const cross = computed(() =>
  Boolean(fromAcc.value && toAcc.value && fromAcc.value.currency !== toAcc.value.currency),
);
const label = (a: (typeof accounts.value)[number]) =>
  t('transfers.option', { name: a.name, balance: a.balance ?? '0', currency: a.currency });
const fromOptions = computed(() => active.value.map((a) => ({ value: a.id, label: label(a) })));
const toOptions = computed(() =>
  active.value.filter((a) => a.id !== from.value).map((a) => ({ value: a.id, label: label(a) })),
);

const hint = computed(() => {
  if (!cross.value || !fromAcc.value || !toAcc.value || sent.value === '' || !rates.table.value)
    return null;
  const fromCur = registry.value.get(fromAcc.value.currency);
  if (fromCur.isErr()) return null;
  return rates.table.value.convert(Money.of(sent.value, fromCur.value), toAcc.value.currency).match(
    (m) => m.round().toString(),
    () => null,
  );
});
const realised = computed(() => {
  if (!cross.value || !fromAcc.value || !toAcc.value || sent.value === '' || received.value === '')
    return null;
  const f = registry.value.get(fromAcc.value.currency);
  const tc = registry.value.get(toAcc.value.currency);
  if (f.isErr() || tc.isErr()) return null;
  return deriveTransfer({
    amountSent: Money.of(sent.value, f.value),
    amountReceived: Money.of(received.value, tc.value),
  }).match(
    (d) => d.realisedRate?.toFixed() ?? null,
    () => null,
  );
});
const canSubmit = computed(
  () =>
    Boolean(from.value) &&
    Boolean(to.value) &&
    from.value !== to.value &&
    sent.value !== '' &&
    (!cross.value || received.value !== ''),
);
/* Said on the field it is about, and only once the sheet is asked to send. */
const fromError = computed(() =>
  showErrors.value && !from.value ? t('transfers.fromRequired') : undefined,
);
const toError = computed(() => {
  if (!showErrors.value) return undefined;
  if (!to.value) return t('transfers.toRequired');
  return to.value === from.value ? t('transfers.sameAccount') : undefined;
});

function amounts() {
  if (cross.value) return { amountSent: sent.value, amountReceived: received.value };
  if (fee.value === '' || fee.value === '0') return { amountSent: sent.value };
  const cur = registry.value
    .get(fromAcc.value!.currency)
    .unwrapOr({ code: 'X', kind: 'fiat' as const, scale: 2 });
  return {
    amountSent: sent.value,
    amountReceived: Money.of(sent.value, cur)
      .subtract(Money.of(fee.value, cur))
      .map((m) => m.toString())
      .unwrapOr(sent.value),
  };
}
/**
 * The API answers `transfer_not_latest` to both paths, but the advice differs:
 * an existing transfer can no longer be edited, while a new one simply needs a
 * later date than the balances already on its accounts.
 */
function messageFor(e: unknown): string {
  if (!props.transfer && e instanceof ApiError && e.code === 'transfer_not_latest')
    return t('errors.transferBackdated');
  return t(errorKeyFor(e, 'transfers.failed'));
}
async function submit() {
  if (!canSubmit.value) {
    showErrors.value = true;
    return;
  }
  const input = {
    ...amounts(),
    ...(dateTouched.value ? { occurredAt: fromLocalInput(occurredAt.value) } : {}),
    note: note.value.trim() || null,
  };
  try {
    // A transfer made with no network is parked on the device rather than lost,
    // so the sheet closes and says so instead of waiting for a connection.
    let parked = false;
    if (props.transfer) await update(props.transfer.id, input);
    else
      parked =
        (await create({ fromAccountId: from.value, toAccountId: to.value, ...input })) === 'parked';
    emit('update:open', false);
    if (parked) toast(t('offline.saved'));
  } catch (e) {
    toast(messageFor(e));
  }
}
async function del() {
  if (!props.transfer) return;
  try {
    await remove(props.transfer.id);
    emit('update:open', false);
  } catch (e) {
    toast(messageFor(e));
  }
}
</script>

<template>
  <QuickActionSheet
    :open="props.open"
    :title="props.transfer ? t('transfers.editTitle') : t('transfers.sheetTitle')"
    :amount="sent"
    :amount-label="t('transfers.sent')"
    :code="fromAcc?.currency ?? ''"
    :currencies="fromAcc ? [fromAcc.currency] : []"
    :currency-label="t('transfers.sentCurrency')"
    :scale="scaleOf(fromAcc?.currency)"
    :locale="amountLocale"
    :types="props.types"
    :type="props.type"
    :type-label="t('quick.type')"
    :confirm-label="props.transfer ? t('transfers.update') : t('transfers.save')"
    :close-label="t('transfers.cancel')"
    :confirm-disabled="creating || updating"
    data-testid="transfer-form"
    @update:open="emit('update:open', $event)"
    @update:amount="sent = $event"
    @update:type="emit('update:type', $event)"
    @confirm="submit"
  >
    <template #fields>
      <SelectRow
        v-model="from"
        :label="t('transfers.from')"
        :options="fromOptions"
        :placeholder="t('transfers.pick')"
        :error="fromError"
        :disabled="Boolean(transfer)"
        data-testid="transfer-from"
      />
      <SelectRow
        v-model="to"
        :label="t('transfers.to')"
        :options="toOptions"
        :placeholder="t('transfers.pick')"
        :error="toError"
        :disabled="Boolean(transfer)"
        data-testid="transfer-to"
      />

      <label
        v-if="cross"
        class="bg-surface-sunken flex min-h-14 flex-col justify-center gap-0.5 rounded-lg px-3 py-2"
      >
        <span class="text-muted-foreground text-xs"
          >{{ t('transfers.received') }} · {{ toAcc?.currency }}</span
        >
        <MoneyInput
          v-model="received"
          data-testid="transfer-received"
          :scale="scaleOf(toAcc?.currency)"
          :locale="uiLocale"
          class="h-auto border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
        />
      </label>
      <label
        v-else
        class="bg-surface-sunken flex min-h-14 flex-col justify-center gap-0.5 rounded-lg px-3 py-2"
      >
        <span class="text-muted-foreground text-xs">{{ t('transfers.fee') }}</span>
        <MoneyInput
          v-model="fee"
          data-testid="transfer-fee"
          :scale="scaleOf(fromAcc?.currency)"
          :locale="uiLocale"
          class="h-auto border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
        />
      </label>

      <p v-if="hint" data-testid="transfer-hint" class="text-muted-foreground px-3 text-xs">
        {{ t('transfers.hint', { amount: `${hint} ${toAcc?.currency}` }) }}
      </p>
      <p v-if="realised" class="text-muted-foreground px-3 text-xs">
        {{ t('transfers.rate', { from: fromAcc?.currency, to: toAcc?.currency, rate: realised }) }}
      </p>

      <InputRow
        v-model="occurredAt"
        :label="t('transfers.occurredAt')"
        type="datetime-local"
        data-testid="transfer-occurred-at"
        @update:model-value="dateTouched = true"
      />
      <InputRow v-model="note" :label="t('transfers.note')" maxlength="200" />
    </template>

    <Button
      v-if="transfer"
      type="button"
      variant="ghost"
      class="text-destructive min-h-11"
      data-testid="transfer-delete"
      @click="del"
    >
      {{ t('transfers.delete') }}
    </Button>
    <template #secondary>
      <slot name="secondary" />
    </template>
  </QuickActionSheet>
</template>
