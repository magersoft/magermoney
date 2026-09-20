import { routeComponent } from '@/shared/layout/route-fallback';

/**
 * Public API of the currencies module: the backend's reference data, which both
 * the profile's editor and the rates module need. It is its own module so
 * neither has to import the other.
 */
export { toCurrency, toRate } from './domain/mappers';
export {
  useConnectedCurrencies,
  useCurrencies,
  useCurrencyCatalogue,
  useCurrencyRegistry,
} from './application/use-currencies';
export { toCurrencyOption, useCurrencyOptions } from './application/use-currency-options';
export { default as AppCurrencySelect } from './ui/AppCurrencySelect.vue';
/** Routed screen, async: the barrel is imported statically for the picker. */
export const CurrenciesPage = routeComponent(() => import('./ui/CurrenciesPage.vue'));
