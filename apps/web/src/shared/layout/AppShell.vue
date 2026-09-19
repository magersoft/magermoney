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
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { Button } from '@magermoney/ui';
import { THEMES, type Theme } from '@/shared/theme';
import { isCurrent, NAV } from '@/shared/layout/nav';
import BottomNav from '@/shared/layout/BottomNav.vue';

const { theme } = defineProps<{ theme: Theme }>();
const emit = defineEmits<{ 'update:theme': [theme: Theme]; quick: [] }>();

const { t } = useI18n();

const route = useRoute();

const themeLabel = computed(() => t('theme.label', { theme: t(`theme.${theme}`) }));

function cycleTheme(): void {
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  if (next) emit('update:theme', next);
}
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-30 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:outline-2 focus:outline-ring"
    >
      {{ t('a11y.skipToContent') }}
    </a>

    <header
      class="sticky top-0 z-20 border-b border-border bg-background"
      style="padding-top: env(safe-area-inset-top)"
    >
      <div class="mx-auto flex h-14 w-full max-w-3xl items-center gap-4 px-4 md:px-6">
        <!-- The wordmark goes home, but it is not a tab: the Home tab is what says where you are. -->
        <RouterLink v-slot="{ href, navigate }" to="/" custom>
          <a
            :href="href"
            class="text-base font-semibold outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            @click="navigate"
          >
            {{ t('app.name') }}
          </a>
        </RouterLink>

        <nav class="hidden gap-4 md:flex" :aria-label="t('a11y.primaryNav')">
          <RouterLink
            v-for="item in NAV"
            :key="item.to"
            v-slot="{ href, navigate }"
            :to="item.to"
            custom
          >
            <a
              :href="href"
              :aria-current="isCurrent(item, route.path) ? 'page' : undefined"
              class="text-sm outline-offset-4 transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring"
              :class="
                isCurrent(item, route.path)
                  ? 'text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="navigate"
            >
              {{ t(item.label) }}
            </a>
          </RouterLink>
        </nav>

        <div class="ms-auto flex items-center gap-2">
          <slot name="currency" />

          <Button
            variant="ghost"
            size="icon"
            type="button"
            :aria-label="themeLabel"
            :title="themeLabel"
            @click="cycleTheme"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-5"
              aria-hidden="true"
            >
              <template v-if="theme === 'system'">
                <rect x="2" y="4" width="20" height="13" rx="2" />
                <path d="M8 21h8m-4-4v4" />
              </template>
              <template v-else-if="theme === 'light'">
                <circle cx="12" cy="12" r="4" />
                <path
                  d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                />
              </template>
              <template v-else>
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </template>
            </svg>
          </Button>
        </div>
      </div>
    </header>

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
