/**
 * The app's sections, in the one order they are ever shown in. Both navigations
 * read this list — the bar at the top of a wide window and the pill at the
 * bottom of a phone — so a section cannot exist in one and be missing from the
 * other, and a tab cannot be lit in one while dark in the other.
 *
 * Icons come from `@lucide/vue`, which is bundled: a phone with no network
 * still gets its navigation drawn.
 */
import type { FunctionalComponent } from 'vue';
import { ChartPieIcon, HouseIcon, SettingsIcon, TargetIcon, WalletIcon } from '@lucide/vue';

export type NavItem = {
  readonly key: string;
  readonly to: string;
  readonly label: string;
  readonly icon: FunctionalComponent;
  /**
   * The path prefixes the tab stays lit for. vue-router's own `isActive` only
   * follows nested records, and these routes are flat, so an account's page
   * would otherwise light nothing. Home owns nothing but itself — every path
   * starts with "/".
   */
  readonly owns: readonly string[];
};

export const NAV: readonly NavItem[] = [
  { key: 'home', to: '/', label: 'nav.home', icon: HouseIcon, owns: [] },
  {
    key: 'accounts',
    to: '/accounts',
    label: 'nav.accounts',
    icon: WalletIcon,
    owns: ['/accounts', '/transfers'],
  },
  { key: 'plan', to: '/plan', label: 'nav.plan', icon: ChartPieIcon, owns: ['/plan'] },
  {
    key: 'goals',
    to: '/goals',
    label: 'nav.goals',
    icon: TargetIcon,
    /* Assets live on this tab's screen too, so an asset's page lights it. */
    owns: ['/goals', '/assets'],
  },
  {
    key: 'settings',
    to: '/settings',
    label: 'nav.settings',
    icon: SettingsIcon,
    owns: ['/settings'],
  },
];

export const isCurrent = (item: NavItem, path: string): boolean =>
  item.owns.length === 0
    ? path === '/'
    : item.owns.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * A tab's own screen — the place the navigation lands you. These are where a
 * visit starts, so there is nothing behind them and the top bar shows no way
 * back.
 */
export const isRoot = (path: string): boolean => NAV.some((item) => item.to === path);

/**
 * Where "back" goes when there is no history to step through: a screen opened
 * from a link, a notification or a reloaded tab still owes the person a way
 * out, and the tab that owns the path is the one they would have come from.
 */
export const backTarget = (path: string): string =>
  NAV.find((item) => item.owns.some((p) => path === p || path.startsWith(`${p}/`)))?.to ?? '/';
