<script setup lang="ts">
/**
 * A fixed expense, written the reference's way (slide 13): the amount first and
 * largest, the kind of operation as a segment under it, and everything else as
 * a row rather than a bordered field.
 *
 * The same sheet is both screens it used to be. Opened from the "+" it is a new
 * expense with the segment above it; opened at `/plan/expenses/:id/edit` it is
 * that expense, with no segment — switching a saved expense into a transfer is
 * not a thing anyone means.
 *
 * The category is still resolved by name: a known name (case-insensitive) sends
 * its id, anything else sends `categoryName` and the API creates it in the same
 * transaction. That is why the field suggests rather than restricts.
 *
 * Nothing about what is sent changed here; what changed is where it is typed.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ExpenseInput } from '@magermoney/contracts';
import { Decimal, EXPENSE_PERIODS, type ExpensePeriod } from '@magermoney/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DayOfMonthPicker,
  InputRow,
  QuickActionSheet,
  SelectRow,
  Switch,
  useToast,
  type AmountLocale,
  type SegmentedOption,
} from '@magermoney/ui';
import { AppCurrencySelect, useCurrencies } from '@/modules/currencies';
import { todayIso, useDisplayCurrency } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useExpenseCategories } from '../application/use-expense-categories';
import {
  useCreateExpense,
  useDeleteExpense,
  useUpdateExpense,
} from '../application/use-expense-mutations';
import { useExpenses } from '../application/use-expenses';

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** The expense being edited, if this is an edit. */
    expenseId?: string | null;
    /** The operation segment, when the sheet is one of several. */
    types?: readonly SegmentedOption[];
    type?: string;
  }>(),
  { expenseId: null, types: () => [], type: '' },
);
const emit = defineEmits<{
  'update:open': [open: boolean];
  'update:type': [type: string];
  /** Saved, ended or deleted: the screen decides where that leaves the person. */
  done: [];
}>();

const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { dtos } = useExpenses();
const { categories } = useExpenseCategories();
const { create, isPending: creating } = useCreateExpense();
const { update, isPending: updating } = useUpdateExpense();
const { remove } = useDeleteExpense();

const NO_MONTH = '0';
const confirmDelete = ref(false);
const existing = computed(() => dtos.value.find((e) => e.id === props.expenseId));

const form = reactive({
  name: '',
  amount: '',
  currency: '',
  period: 'monthly' as ExpensePeriod,
  billingDay: null as number | null,
  billingMonth: NO_MONTH,
  category: '',
  isEssential: false,
  activeFrom: todayIso(),
  activeTo: '',
});
/** The field is the person's, or the edited row's, from the first time either sets it. */
const currencyPicked = ref(false);
watch(
  [existing, categories],
  ([e, cats]) => {
    if (!e) return;
    currencyPicked.value = true;
    Object.assign(form, {
      name: e.name,
      amount: e.amount,
      currency: e.currency,
      period: e.period,
      billingDay: e.billingDay,
      billingMonth: e.billingMonth === null ? NO_MONTH : String(e.billingMonth),
      category: cats.find((c) => c.id === e.categoryId)?.name ?? form.category,
      isEssential: e.isEssential,
      activeFrom: e.activeFrom,
      activeTo: e.activeTo ?? '',
    });
  },
  { immediate: true },
);

/**
 * A new row opens in the currency the screens already report in; if that one is
 * not offered the first of the list does. The currency list and the profile
 * behind the display currency arrive in either order, so the default keeps
 * following them until the field is claimed — by the row being edited or by the
 * person — and never after.
 */
const { current: displayCurrency } = useDisplayCurrency();
const defaultCurrency = computed(() => {
  const codes = currencies.value.map((c) => c.code);
  if (codes.length === 0) return '';
  return codes.includes(displayCurrency.value) ? displayCurrency.value : codes[0]!;
});
watch(
  defaultCurrency,
  (code) => {
    if (code !== '' && !currencyPicked.value) form.currency = code;
  },
  { immediate: true },
);

const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const busy = computed(() => creating.value || updating.value);
const uiLocale = computed(() => locale.value as DateLocale);
const amountLocale = computed(() => locale.value as AmountLocale);
const months = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat(uiLocale.value === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'long',
    }).format(new Date(Date.UTC(2026, i, 1))),
  })),
);
const periodOptions = computed(() =>
  EXPENSE_PERIODS.map((p) => ({ value: p, label: t(`expenses.period.${p}`) })),
);
const monthOptions = computed(() => [
  { value: NO_MONTH, label: t('expenses.form.noMonth') },
  ...months.value,
]);

/* MoneyInput only ever emits a valid decimal string or leaves the last good one. */
const hasAmount = computed(() => form.amount !== '' && new Decimal(form.amount).greaterThan(0));
/*
 * What is wrong is said on the field it is wrong about, and only once the
 * person has left something out that the sheet is about to refuse to send.
 */
const showErrors = ref(false);
const nameError = computed(() =>
  showErrors.value && form.name.trim() === '' ? t('expenses.form.nameRequired') : undefined,
);
const categoryError = computed(() =>
  showErrors.value && form.category.trim() === '' ? t('expenses.form.categoryRequired') : undefined,
);
const amountError = computed(() =>
  showErrors.value && !hasAmount.value ? t('expenses.form.amountRequired') : undefined,
);
const valid = computed(
  () =>
    hasAmount.value &&
    form.name.trim() !== '' &&
    form.category.trim() !== '' &&
    form.currency !== '',
);

