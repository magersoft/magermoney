<script setup lang="ts">
/**
 * Writing a goal down, and changing one. Four fields and no ceremony: a name,
 * the amount, the currency it is counted in, and — optionally — a date it is
 * wanted by.
 *
 * What the goal holds is not here, and cannot be: it is the accounts linked to
 * it, which are chosen on the goal's own screen once it exists (ADR 0003).
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Button, Input, MoneyInput, Skeleton, useToast, type AmountLocale } from '@magermoney/ui';
import { AppCurrencySelect } from '@/modules/currencies';
import { useDisplayCurrency } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import { usePageTitle } from '@/shared/layout/page-bar';
import { useCreateGoal, useUpdateGoal } from '../application/use-goal-mutations';
import { useGoals } from '../application/use-goals';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const uiLocale = computed(() => locale.value as AmountLocale);
const { toast } = useToast();
const { current } = useDisplayCurrency();
const { dtos, isLoading, isError } = useGoals();
const { create, isPending: creating } = useCreateGoal();
const { update, isPending: updating } = useUpdateGoal();

const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = computed(() => dtos.value.find((g) => g.id === editingId.value));
const missing = computed(() => editingId.value !== null && !isLoading.value && !existing.value);

const form = reactive({ name: '', targetAmount: '', currency: current.value, targetDate: '' });
const submitted = ref(false);

watch(
  existing,
  (g) => {
    if (!g) return;
    form.name = g.name;
    form.targetAmount = g.targetAmount;
    form.currency = g.currency;
    form.targetDate = g.targetDate ?? '';
  },
  { immediate: true },
);

const isPending = computed(() => creating.value || updating.value);
const nameInvalid = computed(() => submitted.value && form.name.trim() === '');
const amountInvalid = computed(
  () => submitted.value && !(Number(form.targetAmount.replace(',', '.')) > 0),
);
const canSubmit = computed(
  () => form.name.trim() !== '' && Number(form.targetAmount.replace(',', '.')) > 0,
);

usePageTitle(() => (editingId.value ? t('goals.form.editTitle') : t('goals.form.newTitle')));

async function submit() {
  submitted.value = true;
  if (!canSubmit.value || isPending.value) return;
  const input = {
    name: form.name.trim(),
    targetAmount: form.targetAmount.replace(',', '.'),
    currency: form.currency,
    targetDate: form.targetDate === '' ? null : form.targetDate,
  };
  try {
    const saved = editingId.value ? await update(editingId.value, input) : await create(input);
    toast.success(editingId.value ? t('goals.form.saved') : t('goals.form.created'));
    await router.replace({ name: 'goal', params: { id: saved.id } });
  } catch (e) {
    toast.error(t(errorKeyFor(e, 'goals.error.title')));
  }
}
</script>

<template>
  <section class="flex flex-col gap-5 pb-8">
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ editingId ? t('goals.form.editTitle') : t('goals.form.newTitle') }}
    </h1>

    <Skeleton v-if="editingId && isLoading" class="h-64 w-full rounded-xl" />

    <p
      v-else-if="isError || missing"
      class="text-muted-foreground text-sm"
      data-testid="goal-form-missing"
    >
      {{ t('goals.form.missing') }}
    </p>

    <form v-else class="flex flex-col gap-4" data-testid="goal-form" @submit.prevent="submit">
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ t('goals.form.name') }}</span>
        <Input
          v-model="form.name"
          data-testid="goal-name"
          :aria-invalid="nameInvalid"
          :placeholder="t('goals.form.namePlaceholder')"
          class="min-h-11"
        />
        <span v-if="nameInvalid" class="text-destructive text-xs">{{
          t('goals.form.nameRequired')
        }}</span>
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ t('goals.form.target') }}</span>
        <MoneyInput
          v-model="form.targetAmount"
          :scale="2"
          :locale="uiLocale"
          data-testid="goal-target"
          :aria-invalid="amountInvalid"
          class="min-h-11"
        />
        <span v-if="amountInvalid" class="text-destructive text-xs">{{
          t('goals.form.targetPositive')
        }}</span>
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ t('goals.form.currency') }}</span>
        <AppCurrencySelect v-model="form.currency" data-testid="goal-currency" />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ t('goals.form.by') }}</span>
        <Input v-model="form.targetDate" type="date" data-testid="goal-date" class="min-h-11" />
        <span class="text-muted-foreground text-xs">{{ t('goals.form.byHint') }}</span>
      </label>

      <div class="flex gap-3 pt-2">
        <Button
          type="submit"
          class="min-h-11 rounded-xl px-5"
          :disabled="isPending"
          data-testid="goal-save"
        >
          {{ isPending ? t('goals.form.saving') : t('goals.form.save') }}
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
