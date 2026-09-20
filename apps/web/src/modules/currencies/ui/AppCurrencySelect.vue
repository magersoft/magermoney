<script setup lang="ts">
/**
 * The design system's currency picker, wired to this app: the connected
 * currencies, the names in the language on screen, and the words for the
 * label, the search and the group headings.
 *
 * It exists so the five screens that ask for a currency do not each repeat
 * seven props and the same option mapping — and so that a change to what
 * "frequent" means happens in one place.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CurrencyDto } from '@magermoney/contracts';
import { CurrencySelect } from '@magermoney/ui';
import { useCurrencies } from '../application/use-currencies';
import { useCurrencyOptions } from '../application/use-currency-options';

const props = withDefaults(
  defineProps<{
    variant?: 'row' | 'compact';
    /** Overrides the label when the screen calls this something else. */
    label?: string;
    /** Codes to offer first: usually the currencies already on screen. */
    frequent?: readonly string[];
    /** Narrows the list — the rates screen has no use for the dollar it quotes against. */
    filter?: (currency: CurrencyDto) => boolean;
    error?: string;
    hint?: string;
    disabled?: boolean;
  }>(),
  {
    variant: 'row',
    label: undefined,
    frequent: () => [],
    filter: undefined,
    error: undefined,
    hint: undefined,
    disabled: false,
  },
);

const model = defineModel<string>({ required: true });

const { t } = useI18n();
const connected = useCurrencies();
const shown = computed(() =>
  props.filter ? connected.value.filter(props.filter) : connected.value,
);
const options = useCurrencyOptions(shown);
</script>

<template>
  <CurrencySelect
    v-model="model"
    :options="options"
    :variant="props.variant"
    :label="props.label ?? t('currencySelect.label')"
    :placeholder="t('currencySelect.placeholder')"
    :search-placeholder="t('currencySelect.search')"
    :empty-label="t('currencySelect.empty')"
    :fiat-label="t('currencySelect.fiat')"
    :crypto-label="t('currencySelect.crypto')"
    :frequent-label="t('currencySelect.frequent')"
    :frequent="props.frequent"
    :error="props.error"
    :hint="props.hint"
    :disabled="props.disabled"
  />
</template>
