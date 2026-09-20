<script setup lang="ts">
/** One override: a currency, a date, its USD price. The API hint keeps a typo from becoming a rate. */
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Button,
  Input,
  MoneyInput,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useToast,
} from '@magermoney/ui';
import { AppCurrencySelect } from '@/modules/currencies';
import type { MoneyLocale } from '@/shared/money/format';
import { todayIso } from '../domain';
import { useManualRate } from '../application/use-manual-rate';
import { useRates } from '../application/use-rates';

const props = defineProps<{ open: boolean; base?: string }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();
const { t, locale } = useI18n();
const { toast } = useToast();
const { set, isPending } = useManualRate();
const base = ref(props.base ?? 'EUR');
const date = ref(todayIso());
const value = ref('');
watch(
  () => props.open,
  (o) => {
    if (o) {
      base.value = props.base ?? base.value;
      date.value = todayIso();
      value.value = '';
    }
  },
);
const { table } = useRates();
/**
 * A plain computed rather than an inline `as 'ru' | 'en'` cast in the
 * template: the eslint-plugin-vue template parser misreads the union type's
 * `|` inside a bound attribute as a (deprecated) filter pipe.
 */
const uiLocale = computed(() => locale.value as MoneyLocale);
const apiValue = computed(
  () =>
    table.value?.rateOf(base.value).match(
      (v) => v.toSignificantDigits(6).toFixed(),
      () => null,
    ) ?? null,
);
async function submit() {
  if (value.value === '') return;
  try {
    await set({ base: base.value, date: date.value, value: value.value });
    emit('update:open', false);
  } catch {
    toast(t('rates.failed'));
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SheetHeader>
        <SheetTitle>{{ t('rates.sheetTitle') }}</SheetTitle>
      </SheetHeader>
      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <!-- Rates are stored against the dollar, so the dollar cannot be the one being priced. -->
        <AppCurrencySelect
          v-model="base"
          :label="t('rates.currency')"
          :filter="(c) => c.code !== 'USD'"
          data-testid="manual-base"
        />
        <label class="block"
          ><span class="text-xs text-muted-foreground">{{ t('rates.date') }}</span
          ><Input v-model="date" type="date" class="mt-1" data-testid="manual-date"
        /></label>
        <label class="block"
          ><span class="text-xs text-muted-foreground">{{ t('rates.value', { code: base }) }}</span>
          <MoneyInput
            v-model="value"
            :scale="10"
            :locale="uiLocale"
            class="mt-1"
            data-testid="manual-value"
          />
          <span v-if="apiValue" class="mt-1 block text-xs text-muted-foreground">{{
            t('rates.hint', { code: base, value: apiValue })
          }}</span>
        </label>
        <Button
          type="submit"
          size="lg"
          class="w-full"
          :disabled="isPending || value === ''"
          data-testid="manual-save"
        >
          {{ t('rates.save') }}
        </Button>
      </form>
    </SheetContent>
  </Sheet>
</template>
