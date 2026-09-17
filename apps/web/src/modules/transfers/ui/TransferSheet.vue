<script setup lang="ts">
/**
 * Money from one account to another. When currencies match the person types
 * one number; when they differ, two, with the day's rate as a hint and the
 * realised rate shown once both are in — the fee hides inside that rate.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TransferDto } from '@magermoney/contracts';
import { Money, deriveTransfer } from '@magermoney/domain';
import {
  Button,
  Input,
  MoneyInput,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useToast,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { useRates } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import { fromLocalInput, toLocalInput, type DateLocale } from '@/shared/dates/format';
import {
  useCreateTransfer,
  useDeleteTransfer,
  useUpdateTransfer,
} from '../application/use-transfer-mutations';

const props = defineProps<{ open: boolean; fromAccountId?: string; transfer?: TransferDto }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();
const { t, locale } = useI18n();
/**
 * A plain computed rather than an inline `as 'ru' | 'en'` cast in the
 * template: the eslint-plugin-vue template parser misreads the union type's
 * `|` inside a bound attribute as a (deprecated) filter pipe.
 */
const uiLocale = computed(() => locale.value as DateLocale);
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
    from.value &&
    to.value &&
    from.value !== to.value &&
    sent.value !== '' &&
    (!cross.value || received.value !== ''),
);

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
const messageFor = (e: unknown): string => t(errorKeyFor(e, 'transfers.failed'));
async function submit() {
  if (!canSubmit.value) return;
  const input = {
    ...amounts(),
    ...(dateTouched.value ? { occurredAt: fromLocalInput(occurredAt.value) } : {}),
    note: note.value.trim() || null,
  };
  try {
    if (props.transfer) await update(props.transfer.id, input);
    else await create({ fromAccountId: from.value, toAccountId: to.value, ...input });
    emit('update:open', false);
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
const label = (a: (typeof accounts.value)[number]) =>
  t('transfers.option', { name: a.name, balance: a.balance ?? '0', currency: a.currency });
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SheetHeader>
        <SheetTitle>
          {{ transfer ? t('transfers.editTitle') : t('transfers.sheetTitle') }}
        </SheetTitle>
      </SheetHeader>
      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('transfers.from') }}</span>
          <select
            v-model="from"
            data-testid="transfer-from"
            :disabled="Boolean(transfer)"
            class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
          >
            <option v-for="a in active" :key="a.id" :value="a.id">{{ label(a) }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('transfers.to') }}</span>
          <select
            v-model="to"
            data-testid="transfer-to"
            :disabled="Boolean(transfer)"
            class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
          >
            <option v-for="a in active.filter((x) => x.id !== from)" :key="a.id" :value="a.id">
              {{ label(a) }}
            </option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground"
            >{{ t('transfers.sent') }} · {{ fromAcc?.currency }}</span
          >
          <MoneyInput
            v-model="sent"
            data-testid="transfer-sent"
            :scale="scaleOf(fromAcc?.currency)"
            :locale="uiLocale"
            class="mt-1"
            autofocus
          />
        </label>
        <label v-if="cross" class="block">
          <span class="text-xs font-medium text-muted-foreground"
            >{{ t('transfers.received') }} · {{ toAcc?.currency }}</span
          >
          <MoneyInput
            v-model="received"
            data-testid="transfer-received"
            :scale="scaleOf(toAcc?.currency)"
            :locale="uiLocale"
            class="mt-1"
          />
          <span
            v-if="hint"
            data-testid="transfer-hint"
            class="mt-1 block text-xs text-muted-foreground"
            >{{ t('transfers.hint', { amount: `${hint} ${toAcc?.currency}` }) }}</span
          >
          <span v-if="realised" class="mt-1 block text-xs text-muted-foreground">{{
            t('transfers.rate', { from: fromAcc?.currency, to: toAcc?.currency, rate: realised })
          }}</span>
        </label>
        <label v-else class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('transfers.fee') }}</span>
          <MoneyInput
            v-model="fee"
            data-testid="transfer-fee"
            :scale="scaleOf(fromAcc?.currency)"
            :locale="uiLocale"
            class="mt-1"
          />
        </label>
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{
            t('transfers.occurredAt')
          }}</span>
          <Input
            v-model="occurredAt"
            type="datetime-local"
            class="mt-1"
            data-testid="transfer-occurred-at"
            @change="dateTouched = true"
          />
        </label>
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('transfers.note') }}</span>
          <Input v-model="note" class="mt-1" />
        </label>
        <div class="flex gap-2">
          <Button
            type="submit"
            size="lg"
            class="min-h-9 flex-1 pointer-coarse:min-h-11"
            :disabled="!canSubmit || creating || updating"
            data-testid="transfer-save"
          >
            {{ transfer ? t('transfers.update') : t('transfers.save') }}
          </Button>
          <Button
            v-if="transfer"
            type="button"
            size="lg"
            variant="destructive"
            class="min-h-9 pointer-coarse:min-h-11"
            @click="del"
          >
            {{ t('transfers.delete') }}
          </Button>
        </div>
      </form>
    </SheetContent>
  </Sheet>
</template>
