<script setup lang="ts">
/**
 * "How much is on it now." One big field, a date that defaults to now, an
 * optional note. Editing the latest entry reuses the same sheet.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BalanceEntryDto } from '@magermoney/contracts';
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
import { useCurrencies } from '@/modules/currencies';
import { ApiError } from '@/shared/api/client';
import { fromLocalInput, toLocalInput, type DateLocale } from '@/shared/dates/format';
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
const scale = computed(
  () => currencies.value.find((c) => c.code === account.value?.currency)?.scale ?? 2,
);
const allowNegative = computed(
  () => account.value?.kind === 'card' && account.value.cardType === 'credit',
);

const amount = ref('');
const recordedAt = ref(toLocalInput(new Date().toISOString()));
const note = ref('');
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    amount.value = props.entry?.amount ?? '';
    recordedAt.value = toLocalInput(props.entry?.recordedAt ?? new Date().toISOString());
    note.value = props.entry?.note ?? '';
  },
);

const { record, isPending: recording } = useRecordBalance();
const { edit, isPending: editing } = useEditBalance();
const { remove } = useDeleteBalance();
const busy = computed(() => recording.value || editing.value);

async function submit() {
  if (amount.value === '') return;
  const input = {
    amount: amount.value,
    recordedAt: fromLocalInput(recordedAt.value),
    note: note.value.trim() || null,
  };
  try {
    if (props.entry) await edit(props.accountId, props.entry.id, input);
    else await record(props.accountId, input);
    emit('update:open', false);
  } catch (e) {
    toast(
      e instanceof ApiError && e.status === 409
        ? t('accounts.balance.notLatest')
        : t('accounts.balance.failed'),
    );
  }
}
async function del() {
  if (!props.entry) return;
  try {
    await remove(props.accountId, props.entry.id);
    emit('update:open', false);
  } catch (e) {
    toast(
      e instanceof ApiError && e.status === 409
        ? t('accounts.balance.notLatest')
        : t('accounts.balance.failed'),
    );
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SheetHeader>
        <SheetTitle>
          {{ entry ? t('accounts.balance.editTitle') : t('accounts.balance.title') }}
        </SheetTitle>
      </SheetHeader>
      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground"
            >{{ t('accounts.balance.amount') }} · {{ account?.currency }}</span
          >
          <MoneyInput
            v-model="amount"
            data-testid="balance-amount"
            :scale="scale"
            :locale="uiLocale"
            :allow-negative="allowNegative"
            class="mt-1"
            autofocus
          />
        </label>
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{
            t('accounts.balance.recordedAt')
          }}</span>
          <Input v-model="recordedAt" type="datetime-local" class="mt-1" />
        </label>
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{
            t('accounts.balance.note')
          }}</span>
          <Input v-model="note" class="mt-1" />
        </label>
        <div class="flex gap-2">
          <Button
            type="submit"
            size="lg"
            class="flex-1"
            :disabled="busy || amount === ''"
            data-testid="balance-save"
          >
            {{ t('accounts.balance.save') }}
          </Button>
          <Button
            v-if="entry"
            type="button"
            size="lg"
            variant="destructive"
            data-testid="balance-delete"
            @click="del"
          >
            {{ t('accounts.balance.delete') }}
          </Button>
        </div>
      </form>
    </SheetContent>
  </Sheet>
</template>
