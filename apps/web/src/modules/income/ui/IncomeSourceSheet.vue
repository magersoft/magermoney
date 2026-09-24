<script setup lang="ts">
/**
 * An Income source on the reference's add-operation layout (slide 13): the
 * gross month is the first and largest field, the kind of operation is the
 * segment under it, and the rest of the form is rows.
 *
 * Gross is monthly; tax and commission are typed as percentages and travel as
 * fractions; the net between them is the domain's own `netMonthly`, so the
 * preview and the dashboard cannot disagree. None of that changed — only where
 * it is typed.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Decimal, Money, netMonthly } from '@magermoney/domain';
import {
  DayOfMonthPicker,
  InputRow,
  PercentInput,
  QuickActionSheet,
  SelectRow,
  Switch,
  useToast,
  type AmountLocale,
  type SegmentedOption,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { AppCurrencySelect, useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useDisplayCurrency } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useIncomeSource } from '../application/use-income-sources';
import {
  useCreateIncomeSource,
  useUpdateIncomeSource,
} from '../application/use-income-source-mutations';

const props = withDefaults(
  defineProps<{
    open: boolean;
    sourceId?: string | null;
    types?: readonly SegmentedOption[];
    type?: string;
  }>(),
  { sourceId: null, types: () => [], type: '' },
);
const emit = defineEmits<{
  'update:open': [open: boolean];
  'update:type': [type: string];
  /** Saved: the screen decides where that leaves the person. */
  saved: [id: string];
}>();

const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const registry = useCurrencyRegistry();
const { accounts } = useAccounts();
const existing = useIncomeSource(() => props.sourceId ?? '');
const { create, isPending: creating } = useCreateIncomeSource();
const { update, isPending: updating } = useUpdateIncomeSource();

const NO_ACCOUNT = '';
const form = reactive({
  name: '',
  grossAmount: '',
  currency: '',
  taxRate: '0',
  commissionRate: '0',
  payDays: [] as number[],
  isPrimary: false,
  activeFrom: todayIso(),
  activeTo: '',
  defaultAccountId: NO_ACCOUNT,
});
/** The field is the person's, or the edited row's, from the first time either sets it. */
const currencyPicked = ref(false);
watch(
  existing,
  (s) => {
    if (!s) return;
    currencyPicked.value = true;
    Object.assign(form, {
      name: s.name,
      grossAmount: s.grossAmount,
      currency: s.currency,
      taxRate: s.taxRate,
      commissionRate: s.commissionRate,
      payDays: [...s.payDays],
      isPrimary: s.isPrimary,
      activeFrom: s.activeFrom,
      activeTo: s.activeTo ?? '',
      defaultAccountId: s.defaultAccountId ?? NO_ACCOUNT,
    });
  },
  { immediate: true },
);

/** The same default-currency rule every form in the app follows. */
const { current: displayCurrency } = useDisplayCurrency();
const defaultCurrency = computed(() => {
  const list = currencies.value.map((c) => c.code);
  if (list.length === 0) return '';
  return list.includes(displayCurrency.value) ? displayCurrency.value : list[0]!;
});
watch(
  defaultCurrency,
  (code) => {
    if (code !== '' && !currencyPicked.value) form.currency = code;
  },
  { immediate: true },
);

