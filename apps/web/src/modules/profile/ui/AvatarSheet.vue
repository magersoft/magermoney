<script setup lang="ts">
/**
 * Choosing the profile disc: an emoji and a colour, with the disc itself on
 * top so the choice is seen rather than imagined.
 *
 * Unlike the account filter, picking *is* applying: each choice is saved the
 * moment it is made, the way every other setting on this screen is, so the disc
 * in the top bar and in the home greeting has already changed by the time the
 * sheet is closed. There is nothing to confirm and nothing to lose.
 *
 * Both rows are radio groups, not rows of toggles: one emoji and one colour at
 * a time, announced as «checked» and walked with the arrow keys from a single
 * tab stop each (the same pattern as `AccountColorPicker`). The first choice in
 * each is the one with nothing picked — the initial of the name, the plain
 * surface — so going back is a choice like any other rather than a hidden
 * «reset».
 */
import { computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Sheet, SheetContent, SheetTitle, cardFillStyle, cn } from '@magermoney/ui';
import { AVATAR_COLORS, type AvatarColor } from '@magermoney/domain';
import type { UpdateProfileInput } from '@magermoney/contracts';
import { useSession } from '@/modules/auth';
import { AVATAR_EMOJI_CHOICES, avatarFace } from '../domain/profile';
import { useProfile } from '../application/use-profile';
import ProfileAvatar from './ProfileAvatar.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  'update:open': [open: boolean];
  change: [input: Pick<UpdateProfileInput, 'avatarEmoji' | 'avatarColor'>];
}>();

const { t } = useI18n();
const { profile } = useProfile();
const { user } = useSession();

const emoji = computed(() => profile.value?.avatarEmoji ?? null);
const color = computed(() => profile.value?.avatarColor ?? null);

/*
 * A stored emoji the grid no longer deals still shows up, checked, after the
 * initial — otherwise nothing in the group would be checked and the person
 * could not see what they have.
 */
const emojiChoices = computed<(string | null)[]>(() => {
  const dealt: string[] = [...AVATAR_EMOJI_CHOICES];
  const stored = emoji.value;
  return stored && !dealt.includes(stored) ? [null, stored, ...dealt] : [null, ...dealt];
});
const colorChoices: (AvatarColor | null)[] = [null, ...AVATAR_COLORS];

/* What the «no emoji» choice looks like: the letter the disc falls back to. */
const initial = computed(() => {
  const face = avatarFace(
    profile.value && { ...profile.value, avatarEmoji: null },
    user.value?.email ?? null,
  );
  return face.kind === 'initial' ? face.glyph : '';
});

function pickEmoji(next: string | null): void {
  if (next !== emoji.value) emit('change', { avatarEmoji: next });
}
function pickColor(next: AvatarColor | null): void {
  if (next !== color.value) emit('change', { avatarColor: next });
}

/**
 * Arrow keys move the selection and the focus with it, wrapping, as a radio
 * group does; Home and End jump to the ends. All four arrows step through the
 * list in reading order — a grid that moved by rows on ↑↓ would make the same
 * key mean two things between the two groups.
 *
 * Focus is found among the group's own radios by position rather than through a
 * `v-for` template ref, whose array Vue does not promise to keep in order.
 */
function onKey<V>(
  event: KeyboardEvent,
  choices: readonly V[],
  current: V,
  pick: (value: V) => void,
): void {
  const group = event.currentTarget as HTMLElement;
  const at = Math.max(0, choices.indexOf(current));
  const last = choices.length - 1;
  const target =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? at === last
        ? 0
        : at + 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? at === 0
          ? last
          : at - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined;
  if (target === undefined) return;
  event.preventDefault();
  pick(choices[target] as V);
  void nextTick(() => group.querySelectorAll<HTMLElement>('[role="radio"]')[target]?.focus());
}

const LEGEND = 'text-muted-foreground mb-2 text-xs font-medium';
const CHOICE = [
  'grid place-items-center rounded-full outline-offset-2',
  'focus-visible:outline-ring focus-visible:outline-2',
  'duration-fast ease-out-quart transition-shadow motion-reduce:transition-none',
];
const CHECKED = 'ring-ink ring-offset-background ring-2 ring-offset-2';
</script>

<template>
  <Sheet :open="props.open" @update:open="emit('update:open', $event)">
    <SheetContent
      side="bottom"
      :aria-describedby="undefined"
      class="mx-auto max-h-[92dvh] w-full max-w-lg gap-0 rounded-t-2xl"
      data-testid="avatar-sheet"
    >
      <div class="px-4 pt-4 pb-2">
        <SheetTitle class="text-base font-medium">
          {{ t('settings.profile.avatar.title') }}
        </SheetTitle>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-6">
        <ProfileAvatar
          class="shadow-card size-24 self-center text-4xl"
          data-testid="avatar-preview"
        />

        <div>
          <p id="avatar-emoji-label" :class="LEGEND">
            {{ t('settings.profile.avatar.emoji') }}
          </p>
          <div
            role="radiogroup"
            aria-labelledby="avatar-emoji-label"
            class="grid grid-cols-6 gap-2 sm:grid-cols-9"
            data-testid="avatar-emoji"
            @keydown="(e: KeyboardEvent) => onKey(e, emojiChoices, emoji, pickEmoji)"
          >
            <button
              v-for="choice in emojiChoices"
              :key="choice ?? 'initial'"
              type="button"
              role="radio"
              :data-testid="`avatar-emoji-${choice ?? 'initial'}`"
              :aria-checked="choice === emoji"
              :tabindex="choice === emoji ? 0 : -1"
              :aria-label="choice === null ? t('settings.profile.avatar.initial') : undefined"
              :class="
                cn(
                  CHOICE,
                  'bg-surface-sunken text-ink aspect-square w-full text-2xl',
                  choice === emoji && CHECKED,
                )
              "
              @click="pickEmoji(choice)"
            >
              <span v-if="choice === null" class="text-base font-medium" aria-hidden="true">
                {{ initial || '–' }}
              </span>
              <template v-else>
                {{ choice }}
              </template>
            </button>
          </div>
        </div>

        <div>
          <p id="avatar-color-label" :class="LEGEND">
            {{ t('settings.profile.avatar.color') }}
          </p>
          <!--
            Each dot is painted in the colour it sets, so the row is its own
            legend; the ring, not a size change, marks the one that is on — a
            size difference is not a state a colour-blind eye can read.
          -->
          <div
            role="radiogroup"
            aria-labelledby="avatar-color-label"
            class="flex flex-wrap items-center gap-3"
            data-testid="avatar-color"
            @keydown="(e: KeyboardEvent) => onKey(e, colorChoices, color, pickColor)"
          >
            <button
              v-for="choice in colorChoices"
              :key="choice ?? 'none'"
              type="button"
              role="radio"
              :data-testid="`avatar-color-${choice ?? 'none'}`"
              :aria-checked="choice === color"
              :tabindex="choice === color ? 0 : -1"
              :aria-label="t(`settings.profile.avatar.colors.${choice ?? 'none'}`)"
              :title="t(`settings.profile.avatar.colors.${choice ?? 'none'}`)"
              :style="choice ? cardFillStyle(0, choice) : undefined"
              :class="
                cn(
                  CHOICE,
                  'size-9 pointer-coarse:size-11',
                  choice ? 'bg-card-fill' : 'border-line-strong bg-surface border',
                  choice === color && CHECKED,
                )
              "
              @click="pickColor(choice)"
            />
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
