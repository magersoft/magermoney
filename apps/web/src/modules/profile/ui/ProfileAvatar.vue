<script setup lang="ts">
/**
 * The person, as a disc. An initial rather than a photo, because no photo is
 * stored and a generic silhouette would say less than the first letter of the
 * name they gave; the silhouette is only what is left when there is no name
 * yet.
 *
 * Presentational and size-agnostic: the size, the shadow and the ring come
 * from whoever places it — large and raised in the home screen's greeting, a
 * quiet 36px in the top bar. It reads the profile itself rather than taking a
 * prop, so the two never drift apart while one of them has stale data.
 */
import { computed } from 'vue';
import { useSession } from '@/modules/auth';
import { greetingName } from '../domain/profile';
import { useProfile } from '../application/use-profile';

const { profile } = useProfile();
const { user } = useSession();

const name = computed(() => greetingName(profile.value, user.value?.email ?? null));
/* Intl rather than [0]: «Ярослав» and an emoji both have to survive it. */
const initial = computed(() => (name.value ? [...name.value][0]?.toUpperCase() : undefined));
</script>

<template>
  <span
    aria-hidden="true"
    class="grid shrink-0 place-items-center rounded-full bg-surface font-medium text-ink"
  >
    <span v-if="initial">{{ initial }}</span>
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      class="size-[55%] text-muted-foreground"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  </span>
</template>
