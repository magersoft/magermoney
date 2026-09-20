/**
 * What a tab needs to know. Plain values, never the domain: the design system
 * depends on Vue and Tailwind and nothing else, and the label is written by the
 * screen, because the copy lives in the app's locales.
 */
export interface TabItem {
  /** What the screen gets back when the tab is opened. */
  value: string;
  /** The tab's name, as it is read: «Расходы». */
  label: string;
}
