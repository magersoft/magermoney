<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatMoney, type MoneyLocale } from '@/shared/money/format';

const { t, locale } = useI18n();
const sample = computed(() => formatMoney('1234.5', 'EUR', locale.value as MoneyLocale));
</script>

<template>
  <h1 class="text-2xl font-semibold tracking-[-0.01em]">
    {{ t('home.greeting', { name: t('app.name') }) }}
  </h1>
  <p class="mt-6 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
    {{ t('home.sample') }}
  </p>
  <p
    data-amount
    class="text-[32px] font-semibold leading-[1.1]"
  >
    {{ sample }}
  </p>
</template>
