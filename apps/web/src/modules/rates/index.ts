/**
 * Public API of the rates module. `useCurrencies` is here because the profile's
 * currency editor needs the list too, and a module is reached only through its
 * front door.
 */
export { useCurrencies } from './application/use-currencies';
export { default as HomePage } from './ui/views/HomePage.vue';
