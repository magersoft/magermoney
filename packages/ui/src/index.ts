/**
 * `@magermoney/ui` — the design system. Depends on Vue and the Tailwind family
 * only; it must never import `@magermoney/domain` or `@magermoney/contracts`.
 *
 * Import `@magermoney/ui/styles` once in the consuming app for the tokens, and
 * load Instrument Sans + IBM Plex Mono there too (see docs/design/direction.md).
 */

import type { IconifyJSON } from '@iconify/types';
import { addCollection } from '@iconify/vue';
import { toast } from 'vue-sonner';
import subset from './icons/subset.json';

/*
 * Registering up front is what makes every currency mark render offline, with no
 * request to the Iconify API — a requirement for the PWA, and the reason
 * CurrencyIcon works inside a service-worker-served shell.
 *
 * The subset is built at development time by `bun run icons:build` from the
 * resolver's own tables, so an icon can never be resolvable but unregistered,
 * and the two ~1.1MB collections never reach a consumer's bundle.
 */
for (const collection of Object.values(subset)) {
  addCollection(collection as unknown as IconifyJSON);
}

export { cn } from './lib/utils';

export * from './components/ui/button';
export * from './components/ui/input';
export * from './components/ui/select';
export * from './components/ui/card';
export * from './components/ui/sheet';
export * from './components/ui/sonner';
export * from './components/ui/skeleton';
export * from './components/ui/badge';
export * from './components/ui/separator';
export * from './components/ui/dropdown-menu';
export * from './components/ui/alert-dialog';
export * from './components/ui/switch';
export * from './components/ui/combobox';

export { default as MoneyInput } from './components/money-input/MoneyInput.vue';
export { parseAmountInput, formatAmountInput } from './components/money-input/parse';

export { default as PercentInput } from './components/percent-input/PercentInput.vue';
export { percentToFraction, fractionToPercent } from './components/percent-input/percent';

export { default as SegmentedControl } from './components/segmented-control/SegmentedControl.vue';
export type { SegmentedOption } from './components/segmented-control/types';

/* Tabs, not a segmented control: each one opens a panel, and names it. */
export { default as TabBar } from './components/tab-bar/TabBar.vue';
export type { TabItem } from './components/tab-bar/types';

export { default as DayOfMonthPicker } from './components/day-of-month-picker/DayOfMonthPicker.vue';
export { default as ProgressRule } from './components/progress-rule/ProgressRule.vue';

export { default as RouteLoading } from './components/async-fallback/RouteLoading.vue';
export { default as RouteError } from './components/async-fallback/RouteError.vue';

/* The signature lockup. Every amount on every screen is set through it. */
export { default as AmountLockup } from './components/amount-lockup/AmountLockup.vue';
export {
  formatAmountLockup,
  resolveCurrencySymbol,
  plainAmount,
} from './components/amount-lockup/format-amount';
export type {
  AmountLocale,
  AmountLockupOptions,
  AmountLockupParts,
} from './components/amount-lockup/format-amount';

/*
 * The account card and its two layouts. The card is built once here because the
 * home strip and the accounts stack are the same object seen twice.
 */
export { default as AccountCard } from './components/account-card/AccountCard.vue';
export { default as AccountCardStrip } from './components/account-card/AccountCardStrip.vue';
export { default as AccountCardStack } from './components/account-card/AccountCardStack.vue';
export {
  currencyHue,
  currencyTintStyle,
  CURRENCY_TINT_ORDER,
} from './components/account-card/currency-tint';
export type { AccountCardItem } from './components/account-card/types';

/*
 * The chips. The filter row states what a screen of numbers is filtered by and
 * lets a filter be dropped where it is read; the category chip is the palette
 * a budget or an expense picks from.
 */
export { default as FilterChip } from './components/chip/FilterChip.vue';
export { default as FilterChipRow } from './components/chip/FilterChipRow.vue';
export { default as CategoryChip } from './components/chip/CategoryChip.vue';
export type { FilterChipItem, CategoryChipItem } from './components/chip/types';

/*
 * The statistics tile: a month's income or spending with what it did against
 * the month before. The badge is the only coloured thing on it.
 */
export { default as StatTile } from './components/stat-tile/StatTile.vue';
export { formatDelta, deltaTone, deltaDirection } from './components/stat-tile/delta';
export type { DeltaTone } from './components/stat-tile/delta';

/*
 * The quick action: the field that is a row, the amounts worth one tap, and the
 * sheet that puts the amount first — the reference's answer to how long it takes
 * to write an expense down.
 */
export { default as FieldRow } from './components/field-row/FieldRow.vue';
export { default as InputRow } from './components/field-row/InputRow.vue';
export { default as SelectRow } from './components/field-row/SelectRow.vue';
export type { SelectRowOption } from './components/field-row/SelectRow.vue';
export { default as QuickAmountGrid } from './components/quick-action/QuickAmountGrid.vue';
export { default as QuickActionSheet } from './components/quick-action/QuickActionSheet.vue';

/*
 * The two most repeated rows in the app, and the card that groups them. Every
 * list of movements is made of the first; every budget screen, of the second.
 */
export { default as TransactionRow } from './components/row/TransactionRow.vue';
export { default as CategoryRow } from './components/row/CategoryRow.vue';
export { default as RowGroup } from './components/row/RowGroup.vue';

/*
 * The donut: the only chart in the app, in its two roles — a period split by
 * category, and a budget against its limit. The legend is exported beside it
 * because a screen can lay it out itself, never because the ring can do without
 * one.
 */
export { default as DonutChart } from './components/donut/DonutChart.vue';
export { default as DonutLegend } from './components/donut/DonutLegend.vue';
export {
  layoutDonut,
  segmentHue,
  segmentStyle,
  progressPercent,
  DONUT_CIRCUMFERENCE,
  DONUT_GAP,
  DONUT_MIN_ARC,
  DONUT_RADIUS,
  DONUT_STROKE,
} from './components/donut/segments';
export type { DonutArc } from './components/donut/segments';
export type { DonutSegment } from './components/donut/types';

export { default as CurrencyIcon } from './components/currency-icon/CurrencyIcon.vue';
export {
  resolveCurrencyIcon,
  FIAT_FLAG,
  CRYPTO_KNOWN,
} from './components/currency-icon/resolve-icon';
export type { CurrencyIconInput, ResolvedIcon } from './components/currency-icon/resolve-icon';
export { COUNTRY_CODES } from './components/currency-icon/countries';
export { loadCountryFlags, countryFlagsReady } from './icons/country-flags';

/* Where an account is held: the flag, and the list of 257 places behind it. */
export { default as CountrySelect } from './components/country-select/CountrySelect.vue';
export { default as CountryFlag } from './components/country-select/CountryFlag.vue';
export { filterCountries } from './components/country-select/filter';
export type { CountryOption } from './components/country-select/filter';

export {
  fadeUp,
  scaleIn,
  fade,
  sheetUp,
  listStagger,
  withMotionPreference,
  EASE_OUT_QUART,
} from './motion/presets';
export type { MotionPreset } from './motion/presets';

/**
 * Toasts. `Toaster` mounts once in the app shell; `useToast()` is how a screen
 * raises one, so callers never import `vue-sonner` directly.
 */
export function useToast() {
  return { toast };
}
