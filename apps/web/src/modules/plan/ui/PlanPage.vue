<script setup lang="ts">
/** Placeholder: the Plan screen (Income / Expenses / Budgets) arrives in Task 25. */
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section class="pb-8" data-testid="plan">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ t('plan.title') }}
    </h1>
  </section>
</template>
