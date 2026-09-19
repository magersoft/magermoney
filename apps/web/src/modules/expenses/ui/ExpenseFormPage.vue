<script setup lang="ts">
/**
 * The route behind the expense sheet. `/plan/expenses/new` and
 * `/plan/expenses/:id/edit` are still links anyone can keep, and what opens on
 * them is the same sheet the "+" raises — the form lives in one place now.
 *
 * Closing it is going back to where the link came from, which is the Plan.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Button, Skeleton } from '@magermoney/ui';
import { useExpenses } from '../application/use-expenses';
import ExpenseSheet from './ExpenseSheet.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { dtos, isLoading, isError } = useExpenses();

const editingId = computed(() => (route.params.id ? String(route.params.id) : null));
const existing = computed(() => dtos.value.find((e) => e.id === editingId.value));
const found = computed(() => editingId.value === null || existing.value !== undefined);

const back = () => router.replace({ name: 'plan', query: { tab: 'expenses' } });
</script>

<template>
  <ExpenseSheet v-if="found" open :expense-id="editingId" @update:open="back" @done="back" />

  <div v-else-if="isLoading" class="space-y-4">
    <Skeleton class="h-8 w-40" />
    <Skeleton class="h-12 w-64" />
  </div>

  <!-- The list answered and this id is not in it: a stale link, or it was just deleted. -->
  <div v-else class="mt-10 text-center">
    <p class="text-muted-foreground text-sm">
      {{ isError ? t('expenses.error.title') : t('expenses.form.notFound') }}
    </p>
    <Button as-child variant="outline" class="mt-4 min-h-11">
      <RouterLink :to="{ path: '/plan', query: { tab: 'expenses' } }" data-testid="expense-back">
        {{ t('expenses.title') }}
      </RouterLink>
    </Button>
  </div>
</template>
