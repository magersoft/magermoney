<script setup lang="ts">
/**
 * The mark of a goal or an asset, in its form: the disc itself, beside the
 * name, as the button that changes it. The disc is the preview, so there is
 * nothing to imagine; tapping it opens a sheet with the two choices and the
 * disc again, large, on top.
 *
 * Nothing is saved from here. The choice lives in the form until the form is
 * saved, the same as the name next to it — the sheet is only a bigger place to
 * make it, because twenty-five emoji do not fit in a form row.
 *
 * Shared rather than owned by either module: goals and assets are marked the
 * same way on purpose, and neither may import the other's screens.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Button,
  MarkDisc,
  MarkPicker,
  Sheet,
  SheetContent,
  SheetTitle,
  type MarkPickerLabels,
} from '@magermoney/ui';
import { MARK_COLORS, type MarkColor } from '@magermoney/domain';
import { MARK_EMOJI_CHOICES } from './emoji';

const props = defineProps<{ name: string }>();
const emoji = defineModel<string | null>('emoji', { default: null });
const color = defineModel<MarkColor | null>('color', { default: null });

const { t } = useI18n();
const open = ref(false);

const labels = computed<MarkPickerLabels>(() => ({
  emoji: t('marks.emoji'),
  color: t('marks.color'),
  initial: t('marks.initial'),
  none: t('marks.none'),
  colors: Object.fromEntries(MARK_COLORS.map((c) => [c, t(`marks.colors.${c}`)])),
}));
</script>

<template>
  <button
    type="button"
    class="shrink-0 rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
    data-testid="mark-open"
    :aria-label="t('marks.open')"
    :title="t('marks.open')"
    @click="open = true"
  >
    <MarkDisc
      :emoji="emoji"
      :color="color"
      :name="props.name"
      class="shadow-card size-11 text-lg"
    />
  </button>

  <Sheet v-model:open="open">
    <SheetContent
      side="bottom"
      :aria-describedby="undefined"
      class="mx-auto max-h-[92dvh] w-full max-w-lg gap-0 rounded-t-2xl"
      data-testid="mark-sheet"
    >
      <div class="px-4 pt-4 pb-2">
        <SheetTitle class="text-base font-medium">
          {{ t('marks.title') }}
        </SheetTitle>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-4">
        <MarkDisc
          :emoji="emoji"
          :color="color"
          :name="props.name"
          class="shadow-card size-20 self-center text-3xl"
          data-testid="mark-preview"
        />
        <MarkPicker
          v-model:emoji="emoji"
          v-model:color="color"
          :name="props.name"
          :emojis="MARK_EMOJI_CHOICES"
          :labels="labels"
        />
      </div>

      <div class="border-line border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button class="min-h-11 w-full rounded-xl" data-testid="mark-done" @click="open = false">
          {{ t('marks.done') }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
