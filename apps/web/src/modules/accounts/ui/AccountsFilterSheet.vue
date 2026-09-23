<script setup lang="ts">
/**
 * Every way the Accounts stack can be narrowed, in one sheet from the bottom
 * edge (reference slide 12's calendar sheet, grown up). Like the period sheet,
 * picking is not applying: the sheet edits a draft and «Применить» hands it
 * over, so a list of cards never reshuffles under the thumb while a filter is
 * half set.
 *
 * It asks only what the accounts can answer. A country none of them is held
 * in, a card type with no cards behind it, an expiry no card states — each
 * could only ever empty the screen, so each question appears once there is
 * something to choose between, and not before.
 */
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Button,
  CountrySelect,
  CurrencySelect,
  MoneyInput,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetTitle,
  cn,
  type AmountLocale,
  type CurrencyOption,
} from '@magermoney/ui';
import type { AccountKind, CardType } from '@magermoney/domain';
import { toCurrencyOption, useCurrencies } from '@/modules/currencies';
import { useCountryOptions } from '@/shared/countries/options';
import {
  EMPTY_FILTER,
  type AccountFilter,
  type ExpiryFilter,
  type FilterChoices,
} from '../domain/account-filter';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';

const props = defineProps<{
  open: boolean;
  /** What the screen is filtered by now; the draft starts from it. */
  filter: AccountFilter;
  choices: FilterChoices;
  /** The currency the bounds are in: the one the total is shown in. */
  displayCode: string;
  displayScale: number;
}>();
const emit = defineEmits<{
  'update:open': [open: boolean];
  apply: [filter: AccountFilter];
  /* The sheet has no trigger of its own, so the screen puts focus back. */
  closed: [];
}>();

const { t, locale } = useI18n();
const amountLocale = computed(() => locale.value as AmountLocale);

const draft = reactive<{
  currencies: string[];
  countries: string[];
  kinds: AccountKind[];
  cardTypes: CardType[];
  expiry: ExpiryFilter;
  min: string;
  max: string;
}>({ ...EMPTY_FILTER, currencies: [], countries: [], kinds: [], cardTypes: [] });

/* Reopening starts from what the screen shows, not from where the draft was left. */
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.assign(draft, {
      ...props.filter,
      currencies: [...props.filter.currencies],
      countries: [...props.filter.countries],
      kinds: [...props.filter.kinds],
      cardTypes: [...props.filter.cardTypes],
    });
  },
  { immediate: true },
);

/*
 * The accounts' own currencies, not the catalogue: a filter over two hundred
 * currencies nobody holds is a search box for an empty result. One the
 * catalogue does not know is still offered, under its code.
 */
const currencies = useCurrencies();
const currencyOptions = computed<CurrencyOption[]>(() =>
  props.choices.currencies.map((code) => {
    const dto = currencies.value.find((c) => c.code === code);
    return dto ? toCurrencyOption(dto, locale.value) : { code, kind: 'fiat', name: code };
  }),
);
const allCountries = useCountryOptions();
const countryOptions = computed(() =>
  allCountries.value.filter((c) => props.choices.countries.includes(c.code)),
);

const expiryOptions = computed(() =>
  (['any', 'soon', 'expired'] as const).map((value) => ({
    value,
    label: t(`accounts.filter.expiryOption.${value}`),
  })),
);

function toggle<V>(list: V[], value: V) {
  const at = list.indexOf(value);
  if (at === -1) list.push(value);
  else list.splice(at, 1);
}

function apply() {
  emit('apply', {
    ...draft,
    currencies: [...draft.currencies],
    countries: [...draft.countries],
    kinds: [...draft.kinds],
    cardTypes: [...draft.cardTypes],
  });
}

const PILL = [
  'min-h-11 rounded-xl px-4 text-sm font-medium',
  'duration-fast ease-out-quart transition-colors motion-reduce:transition-none',
  'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
];
const LEGEND = 'text-muted-foreground mb-2 text-xs font-medium';
</script>

