/**
 * What the donut needs to know. Plain values, never the domain — the design
 * system depends on Vue and Tailwind and nothing else — and every word the
 * chart shows is written by the screen, because the copy lives in the app's
 * locales.
 */

/** One slice of a period: a category, or the one segment of a budget. */
export interface DonutSegment {
  /** What the screen gets back when the slice is picked. */
  id: string;
  /** The category's name, as the legend reads it: «Продукты». */
  label: string;
  /**
   * The share this slice draws. A float made from an exact amount for drawing
   * only — the rule `ProgressRule` follows — and it never reaches a figure a
   * person reads.
   */
  value: number;
  /** The exact decimal string, as stored. What the legend actually shows. */
  amount: string;
  /** The category's own emoji. A category without one is still a slice. */
  emoji?: string;
}
