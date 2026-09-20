<script setup lang="ts">
/**
 * The app shell: a top bar the whole app is hung from, and — on a phone — the
 * floating pill that replaces it as navigation. It renders chrome only: screens
 * fill the default slot, the currency switch and the desktop "+" fill the named
 * ones.
 *
 * Four sections: Home · Accounts · Plan · Settings; Goals joins in phase 4. The
 * list itself lives in `nav.ts`, because both navigations read it.
 *
 * Chrome recedes and amounts carry the contrast (docs/design/direction.md), so
 * the top bar is a hairline-separated surface, labels sit at 11–13px, and the
 * accent marks exactly one thing: where you are.
 *
 * The bar's right-hand corner belongs to whichever screen is open. The shell
 * opens it here, once, above the `RouterView` — a screen claims it by calling
 * `usePageAction` and gives it back on the way out.
 */
import { useI18n } from 'vue-i18n';
import AppHeader from '@/shared/layout/AppHeader.vue';
import BottomNav from '@/shared/layout/BottomNav.vue';
import { providePageAction } from '@/shared/layout/page-action';

const emit = defineEmits<{ quick: [] }>();

const { t } = useI18n();

const action = providePageAction();
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-30 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:outline-2 focus:outline-ring"
    >
      {{ t('a11y.skipToContent') }}
    </a>

    <AppHeader :action="action">
      <template #currency>
        <slot name="currency" />
      </template>
    </AppHeader>

    <!--
      The pill is 64px tall, the "+" rises 20px out of it and it floats 12px
      clear of the safe area: 7rem of padding is what keeps the last row of a
      screen readable instead of tucked under the navigation.
    -->
    <main
      id="main"
      tabindex="-1"
      class="mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+7rem)] md:px-6 md:pb-12"
    >
      <slot />
    </main>

    <!-- The phone reaches the quick actions through the pill's "+"; this is the wide window's. -->
    <div class="fixed right-[max(1rem,calc(50%-24rem))] bottom-8 z-20 hidden md:block">
      <slot name="fab" />
    </div>

    <BottomNav @quick="emit('quick')" />
  </div>
</template>
