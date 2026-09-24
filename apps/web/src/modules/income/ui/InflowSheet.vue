<script setup lang="ts">
/**
 * Money that arrived. The source decides the currency; an Account is optional,
 * and when its currency differs the person types what actually reached it — the
 * app never converts a balance by itself (ADR 0002). The day's rate is a hint,
 * the realised rate is derived once both numbers are in.
 *
 * It is written far more often than a source is set up, so it is one of the
 * kinds of operation the "+" offers, on the same quick-action sheet as its
 * neighbours: the amount first, the source's currency beside it, the rest rows.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Motion } from 'motion-v';
import type { InflowDto } from '@magermoney/contracts';
import { Decimal, Money, deriveInflowCredit, type Currency } from '@magermoney/domain';
import {
  Button,
  fade,
  InputRow,
  MoneyInput,
  QuickActionSheet,
  SelectRow,
  useToast,
  type AmountLocale,
  type SegmentedOption,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { AppCurrencySelect, useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useDisplayCurrency, useRates } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useIncomeSources } from '../application/use-income-sources';
import { useCreateIncomeSource } from '../application/use-income-source-mutations';
import {
  useCreateInflow,
  useDeleteInflow,
  useUpdateInflow,
} from '../application/use-inflow-mutations';

const props = withDefaults(
  defineProps<{
    open: boolean;
    sourceId?: string;
    inflow?: InflowDto;
    types?: readonly SegmentedOption[];
    type?: string;
  }>(),
  { sourceId: undefined, inflow: undefined, types: () => [], type: '' },
);
const emit = defineEmits<{ 'update:open': [open: boolean]; 'update:type': [type: string] }>();

const NEW_SOURCE = '__new__';
const NO_ACCOUNT = '';
const { t, locale } = useI18n();
const uiLocale = computed(() => locale.value as DateLocale);
const amountLocale = computed(() => locale.value as AmountLocale);
const { toast } = useToast();
const { dtos: sources } = useIncomeSources();
const { accounts } = useAccounts();
const currencies = useCurrencies();
const { options: reportingCurrencies } = useDisplayCurrency();
const registry = useCurrencyRegistry();
const rates = useRates();
const { create, isPending: creating } = useCreateInflow();
const { update, isPending: updating } = useUpdateInflow();
const { remove } = useDeleteInflow();
const { create: createSource, isPending: creatingSource } = useCreateIncomeSource();

const source = ref('');
const newName = ref('');
const newCurrency = ref('USD');
const amount = ref('');
const receivedOn = ref(todayIso());
/** The server's "today" is the truth for an untouched date; the field's default is only what the person sees. */
const dateTouched = ref(false);
const accountId = ref(NO_ACCOUNT);
const credited = ref('');
const usdRate = ref('');
const more = ref(false);
const note = ref('');

const today = todayIso();
const currentSources = computed(() =>
  sources.value.filter(
    (s) => s.activeTo === null || s.activeTo >= today || s.id === props.inflow?.incomeSourceId,
  ),
);
const activeAccounts = computed(() =>
  accounts.value.filter((a) => a.archivedAt === null || a.id === props.inflow?.accountId),
);
const chosenSource = computed(() => sources.value.find((s) => s.id === source.value));
const sourceOptions = computed(() => [
  ...currentSources.value.map((s) => ({ value: s.id, label: `${s.name} · ${s.currency}` })),
  ...(props.inflow ? [] : [{ value: NEW_SOURCE, label: t('inflows.newSource') }]),
]);
const accountOptions = computed(() => [
  { value: NO_ACCOUNT, label: t('inflows.noAccount') },
  ...activeAccounts.value.map((a) => ({
    value: a.id,
    label: `${a.name} · ${a.balance ?? '0'} ${a.currency}`,
  })),
]);

/**
 * True for the tick in which `reset()` fills the fields, so the guard below
 * does not mistake a prefill for the person changing their mind.
 */
let priming = false;

function pickDate(value: string) {
  receivedOn.value = value;
  dateTouched.value = true;
}

function reset() {
  priming = true;
  void nextTick(() => (priming = false));
  const i = props.inflow;
  source.value = i?.incomeSourceId ?? props.sourceId ?? currentSources.value[0]?.id ?? NEW_SOURCE;
  newName.value = '';
  amount.value = i?.amount ?? '';
  receivedOn.value = i?.receivedOn ?? todayIso();
  dateTouched.value = false;
  accountId.value = i
    ? (i.accountId ?? NO_ACCOUNT)
    : (chosenSource.value?.defaultAccountId ?? NO_ACCOUNT);
  credited.value = i?.creditedAmount ?? '';
  usdRate.value = i?.realisedRateToUsd ?? '';
  more.value = Boolean(i?.realisedRateToUsd || i?.note);
  note.value = i?.note ?? '';
}
watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
  { immediate: true },
);
/** The sheet can open before the lists arrive; the defaults are re-read once, as long as nothing was typed. */
watch([sources, accounts], () => {
  if (props.open && amount.value === '' && !props.inflow) reset();
});
/** Choosing another source moves the account to that source's usual one. */
watch(source, (id, before) => {
  if (!before || props.inflow) return;
  accountId.value = sources.value.find((s) => s.id === id)?.defaultAccountId ?? NO_ACCOUNT;
});

