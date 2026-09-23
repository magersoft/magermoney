<script setup lang="ts">
/**
 * The person, as a disc: the emoji they picked, or the first letter of their
 * name, on the colour they picked. No photo is stored, and a generic
 * silhouette would say less than the first letter of the name they gave; the
 * silhouette is only what is left when there is no name yet.
 *
 * The colours are the card palette, and the letter takes the ink each fill was
 * chosen with, so a disc is legible in either theme for the same reason a card
 * is. Unpainted, it keeps the surface colour and the theme's ink.
 *
 * Presentational and size-agnostic: the size, the shadow and the ring come
 * from whoever places it — large and raised in the home screen's greeting, a
 * quiet 36px in the top bar. It reads the profile itself rather than taking a
 * prop, so every disc on screen changes the moment the profile cache does.
 * `emoji` and `color` override what is stored, for a preview of a choice not
 * yet made.
 */
import { computed } from 'vue';
import { cardFillStyle, cn } from '@magermoney/ui';
import type { AvatarColor } from '@magermoney/domain';
import { useSession } from '@/modules/auth';
import { avatarFace } from '../domain/profile';
import { useProfile } from '../application/use-profile';

const props = defineProps<{
  emoji?: string | null;
  color?: AvatarColor | null;
}>();

const { profile } = useProfile();
const { user } = useSession();

/* `undefined` means "what is stored"; `null` is a choice of its own — none. */
const emoji = computed(() =>
  props.emoji === undefined ? (profile.value?.avatarEmoji ?? null) : props.emoji,
);
const color = computed(() =>
  props.color === undefined ? (profile.value?.avatarColor ?? null) : props.color,
);

const face = computed(() =>
  avatarFace(
    profile.value && { ...profile.value, avatarEmoji: emoji.value },
    user.value?.email ?? null,
  ),
);
const paint = computed(() => (color.value ? cardFillStyle(0, color.value) : undefined));
</script>

<template>
  <span
    aria-hidden="true"
    data-slot="profile-avatar"
    :data-color="color ?? undefined"
    :style="paint"
    :class="
      cn(
        'grid shrink-0 place-items-center rounded-full font-medium',
        color ? 'bg-card-fill text-card-ink' : 'bg-surface text-ink',
      )
    "
  >
    <span v-if="face.kind === 'emoji'" class="text-[1.25em] leading-none">{{ face.glyph }}</span>
    <span v-else-if="face.kind === 'initial'">{{ face.glyph }}</span>
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      :class="cn('size-[55%]', !color && 'text-muted-foreground')"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  </span>
</template>
