<script setup lang="ts">
/**
 * Which currencies this person uses.
 *
 * The catalogue holds a couple of hundred; this screen is the short list they
 * picked out of it, and the one place to add to it or take something off. Every
 * other screen — the account form, the budget wizard, the rates list — offers
 * exactly what is here.
 *
 * The rows say two things a code cannot: the currency's name, and whether
 * anyone quotes a rate for it. A currency nobody quotes still works; it just
 * needs a rate typed by hand, and saying so here is what keeps an unconverted
 * amount from reading as a zero later (ADR 0006).
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, CurrencyIcon, CurrencySelect, Skeleton, useToast } from '@magermoney/ui';
import { ApiError } from '@/shared/api/client';
import { usePageAction, usePageTitle } from '@/shared/layout/page-bar';
import {
  useConnectedCurrencies,
  useCurrencies,
  useCurrencyCatalogue,
} from '../application/use-currencies';
import { useCurrencyOptions } from '../application/use-currency-options';

const { t } = useI18n();
const { toast } = useToast();

const connected = useCurrencies();
const { connect, disconnect, isPending } = useConnectedCurrencies();

/*
 * The catalogue is a couple of hundred rows and no other screen wants it — but
 * this one exists to add a currency out of it, so it is fetched on arrival
 * rather than gated behind opening the picker.
 */
const { currencies: catalogue, isLoading: loadingCatalogue } = useCurrencyCatalogue();
const catalogueOptions = useCurrencyOptions(catalogue);
const options = useCurrencyOptions(connected);

const connectedCodes = computed(() => connected.value.map((c) => c.code));

/* Joined once here rather than looked up per row inside the template. */
const rows = computed(() =>
  options.value.map((o, i) => ({ ...o, quoted: connected.value[i]?.rateSource !== null })),
);

usePageTitle(() => t('currencies.title'));
/*
 * The bar's action opens the same picker the row does, rather than being a
 * second way to add a currency: two controls that do one thing are two places
 * for the list to disagree about what is already connected.
 */
const picker = ref<HTMLElement | null>(null);
usePageAction(() => ({
  label: t('currencies.add'),
  ariaLabel: t('currencies.addAria'),
  onSelect: () =>
    picker.value?.querySelector<HTMLElement>('[data-testid="currency-trigger"]')?.click(),
  pending: isPending.value,
  testid: 'currencies-add',
}));

/*
 * The picker is an action, not a field: choosing a currency connects it and the
 * control returns to its placeholder. `pending` is never a real currency, so
 * binding it two-way is safe.
 */
const pending = ref('');
async function onPick(code: string) {
  pending.value = '';
  if (!code) return;
  try {
    await connect(code);
  } catch {
    toast(t('currencies.addFailed'));
  }
}

async function remove(code: string) {
  try {
    await disconnect(code);
  } catch (e) {
    /* The API already wrote the sentence: which accounts, which budgets. */
    toast(e instanceof ApiError ? e.message : t('currencies.removeFailed'));
  }
}
</script>

<template>
  <section class="pb-8">
    <!-- The bar carries this on a phone; a wide window's bar carries the links. -->
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ t('currencies.title') }}
    </h1>
    <p class="text-muted-foreground mt-1 text-xs">
      {{ t('currencies.hint') }}
    </p>

    <div ref="picker" class="mt-4">
      <!-- No `:key` to force a remount: `onPick` clears `pending` itself, and
           remounting would rebuild a list of two hundred rows on every add. -->
      <CurrencySelect
        v-model="pending"
        :options="catalogueOptions"
        :disabled-codes="connectedCodes"
        :disabled-label="t('currencies.alreadyAdded')"
        :label="t('currencies.add')"
        :placeholder="loadingCatalogue ? t('currencies.loading') : t('currencies.add')"
        :search-placeholder="t('currencySelect.search')"
        :empty-label="t('currencySelect.empty')"
        :fiat-label="t('currencySelect.fiat')"
        :crypto-label="t('currencySelect.crypto')"
        :disabled="isPending"
        data-testid="currencies-picker"
        @update:model-value="onPick"
      />
    </div>

    <Skeleton v-if="connected.length === 0" class="mt-4 h-12 w-full" />
    <ul v-else class="divide-border/60 mt-4 divide-y" data-testid="currencies-list">
      <li
        v-for="c in rows"
        :key="c.code"
        :data-testid="`currency-row-${c.code}`"
        class="flex min-h-14 items-center gap-3 py-2"
      >
        <CurrencyIcon :code="c.code" :kind="c.kind" :size="24" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm">{{ c.name }}</span>
          <span v-if="!c.quoted" class="text-muted-foreground text-xs">{{
            t('currencies.noRateSource')
          }}</span>
        </span>
        <span class="text-muted-foreground shrink-0 font-mono text-xs tracking-[0.08em]">{{
          c.code
        }}</span>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          class="shrink-0 pointer-coarse:size-11"
          :disabled="connected.length < 2 || isPending"
          :aria-label="t('currencies.remove', { code: c.code })"
          :title="t('currencies.remove', { code: c.code })"
          :data-testid="`currency-remove-${c.code}`"
          @click="remove(c.code)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            class="size-4"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      </li>
    </ul>
  </section>
</template>
