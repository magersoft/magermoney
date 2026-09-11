/**
 * Public API of the rates module. Reference data lives in `@/modules/currencies`
 * — both this module and the profile's editor need it, and neither should have
 * to import the other to get it.
 */
export { todayIso } from './domain';
export { useRates } from './application/use-rates';
export {
  createConvertToDisplay,
  useConvertToDisplay,
  type ConversionError,
  type ConvertToDisplay,
} from './application/convert-to-display';
export { createDisplayCurrency, useDisplayCurrency, type DisplayCurrency } from './application/use-display-currency';
export { default as CurrencySwitch } from './ui/CurrencySwitch.vue';
export { default as MoneyText } from './ui/MoneyText.vue';
export { default as HomePage } from './ui/HomePage.vue';
