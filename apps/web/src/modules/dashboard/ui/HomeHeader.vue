<script setup lang="ts">
/**
 * The reference's home header (slide 10) with one swap: there is no bell,
 * because there are no notifications, and the place on the right belongs to the
 * thing this app is actually about — which currency the screen counts in.
 *
 * The avatar is the same disc the top bar carries on the other screens, at the
 * size the reference gives it here and raised off the canvas.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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
    <ProfileAvatar data-testid="home-avatar" class="shadow-card size-11 text-base" />

    <p class="min-w-0 flex-1 truncate text-sm font-medium" data-testid="home-greeting">
      {{ name ? t('dashboard.greeting.named', { name }) : t('dashboard.greeting.plain') }}
    </p>

    <CurrencySwitch />
  </header>
</template>
