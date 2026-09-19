<script setup lang="ts">
/**
 * Which month the account screen is reading (reference slide 12: the calendar
 * picker with «Apply»). Picking is not applying — the sheet holds the choice
 * until the button confirms it, so a mis-tap costs a second tap rather than a
 * screen that reloads under the thumb.
 *
 * A month at a time, because every figure this screen shows is a month's:
 * stepping the donut, the two tiles and the day groups by anything else would
 * mean three different periods on one screen.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue';
import { firstOfMonth, parseIso, toIso } from '@magermoney/domain';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, cn } from '@magermoney/ui';
import type { DateLocale } from '@/shared/dates/format';

const props = defineProps<{
  open: boolean;
  /** The month being read, as any day inside it. */
  month: string;
  /** The last month worth offering: there are no movements in the future. */
  latest: string;
}>();
const emit = defineEmits<{ 'update:open': [open: boolean]; apply: [month: string] }>();

const { t, locale } = useI18n();
const uiLocale = computed(() => locale.value as DateLocale);

const year = ref(parseIso(props.month).year);
const picked = ref(firstOfMonth(props.month));
/* Reopening starts from what the screen is showing, not from where it was left. */
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    year.value = parseIso(props.month).year;
    picked.value = firstOfMonth(props.month);
  },
);

const names = computed(() => {
  const format = new Intl.DateTimeFormat(uiLocale.value === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'short',
  });
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(2026, i, 1)));
});

const last = computed(() => parseIso(firstOfMonth(props.latest)));
const isAfterLatest = (month: number) =>
  year.value > last.value.year || (year.value === last.value.year && month > last.value.month);
const nextYearDisabled = computed(() => year.value >= last.value.year);
</script>

<template>
  <Sheet :open="props.open" @update:open="emit('update:open', $event)">
    <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SheetHeader>
        <SheetTitle>{{ t('accounts.period.title') }}</SheetTitle>
      </SheetHeader>

      <div class="mt-4 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="icon"
          class="size-11"
          :aria-label="t('accounts.period.prevYear')"
          data-testid="period-prev-year"
          @click="year -= 1"
        >
          <ChevronLeftIcon aria-hidden="true" class="size-5" />
        </Button>
        <span data-testid="period-year" class="text-lg font-semibold tabular-nums">{{ year }}</span>
        <Button
          variant="ghost"
          size="icon"
          class="size-11"
          :aria-label="t('accounts.period.nextYear')"
          :disabled="nextYearDisabled"
          data-testid="period-next-year"
          @click="year += 1"
        >
          <ChevronRightIcon aria-hidden="true" class="size-5" />
        </Button>
      </div>

      <div
        class="mt-3 grid grid-cols-3 gap-2"
        role="group"
        :aria-label="t('accounts.period.title')"
      >
        <button
          v-for="(name, i) in names"
          :key="name"
          type="button"
          :data-testid="`period-month-${i + 1}`"
          :disabled="isAfterLatest(i + 1)"
          :aria-pressed="picked === toIso(year, i + 1, 1) ? 'true' : 'false'"
          :class="
            cn(
              'min-h-11 rounded-xl px-2 text-sm font-medium capitalize',
              'duration-fast ease-out-quart transition-colors motion-reduce:transition-none',
              'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
              'disabled:text-muted-foreground disabled:pointer-events-none disabled:opacity-50',
              picked === toIso(year, i + 1, 1)
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-sunken text-ink',
            )
          "
          @click="picked = toIso(year, i + 1, 1)"
        >
          {{ name }}
        </button>
      </div>

      <Button
        size="lg"
        class="mt-5 w-full"
        data-testid="period-apply"
        @click="emit('apply', picked)"
      >
        {{ t('accounts.period.apply') }}
      </Button>
    </SheetContent>
  </Sheet>
</template>
