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
import { CurrencySwitch, useDisplayCurrency } from '@/modules/rates';
import { useTheme } from '@/app/theme';
import QuickActions from '@/app/QuickActions.vue';

const { theme, set } = useTheme();
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
 * Home carries the currency switch in its own header (the reference's slide 10),
 * so the top bar hands it over rather than showing a second one.
 */
const ownsCurrency = computed(() => route.name === 'home');
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
    <AppShell v-else :theme="theme" @update:theme="set" @quick="quickOpen = true">
      <template #currency>
        <CurrencySwitch v-if="!ownsCurrency" />
      </template>
      <template #fab>
        <QuickActions v-model:open="quickOpen" />
      </template>
      <RouterView />
    </AppShell>
    <Toaster />
  </MotionConfig>
</template>
