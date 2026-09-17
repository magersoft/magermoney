<script setup lang="ts">
/**
 * Create or edit an account. The card block appears only for cards; the
 * currency locks once the account has history (the API refuses anyway, the
 * form just says so first). Opening balance only when creating.
 */
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ACCOUNT_KINDS, CARD_TYPES } from '@magermoney/domain';
import {
  Button,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import type { DateLocale } from '@/shared/dates/format';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';
import { useAccount } from '../application/use-accounts';
import { useCreateAccount, useUpdateAccount } from '../application/use-account-mutations';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = useAccount(() => editingId.value ?? '');
const { create, isPending: creating } = useCreateAccount();
const { update, isPending: updating } = useUpdateAccount();

const form = reactive({
  name: '',
  bank: '',
  country: '',
  currency: 'USD',
  kind: 'bank_account' as (typeof ACCOUNT_KINDS)[number],
  isSpending: false,
  cardType: 'debit' as (typeof CARD_TYPES)[number],
  cardNetwork: '',
  cardTier: '',
  cardLast4: '',
  cardExpires: '',
  note: '',
  openingBalance: '',
});
watch(
  existing,
  (a) => {
    if (!a) return;
    Object.assign(form, {
      name: a.name,
      bank: a.bank,
      country: a.country,
      currency: a.currency,
      kind: a.kind,
      isSpending: a.isSpending,
      cardType: a.cardType ?? 'debit',
      cardNetwork: a.cardNetwork ?? '',
      cardTier: a.cardTier ?? '',
      cardLast4: a.cardLast4 ?? '',
      cardExpires: a.cardExpires ?? '',
      note: a.note ?? '',
    });
  },
  { immediate: true },
);

const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const currencyLocked = computed(
  () => existing.value?.balance !== null && existing.value !== undefined,
);
const isCard = computed(() => form.kind === 'card');
const busy = computed(() => creating.value || updating.value);
/**
 * A plain computed rather than an inline `as 'ru' | 'en'` cast in the
 * template: the eslint-plugin-vue template parser misreads the union type's
 * `|` inside a bound attribute as a (deprecated) filter pipe.
 */
const uiLocale = computed(() => locale.value as DateLocale);

function payload() {
  const base = {
    name: form.name,
    bank: form.bank,
    country: form.country.toUpperCase(),
    currency: form.currency,
    kind: form.kind,
    isSpending: form.isSpending,
    note: form.note.trim() || null,
  };
  const card = isCard.value
    ? {
        cardType: form.cardType,
        cardNetwork: form.cardNetwork || null,
        cardTier: form.cardTier || null,
        cardLast4: form.cardLast4 || null,
        cardExpires: form.cardExpires || null,
      }
    : {};
  return { ...base, ...card };
}
async function submit() {
  try {
    if (editingId.value) {
      const full = payload();
      // The API refuses a currency change once the account has balances; the
      // form already knows that (`currencyLocked`), so it just omits the
      // field rather than round-tripping the rejection.
      const { currency, ...withoutCurrency } = full;
      void currency;
      await update(editingId.value, currencyLocked.value ? withoutCurrency : full);
      await router.replace(`/accounts/${editingId.value}`);
    } else {
      const created = await create({
        ...payload(),
        ...(form.openingBalance ? { openingBalance: { amount: form.openingBalance } } : {}),
      });
      await router.replace(`/accounts/${created.id}`);
    }
  } catch {
    toast(t('accounts.form.saveFailed'));
  }
}
</script>

<template>
  <form class="space-y-5 pb-8" data-testid="account-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('accounts.form.editTitle') : t('accounts.form.createTitle') }}
    </h1>

    <label class="block"
      ><span class="text-xs font-medium text-muted-foreground">{{ t('accounts.form.name') }}</span
      ><Input v-model="form.name" required data-testid="form-name" class="mt-1"
    /></label>
    <label class="block"
      ><span class="text-xs font-medium text-muted-foreground">{{ t('accounts.form.bank') }}</span
      ><Input v-model="form.bank" required data-testid="form-bank" class="mt-1"
    /></label>
    <label class="block"
      ><span class="text-xs font-medium text-muted-foreground">{{
        t('accounts.form.country')
      }}</span
      ><Input
        v-model="form.country"
        required
        maxlength="2"
        pattern="[A-Za-z]{2}"
        data-testid="form-country"
        class="mt-1 uppercase"
    /></label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('accounts.form.currency')
      }}</span>
      <Select v-model="form.currency" :disabled="currencyLocked">
        <SelectTrigger class="mt-1 w-full" data-testid="form-currency"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent
          ><SelectItem v-for="c in currencies" :key="c.code" :value="c.code">{{
            c.code
          }}</SelectItem></SelectContent
        >
      </Select>
      <span v-if="currencyLocked" class="text-xs text-muted-foreground">{{
        t('accounts.form.currencyLocked')
      }}</span>
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('accounts.form.kind') }}</span>
      <Select v-model="form.kind">
        <SelectTrigger class="mt-1 w-full" data-testid="form-kind"><SelectValue /></SelectTrigger>
        <SelectContent
          ><SelectItem v-for="k in ACCOUNT_KINDS" :key="k" :value="k">{{
            t(ACCOUNT_KIND_KEYS[k])
          }}</SelectItem></SelectContent
        >
      </Select>
    </label>

    <label class="flex min-h-11 items-center gap-3"
      ><input
        v-model="form.isSpending"
        type="checkbox"
        class="size-5"
        data-testid="form-spending"
      /><span class="text-sm">{{ t('accounts.form.spending') }}</span></label
    >

    <fieldset v-if="isCard" class="space-y-4 border-t border-border pt-4">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('accounts.form.cardType')
        }}</span>
        <Select v-model="form.cardType"
          ><SelectTrigger class="mt-1 w-full"><SelectValue /></SelectTrigger
          ><SelectContent
            ><SelectItem v-for="ct in CARD_TYPES" :key="ct" :value="ct">{{
              t(`accounts.cardType.${ct}`)
            }}</SelectItem></SelectContent
          ></Select
        >
      </label>
      <label class="block"
        ><span class="text-xs font-medium text-muted-foreground">{{
          t('accounts.form.cardNetwork')
        }}</span
        ><Input v-model="form.cardNetwork" class="mt-1"
      /></label>
      <label class="block"
        ><span class="text-xs font-medium text-muted-foreground">{{
          t('accounts.form.cardTier')
        }}</span
        ><Input v-model="form.cardTier" class="mt-1"
      /></label>
      <label class="block"
        ><span class="text-xs font-medium text-muted-foreground">{{
          t('accounts.form.cardLast4')
        }}</span
        ><Input
          v-model="form.cardLast4"
          inputmode="numeric"
          maxlength="4"
          pattern="\d{4}"
          class="mt-1"
      /></label>
      <label class="block"
        ><span class="text-xs font-medium text-muted-foreground">{{
          t('accounts.form.cardExpires')
        }}</span
        ><Input v-model="form.cardExpires" type="date" class="mt-1"
      /></label>
    </fieldset>

    <label class="block"
      ><span class="text-xs font-medium text-muted-foreground">{{ t('accounts.form.note') }}</span
      ><textarea
        v-model="form.note"
        rows="3"
        class="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
      />
    </label>

    <label v-if="!editingId" class="block">
      <span class="text-xs font-medium text-muted-foreground"
        >{{ t('accounts.form.openingBalance') }} · {{ form.currency }}</span
      >
      <MoneyInput
        v-model="form.openingBalance"
        :scale="scale"
        :locale="uiLocale"
        :allow-negative="isCard && form.cardType === 'credit'"
        data-testid="form-opening"
        class="mt-1"
      />
    </label>

    <Button type="submit" size="lg" class="w-full" :disabled="busy" data-testid="form-submit">
      {{ editingId ? t('accounts.form.save') : t('accounts.form.create') }}
    </Button>
  </form>
</template>
