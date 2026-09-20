/**
 * The rules of the display switch, as pure functions.
 *
 * Every one of them returns the whole next pair — the list and which of it is
 * the main currency — because the API refuses a default that is not in the
 * list, and working that out in three call sites is how one of them gets it
 * wrong. Each returns `null` when the move is not allowed, so the screen can
 * show why instead of sending something that will bounce.
 */
import { MAX_REPORTING_CURRENCIES } from '@magermoney/contracts';

export interface SwitchList {
  reportingCurrencies: string[];
  defaultCurrency: string;
}

/** Adds a currency to the end of the switch. `null` when it is already full. */
export function addToSwitch(current: SwitchList, code: string): SwitchList | null {
  if (current.reportingCurrencies.includes(code)) return null;
  if (current.reportingCurrencies.length >= MAX_REPORTING_CURRENCIES) return null;
  return { ...current, reportingCurrencies: [...current.reportingCurrencies, code] };
}

/**
 * Takes a currency out. `null` when it is the last one: an empty switch shows
 * nothing, and every amount on screen needs a currency to be shown in.
 */
export function removeFromSwitch(current: SwitchList, code: string): SwitchList | null {
  const next = current.reportingCurrencies.filter((c) => c !== code);
  if (next.length === 0 || next.length === current.reportingCurrencies.length) return null;
  return {
    reportingCurrencies: next,
    /* The main currency has to stay inside the list. */
    defaultCurrency: next.includes(current.defaultCurrency)
      ? current.defaultCurrency
      : (next[0] as string),
  };
}

/** Moves a currency one place along. `null` at either end. */
export function moveInSwitch(current: SwitchList, code: string, by: -1 | 1): SwitchList | null {
  const from = current.reportingCurrencies.indexOf(code);
  const to = from + by;
  if (from < 0 || to < 0 || to >= current.reportingCurrencies.length) return null;
  const next = [...current.reportingCurrencies];
  next.splice(from, 1);
  next.splice(to, 0, code);
  return { ...current, reportingCurrencies: next };
}

/** Makes a currency the main one. `null` when it already is, or is not in the switch. */
export function makeMain(current: SwitchList, code: string): SwitchList | null {
  if (code === current.defaultCurrency) return null;
  if (!current.reportingCurrencies.includes(code)) return null;
  return { ...current, defaultCurrency: code };
}
