<script setup lang="ts">
/**
 * Create or edit an Income source. Gross is monthly; tax and commission are
 * typed as percentages and travel as fractions; the net under them is the
 * domain's own `netMonthly`, so the preview and the dashboard cannot disagree.
 */
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Decimal, Money, netMonthly } from '@magermoney/domain';
import {
  Button,
  DayOfMonthPicker,
  Input,
  MoneyInput,
  PercentInput,
  Switch,
  useToast,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useIncomeSource } from '../application/use-income-sources';
import {
  useCreateIncomeSource,
  useUpdateIncomeSource,
} from '../application/use-income-source-mutations';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const registry = useCurrencyRegistry();
const { accounts } = useAccounts();
const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = useIncomeSource(() => editingId.value ?? '');
const { create, isPending: creating } = useCreateIncomeSource();
const { update, isPending: updating } = useUpdateIncomeSource();

const NO_ACCOUNT = '';
const form = reactive({
  name: '',
  grossAmount: '',
  currency: 'USD',
  taxRate: '0',
  commissionRate: '0',
  payDays: [] as number[],
  isPrimary: false,
  activeFrom: todayIso(),
  activeTo: '',
  defaultAccountId: NO_ACCOUNT,
});
watch(
  existing,
  (s) => {
    if (!s) return;
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

const uiLocale = computed(() => locale.value as DateLocale);
const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const activeAccounts = computed(() => accounts.value.filter((a) => a.archivedAt === null));
const busy = computed(() => creating.value || updating.value);

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

async function submit() {
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
    const saved = editingId.value ? await update(editingId.value, input) : await create(input);
    await router.replace(`/plan/income/${saved.id}`);
  } catch (e) {
    toast(t(errorKeyFor(e, 'income.form.saveFailed')));
  }
}
</script>

<template>
  <form class="space-y-5 pb-8" data-testid="source-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('income.form.editTitle') : t('income.form.createTitle') }}
    </h1>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('income.form.name') }}</span>
      <Input v-model="form.name" required maxlength="80" data-testid="source-name" class="mt-1" />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground"
        >{{ t('income.form.gross') }} · {{ form.currency }}</span
      >
      <MoneyInput
        v-model="form.grossAmount"
        :scale="scale"
        :locale="uiLocale"
        data-testid="source-gross"
        class="mt-1"
      />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('income.form.currency') }}</span>
      <!-- A native select, like the account pickers: the e2e drives it with `selectOption`, and on a phone it is the better control anyway. -->
      <select
        v-model="form.currency"
        data-testid="source-currency"
        class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
      >
        <option v-for="c in currencies" :key="c.code" :value="c.code">{{ c.code }}</option>
      </select>
    </label>

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{ t('income.form.tax') }}</span>
        <PercentInput
          v-model="form.taxRate"
          :locale="uiLocale"
          data-testid="source-tax"
          class="mt-1"
        />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('income.form.commission')
        }}</span>
        <PercentInput
          v-model="form.commissionRate"
          :locale="uiLocale"
          data-testid="source-commission"
          class="mt-1"
        />
      </label>
    </div>

    <p class="flex items-baseline justify-between border-y border-border py-3" aria-live="polite">
      <span class="text-sm text-muted-foreground">{{ t('income.form.net') }}</span>
      <span class="font-mono text-lg tabular-nums" data-testid="source-net"
        >{{ netText }} {{ form.currency }}</span
      >
    </p>

    <fieldset>
      <legend class="text-xs font-medium text-muted-foreground">
        {{ t('income.form.payDays') }}
      </legend>
      <DayOfMonthPicker
        :model-value="form.payDays"
        :aria-label="t('income.form.payDays')"
        class="mt-2"
        @update:model-value="(v) => (form.payDays = Array.isArray(v) ? v : [])"
      />
      <p class="mt-2 text-xs text-muted-foreground">
        {{ t('income.form.payDaysHint') }}
      </p>
    </fieldset>

    <div class="flex min-h-11 items-center justify-between gap-4">
      <span>
        <span id="source-primary-label" class="block text-sm font-medium">{{
          t('income.form.primary')
        }}</span>
        <span class="block text-xs text-muted-foreground">{{ t('income.form.primaryHint') }}</span>
      </span>
      <Switch
        v-model="form.isPrimary"
        aria-labelledby="source-primary-label"
        data-testid="source-primary"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('income.form.activeFrom')
        }}</span>
        <Input v-model="form.activeFrom" type="date" required class="mt-1" />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('income.form.activeTo')
        }}</span>
        <Input v-model="form.activeTo" type="date" :min="form.activeFrom" class="mt-1" />
      </label>
    </div>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('income.form.defaultAccount')
      }}</span>
      <select
        v-model="form.defaultAccountId"
        data-testid="source-account"
        class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
      >
        <option :value="NO_ACCOUNT">{{ t('income.form.noAccount') }}</option>
        <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
          {{ a.name }} · {{ a.currency }}
        </option>
      </select>
    </label>

    <Button
      type="submit"
      size="lg"
      class="w-full"
      :disabled="busy || form.name.trim() === ''"
      data-testid="source-submit"
    >
      {{ editingId ? t('income.form.save') : t('income.form.create') }}
    </Button>
  </form>
</template>
