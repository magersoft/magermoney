<script setup lang="ts">
/**
 * The one chart in the app, in the two roles the reference gives it: the
 * breakdown of a period by category (slides 12, 14) and the progress of a
 * budget (slide 10). They are the same ring with a different number of slices,
 * so they are the same component — a second donut would drift from this one
 * within a month.
 *
 * Everything that matters is also written down. The ring is a picture of the
 * breakdown; the legend under it *is* the breakdown, and the chart's accessible
 * name is the whole thing as a sentence. Colour is never the only carrier: the
 * slices are parted by a gap, the legend names and prices each one, and a
 * budget that went over says so in words as well as in red.
 *
 * Every word here is written by the screen. The chart formats numbers, and
 * numbers only — the copy lives in the app's locales.
 */
import { computed } from 'vue';
import { ChevronLeftIcon, ChevronRightIcon, TriangleAlertIcon } from '@lucide/vue';
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import { formatAmountLockup, plainAmount, type AmountLocale } from '../amount-lockup/format-amount';
import DonutLegend from './DonutLegend.vue';
import {
  DONUT_CIRCUMFERENCE,
  DONUT_RADIUS,
  DONUT_STROKE,
  layoutDonut,
  progressPercent,
  segmentStyle,
} from './segments';
import type { DonutSegment } from './types';

