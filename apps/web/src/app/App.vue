<script setup lang="ts">
import { Toaster } from '@magermoney/ui';
import AppShell from '@/shared/layout/AppShell.vue';
import { useTheme } from '@/app/theme';

const { theme, set } = useTheme();
</script>

<template>
  <AppShell
    :theme="theme"
    @update:theme="set"
  >
    <RouterView />
  </AppShell>
  <Toaster />
</template>