const isNew = computed(() => source.value === NEW_SOURCE);
const currencyCode = computed(() =>
  isNew.value ? newCurrency.value : (props.inflow?.currency ?? chosenSource.value?.currency ?? ''),
);
const account = computed(() => accounts.value.find((a) => a.id === accountId.value));
/**
 * A credited amount is typed in one account's currency, for one source's
 * currency. Changing either would otherwise send a number typed for euros as
 * pounds, so the field is emptied and Save waits for it to be typed again.
 */
watch([accountId, currencyCode], () => {
  if (priming) return;
  credited.value = '';
});

const cross = computed(() =>
  Boolean(account.value && account.value.currency !== currencyCode.value),
);
const scaleOf = (code: string | undefined) =>
  currencies.value.find((c) => c.code === code)?.scale ?? 2;
const currencyOf = (code: string): Currency =>
  registry.value.get(code).unwrapOr({ code, kind: 'fiat', scale: scaleOf(code) });

const hint = computed(() => {
  if (!cross.value || !account.value || amount.value === '' || !rates.table.value) return null;
  return rates.table.value
    .convert(Money.of(amount.value, currencyOf(currencyCode.value)), account.value.currency)
    .match(
      (m) => m.round().toString(),
      () => null,
    );
});
const realised = computed(() => {
  if (!cross.value || !account.value || amount.value === '' || credited.value === '') return null;
  const accountCurrency = currencyOf(account.value.currency);
  return deriveInflowCredit({
    amount: Money.of(amount.value, currencyOf(currencyCode.value)),
    accountCurrency,
    creditedAmount: Money.of(credited.value, accountCurrency),
  }).match(
    (d) => d.realisedRate?.toFixed() ?? null,
    () => null,
  );
});
const busy = computed(() => creating.value || updating.value || creatingSource.value);
const canSubmit = computed(
  () =>
    amount.value !== '' &&
    new Decimal(amount.value).gt(0) &&
    (isNew.value ? newName.value.trim() !== '' : source.value !== '') &&
    (!cross.value || credited.value !== ''),
);

async function resolveSourceId(): Promise<string> {
  if (!isNew.value) return source.value;
  // A source born from a receipt expects nothing: no gross, no schedule. It is
  // irregular until the person says otherwise, and it starts the day the money came.
  const created = await createSource({
    name: newName.value.trim(),
    grossAmount: '0',
    currency: newCurrency.value,
    taxRate: '0',
    commissionRate: '0',
    payDays: [],
    isPrimary: false,
    activeFrom: receivedOn.value,
  });
  return created.id;
}

async function submit() {
  if (!canSubmit.value) return;
  try {
    const credit = account.value
      ? { accountId: account.value.id, ...(cross.value ? { creditedAmount: credited.value } : {}) }
      : {};
    const rate = usdRate.value === '' ? {} : { realisedRateToUsd: usdRate.value };
    const noteValue = note.value.trim() || null;
    let parked = false;
    if (props.inflow) {
      const before = props.inflow.accountId;
      await update(
        props.inflow.id,
        {
          amount: amount.value,
          ...(dateTouched.value ? { receivedOn: receivedOn.value } : {}),
          // `null` removes the credit; an unchanged account is sent again so a new amount re-applies to it.
          ...(account.value ? credit : { accountId: null }),
          realisedRateToUsd: usdRate.value === '' ? null : usdRate.value,
          note: noteValue,
        },
        [before, account.value?.id].filter((x): x is string => Boolean(x)),
      );
    } else {
      const incomeSourceId = await resolveSourceId();
      parked =
        (await create({
          incomeSourceId,
          amount: amount.value,
          ...(dateTouched.value ? { receivedOn: receivedOn.value } : {}),
          ...credit,
          ...rate,
          note: noteValue,
        })) === 'parked';
    }
    emit('update:open', false);
    if (parked) toast(t('offline.saved'));
  } catch (e) {
    toast(t(errorKeyFor(e, 'inflows.failed')));
  }
}

async function del() {
  if (!props.inflow) return;
  try {
    await remove(props.inflow.id, props.inflow.accountId ? [props.inflow.accountId] : []);
    emit('update:open', false);
  } catch (e) {
    toast(t(errorKeyFor(e, 'inflows.failed')));
  }
}
</script>

