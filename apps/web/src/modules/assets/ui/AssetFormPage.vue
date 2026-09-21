<script setup lang="ts">
/**
 * Writing an owned thing down, and changing one.
 *
 * What it is worth is not a field here: worth is an opinion with a date, so it
 * is recorded on the asset's own screen as a valuation (ADR 0002). What is
 * asked here is what the thing is, what currency it is thought of in, whether
 * it counts towards the capital, and — if it is known — what it cost.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  Button,
  Input,
  MoneyInput,
  Skeleton,
  Switch,
  useToast,
  type AmountLocale,
} from '@magermoney/ui';
import { AppCurrencySelect } from '@/modules/currencies';
import { useDisplayCurrency } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import { usePageTitle } from '@/shared/layout/page-bar';
import { useCreateAsset, useUpdateAsset } from '../application/use-asset-mutations';
import { useAssets } from '../application/use-assets';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const uiLocale = computed(() => locale.value as AmountLocale);
const { toast } = useToast();
const { current } = useDisplayCurrency();
const { dtos, isLoading, isError } = useAssets();
const { create, isPending: creating } = useCreateAsset();
const { update, isPending: updating } = useUpdateAsset();

const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = computed(() => dtos.value.find((a) => a.id === editingId.value));
const missing = computed(() => editingId.value !== null && !isLoading.value && !existing.value);

const form = reactive({
  name: '',
  currency: current.value,
  countsInTotal: false,
  acquiredOn: '',
  purchasePrice: '',
});
const submitted = ref(false);

watch(
  existing,
  (a) => {
    if (!a) return;
    form.name = a.name;
    form.currency = a.currency;
    form.countsInTotal = a.countsInTotal;
    form.acquiredOn = a.acquiredOn ?? '';
    form.purchasePrice = a.purchasePrice ?? '';
  },
  { immediate: true },
);

const isPending = computed(() => creating.value || updating.value);
const nameInvalid = computed(() => submitted.value && form.name.trim() === '');

usePageTitle(() => (editingId.value ? t('assets.form.editTitle') : t('assets.form.newTitle')));

async function submit() {
  submitted.value = true;
  if (form.name.trim() === '' || isPending.value) return;
  const price = form.purchasePrice.replace(',', '.');
  const input = {
    name: form.name.trim(),
    currency: form.currency,
    countsInTotal: form.countsInTotal,
    acquiredOn: form.acquiredOn === '' ? null : form.acquiredOn,
    purchasePrice: price === '' ? null : price,
  };
  try {
    const saved = editingId.value ? await update(editingId.value, input) : await create(input);
    toast.success(editingId.value ? t('assets.form.saved') : t('assets.form.created'));
    await router.replace({ name: 'asset', params: { id: saved.id } });
  } catch (e) {
    toast.error(t(errorKeyFor(e, 'assets.error.title')));
  }
}
</script>

<template>
  <section class="flex flex-col gap-5 pb-8">
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ editingId ? t('assets.form.editTitle') : t('assets.form.newTitle') }}
    </h1>

    <Skeleton v-if="editingId && isLoading" class="h-64 w-full rounded-xl" />

    <p
      v-else-if="isError || missing"
      class="text-muted-foreground text-sm"
      data-testid="asset-form-missing"
    >
      {{ t('assets.form.missing') }}
    </p>

    <form v-else class="flex flex-col gap-4" data-testid="asset-form" @submit.prevent="submit">
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ t('assets.form.name') }}</span>
        <Input
          v-model="form.name"
          data-testid="asset-name"
          :aria-invalid="nameInvalid"
          :placeholder="t('assets.form.namePlaceholder')"
          class="min-h-11"
        />
        <span v-if="nameInvalid" class="text-destructive text-xs">
          {{ t('assets.form.nameRequired') }}
        </span>
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ t('assets.form.currency') }}</span>
        <AppCurrencySelect v-model="form.currency" data-testid="asset-currency" />
      </label>

      <div class="flex min-h-11 items-center justify-between gap-3">
        <span class="flex flex-col">
          <span class="text-sm font-medium">{{ t('assets.form.counts') }}</span>
          <span class="text-muted-foreground text-xs">{{ t('assets.form.countsHint') }}</span>
        </span>
        <Switch v-model="form.countsInTotal" data-testid="asset-counts" />
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ t('assets.form.acquired') }}</span>
        <Input
          v-model="form.acquiredOn"
          type="date"
          data-testid="asset-acquired"
          class="min-h-11"
        />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ t('assets.form.price') }}</span>
        <MoneyInput
          v-model="form.purchasePrice"
          :scale="2"
          :locale="uiLocale"
          data-testid="asset-price"
          class="min-h-11"
        />
        <span class="text-muted-foreground text-xs">{{ t('assets.form.priceHint') }}</span>
      </label>

      <div class="flex gap-3 pt-2">
        <Button
          type="submit"
          class="min-h-11 rounded-xl px-5"
          :disabled="isPending"
          data-testid="asset-save"
        >
          {{ isPending ? t('assets.form.saving') : t('assets.form.save') }}
        </Button>
        <Button
          type="button"
          variant="ghost"
          class="min-h-11 rounded-xl px-4"
          @click="router.back()"
        >
          {{ t('action.back') }}
        </Button>
      </div>
    </form>
  </section>
</template>
