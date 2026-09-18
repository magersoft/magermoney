<script setup lang="ts">
/** Placeholder: the dashboard arrives in Task 26. Home has to render something until then. */
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section class="pb-8" data-testid="dashboard">
    <h1 class="text-2xl font-semibold tracking-[-0.01em]">
      {{ t('dashboard.title') }}
    </h1>
  </section>
</template>
