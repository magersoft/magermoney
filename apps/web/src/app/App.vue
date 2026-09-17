<script setup lang="ts">
/**
 * The composition root's only view. Signed-out routes render bare: showing the
 * app's navigation to someone who cannot follow it is an invitation to a
 * redirect, so sign-in and the auth callback get the page and nothing else.
 *
 * `MotionConfig` is here because `reduced-motion="user"` has to be set once for
 * the whole tree: motion-v then keeps the fades and drops the movement.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { MotionConfig } from 'motion-v';
import { Toaster } from '@magermoney/ui';
import AppShell from '@/shared/layout/AppShell.vue';
import { CurrencySwitch } from '@/modules/rates';
import { useTheme } from '@/app/theme';
import QuickActions from '@/app/QuickActions.vue';

const { theme, set } = useTheme();
const route = useRoute();

const bare = computed(() => Boolean(route.meta.public));
</script>

<template>
  <MotionConfig reduced-motion="user">
    <main
      v-if="bare"
      class="mx-auto min-h-dvh w-full max-w-3xl bg-background px-4 text-foreground md:px-6"
    >
      <RouterView />
    </main>
    <AppShell v-else :theme="theme" @update:theme="set">
      <template #currency>
        <CurrencySwitch />
      </template>
      <template #fab>
        <QuickActions />
      </template>
      <RouterView />
    </AppShell>
    <Toaster />
  </MotionConfig>
</template>