function payload(): ExpenseInput {
  const name = form.category.trim();
  const known = categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return {
    ...(known ? { categoryId: known.id } : { categoryName: name }),
    name: form.name.trim(),
    amount: form.amount,
    currency: form.currency,
    period: form.period,
    billingDay: form.billingDay,
    billingMonth:
      form.period === 'yearly' && form.billingMonth !== NO_MONTH ? Number(form.billingMonth) : null,
    isEssential: form.isEssential,
    activeFrom: form.activeFrom,
    activeTo: form.activeTo || null,
  };
}

async function submit() {
  if (!valid.value) {
    showErrors.value = true;
    return;
  }
  try {
    if (props.expenseId) await update(props.expenseId, payload());
    else await create(payload());
    emit('done');
  } catch (e) {
    /* The sheet stays open: a failed save must leave what was typed where it is. */
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
async function endToday() {
  if (!props.expenseId) return;
  try {
    await update(props.expenseId, { activeTo: todayIso() });
    emit('done');
  } catch (e) {
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
async function del() {
  if (!props.expenseId) return;
  try {
    await remove(props.expenseId);
    emit('done');
  } catch (e) {
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
</script>

<template>
  <QuickActionSheet
    :open="props.open"
    :title="props.expenseId ? t('expenses.form.editTitle') : t('expenses.form.createTitle')"
    :amount="form.amount"
    :amount-label="t('expenses.form.amount')"
    :code="form.currency"
    :scale="scale"
    :locale="amountLocale"
    :types="props.types"
    :type="props.type"
    :type-label="t('quick.type')"
    :confirm-label="props.expenseId ? t('expenses.form.save') : t('expenses.form.create')"
    :close-label="t('expenses.form.cancel')"
    :confirm-disabled="busy"
    data-testid="expense-form"
    @update:open="emit('update:open', $event)"
    @update:amount="form.amount = $event"
    @update:type="emit('update:type', $event)"
    @confirm="submit"
  >
    <template #currency>
      <AppCurrencySelect
        variant="compact"
        :model-value="form.currency"
        :label="t('expenses.form.currency')"
        data-testid="expense-currency"
        @update:model-value="
          form.currency = $event;
          currencyPicked = true;
        "
      />
    </template>

    <template #fields>
      <p v-if="amountError" class="text-negative -mt-1 text-xs" data-testid="expense-amount-error">
        {{ amountError }}
      </p>

      <InputRow
        v-model="form.name"
        :label="t('expenses.form.name')"
        :error="nameError"
        maxlength="80"
        data-testid="expense-name"
      />

      <InputRow
        v-model="form.category"
        :label="t('expenses.form.category')"
        :placeholder="t('expenses.form.categoryHint')"
        :error="categoryError"
        list="expense-categories"
        maxlength="60"
        data-testid="expense-category"
      />
      <datalist id="expense-categories">
        <option v-for="c in categories" :key="c.id" :value="c.name" />
      </datalist>

      <SelectRow
        v-model="form.period"
        :label="t('expenses.form.period')"
        :options="periodOptions"
        data-testid="expense-period"
      />

      <SelectRow
        v-if="form.period === 'yearly'"
        v-model="form.billingMonth"
        :label="t('expenses.form.billingMonth')"
        :options="monthOptions"
        data-testid="expense-billing-month"
      />

      <InputRow
        v-model="form.activeFrom"
        :label="t('expenses.form.activeFrom')"
        type="date"
        data-testid="expense-active-from"
      />
      <InputRow
        v-model="form.activeTo"
        :label="t('expenses.form.activeTo')"
        type="date"
        :min="form.activeFrom"
        data-testid="expense-active-to"
      />

      <div
        class="bg-surface-sunken flex min-h-14 items-center justify-between gap-4 rounded-lg px-3 py-2"
      >
        <span id="expense-essential-label" class="text-sm font-medium">{{
          t('expenses.form.essential')
        }}</span>
        <Switch
          v-model="form.isEssential"
          aria-labelledby="expense-essential-label"
          data-testid="expense-essential"
        />
      </div>
    </template>

    <fieldset>
      <legend class="text-muted-foreground mb-2 text-xs">
        {{ t('expenses.form.billingDay') }}
      </legend>
      <!-- The picker emits `number[] | number | null`; single mode only ever sends the last two. -->
      <DayOfMonthPicker
        :model-value="form.billingDay"
        :multiple="false"
        :aria-label="t('expenses.form.billingDay')"
        data-testid="expense-billing-day"
        @update:model-value="(v) => (form.billingDay = Array.isArray(v) ? null : v)"
      />
    </fieldset>

    <div v-if="props.expenseId" class="border-border/60 grid gap-2 border-t pt-3">
      <Button
        v-if="!existing?.activeTo"
        type="button"
        variant="outline"
        class="min-h-11"
        :disabled="busy"
        data-testid="expense-end"
        @click="endToday"
      >
        {{ t('expenses.form.endToday') }}
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="text-destructive min-h-11"
        data-testid="expense-delete"
        @click="confirmDelete = true"
      >
        {{ t('expenses.form.delete') }}
      </Button>
    </div>
  </QuickActionSheet>

  <AlertDialog v-model:open="confirmDelete">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('expenses.form.deleteTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t('expenses.form.deleteBody') }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('expenses.form.cancel') }}</AlertDialogCancel>
        <AlertDialogAction data-testid="expense-delete-confirm" @click="del">
          {{ t('expenses.form.delete') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
