<script setup lang="ts">
/**
 * Create or edit an account, in the row language of the reference (slide 13):
 * no bordered fields, every question a row on a surface, one dark button at the
 * bottom. The card block appears only for cards; the currency locks once the
 * account has history (the API refuses anyway, the form just says so first).
 * Opening balance only when creating.
 *
 * The choices are native `<select>`s rather than a rebuilt listbox. In a row
 * that is all a select has to be — the row carries the label and the height,
 * and the platform carries the keyboard, the wheel and the screen reader.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ACCOUNT_KINDS, CARD_TYPES } from '@magermoney/domain';
import { Button, CountrySelect, MoneyInput, useToast } from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { errorKeyFor } from '@/shared/api/error-messages';
import { useCountryOptions } from '@/shared/countries/options';
import type { DateLocale } from '@/shared/dates/format';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';
import { useAccount } from '../application/use-accounts';
import { useCreateAccount, useUpdateAccount } from '../application/use-account-mutations';
import FormFieldRow from './FormFieldRow.vue';
import FormSwitchRow from './FormSwitchRow.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const countries = useCountryOptions();
const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = useAccount(() => editingId.value ?? '');
const { create, isPending: creating } = useCreateAccount();
const { update, isPending: updating } = useUpdateAccount();

const form = reactive({
  name: '',
  bank: '',
  country: null as string | null,
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

/* Every control in a row shares one look: no border of its own, the row's. */
const CONTROL =
  'w-full min-w-0 bg-transparent text-sm font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted-foreground';

/*
 * The country is the one answer the browser cannot police for us: a combobox is
 * not an input with `required`, so the form says what is missing itself. It
 * only says it once asked to save — a field cannot be wrong before it is due.
 */
const countryMissing = ref(false);
const countryError = computed(() =>
  countryMissing.value && !form.country ? t('accounts.form.countryRequired') : undefined,
);
watch(
  () => form.country,
  (country) => country && (countryMissing.value = false),
);

function payload() {
  const base = {
    name: form.name,
    bank: form.bank,
    country: (form.country ?? '').toUpperCase(),
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
  if (!form.country) {
    countryMissing.value = true;
    return;
  }
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
  } catch (e) {
    toast(t(errorKeyFor(e, 'accounts.form.saveFailed')));
  }
}
</script>

<template>
  <form class="flex flex-col gap-6 pb-8" data-testid="account-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('accounts.form.editTitle') : t('accounts.form.createTitle') }}
    </h1>

    <div class="flex flex-col gap-2">
      <FormFieldRow :label="t('accounts.form.name')">
        <input v-model="form.name" required data-testid="form-name" :class="CONTROL" />
      </FormFieldRow>
      <FormFieldRow :label="t('accounts.form.bank')">
        <input v-model="form.bank" required data-testid="form-bank" :class="CONTROL" />
      </FormFieldRow>
      <CountrySelect
        v-model="form.country"
        :options="countries"
        :label="t('accounts.form.country')"
        :placeholder="t('accounts.form.countryPlaceholder')"
        :search-placeholder="t('accounts.form.countrySearch')"
        :empty-label="t('accounts.form.countryEmpty')"
        :clear-label="t('accounts.form.countryClear')"
        :error="countryError"
        data-testid="form-country"
      />
      <FormFieldRow
        :label="t('accounts.form.currency')"
        :hint="currencyLocked ? t('accounts.form.currencyLocked') : undefined"
      >
        <select
          v-model="form.currency"
          :disabled="currencyLocked"
          data-testid="form-currency"
          :class="[CONTROL, 'disabled:opacity-60']"
        >
          <option v-for="c in currencies" :key="c.code" :value="c.code">
            {{ c.code }}
          </option>
        </select>
      </FormFieldRow>
      <FormFieldRow :label="t('accounts.form.kind')">
        <select v-model="form.kind" data-testid="form-kind" :class="CONTROL">
          <option v-for="k in ACCOUNT_KINDS" :key="k" :value="k">
            {{ t(ACCOUNT_KIND_KEYS[k]) }}
          </option>
        </select>
      </FormFieldRow>

      <!--
        Whether the account shows on Home is not here: it is the star on the
        account's own screen. A switch buried in an editor would be a second
        way to say the same thing, and the slower of the two.
      -->
      <FormSwitchRow
        v-model="form.isSpending"
        :label="t('accounts.form.spending')"
        testid="form-spending"
      />
    </div>

    <fieldset v-if="isCard" class="flex flex-col gap-2">
      <legend class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('accounts.form.cardSection') }}
      </legend>
      <FormFieldRow :label="t('accounts.form.cardType')">
        <select v-model="form.cardType" data-testid="form-card-type" :class="CONTROL">
          <option v-for="ct in CARD_TYPES" :key="ct" :value="ct">
            {{ t(`accounts.cardType.${ct}`) }}
          </option>
        </select>
      </FormFieldRow>
      <FormFieldRow :label="t('accounts.form.cardNetwork')">
        <input v-model="form.cardNetwork" :class="CONTROL" />
      </FormFieldRow>
      <FormFieldRow :label="t('accounts.form.cardTier')">
        <input v-model="form.cardTier" :class="CONTROL" />
      </FormFieldRow>
      <FormFieldRow :label="t('accounts.form.cardLast4')">
        <input
          v-model="form.cardLast4"
          inputmode="numeric"
          maxlength="4"
          pattern="\d{4}"
          :class="CONTROL"
        />
      </FormFieldRow>
      <FormFieldRow :label="t('accounts.form.cardExpires')">
        <input v-model="form.cardExpires" type="date" :class="CONTROL" />
      </FormFieldRow>
    </fieldset>

    <div class="flex flex-col gap-2">
      <FormFieldRow :label="t('accounts.form.note')" class="items-start">
        <textarea v-model="form.note" rows="2" :class="[CONTROL, 'resize-none']" />
      </FormFieldRow>

      <FormFieldRow
        v-if="!editingId"
        :label="`${t('accounts.form.openingBalance')} · ${form.currency}`"
      >
        <MoneyInput
          v-model="form.openingBalance"
          :scale="scale"
          :locale="uiLocale"
          :allow-negative="isCard && form.cardType === 'credit'"
          data-testid="form-opening"
          class="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm font-medium shadow-none focus-visible:ring-0"
        />
      </FormFieldRow>
    </div>

    <!-- The reference's finishing button: full width, 48px, its own weight. -->
    <Button
      type="submit"
      size="lg"
      class="h-12 w-full rounded-xl text-base"
      :disabled="busy"
      data-testid="form-submit"
    >
      {{ editingId ? t('accounts.form.save') : t('accounts.form.create') }}
    </Button>
  </form>
</template>
