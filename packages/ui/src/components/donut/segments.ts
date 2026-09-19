/**
 * The donut, as data: what each slice is worth, how far round it starts and
 * where it stops. `Donut.vue` only puts these numbers into attributes, so the
 * geometry can be read in a test rather than in a rendered tree.
 *
 * The ring is drawn as one circle per slice with a dashed stroke rather than as
 * arc paths: a dash is two numbers and a rotation, an arc path is trigonometry
 * that has to get the large-arc flag right at exactly the sizes nobody checks.
 */

import type { DonutSegment } from './types';

/** The viewBox is 100×100, so these are percentages of it in all but name. */
export const DONUT_RADIUS = 42;
export const DONUT_STROKE = 12;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/**
 * The parting between two neighbours. It is taken out of the arcs rather than
 * added between them — the ring has to stay a ring — and it is what lets two
 * categories be read as two without their colours having to be far apart.
 */
export const DONUT_GAP = 4;

/**
 * A slice worth a third of a percent still happened. Rounded to nothing it
 * would vanish from a chart that claims to show the breakdown, so it keeps a
 * tick, and the legend beside it keeps the number that says how small.
 */
export const DONUT_MIN_ARC = 1.5;

/** One slice, laid out: the segment plus everything the drawing needs. */
export interface DonutArc extends DonutSegment {
  /** Position in the ring, which is what picks the hue. */
  index: number;
  /** 0..1 of the total. */
  share: number;
  /** The share as a whole percent — a label, not a measurement. */
  percent: number;
  hue: number;
  /** The drawn length of the arc, gap already taken out. */
  dash: number;
  /** What the arc's `stroke-dashoffset` is set to. */
  offset: number;
}

/**
 * The golden angle, the same step the account card's tint walks: it spreads any
 * number of slices about as far apart as they can go and keeps doing so as the
 * list grows, where `index * (360 / n)` re-colours everything whenever `n`
 * changes — and a category that changed colour between two months would read as
 * a different category.
 */
const GOLDEN_ANGLE = 137.508;

/**
 * The first slice — the largest, on a list the screen sorted — lands on the
 * brand hue, and the rest walk away from it. Starting at 0° would open every
 * breakdown on red, which in this palette means «over the limit».
 */
const FIRST_HUE = 262;

/** The hue of the slice in position `index`. Deterministic, 0..360. */
export function segmentHue(index: number): number {
  const hue = (FIRST_HUE + index * GOLDEN_ANGLE) % 360;
  return Math.round(hue * 10) / 10;
}

/** What an arc or a legend dot puts in its `style`; the theme owns the rest. */
export function segmentStyle(hue: number): Record<string, string> {
  return { '--mm-segment-hue': `${hue}` };
}

/**
 * Lays the ring out. Slices that cannot be drawn — zero, negative, not a number
 * — are dropped rather than hidden at width zero, so a period that added up to
 * nothing comes back empty and the chart can say so in words.
 */
export function layoutDonut(segments: readonly DonutSegment[]): DonutArc[] {
  const drawable = segments.filter(
    (segment) => Number.isFinite(segment.value) && segment.value > 0,
  );
  const total = drawable.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return [];

  /* One slice has no neighbour to part from, so it closes into a full ring. */
  const gap = drawable.length > 1 ? DONUT_GAP : 0;

  let start = 0;
  return drawable.map((segment, index) => {
    const share = segment.value / total;
    const length = DONUT_CIRCUMFERENCE * share;
    const dash = Math.max(length - gap, gap > 0 ? DONUT_MIN_ARC : length);
    const arc: DonutArc = {
      ...segment,
      index,
      share,
      percent: Math.round(share * 100),
      hue: segmentHue(index),
      dash,
      /* Negative, because the dash pattern runs backwards from the start. */
      offset: gap > 0 ? -(start + gap / 2) : 0,
    };
    start += length;
    return arc;
  });
}

/** How far a budget got, as a whole percent, capped at a full ring. */
export function progressPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}
