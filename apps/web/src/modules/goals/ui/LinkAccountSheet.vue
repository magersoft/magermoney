<script setup lang="ts">
/**
 * Choosing which accounts fund a goal.
 *
 * An account funds at most one goal, so an account already taken by another one
 * is shown and disabled rather than hidden: "where did my savings account go"
 * is a question the list should answer, not raise.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  useToast,
} from '@magermoney/ui';
import { useAccounts, useUpdateAccount } from '@/modules/accounts';
import { errorKeyFor } from '@/shared/api/error-messages';
import { useGoals } from '../application/use-goals';

const props = defineProps<{ open: boolean; goalId: string }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const { t } = useI18n();
const { toast } = useToast();
const accounts = useAccounts();
const { goals } = useGoals();
const { update, isPending } = useUpdateAccount();

const nameOfGoal = (id: string) => goals.value.find((g) => g.id === id)?.name ?? '';

/** Everything not archived: free accounts, this goal's, and the ones another goal holds. */
const rows = computed(() =>
  accounts.accounts.value
    .filter((a) => a.archivedAt === null)
    .map((a) => ({
      account: a,
      here: a.goalId === props.goalId,
      takenBy: a.goalId !== null && a.goalId !== props.goalId ? nameOfGoal(a.goalId) : null,
    })),
);

/** How many could be linked right now: this goal's own, plus the untaken. */
const freeCount = computed(() => rows.value.filter((r) => r.takenBy === null).length);

async function toggle(accountId: string, here: boolean) {
  try {
    await update(accountId, { goalId: here ? null : props.goalId });
  } catch (e) {
    toast.error(t(errorKeyFor(e, 'goals.error.title')));
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent
      side="bottom"
      class="max-h-[80dvh] overflow-y-auto"
      data-testid="link-account-sheet"
    >
      <SheetHeader>
        <SheetTitle>{{ t('goals.link') }}</SheetTitle>
        <SheetDescription>{{ t('goals.linkHint') }}</SheetDescription>
      </SheetHeader>

      <ul class="flex list-none flex-col gap-1 p-0 pt-2">
        <li v-for="row in rows" :key="row.account.id">
          <Button
            variant="ghost"
            class="min-h-11 w-full justify-between rounded-xl px-3 text-left"
            :disabled="isPending || row.takenBy !== null"
            :data-testid="`link-account-${row.account.id}`"
            :aria-pressed="row.here"
            @click="toggle(row.account.id, row.here)"
          >
            <span class="flex min-w-0 flex-col">
              <span class="truncate text-sm font-medium">{{ row.account.name }}</span>
              <span v-if="row.takenBy" class="text-muted-foreground text-xs">
                {{ t('goals.takenBy', { name: row.takenBy }) }}
              </span>
            </span>
            <span class="text-muted-foreground shrink-0 text-xs">
              {{ row.here ? t('goals.linked') : t('goals.linkOne') }}
            </span>
          </Button>
        </li>
      </ul>

      <p
        v-if="rows.length === 0"
        class="text-muted-foreground p-3 text-sm"
        data-testid="link-no-accounts"
      >
        {{ t('goals.noAccountsAtAll') }}
      </p>

      <!--
        Every account is taken. Saying "no accounts" here would be a lie about
        the money; the reason is what the person needs to act on.
      -->
      <p
        v-else-if="freeCount === 0"
        class="text-muted-foreground p-3 text-sm"
        data-testid="link-none-free"
      >
        {{ t('goals.noFreeAccounts') }}
      </p>
    </SheetContent>
  </Sheet>
</template>
