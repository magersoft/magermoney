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
import { ChartPieIcon, HouseIcon, SettingsIcon, WalletIcon } from '@lucide/vue';

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
