<script setup lang="ts">
/**
 * The route behind both ways of writing a budget.
 *
 * A new one goes through the wizard (reference slide 16), because picking the
 * categories and giving each a ceiling is the heavy part and a wizard is what
 * makes it one thing at a time. An existing one is a single budget with a name
 * and a limit, so it stays the plain form it always was — five steps to change
 * one number would be a ceremony, not a help.
 *
 * Leaving a half-filled wizard asks first, and the ask is on the navigation
 * itself, so the browser's own Back is covered as well as the button.
 */
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
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
import { useDeleteBudget, useUpdateBudget } from '../application/use-budget-mutations';
import { useBudgets } from '../application/use-budgets';
import BudgetWizard from './BudgetWizard.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { dtos, isLoading, isError } = useBudgets();
const { update, isPending: updating } = useUpdateBudget();
const { remove } = useDeleteBudget();

const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = computed(() => dtos.value.find((b) => b.id === editingId.value));
const confirmDelete = ref(false);

/* The wizard says when it is carrying something; until it does, leaving is free. */
const dirty = ref(false);
const confirmLeave = ref(false);
const leaving = ref<((go: boolean) => void) | null>(null);
/** Set while the wizard's own «done» is navigating, so its exit is not questioned. */
const finished = ref(false);

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
/** MoneyInput only ever emits a valid decimal string or leaves the last good one. */
const hasLimit = computed(
  () => form.monthlyLimit !== '' && new Decimal(form.monthlyLimit).greaterThan(0),
);
const found = computed(() => editingId.value === null || existing.value !== undefined);
const uiLocale = computed(() => locale.value as DateLocale);
const back = () => router.replace({ name: 'plan', query: { tab: 'budgets' } });

/*
 * On the router rather than in the component: `onBeforeRouteLeave` only fires
 * for the component the route itself resolved to, and this one is reached
 * through the async wrapper every routed screen here uses. A global guard,
 * dropped when the screen goes, holds for every way out — the button, the
 * navigation, the browser's own Back.
 */
const stopGuard = router.beforeEach((_to, _from, next) => {
  if (editingId.value !== null || finished.value || !dirty.value) {
    next();
    return;
  }
  leaving.value = (go: boolean) => next(go ? undefined : false);
  confirmLeave.value = true;
});
onUnmounted(stopGuard);
/* Vue Router wants an answer either way: a guard left unanswered freezes the app. */
function answer(go: boolean) {
  confirmLeave.value = false;
  const decide = leaving.value;
  leaving.value = null;
  decide?.(go);
}
const leave = () => answer(true);
const stay = () => answer(false);
async function wizardDone() {
  finished.value = true;
  await back();
}

async function run(action: () => Promise<unknown>) {
  try {
    await action();
    await back();
  } catch (e) {
    toast(t(errorKeyFor(e, 'budgets.form.saveFailed')));
  }
}
const submit = () =>
  run(() =>
    update(editingId.value!, {
      name: form.name.trim(),
      monthlyLimit: form.monthlyLimit,
      currency: form.currency,
      activeFrom: form.activeFrom,
      activeTo: form.activeTo || null,
    }),
  );
const endToday = () => run(() => update(editingId.value!, { activeTo: todayIso() }));
const del = () => run(() => remove(editingId.value!));
</script>

<template>
  <!-- One root: the page is a wizard, a form or a sentence, and the leave
       dialog stands beside whichever it is. -->
  <div class="contents">
    <BudgetWizard
      v-if="editingId === null"
      @done="wizardDone"
      @cancel="back"
      @update:dirty="dirty = $event"
    />

    <form
      v-else-if="found"
      class="space-y-5 pb-8"
      data-testid="budget-form"
      @submit.prevent="submit"
    >
      <h1 class="text-2xl font-semibold tracking-[-0.01em]">
        {{ t('budgets.form.editTitle') }}
      </h1>

      <label class="block">
        <span class="text-muted-foreground text-xs font-medium">{{ t('budgets.form.name') }}</span>
        <Input v-model="form.name" required maxlength="60" data-testid="budget-name" class="mt-1" />
      </label>

      <label class="block">
        <span class="text-muted-foreground text-xs font-medium"
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
        <span class="text-muted-foreground text-xs font-medium">{{
          t('budgets.form.currency')
        }}</span>
        <!-- Native select, like the income and expense forms: the e2e drives it with `selectOption`, and on a phone the platform picker wins. -->
        <select
          v-model="form.currency"
          data-testid="budget-currency"
          class="border-border bg-background mt-1 flex min-h-11 w-full rounded-lg border px-3 text-sm"
        >
          <option v-for="c in currencies" :key="c.code" :value="c.code">{{ c.code }}</option>
        </select>
      </label>

      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="text-muted-foreground text-xs font-medium">{{
            t('budgets.form.activeFrom')
          }}</span>
          <Input v-model="form.activeFrom" type="date" required class="mt-1" />
        </label>
        <label class="block">
          <span class="text-muted-foreground text-xs font-medium">{{
            t('budgets.form.activeTo')
          }}</span>
          <Input v-model="form.activeTo" type="date" :min="form.activeFrom" class="mt-1" />
        </label>
      </div>

      <Button
        type="submit"
        size="lg"
        class="min-h-12 w-full"
        :disabled="updating || !hasLimit || form.name.trim() === ''"
        data-testid="budget-submit"
      >
        {{ t('budgets.form.save') }}
      </Button>

      <div class="border-border grid gap-2 border-t pt-4">
        <Button
          v-if="!existing?.activeTo"
          type="button"
          variant="outline"
          class="min-h-11"
          :disabled="updating"
          data-testid="budget-end"
          @click="endToday"
        >
          {{ t('budgets.form.endToday') }}
        </Button>
        <Button
          type="button"
          variant="ghost"
          class="text-destructive min-h-11"
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
      <p class="text-muted-foreground text-sm">
        {{ isError ? t('budgets.error.title') : t('budgets.form.notFound') }}
      </p>
      <Button as-child variant="outline" class="mt-4 min-h-11">
        <RouterLink
          :to="{ path: '/plan', query: { tab: 'budgets' } }"
          data-testid="budget-back-link"
        >
          {{ t('budgets.title') }}
        </RouterLink>
      </Button>
    </div>

    <AlertDialog v-model:open="confirmLeave">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('budgets.wizard.leaveTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('budgets.wizard.leaveBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="budget-stay" @click="stay">
            {{ t('budgets.wizard.stay') }}
          </AlertDialogCancel>
          <AlertDialogAction data-testid="budget-leave" @click="leave">
            {{ t('budgets.wizard.leave') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
