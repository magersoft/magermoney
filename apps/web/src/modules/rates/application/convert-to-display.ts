import { computed, type ComputedRef, type Ref } from 'vue';
import { err, type Result } from 'neverthrow';
import {
  RateMissingError,
  UnknownCurrencyError,
  type Money,
  type RateTable,
} from '@magermoney/domain';
import { todayIso } from '../domain';
import { useDisplayCurrency } from './use-display-currency';
import { useRates } from './use-rates';

export type ConversionError = RateMissingError | UnknownCurrencyError;
export type ConvertToDisplay = (money: Money) => Result<Money, ConversionError>;

/**
 * Conversion into the display currency, as one function. Pure and bound to a
 * table and a target, so the rule — including what happens before the rates
 * arrive — can be tested without a component.
 */
export function createConvertToDisplay(
  table: Ref<RateTable | undefined> | ComputedRef<RateTable | undefined>,
  current: Ref<string>,
): ConvertToDisplay {
  return (money: Money) => {
    const rates = table.value;
    if (!rates) return err(new RateMissingError(current.value, 'USD', todayIso()));
    return rates.convert(money, current.value);
  };
}

/**
 * The app's conversion: the shared rate table and the shared display currency.
 * Every amount on screen goes through this one, which is why flipping the
 * switch changes all of them at once.
 */
export function useConvertToDisplay(date?: string): {
  convertToDisplay: ConvertToDisplay;
  current: Ref<string>;
  date: ComputedRef<string>;
} {
  const rates = useRates(date);
  const { current } = useDisplayCurrency();
  return {
    convertToDisplay: createConvertToDisplay(rates.table, current),
    current,
    date: computed(() => rates.date.value),
  };
}
