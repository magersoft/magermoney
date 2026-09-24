<script setup lang="ts">
/**
 * One goal in full: how far it has got, when it lands at the pace it is
 * actually being funded at, and — the part that only exists here — which
 * accounts are doing the funding.
 *
 * Linking is done from this side rather than from the account's screen because
 * the question a person is answering is "what pays for this", not "what is this
 * account for". An account funds at most one goal, so the picker offers only
 * the free ones and the ones already here.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AmountLockup,
  Button,
  RouteError,
  RowGroup,
  Skeleton,
  useToast,
  type AmountLocale,
} from '@magermoney/ui';
import { useAccounts, useUpdateAccount } from '@/modules/accounts';
import { errorKeyFor } from '@/shared/api/error-messages';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import { usePageAction, usePageTitle } from '@/shared/layout/page-bar';
import { useArchiveGoal } from '../application/use-goal-mutations';
import { useGoalProgress } from '../application/use-goal-progress';
import { useGoals } from '../application/use-goals';
import GoalCard from './GoalCard.vue';
import LinkAccountSheet from './LinkAccountSheet.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const amountLocale = computed(() => locale.value as AmountLocale);
const uiLocale = computed(() => locale.value as DateLocale);

const id = computed(() => String(route.params.id));
const { goals, isLoading, isError, refetch } = useGoals();
const goal = computed(() => goals.value.find((g) => g.id === id.value));
const { progress } = useGoalProgress(goal);
const accounts = useAccounts();
const { update } = useUpdateAccount();
const { archive, isPending: deleting } = useArchiveGoal();

const linked = computed(() => accounts.accounts.value.filter((a) => a.goalId === id.value));
const picking = ref(false);
const confirmDelete = ref(false);
const missing = computed(() => !isLoading.value && !isError.value && !goal.value);

usePageTitle(() => goal.value?.name ?? t('goals.title'));
usePageAction(() => ({
  label: t('goals.edit'),
  ariaLabel: t('goals.editNamed', { name: goal.value?.name ?? '' }),
  onSelect: () => void router.push({ name: 'goal-edit', params: { id: id.value } }),
  disabled: !goal.value,
  testid: 'goal-edit',
}));

async function release(accountId: string) {
  try {
    await update(accountId, { goalId: null });
  } catch (e) {
    toast.error(t(errorKeyFor(e, 'goals.error.title')));
  }
}

/**
 * Deleting is archiving underneath: the goal keeps its row, lets go of its
 * accounts in the same write, and no screen shows it again. The person is told
 * only what they will notice — how many accounts come free.
 */
const deleteBody = computed(() =>
  linked.value.length === 0
    ? t('goals.deleteNoAccounts')
    : t('goals.deleteAccounts', { n: linked.value.length }, linked.value.length),
);

async function deleteGoal() {
  if (!goal.value) return;
  try {
    await archive(goal.value.id);
    toast.success(t('goals.deleted'));
    await router.replace({ name: 'savings' });
  } catch (e) {
    toast.error(t(errorKeyFor(e, 'goals.error.title')));
  }
}
</script>

<template>
  <section class="flex flex-col gap-5 pb-8">
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ goal?.name ?? t('goals.title') }}
    </h1>

    <div v-if="isError" data-testid="goal-error">
      <RouteError
        :title="t('goals.error.title')"
        :action-label="t('goals.error.retry')"
        @retry="refetch"
      />
    </div>

    <Skeleton v-else-if="isLoading" class="h-48 w-full rounded-xl" />

    <p v-else-if="missing" class="text-muted-foreground text-sm" data-testid="goal-missing">
      {{ t('goals.form.missing') }}
    </p>

    <template v-else-if="goal">
      <GoalCard :goal="goal" :progress="progress" :linked="linked" />

      <p
        v-if="goal.targetDate"
        class="text-muted-foreground px-1 text-sm"
        data-testid="goal-target-date"
      >
        {{ t('goals.wantedBy', { date: formatDay(goal.targetDate, uiLocale) }) }}
      </p>

      <section class="flex flex-col gap-2">
        <h2 class="px-1 text-sm font-medium">
          {{ t('goals.funding') }}
        </h2>

        <p
          v-if="linked.length === 0"
          class="text-muted-foreground px-1 text-sm"
          data-testid="goal-no-accounts"
        >
          {{ t('goals.noAccounts') }}
        </p>

        <RowGroup v-else :aria-label="t('goals.funding')">
          <li v-for="a in linked" :key="a.id" class="min-w-0">
            <div class="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
              <div class="flex min-w-0 flex-col">
                <span class="truncate text-sm font-medium">{{ a.name }}</span>
                <span class="text-muted-foreground text-xs">{{ a.bank }}</span>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <AmountLockup
                  :amount="a.balance ?? '0'"
                  :code="a.currency"
                  :scale="2"
                  :locale="amountLocale"
                  class="text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  class="min-h-11 px-2"
                  :data-testid="`goal-release-${a.id}`"
                  :aria-label="t('goals.releaseNamed', { name: a.name })"
                  @click="release(a.id)"
                >
                  {{ t('goals.release') }}
                </Button>
              </div>
            </div>
          </li>
        </RowGroup>

        <div>
          <Button
            variant="outline"
            class="min-h-11 rounded-xl px-4"
            data-testid="goal-link-open"
            @click="picking = true"
          >
            {{ t('goals.link') }}
          </Button>
        </div>
      </section>

      <div class="pt-2">
        <Button
          variant="destructive"
          class="min-h-11 rounded-xl px-4"
          :disabled="deleting"
          data-testid="goal-delete"
          @click="confirmDelete = true"
        >
          {{ t('goals.delete') }}
        </Button>
      </div>

      <AlertDialog v-model:open="confirmDelete">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ t('goals.deleteTitle', { name: goal.name }) }}</AlertDialogTitle>
            <AlertDialogDescription>{{ deleteBody }}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="goal-delete-cancel">
              {{ t('goals.cancel') }}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              :disabled="deleting"
              data-testid="goal-delete-confirm"
              @click="deleteGoal"
            >
              {{ t('goals.delete') }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkAccountSheet v-model:open="picking" :goal-id="goal.id" />
    </template>
  </section>
</template>