<template>
  <Sheet :open="props.open" @update:open="emit('update:open', $event)">
    <!--
      The fields scroll and the two buttons do not: on a small phone with the
      keyboard up, «Применить» is still where the thumb expects it.
    -->
    <SheetContent
      side="bottom"
      :aria-describedby="undefined"
      class="mx-auto max-h-[92dvh] w-full max-w-lg gap-0 rounded-t-2xl"
      data-testid="accounts-filter-sheet"
      @close-auto-focus="
        (e: Event) => {
          e.preventDefault();
          emit('closed');
        }
      "
    >
      <div class="px-4 pt-4 pb-2">
        <SheetTitle class="text-base font-medium">
          {{ t('accounts.filter.title') }}
        </SheetTitle>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-2 pb-4">
        <CurrencySelect
          v-if="props.choices.currencies.length > 1"
          v-model="draft.currencies"
          multiple
          data-testid="filter-currency"
          class="bg-surface-sunken"
          :options="currencyOptions"
          :label="t('accounts.filter.currency')"
          :placeholder="
            draft.currencies.length
              ? t('accounts.filter.chosen', { n: draft.currencies.length })
              : t('accounts.filter.currencyAny')
          "
          :search-placeholder="t('currencySelect.search')"
          :empty-label="t('currencySelect.empty')"
          :fiat-label="t('currencySelect.fiat')"
          :crypto-label="t('currencySelect.crypto')"
          :remove-label="(name: string) => t('accounts.filter.remove', { label: name })"
        />

        <CountrySelect
          v-if="props.choices.countries.length > 1"
          v-model="draft.countries"
          multiple
          data-testid="filter-country"
          class="bg-surface-sunken"
          :options="countryOptions"
          :label="t('accounts.filter.country')"
          :placeholder="
            draft.countries.length
              ? t('accounts.filter.chosen', { n: draft.countries.length })
              : t('accounts.filter.countryAny')
          "
          :search-placeholder="t('accounts.form.countrySearch')"
          :empty-label="t('accounts.form.countryEmpty')"
          :remove-label="(name: string) => t('accounts.filter.remove', { label: name })"
        />

        <fieldset v-if="props.choices.kinds.length > 1" data-testid="filter-kind">
          <legend :class="LEGEND">
            {{ t('accounts.filter.kind') }}
          </legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="kind in props.choices.kinds"
              :key="kind"
              type="button"
              :data-testid="`filter-kind-${kind}`"
              :aria-pressed="draft.kinds.includes(kind) ? 'true' : 'false'"
              :class="
                cn(
                  PILL,
                  draft.kinds.includes(kind)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-sunken text-ink',
                )
              "
              @click="toggle(draft.kinds, kind)"
            >
              {{ t(ACCOUNT_KIND_KEYS[kind]) }}
            </button>
          </div>
        </fieldset>

        <fieldset v-if="props.choices.cardTypes.length > 0" data-testid="filter-card-type">
          <legend :class="LEGEND">
            {{ t('accounts.filter.cardType') }}
          </legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="type in props.choices.cardTypes"
              :key="type"
              type="button"
              :data-testid="`filter-card-type-${type}`"
              :aria-pressed="draft.cardTypes.includes(type) ? 'true' : 'false'"
              :class="
                cn(
                  PILL,
                  draft.cardTypes.includes(type)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-sunken text-ink',
                )
              "
              @click="toggle(draft.cardTypes, type)"
            >
              {{ t(`accounts.filter.cardTypes.${type}`) }}
            </button>
          </div>
        </fieldset>

        <div v-if="props.choices.hasExpiry" data-testid="filter-expiry">
          <p :class="LEGEND">
            {{ t('accounts.filter.expiryLabel') }}
          </p>
          <SegmentedControl
            v-model="draft.expiry"
            :options="expiryOptions"
            :aria-label="t('accounts.filter.expiryLabel')"
          />
        </div>

        <fieldset data-testid="filter-amount">
          <legend :class="LEGEND">
            {{ t('accounts.filter.amount', { code: props.displayCode }) }}
          </legend>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-muted-foreground text-xs">{{ t('accounts.filter.min') }}</span>
              <MoneyInput
                v-model="draft.min"
                data-testid="filter-min"
                allow-negative
                :scale="props.displayScale"
                :locale="amountLocale"
                class="text-lg"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-muted-foreground text-xs">{{ t('accounts.filter.max') }}</span>
              <MoneyInput
                v-model="draft.max"
                data-testid="filter-max"
                allow-negative
                :scale="props.displayScale"
                :locale="amountLocale"
                class="text-lg"
              />
            </label>
          </div>
        </fieldset>
      </div>

      <div
        class="border-border/60 flex gap-2 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <Button
          variant="ghost"
          size="lg"
          class="min-h-12 flex-1"
          data-testid="filter-reset"
          @click="emit('apply', EMPTY_FILTER)"
        >
          {{ t('accounts.filter.reset') }}
        </Button>
        <Button size="lg" class="min-h-12 flex-[2]" data-testid="filter-apply" @click="apply">
          {{ t('accounts.filter.apply') }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