const props = withDefaults(
  defineProps<{
    /** A period split by category, or one budget against its limit. */
    mode?: 'breakdown' | 'progress';
    /** What the chart is, in the screen's words: «Расходы за апрель». */
    label: string;
    /** The period total, set in the gap of the ring. */
    amount: string;
    code: string;
    scale?: number;
    locale?: AmountLocale;
    /** Breakdown only. Sorted by the screen; position picks the colour. */
    segments?: readonly DonutSegment[];
    /** Progress only: spent and the limit, as floats, for drawing. */
    value?: number;
    max?: number;
    /** The period the ring covers: «Апрель 2026». */
    period?: string;
    /** Naming an arrow is what makes it exist. */
    prevLabel?: string;
    nextLabel?: string;
    prevDisabled?: boolean;
    nextDisabled?: boolean;
    /** A line under the ring: «Потрачено 1 550 из 3 900». */
    caption?: string;
    /** Shown and announced when the period holds nothing. */
    emptyLabel?: string;
    /** Shown and announced when a budget has been passed. */
    overLabel?: string;
    /** The slice singled out in the ring and in the legend. */
    activeId?: string | null;
    legendLabel?: string;
    showLegend?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  {
    mode: 'breakdown',
    scale: 2,
    locale: 'en',
    segments: () => [],
    value: 0,
    max: 0,
    period: undefined,
    prevLabel: undefined,
    nextLabel: undefined,
    prevDisabled: false,
    nextDisabled: false,
    caption: undefined,
    emptyLabel: undefined,
    overLabel: undefined,
    activeId: null,
    legendLabel: undefined,
    showLegend: true,
    class: '',
  },
);

const emit = defineEmits<{
  prev: [];
  next: [];
  'update:activeId': [id: string | null];
}>();

const progress = computed(() => props.mode === 'progress');

/*
 * A budget is one slice against its own track, so it lays out like any other —
 * except that the track, not the slice, is the whole it is measured against.
 */
const arcs = computed(() =>
  progress.value
    ? layoutDonut(
        props.max > 0
          ? [
              {
                id: 'progress',
                label: props.label,
                amount: props.amount,
                value: Math.min(props.value, props.max),
              },
            ]
          : [],
        props.max,
      )
    : layoutDonut(props.segments),
);

const percent = computed(() => progressPercent(props.value, props.max));

/* Past the limit the ring can only fill — it has nowhere further to go. */
const over = computed(() => progress.value && props.max > 0 && props.value > props.max);
const empty = computed(() => arcs.value.length === 0);

const money = (amount: string) =>
  plainAmount(
    formatAmountLockup(amount, { code: props.code, locale: props.locale, scale: props.scale }),
  );

/**
 * The chart as a sentence. Without it a screen reader is handed «graphic» and
 * the only chart in the app says nothing at all.
 */
const summary = computed(() => {
  const parts = [props.label];
  if (progress.value) {
    if (props.caption) parts.push(props.caption);
    parts.push(empty.value ? (props.emptyLabel ?? `${percent.value}%`) : `${percent.value}%`);
    if (over.value && props.overLabel) parts.push(props.overLabel);
  } else if (empty.value) {
    if (props.emptyLabel) parts.push(props.emptyLabel);
  } else {
    parts.push(
      arcs.value.map((arc) => `${arc.label} — ${money(arc.amount)}, ${arc.percent}%`).join('; '),
    );
  }
  return parts.filter(Boolean).join('. ');
});

/* Picking the slice that is already picked is how the highlight is let go. */
const select = (id: string) => emit('update:activeId', props.activeId === id ? null : id);

const ARROW =
  'text-muted-foreground hover:bg-surface-sunken hover:text-ink grid size-11 shrink-0 place-items-center rounded-full ' +
  'duration-fast ease-out-quart transition-colors focus-visible:outline-ring outline-offset-2 focus-visible:outline-2 ' +
  'disabled:pointer-events-none disabled:opacity-40';
</script>

<template>
  <div
    data-slot="donut"
    :data-mode="props.mode"
    :data-empty="empty ? 'true' : 'false'"
    :data-over="over ? 'true' : 'false'"
    :class="cn('flex w-full flex-col items-center gap-4', props.class)"
  >
    <div class="flex w-full items-center justify-center gap-1">
      <button
        v-if="props.prevLabel"
        type="button"
        data-slot="donut-prev"
        :aria-label="props.prevLabel"
        :disabled="props.prevDisabled"
        :class="ARROW"
        @click="emit('prev')"
      >
        <ChevronLeftIcon aria-hidden="true" class="size-5" />
      </button>

      <div class="relative aspect-square w-full max-w-56 min-w-0">
        <!--
          Rotated so the ring opens at twelve o'clock, where a period is read
          from. The dash pattern does the rest: one circle per slice, each
          shortened by the gap that parts it from its neighbour.
        -->
        <svg
          data-slot="donut-chart"
          viewBox="0 0 100 100"
          class="size-full -rotate-90"
          :role="progress ? 'progressbar' : 'img'"
          :aria-label="progress ? props.label : summary"
          :aria-valuemin="progress ? 0 : undefined"
          :aria-valuemax="progress ? 100 : undefined"
          :aria-valuenow="progress ? percent : undefined"
          :aria-valuetext="progress ? summary : undefined"
        >
          <circle
            data-slot="donut-track"
            cx="50"
            cy="50"
            :r="DONUT_RADIUS"
            fill="none"
            :stroke-width="DONUT_STROKE"
            class="stroke-surface-sunken"
          />
          <circle
            v-for="arc in arcs"
            :key="arc.id"
            data-slot="donut-arc"
            :data-segment-id="arc.id"
            :data-active="props.activeId === arc.id ? 'true' : 'false'"
            :data-over="over ? 'true' : 'false'"
            cx="50"
            cy="50"
            :r="DONUT_RADIUS"
            fill="none"
            :stroke-width="DONUT_STROKE"
            :stroke-dasharray="`${arc.dash} ${DONUT_CIRCUMFERENCE - arc.dash}`"
            :stroke-dashoffset="arc.offset"
            :style="progress ? undefined : segmentStyle(arc.hue)"
            :class="
              cn(
                'duration-base ease-out-quart transition-opacity motion-reduce:transition-none',
                progress ? (over ? 'stroke-negative' : 'stroke-primary') : 'stroke-segment',
                props.activeId && props.activeId !== arc.id && 'opacity-30',
              )
            "
          />
        </svg>

        <!-- The period total sits in the gap of the ring, as on the reference. -->
        <div
          data-slot="donut-centre"
          class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-8 text-center"
        >
          <AmountLockup
            :amount="props.amount"
            :code="props.code"
            :scale="props.scale"
            :locale="props.locale"
            class="text-lg"
          />
          <span
            v-if="props.period"
            data-slot="donut-period"
            class="text-muted-foreground truncate text-xs font-medium"
            >{{ props.period }}</span
          >
        </div>
      </div>

      <button
        v-if="props.nextLabel"
        type="button"
        data-slot="donut-next"
        :aria-label="props.nextLabel"
        :disabled="props.nextDisabled"
        :class="ARROW"
        @click="emit('next')"
      >
        <ChevronRightIcon aria-hidden="true" class="size-5" />
      </button>
    </div>

    <p v-if="props.caption" data-slot="donut-caption" class="text-muted-foreground text-sm">
      {{ props.caption }}
    </p>

    <!-- Red is a second way of saying this, never the only one. -->
    <p
      v-if="over && props.overLabel"
      data-slot="donut-over"
      class="text-negative inline-flex items-center gap-1.5 text-sm font-medium"
    >
      <TriangleAlertIcon aria-hidden="true" class="size-4 shrink-0" />
      {{ props.overLabel }}
    </p>

    <p
      v-if="empty && props.emptyLabel"
      data-slot="donut-empty"
      class="text-muted-foreground text-sm"
    >
      {{ props.emptyLabel }}
    </p>

    <DonutLegend
      v-if="props.showLegend && !progress"
      :arcs="arcs"
      :code="props.code"
      :scale="props.scale"
      :locale="props.locale"
      :active-id="props.activeId"
      :aria-label="props.legendLabel"
      @select="select"
    />
  </div>
</template>