<template>
  <QuickActionSheet
    :open="props.open"
    :title="inflow ? t('inflows.editTitle') : t('inflows.title')"
    :amount="amount"
    :amount-label="t('inflows.amount')"
    :code="currencyCode"
    :scale="scaleOf(currencyCode)"
    :locale="amountLocale"
    :types="props.types"
    :type="props.type"
    :type-label="t('quick.type')"
    :confirm-label="inflow ? t('inflows.update') : t('inflows.save')"
    :close-label="t('inflows.close')"
    :confirm-disabled="!canSubmit || busy"
    data-testid="inflow-form"
    @update:open="emit('update:open', $event)"
    @update:amount="amount = $event"
    @update:type="emit('update:type', $event)"
    @confirm="submit"
  >
    <template #currency>
      <!-- A new source is typed here, so its currency is chosen here; an existing one already has it. -->
      <AppCurrencySelect
        v-if="isNew"
        v-model="newCurrency"
        variant="compact"
        :label="t('inflows.newCurrency')"
        :frequent="reportingCurrencies"
        data-testid="inflow-new-currency"
      />
      <p
        v-else
        data-testid="inflow-currency"
        class="text-muted-foreground flex min-h-11 items-center px-1 font-mono text-sm font-medium tracking-[0.06em] uppercase"
      >
        {{ currencyCode }}
      </p>
    </template>

    <template #fields>
      <SelectRow
        v-model="source"
        :label="t('inflows.source')"
        :options="sourceOptions"
        :disabled="Boolean(inflow)"
        data-testid="inflow-source"
      />

      <InputRow
        v-if="isNew"
        v-model="newName"
        :label="t('inflows.newName')"
        maxlength="80"
        data-testid="inflow-new-name"
      />

      <InputRow
        :model-value="receivedOn"
        :label="t('inflows.date')"
        type="date"
        :max="today"
        data-testid="inflow-date"
        @update:model-value="pickDate"
      />

      <SelectRow
        v-model="accountId"
        :label="t('inflows.account')"
        :options="accountOptions"
        data-testid="inflow-account"
      />

      <Motion v-if="cross" class="flex flex-col gap-1" v-bind="fade">
        <label
          class="bg-surface-sunken flex min-h-14 flex-col justify-center gap-0.5 rounded-lg px-3 py-2"
        >
          <span class="text-muted-foreground text-xs"
            >{{ t('inflows.credited') }} · {{ account?.currency }}</span
          >
          <MoneyInput
            v-model="credited"
            data-testid="inflow-credited"
            :scale="scaleOf(account?.currency)"
            :locale="uiLocale"
            class="h-auto border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
          />
        </label>
        <span v-if="hint" data-testid="inflow-hint" class="text-muted-foreground px-3 text-xs">
          {{ t('inflows.hint', { amount: `${hint} ${account?.currency}` }) }}
        </span>
        <span v-if="realised" data-testid="inflow-rate" class="text-muted-foreground px-3 text-xs">
          {{ t('inflows.rate', { from: currencyCode, to: account?.currency, rate: realised }) }}
        </span>
      </Motion>
    </template>

    <div class="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="min-h-11 self-start"
        :aria-expanded="more"
        aria-controls="inflow-more-fields"
        data-testid="inflow-more"
        @click="more = !more"
      >
        {{ t('inflows.more') }}
      </Button>
      <!-- `v-show`, not `v-if`: the button's `aria-controls` has to point at an element that exists. -->
      <div v-show="more" id="inflow-more-fields" class="flex flex-col gap-2">
        <label
          class="bg-surface-sunken flex min-h-14 flex-col justify-center gap-0.5 rounded-lg px-3 py-2"
        >
          <span class="text-muted-foreground text-xs">{{ t('inflows.usdRate') }}</span>
          <MoneyInput
            v-model="usdRate"
            data-testid="inflow-usd-rate"
            :scale="10"
            :locale="uiLocale"
            class="h-auto border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
          />
        </label>
        <p class="text-muted-foreground px-3 text-xs">
          {{ t('inflows.usdRateHint', { code: currencyCode }) }}
        </p>
        <InputRow v-model="note" :label="t('inflows.note')" maxlength="1000" />
      </div>
    </div>

    <div v-if="inflow" class="border-border/60 grid gap-2 border-t pt-3">
      <Button
        type="button"
        variant="ghost"
        class="text-destructive min-h-11"
        data-testid="inflow-delete"
        @click="del"
      >
        {{ t('inflows.delete') }}
      </Button>
    </div>

    <template #secondary>
      <slot name="secondary" />
    </template>
  </QuickActionSheet>
</template>