const uiLocale = computed(() => locale.value as DateLocale);
const amountLocale = computed(() => locale.value as AmountLocale);
const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const busy = computed(() => creating.value || updating.value);
const accountOptions = computed(() => [
  { value: NO_ACCOUNT, label: t('income.form.noAccount') },
  ...accounts.value
    .filter((a) => a.archivedAt === null)
    .map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` })),
]);

const net = computed(() => {
  if (form.grossAmount === '') return null;
  const currency = registry.value
    .get(form.currency)
    .unwrapOr({ code: form.currency, kind: 'fiat' as const, scale: scale.value });
  return netMonthly({
    grossAmount: Money.of(form.grossAmount, currency),
    taxRate: new Decimal(form.taxRate),
    commissionRate: new Decimal(form.commissionRate),
  });
});
const netText = computed(() => net.value?.amount.toFixed(scale.value) ?? '—');

const showErrors = ref(false);
const nameError = computed(() =>
  showErrors.value && form.name.trim() === '' ? t('income.form.nameRequired') : undefined,
);
const valid = computed(() => form.name.trim() !== '' && form.currency !== '');

async function submit() {
  if (!valid.value) {
    showErrors.value = true;
    return;
  }
  const input = {
    name: form.name.trim(),
    grossAmount: form.grossAmount === '' ? '0' : form.grossAmount,
    currency: form.currency,
    taxRate: form.taxRate,
    commissionRate: form.commissionRate,
    payDays: form.payDays,
    isPrimary: form.isPrimary,
    activeFrom: form.activeFrom,
    activeTo: form.activeTo || null,
    defaultAccountId: form.defaultAccountId || null,
  };
  try {
    const saved = props.sourceId ? await update(props.sourceId, input) : await create(input);
    emit('saved', saved.id);
  } catch (e) {
    /* The sheet stays open: a failed save must leave what was typed where it is. */
    toast(t(errorKeyFor(e, 'income.form.saveFailed')));
  }
}
</script>

<template>
  <QuickActionSheet
    :open="props.open"
    :title="props.sourceId ? t('income.form.editTitle') : t('income.form.createTitle')"
    :amount="form.grossAmount"
    :amount-label="t('income.form.gross')"
    :code="form.currency"
    :scale="scale"
    :locale="amountLocale"
    :types="props.types"
    :type="props.type"
    :type-label="t('quick.type')"
    :confirm-label="props.sourceId ? t('income.form.save') : t('income.form.create')"
    :close-label="t('income.form.cancel')"
    :confirm-disabled="busy"
    data-testid="source-form"
    @update:open="emit('update:open', $event)"
    @update:amount="form.grossAmount = $event"
    @update:type="emit('update:type', $event)"
    @confirm="submit"
  >
    <template #currency>
      <AppCurrencySelect
        variant="compact"
        :model-value="form.currency"
        :label="t('income.form.currency')"
        data-testid="source-currency"
        @update:model-value="
          form.currency = $event;
          currencyPicked = true;
        "
      />
    </template>

    <template #fields>
      <InputRow
        v-model="form.name"
        :label="t('income.form.name')"
        :error="nameError"
        maxlength="80"
        data-testid="source-name"
      />

      <div class="grid grid-cols-2 gap-2">
        <label
          class="bg-surface-sunken flex min-h-14 flex-col justify-center gap-0.5 rounded-lg px-3 py-2"
        >
          <span class="text-muted-foreground text-xs">{{ t('income.form.tax') }}</span>
          <PercentInput
            v-model="form.taxRate"
            :locale="uiLocale"
            data-testid="source-tax"
            class="h-auto border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
          />
        </label>
        <label
          class="bg-surface-sunken flex min-h-14 flex-col justify-center gap-0.5 rounded-lg px-3 py-2"
        >
          <span class="text-muted-foreground text-xs">{{ t('income.form.commission') }}</span>
          <PercentInput
            v-model="form.commissionRate"
            :locale="uiLocale"
            data-testid="source-commission"
            class="h-auto border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
          />
        </label>
      </div>

      <p class="flex items-baseline justify-between px-3 py-1" aria-live="polite">
        <span class="text-muted-foreground text-sm">{{ t('income.form.net') }}</span>
        <span class="font-mono text-base tabular-nums" data-testid="source-net"
          >{{ netText }} {{ form.currency }}</span
        >
      </p>

      <SelectRow
        v-model="form.defaultAccountId"
        :label="t('income.form.defaultAccount')"
        :options="accountOptions"
        data-testid="source-account"
      />

      <InputRow
        v-model="form.activeFrom"
        :label="t('income.form.activeFrom')"
        type="date"
        data-testid="source-active-from"
      />
      <InputRow
        v-model="form.activeTo"
        :label="t('income.form.activeTo')"
        type="date"
        :min="form.activeFrom"
        data-testid="source-active-to"
      />

      <div
        class="bg-surface-sunken flex min-h-14 items-center justify-between gap-4 rounded-lg px-3 py-2"
      >
        <span>
          <span id="source-primary-label" class="block text-sm font-medium">{{
            t('income.form.primary')
          }}</span>
          <span class="text-muted-foreground block text-xs">{{
            t('income.form.primaryHint')
          }}</span>
        </span>
        <Switch
          v-model="form.isPrimary"
          aria-labelledby="source-primary-label"
          data-testid="source-primary"
        />
      </div>
    </template>

    <fieldset>
      <legend class="text-muted-foreground mb-2 text-xs">
        {{ t('income.form.payDays') }}
      </legend>
      <DayOfMonthPicker
        :model-value="form.payDays"
        :aria-label="t('income.form.payDays')"
        @update:model-value="(v) => (form.payDays = Array.isArray(v) ? v : [])"
      />
      <p class="text-muted-foreground mt-2 text-xs">
        {{ t('income.form.payDaysHint') }}
      </p>
    </fieldset>
  </QuickActionSheet>
</template>
