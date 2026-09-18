<script setup lang="ts">
/** Create or edit a Budget: a name and a monthly ceiling. Ending is a PATCH of `activeTo`. */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Decimal } from '@magermoney/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  MoneyInput,
  Skeleton,
  useToast,
} from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import {
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from '../application/use-budget-mutations';
import { useBudgets } from '../application/use-budgets';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { dtos, isLoading, isError } = useBudgets();
const { create, isPending: creating } = useCreateBudget();
const { update, isPending: updating } = useUpdateBudget();
const { remove } = useDeleteBudget();

const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = computed(() => dtos.value.find((b) => b.id === editingId.value));
const confirmDelete = ref(false);

const form = reactive({
  name: '',
  monthlyLimit: '',
  currency: 'EUR',
  activeFrom: todayIso(),
  activeTo: '',
});
watch(
  existing,
  (b) => {
    if (!b) return;
    Object.assign(form, {
      name: b.name,
      monthlyLimit: b.monthlyLimit,
      currency: b.currency,
      activeFrom: b.activeFrom,
      activeTo: b.activeTo ?? '',
    });
  },
  { immediate: true },
);

const scale = computed(() => currencies.value.find((c) => c.code === form.currency)?.scale ?? 2);
const busy = computed(() => creating.value || updating.value);
/** MoneyInput only ever emits a valid decimal string or leaves the last good one. */
const hasLimit = computed(
  () => form.monthlyLimit !== '' && new Decimal(form.monthlyLimit).greaterThan(0),
);
const found = computed(() => editingId.value === null || existing.value !== undefined);
const uiLocale = computed(() => locale.value as DateLocale);
const back = () => router.replace({ name: 'plan', query: { tab: 'budgets' } });
const payload = () => ({
  name: form.name.trim(),
  monthlyLimit: form.monthlyLimit,
  currency: form.currency,
  activeFrom: form.activeFrom,
  activeTo: form.activeTo || null,
});

async function run(action: () => Promise<unknown>) {
  try {
    await action();
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'budgets.form.saveFailed')));
  }
}
const submit = () =>
  run(() => (editingId.value ? update(editingId.value, payload()) : create(payload())));
const endToday = () => run(() => update(editingId.value!, { activeTo: todayIso() }));
const del = () => run(() => remove(editingId.value!));
</script>

<template>
  <form v-if="found" class="space-y-5 pb-8" data-testid="budget-form" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ editingId ? t('budgets.form.editTitle') : t('budgets.form.createTitle') }}
    </h1>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{ t('budgets.form.name') }}</span>
      <Input v-model="form.name" required maxlength="60" data-testid="budget-name" class="mt-1" />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground"
        >{{ t('budgets.form.limit') }} · {{ form.currency }}</span
      >
      <MoneyInput
        v-model="form.monthlyLimit"
        :scale="scale"
        :locale="uiLocale"
        data-testid="budget-limit"
        class="mt-1"
      />
    </label>

    <label class="block">
      <span class="text-xs font-medium text-muted-foreground">{{
        t('budgets.form.currency')
      }}</span>
      <!-- Native select, like the income and expense forms: the e2e drives it with `selectOption`, and on a phone the platform picker wins. -->
      <select
        v-model="form.currency"
        data-testid="budget-currency"
        class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
      >
        <option v-for="c in currencies" :key="c.code" :value="c.code">{{ c.code }}</option>
      </select>
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('budgets.form.activeFrom')
        }}</span>
        <Input v-model="form.activeFrom" type="date" required class="mt-1" />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-muted-foreground">{{
          t('budgets.form.activeTo')
        }}</span>
        <Input v-model="form.activeTo" type="date" :min="form.activeFrom" class="mt-1" />
      </label>
    </div>

    <Button
      type="submit"
      size="lg"
      class="w-full"
      :disabled="busy || !hasLimit || form.name.trim() === ''"
      data-testid="budget-submit"
    >
      {{ editingId ? t('budgets.form.save') : t('budgets.form.create') }}
    </Button>

    <div v-if="editingId" class="grid gap-2 border-t border-border pt-4">
      <Button
        v-if="!existing?.activeTo"
        type="button"
        variant="outline"
        class="min-h-9 pointer-coarse:min-h-11"
        :disabled="busy"
        data-testid="budget-end"
        @click="endToday"
      >
        {{ t('budgets.form.endToday') }}
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="min-h-9 text-destructive pointer-coarse:min-h-11"
        data-testid="budget-delete"
        @click="confirmDelete = true"
      >
        {{ t('budgets.form.delete') }}
      </Button>
    </div>

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('budgets.form.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('budgets.form.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('budgets.form.cancel') }}</AlertDialogCancel>
          <AlertDialogAction data-testid="budget-delete-confirm" @click="del">
            {{ t('budgets.form.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </form>
  <div v-else-if="isLoading" class="space-y-4">
    <Skeleton class="h-8 w-40" />
    <Skeleton class="h-12 w-64" />
  </div>
  <!-- The list answered and this id is not in it: a stale link, or it was just deleted. -->
  <div v-else class="mt-10 text-center">
    <p class="text-sm text-muted-foreground">
      {{ isError ? t('budgets.error.title') : t('budgets.form.notFound') }}
    </p>
    <Button as-child variant="outline" class="mt-4 min-h-9 pointer-coarse:min-h-11">
      <RouterLink :to="{ path: '/plan', query: { tab: 'budgets' } }" data-testid="budget-back">
        {{ t('budgets.title') }}
      </RouterLink>
    </Button>
  </div>
</template>
