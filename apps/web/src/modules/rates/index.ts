import { defineAsyncComponent } from 'vue';

/**
 * Public API of the rates module. Reference data lives in `@/modules/currencies`
 * — both this module and the profile's editor need it, and neither should have
 * to import the other to get it.
 */
export { todayIso } from './domain';
export { useRates } from './application/use-rates';
export { useManualRate } from './application/use-manual-rate';
export {
  createConvertToDisplay,
  useConvertToDisplay,
  type ConversionError,
  type ConvertToDisplay,
} from './application/convert-to-display';
export {
  createDisplayCurrency,
  resetDisplayCurrency,
  useDisplayCurrency,
  type DisplayCurrency,
} from './application/use-display-currency';
export { default as CurrencySwitch } from './ui/CurrencySwitch.vue';
export { default as MoneyText } from './ui/MoneyText.vue';
/** Routed screen, async: the shell imports this barrel statically for `CurrencySwitch` and `MoneyText`. */
export const RatesPage = defineAsyncComponent(() => import('./ui/RatesPage.vue'));
export { default as ManualRateSheet } from './ui/ManualRateSheet.vue';
