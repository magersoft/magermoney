<script setup lang="ts">
/**
 * The reporting currencies, as a ledger list: one hairline-separated row per
 * currency, the code in the mono lockup, and the radio that marks the default.
 * Removing the current default moves it rather than sending a pair the API will
 * reject, and the last currency cannot be removed at all.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, CurrencyIcon, CurrencySelect } from '@magermoney/ui';
import { useCurrencies, useCurrencyOptions } from '@/modules/currencies';
import { withoutCurrency } from '../domain/profile';

const props = defineProps<{
  selected: readonly string[];
  defaultCurrency: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  change: [value: { reportingCurrencies: string[]; defaultCurrency: string }];
}>();

const { t, locale } = useI18n();
const currencies = useCurrencies();

const byCode = computed(() => new Map(currencies.value.map((c) => [c.code, c])));

const rows = computed(() =>
  props.selected.map((code) => {
    const known = byCode.value.get(code);
    return {
      code,
      kind: known?.kind ?? ('fiat' as const),
      icon: known?.icon ?? null,
      name: (locale.value === 'ru' ? known?.nameRu : known?.nameEn) ?? known?.nameEn ?? '',
    };
  }),
);

const addable = computed(() => currencies.value.filter((c) => !props.selected.includes(c.code)));
const addableOptions = useCurrencyOptions(addable);

/*
 * The picker is an action, not a field: choosing a currency adds it and the
 * control goes back to its placeholder, ready for the next one. Holding on to
 * the choice would leave the row showing a currency that is already in the
 * list below it.
 */
const pending = ref('');
watch(pending, (code) => {
  if (!code) return;
  add(code);
  pending.value = '';
});

function add(code: string): void {
  if (!code || props.selected.includes(code)) return;
  emit('change', {
    reportingCurrencies: [...props.selected, code],
    defaultCurrency: props.defaultCurrency,
  });
}

function remove(code: string): void {
  const next = withoutCurrency(props.selected, props.defaultCurrency, code);
  if (next) emit('change', next);
}

function makeDefault(code: string): void {
  if (code === props.defaultCurrency) return;
  emit('change', { reportingCurrencies: [...props.selected], defaultCurrency: code });
}
</script>

<template>
  <fieldset class="mt-4" :disabled="busy">
    <legend class="sr-only">
      {{ t('settings.currencies.title') }}
    </legend>

    <ul class="divide-y divide-border border-y border-border">
      <li v-for="row in rows" :key="row.code" class="flex min-h-[52px] items-center gap-3 py-2">
        <CurrencyIcon :code="row.code" :kind="row.kind" :icon="row.icon" :size="24" />
        <span class="font-mono text-xs uppercase tracking-[0.08em]">{{ row.code }}</span>
        <span class="truncate text-sm text-muted-foreground">{{ row.name }}</span>

        <label
          class="ms-auto flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-1 text-sm"
          :title="t('settings.currencies.defaultOf', { code: row.code })"
        >
          <input
            type="radio"
            name="default-currency"
            class="size-4 accent-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            :value="row.code"
            :checked="row.code === defaultCurrency"
            @change="makeDefault(row.code)"
          />
          <span :class="row.code === defaultCurrency ? 'text-foreground' : 'text-muted-foreground'">
            {{ t('settings.currencies.default') }}
          </span>
        </label>

        <Button
          variant="ghost"
          size="icon"
          type="button"
          class="shrink-0"
          :disabled="selected.length < 2"
          :aria-label="t('settings.currencies.remove', { code: row.code })"
          :title="t('settings.currencies.remove', { code: row.code })"
          @click="remove(row.code)"
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

    <div class="mt-4 flex items-center gap-3">
      <CurrencySelect
        v-model="pending"
        :options="addableOptions"
        :label="t('settings.currencies.add')"
        :placeholder="t('settings.currencies.add')"
        :search-placeholder="t('currencySelect.search')"
        :empty-label="t('currencySelect.empty')"
        :fiat-label="t('currencySelect.fiat')"
        :crypto-label="t('currencySelect.crypto')"
        :disabled="addable.length === 0"
        class="flex-1"
      />
    </div>
  </fieldset>
</template>
