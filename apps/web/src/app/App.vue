<script setup lang="ts">
/**
 * The composition root's only view. Signed-out routes render bare: showing the
 * app's navigation to someone who cannot follow it is an invitation to a
 * redirect, so sign-in and the auth callback get the page and nothing else.
 *
 * `MotionConfig` is here because `reduced-motion="user"` has to be set once for
 * the whole tree: motion-v then keeps the fades and drops the movement.
 */
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { MotionConfig } from 'motion-v';
import { Toaster } from '@magermoney/ui';
import AppShell from '@/shared/layout/AppShell.vue';
import { useDisplayCurrency } from '@/modules/rates';
import { useTheme } from '@/app/theme';
import QuickActions from '@/app/QuickActions.vue';

/*
 * Asked for its effect, not its value: `useTheme` is what applies the stored
 * preference to the document, and the settings screen is the only place that
 * changes it. Dropping this call would leave a reloaded app in whatever theme
 * the CSS defaults to until someone opened Settings.
 */
useTheme();
const route = useRoute();

/*
 * The display currency is one object for the whole app, and it reads the profile
 * through a query owned by whoever asks for it first. Asking here makes that
 * the composition root, which outlives every screen — a screen that unmounts
 * would otherwise take the profile's subscription with it, and the switch would
 * quietly lose its list of currencies.
 */
useDisplayCurrency();

const bare = computed(() => Boolean(route.meta.public));
/**
 * The quick actions are mounted once, here, and opened from two places: the
 * "+" in the phone's navigation pill and the floating button on a wide window.
 * One instance means one set of sheets — and the half-typed inflow in them
 * survives a walk between screens.
 */
const quickOpen = ref(false);
</script>

<template>
  <MotionConfig reduced-motion="user">
    <main
      v-if="bare"
      class="mx-auto min-h-dvh w-full max-w-3xl bg-background px-4 text-foreground md:px-6"
    >
      <RouterView />
    </main>
    <AppShell v-else @quick="quickOpen = true">
      <template #fab>
        <QuickActions v-model:open="quickOpen" />
      </template>
      <RouterView />
    </AppShell>
    <Toaster />
  </MotionConfig>
</template>
