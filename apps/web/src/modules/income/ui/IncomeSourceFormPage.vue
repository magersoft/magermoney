<script setup lang="ts">
/**
 * The route behind the income-source sheet. `/plan/income/new` and
 * `/plan/income/:id/edit` stay links anyone can keep; what opens on them is the
 * same sheet the "+" raises.
 *
 * A saved source goes to its own screen, as it always did; closing the sheet
 * without saving goes back to the Plan.
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import IncomeSourceSheet from './IncomeSourceSheet.vue';

const route = useRoute();
const router = useRouter();
const editingId = computed(() => (route.params.id ? String(route.params.id) : null));

const back = () => router.replace({ name: 'plan', query: { tab: 'income' } });
const opened = (id: string) => router.replace(`/plan/income/${id}`);
</script>

<template>
  <IncomeSourceSheet open :source-id="editingId" @update:open="back" @saved="opened" />
</template>
