<script setup lang="ts">
/**
 * The composition root's only view. Signed-out routes render bare: showing the
 * app's navigation to someone who cannot follow it is an invitation to a
 * redirect, so sign-in and the auth callback get the page and nothing else.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Toaster } from '@magermoney/ui';
import AppShell from '@/shared/layout/AppShell.vue';
import { useTheme } from '@/app/theme';

const { theme, set } = useTheme();
const route = useRoute();

const bare = computed(() => Boolean(route.meta.public));
</script>

<template>
  <main
    v-if="bare"
    class="mx-auto min-h-dvh w-full max-w-3xl bg-background px-4 text-foreground md:px-6"
  >
    <RouterView />
  </main>
  <AppShell
    v-else
    :theme="theme"
    @update:theme="set"
  >
    <RouterView />
  </AppShell>
  <Toaster />
</template>
