<script setup lang="ts">
/**
 * The new-budget wizard (reference slide 16): five steps, a progress bar along
 * the bottom and a pill with an arrow that moves on.
 *
 * The reference's budget holds several categories; ours *is* a category with a
 * ceiling (CONTEXT.md). So one pass through these steps writes one budget per
 * category picked — the step that looks like «pick your categories» is the step
 * that decides how many budgets are about to exist.
 *
 * What makes it a wizard rather than five screens: the draft is one object held
 * here from the first step to the last, so going back never loses what was
 * typed, and leaving with something in it asks first.
 *
 * Every step is a heading, a region named by it, and a live line that says
 * which step this is — because a progress bar is a picture, and a picture is
 * not an announcement.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue';
import {
  Button,
  CategoryChip,
  Input,
  InputRow,
  MoneyInput,
  ProgressRule,
  SelectRow,
  useToast,
} from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { todayIso, useDisplayCurrency } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { BUDGET_PALETTE, customId } from '../domain/palette';
import {
  BUDGET_STEPS,
  budgetInputs,
  emptyDraft,
  isStepComplete,
  nextStep,
  previousStep,
  type BudgetStep,
  type PickedCategory,
} from '../application/budget-draft';
import { useCreateBudget } from '../application/use-budget-mutations';

const emit = defineEmits<{
  /** Every budget the pass wrote is in. */
  done: [];
  /** Backed out of the first step: what happens to the draft is the screen's call. */
  cancel: [];
  /** Something has been entered: leaving now needs a confirmation. */
  'update:dirty': [dirty: boolean];
}>();

const { t, locale } = useI18n();
const { toast } = useToast();
const currencies = useCurrencies();
const { current: displayCurrency } = useDisplayCurrency();
const { create, isPending } = useCreateBudget();

const step = ref<BudgetStep>('period');
const draft = ref(emptyDraft(todayIso(), displayCurrency.value));
const custom = ref('');
const failed = ref('');

/* The currency list and the profile arrive in either order; the draft follows
 * the display currency until the person reaches the step that claims it. */
watch(displayCurrency, (code) => {
  if (step.value === 'period' && code) draft.value.currency = code;
});

const uiLocale = computed(() => locale.value as DateLocale);
const index = computed(() => BUDGET_STEPS.indexOf(step.value));
const isLast = computed(() => step.value === 'confirm');
const canAdvance = computed(() => isStepComplete(draft.value, step.value));
const scale = computed(
  () => currencies.value.find((c) => c.code === draft.value.currency)?.scale ?? 2,
);
const currencyOptions = computed(() =>
  currencies.value.map((c) => ({ value: c.code, label: c.code })),
);
const palette = computed(() =>
  BUDGET_PALETTE.map((c) => ({
    id: c.key,
    name: t(`budgets.palette.${c.key}`),
    emoji: c.emoji,
  })),
);
/** What the person typed in themselves, kept beside the palette so it can be dropped again. */
const typedIn = computed(() =>
  draft.value.picked.filter((c) => !BUDGET_PALETTE.some((p) => p.key === c.id)),
);
const isPicked = (id: string) => draft.value.picked.some((c) => c.id === id);
const dirty = computed(
  () => draft.value.picked.length > 0 || custom.value.trim() !== '' || draft.value.activeTo !== '',
);
watch(dirty, (value) => emit('update:dirty', value), { immediate: true });

function toggle(category: PickedCategory, selected: boolean) {
  draft.value.picked = selected
    ? [...draft.value.picked, category]
    : draft.value.picked.filter((c) => c.id !== category.id);
}
function addCustom() {
  const name = custom.value.trim();
  if (name === '') return;
  const id = customId(name);
  if (!isPicked(id)) draft.value.picked = [...draft.value.picked, { id, name }];
  custom.value = '';
}

function back() {
  if (step.value === 'period') {
    emit('cancel');
    return;
  }
  step.value = previousStep(step.value);
}
async function forward() {
  if (!canAdvance.value) return;
  if (!isLast.value) {
    step.value = nextStep(step.value);
    return;
  }
  failed.value = '';
  try {
    /* One after another rather than at once: each is its own budget, and the
     * first failure says which of them did not make it. */
    for (const input of budgetInputs(draft.value)) await create(input);
    emit('done');
  } catch (e) {
    failed.value = t(errorKeyFor(e, 'budgets.form.saveFailed'));
    toast(failed.value);
  }
}
</script>

