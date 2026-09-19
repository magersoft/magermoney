<script setup lang="ts">
/**
 * The reference's home header (slide 10) with one swap: there is no bell,
 * because there are no notifications, and the place on the right belongs to the
 * thing this app is actually about — which currency the screen counts in.
 *
 * The avatar is an initial on a disc. No photo is stored, and a generic silhouette
 * would say less than the first letter of the name the person gave.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSession } from '@/modules/auth';
import { greetingName, useProfile } from '@/modules/profile';
import { CurrencySwitch } from '@/modules/rates';

const { t } = useI18n();
const { profile } = useProfile();
const { user } = useSession();

const name = computed(() => greetingName(profile.value, user.value?.email ?? null));
/* Intl rather than [0]: «Ярослав» and an emoji both have to survive it. */
const initial = computed(() => (name.value ? [...name.value][0]?.toUpperCase() : undefined));
</script>

<template>
  <header class="flex items-center gap-3" data-testid="home-header">
    <span
      data-testid="home-avatar"
      aria-hidden="true"
      class="bg-surface text-ink shadow-card grid size-11 shrink-0 place-items-center rounded-full text-base font-medium"
    >
      <span v-if="initial">{{ initial }}</span>
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        class="text-muted-foreground size-5"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    </span>

    <p class="min-w-0 flex-1 truncate text-sm font-medium" data-testid="home-greeting">
      {{ name ? t('dashboard.greeting.named', { name }) : t('dashboard.greeting.plain') }}
    </p>

    <CurrencySwitch />
  </header>
</template>
