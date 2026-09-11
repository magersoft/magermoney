/**
 * Public API of the rates module. `useCurrencies` is here because the profile's
 * currency editor needs the list too, and a module is reached only through its
 * front door.
 */
export { toCurrency, toRate, todayIso } from './domain';
export { useCurrencies } from './application/use-currencies';
export { useRates } from './application/use-rates';
export { createDisplayCurrency, useDisplayCurrency, type DisplayCurrency } from './application/use-display-currency';
export { default as CurrencySwitch } from './ui/CurrencySwitch.vue';
export { default as MoneyText } from './ui/MoneyText.vue';
export { default as HomePage } from './ui/HomePage.vue';
