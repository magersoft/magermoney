<script setup lang="ts">
/**
 * The reference's home header (slide 10) with one swap: there is no bell,
 * because there are no notifications, and the place on the right belongs to the
 * thing this app is actually about — which currency the screen counts in.
 *
 * The avatar is the same disc the top bar carries on the other screens, at the
 * size the reference gives it here and raised off the canvas — and it leads
 * where that one leads. This screen's bar is not drawn on a phone, because it
 * names nothing and asks for nothing, so without this the face in the bar has
 * nowhere to appear and Settings has no door on the screen the app opens to.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { useSession } from '@/modules/auth';
import { greetingName, ProfileAvatar, useProfile } from '@/modules/profile';
import { CurrencySwitch } from '@/modules/rates';

const { t } = useI18n();
const { profile } = useProfile();
const { user } = useSession();

const name = computed(() => greetingName(profile.value, user.value?.email ?? null));
</script>

<template>
  <header class="flex items-center gap-3" data-testid="home-header">
    <RouterLink
      to="/settings"
      :aria-label="t('nav.settings')"
      data-testid="home-avatar"
      class="shrink-0 rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ProfileAvatar class="shadow-card size-11 text-base" />
    </RouterLink>

    <p class="min-w-0 flex-1 truncate text-sm font-medium" data-testid="home-greeting">
      {{ name ? t('dashboard.greeting.named', { name }) : t('dashboard.greeting.plain') }}
    </p>

    <CurrencySwitch />
  </header>
</template>
