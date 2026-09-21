<script setup lang="ts">
/**
 * Saying what a thing is worth today — or on some earlier day nobody got round
 * to writing down.
 *
 * One opinion per thing per day: the database says so, and the sheet says the
 * same thing back when the date is already taken, rather than leaving the
 * refusal to look like a failure.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Button,
  Input,
  MoneyInput,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  useToast,
  type AmountLocale,
} from '@magermoney/ui';
import { todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import { useAddValuation } from '../application/use-asset-mutations';

const props = defineProps<{ open: boolean; assetId: string }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const { t, locale } = useI18n();
const uiLocale = computed(() => locale.value as AmountLocale);
const { toast } = useToast();
const { add, isPending } = useAddValuation(props.assetId);

const form = reactive({ value: '', valuedOn: todayIso() });
const submitted = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.value = '';
    form.valuedOn = todayIso();
    submitted.value = false;
  },
);

const invalid = computed(() => submitted.value && !(Number(form.value.replace(',', '.')) > 0));

async function submit() {
  submitted.value = true;
  if (!(Number(form.value.replace(',', '.')) > 0) || isPending.value) return;
  try {
    await add({ value: form.value.replace(',', '.'), valuedOn: form.valuedOn });
    toast.success(t('assets.valuationSaved'));
    emit('update:open', false);
  } catch (e) {
    toast.error(t(errorKeyFor(e, 'assets.error.title')));
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent side="bottom" data-testid="valuation-sheet">
      <SheetHeader>
        <SheetTitle>{{ t('assets.revalue') }}</SheetTitle>
        <SheetDescription>{{ t('assets.revalueHint') }}</SheetDescription>
      </SheetHeader>

      <form class="flex flex-col gap-4 pt-2" @submit.prevent="submit">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">{{ t('assets.worth') }}</span>
          <MoneyInput
            v-model="form.value"
            :scale="2"
            :locale="uiLocale"
            data-testid="valuation-value"
            :aria-invalid="invalid"
            class="min-h-11"
          />
          <span v-if="invalid" class="text-destructive text-xs">
            {{ t('assets.worthPositive') }}
          </span>
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">{{ t('assets.valuedOnLabel') }}</span>
          <Input
            v-model="form.valuedOn"
            type="date"
            data-testid="valuation-date"
            class="min-h-11"
          />
        </label>

        <Button
          type="submit"
          class="min-h-11 rounded-xl px-5"
          :disabled="isPending"
          data-testid="valuation-save"
        >
          {{ isPending ? t('assets.form.saving') : t('assets.form.save') }}
        </Button>
      </form>
    </SheetContent>
  </Sheet>
</template>