<template>
  <section class="flex min-h-[70vh] flex-col gap-5 pb-8" data-testid="budget-wizard">
    <header class="flex flex-col gap-1">
      <p class="text-muted-foreground text-xs" aria-live="polite" data-testid="budget-step-of">
        {{ t('budgets.wizard.stepOf', { step: index + 1, total: BUDGET_STEPS.length }) }}
      </p>
      <h1 :id="`budget-step-${step}`" class="text-2xl font-semibold tracking-[-0.01em]">
        {{ t(`budgets.wizard.${step}.title`) }}
      </h1>
      <p class="text-muted-foreground text-sm">
        {{ t(`budgets.wizard.${step}.body`) }}
      </p>
    </header>

    <div
      role="group"
      :aria-labelledby="`budget-step-${step}`"
      class="flex flex-1 flex-col gap-3"
      :data-testid="`budget-step-${step}`"
    >
      <template v-if="step === 'period'">
        <InputRow
          v-model="draft.activeFrom"
          :label="t('budgets.form.activeFrom')"
          type="date"
          data-testid="budget-active-from"
        />
        <InputRow
          v-model="draft.activeTo"
          :label="t('budgets.form.activeTo')"
          type="date"
          :min="draft.activeFrom"
          data-testid="budget-active-to"
        />
      </template>

      <SelectRow
        v-else-if="step === 'currency'"
        v-model="draft.currency"
        :label="t('budgets.form.currency')"
        :options="currencyOptions"
        data-testid="budget-currency"
      />

      <template v-else-if="step === 'categories'">
        <ul class="flex flex-wrap gap-2" data-testid="budget-palette">
          <li v-for="c in palette" :key="c.id">
            <CategoryChip
              :label="c.name"
              :emoji="c.emoji"
              :selected="isPicked(c.id)"
              :data-testid="`budget-chip-${c.id}`"
              @update:selected="toggle(c, $event)"
            />
          </li>
          <li v-for="c in typedIn" :key="c.id">
            <CategoryChip
              :label="c.name"
              selected
              :data-testid="`budget-chip-${c.id}`"
              @update:selected="toggle(c, $event)"
            />
          </li>
        </ul>

        <div class="flex items-end gap-2">
          <label class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-muted-foreground text-xs">{{ t('budgets.wizard.own') }}</span>
            <Input
              v-model="custom"
              maxlength="60"
              :placeholder="t('budgets.wizard.ownHint')"
              data-testid="budget-custom"
              @keydown.enter.prevent="addCustom"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            class="min-h-11"
            :disabled="custom.trim() === ''"
            data-testid="budget-custom-add"
            @click="addCustom"
          >
            {{ t('budgets.wizard.add') }}
          </Button>
        </div>
      </template>

      <template v-else-if="step === 'limits'">
        <label
          v-for="c in draft.picked"
          :key="c.id"
          class="bg-surface-sunken flex min-h-14 items-center gap-3 rounded-lg px-3 py-2"
        >
          <span aria-hidden="true" class="text-base">{{ c.emoji ?? '•' }}</span>
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ c.name }}</span>
          <MoneyInput
            :model-value="draft.limits[c.id] ?? ''"
            :scale="scale"
            :locale="uiLocale"
            class="h-auto w-28 border-0 bg-transparent p-0 text-right text-sm font-medium focus-visible:ring-0"
            :data-testid="`budget-limit-${c.id}`"
            @update:model-value="draft.limits[c.id] = $event"
          />
          <span class="text-muted-foreground font-mono text-xs">{{ draft.currency }}</span>
        </label>
      </template>

      <template v-else>
        <ul
          class="bg-surface shadow-card flex flex-col gap-2 rounded-xl p-4"
          data-testid="budget-summary"
        >
          <li
            v-for="c in draft.picked"
            :key="c.id"
            class="flex items-baseline justify-between gap-3"
          >
            <span class="truncate text-sm">
              <span v-if="c.emoji" aria-hidden="true">{{ c.emoji }} </span>{{ c.name }}
            </span>
            <span class="font-mono text-sm tabular-nums"
              >{{ draft.limits[c.id] }} {{ draft.currency }}</span
            >
          </li>
        </ul>
        <p class="text-muted-foreground text-sm">
          {{
            t('budgets.wizard.confirm.period', {
              from: draft.activeFrom,
              to: draft.activeTo || t('budgets.wizard.open'),
            })
          }}
        </p>
        <p v-if="failed" role="alert" class="text-negative text-sm" data-testid="budget-failed">
          {{ failed }}
        </p>
      </template>
    </div>

    <!--
      The reference's footer: a text link back on the left, a dark pill with an
      arrow on the right, and the progress of the steps under both.
    -->
    <footer class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          class="min-h-11"
          data-testid="budget-back"
          @click="back"
        >
          <ChevronLeftIcon aria-hidden="true" class="size-4" />
          {{ step === 'period' ? t('budgets.form.cancel') : t('budgets.wizard.back') }}
        </Button>
        <Button
          type="button"
          size="lg"
          class="min-h-12 rounded-full px-6"
          :disabled="!canAdvance || isPending"
          data-testid="budget-next"
          @click="forward"
        >
          {{
            isLast
              ? t('budgets.wizard.create', { n: draft.picked.length }, draft.picked.length)
              : t('budgets.wizard.next')
          }}
          <ChevronRightIcon aria-hidden="true" class="size-4" />
        </Button>
      </div>
      <ProgressRule
        :value="index + 1"
        :max="BUDGET_STEPS.length"
        :label="t('budgets.wizard.stepOf', { step: index + 1, total: BUDGET_STEPS.length })"
        data-testid="budget-progress"
      />
    </footer>
  </section>
</template>
