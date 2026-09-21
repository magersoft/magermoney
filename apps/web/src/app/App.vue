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
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { MotionConfig } from 'motion-v';
import { Toaster } from '@magermoney/ui';
import AppShell from '@/shared/layout/AppShell.vue';
import { useDisplayCurrency } from '@/modules/rates';
import { ProfileAvatar } from '@/modules/profile';
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
const { t } = useI18n();

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
 * The person sits in the bar's left corner on the screens with no way back —
 * the reference's home header, moved to where that corner is otherwise empty.
 * Phone only: a wide window fills that corner with the wordmark and shows the
 * settings tab in the bar anyway, so the shortcut would be a third way to the
 * same screen. And not on the settings screen itself, at any width: a face
 * that leads to the screen you are already reading is a button that does
 * nothing.
 */
const showAvatar = computed(() => route.name !== 'settings');
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
      <!--
        Passed only when there is a face to put there, so the bar can tell an
        empty corner from a filled one: `v-if` on the template, not inside it.
      -->
      <template v-if="showAvatar" #lead>
        <RouterLink
          to="/settings"
          :aria-label="t('nav.settings')"
          data-testid="nav-avatar"
          class="-ms-1 grid size-11 shrink-0 place-items-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring md:hidden"
        >
          <ProfileAvatar class="size-9 text-sm" />
        </RouterLink>
      </template>
      <template #fab>
        <QuickActions v-model:open="quickOpen" />
      </template>
      <RouterView />
    </AppShell>
    <!--
      Toasts come down from the top, clear of the header: the bottom of a phone
      belongs to the navigation pill and the thumb, and a message that lands
      there covers the way out of the screen it is complaining about.
    -->
    <Toaster
      position="top-center"
      :offset="{ top: 'calc(env(safe-area-inset-top) + 4.25rem)' }"
      :mobile-offset="{ top: 'calc(env(safe-area-inset-top) + 4.25rem)' }"
    />
  </MotionConfig>
</template>
