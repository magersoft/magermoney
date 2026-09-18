<script setup lang="ts">
/**
 * Create or edit a fixed expense. The category is resolved by name: a known
 * name (case-insensitive) sends its id, anything else sends `categoryName` and
 * the API creates it in the same transaction. Ending is a PATCH of `activeTo`.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { ExpenseInput } from '@magermoney/contracts';
import { EXPENSE_PERIODS, type ExpensePeriod } from '@magermoney/domain';
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
  Input,
  MoneyInput,
  Switch,
  useToast,
} from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useExpenseCategories } from '../application/use-expense-categories';
import {
  useCreateExpense,
  useDeleteExpense,
  useUpdateExpense,
} from '../application/use-expense-mutations';
import { useExpenses } from '../application/use-expenses';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { dtos } = useExpenses();
const { categories } = useExpenseCategories();
const { create, isPending: creating } = useCreateExpense();
const { update, isPending: updating } = useUpdateExpense();
const { remove } = useDeleteExpense();

const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = computed(() => dtos.value.find((e) => e.id === editingId.value));
const confirmDelete = ref(false);
const NO_MONTH = '0';

const form = reactive({
  name: '',
  amount: '',
  currency: 'EUR',
  period: 'monthly' as ExpensePeriod,
  billingDay: null as number | null,
  billingMonth: NO_MONTH,
  category: '',
  isEssential: false,
  activeFrom: todayIso(),
  activeTo: '',
});
watch(
  [existing, categories],
  ([e, cats]) => {
    if (!e) return;
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

const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const busy = computed(() => creating.value || updating.value);
const uiLocale = computed(() => locale.value as DateLocale);
const months = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat(uiLocale.value === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'long',
    }).format(new Date(Date.UTC(2026, i, 1))),
  })),
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
const back = () => router.replace({ name: 'plan', query: { tab: 'expenses' } });

async function submit() {
  try {
    if (editingId.value) await update(editingId.value, payload());
    else await create(payload());
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
async function endToday() {
  if (!editingId.value) return;
  try {
    await update(editingId.value, { activeTo: todayIso() });
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
async function del() {
  if (!editingId.value) return;
  try {
    await remove(editingId.value);
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'expenses.form.saveFailed')));
  }
}
</script>

<template>
  <form class="space-y-5 pb-8" data-testid="expense-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('expenses.form.editTitle') : t('expenses.form.createTitle') }}
    </h1>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('expenses.form.name') }}</span>
      <Input v-model="form.name" required maxlength="80" data-testid="expense-name" class="mt-1" />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground"
        >{{ t('expenses.form.amount') }} · {{ form.currency }}</span
      >
      <MoneyInput
        v-model="form.amount"
        :scale="scale"
        :locale="uiLocale"
        data-testid="expense-amount"
        class="mt-1"
      />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('expenses.form.currency')
      }}</span>
      <!-- Native selects here for the same reason as the income form: the e2e drives them with `selectOption`, and on a phone the platform picker wins. -->
      <select
        v-model="form.currency"
        data-testid="expense-currency"
        class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
      >
        <option v-for="c in currencies" :key="c.code" :value="c.code">{{ c.code }}</option>
      </select>
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('expenses.form.period') }}</span>
      <select
        v-model="form.period"
        data-testid="expense-period"
        class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
      >
        <option v-for="p in EXPENSE_PERIODS" :key="p" :value="p">
          {{ t(`expenses.period.${p}`) }}
        </option>
      </select>
    </label>

    <label v-if="form.period === 'yearly'" class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('expenses.form.billingMonth')
      }}</span>
      <select
        v-model="form.billingMonth"
        data-testid="expense-billing-month"
        class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
      >
        <option :value="NO_MONTH">{{ t('expenses.form.noMonth') }}</option>
        <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </label>

    <fieldset>
      <legend class="text-xs font-medium text-muted-foreground">
        {{ t('expenses.form.billingDay') }}
      </legend>
      <!-- The picker emits `number[] | number | null`; single mode only ever sends the last two. -->
      <DayOfMonthPicker
        :model-value="form.billingDay"
        :multiple="false"
        :aria-label="t('expenses.form.billingDay')"
        class="mt-2"
        data-testid="expense-billing-day"
        @update:model-value="(v) => (form.billingDay = Array.isArray(v) ? null : v)"
      />
    </fieldset>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('expenses.form.category')
      }}</span>
      <Input
        v-model="form.category"
        required
        maxlength="60"
        list="expense-categories"
        autocomplete="off"
        :placeholder="t('expenses.form.categoryHint')"
        data-testid="expense-category"
        class="mt-1"
      />
      <datalist id="expense-categories">
        <option v-for="c in categories" :key="c.id" :value="c.name" />
      </datalist>
    </label>

    <div class="flex min-h-11 items-center justify-between gap-4">
      <span id="expense-essential-label" class="text-sm">{{ t('expenses.form.essential') }}</span>
      <Switch
        v-model="form.isEssential"
        aria-labelledby="expense-essential-label"
        data-testid="expense-essential"
      />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('expenses.form.activeFrom')
        }}</span>
        <Input v-model="form.activeFrom" type="date" required class="mt-1" />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('expenses.form.activeTo')
        }}</span>
        <Input v-model="form.activeTo" type="date" :min="form.activeFrom" class="mt-1" />
      </label>
    </div>

    <Button
      type="submit"
      size="lg"
      class="w-full"
      :disabled="busy || form.name.trim() === '' || form.category.trim() === ''"
      data-testid="expense-submit"
    >
      {{ editingId ? t('expenses.form.save') : t('expenses.form.create') }}
    </Button>

    <div v-if="editingId" class="grid gap-2 border-t border-border pt-4">
      <Button
        v-if="!existing?.activeTo"
        type="button"
        variant="outline"
        class="min-h-9 pointer-coarse:min-h-11"
        :disabled="busy"
        data-testid="expense-end"
        @click="endToday"
      >
        {{ t('expenses.form.endToday') }}
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="min-h-9 text-destructive pointer-coarse:min-h-11"
        data-testid="expense-delete"
        @click="confirmDelete = true"
      >
        {{ t('expenses.form.delete') }}
      </Button>
    </div>

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
  </form>
</template>
