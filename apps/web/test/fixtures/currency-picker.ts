import { flushPromises } from '@vue/test-utils';

/**
 * Picks a currency through `AppCurrencySelect`.
 *
 * The control is a combobox whose list renders into a portal on `document.body`,
 * so a test cannot `setValue` it the way it could the `<select>` this replaced:
 * it has to open the trigger and click the option, which is also what a person
 * does.
 *
 * `picker` is the element the caller found through its own wrapper — not a
 * selector this function resolves against `document`. These suites mount with
 * `attachTo: document.body` and do not always unmount, so several copies of the
 * same screen can be in the document at once, and a global lookup picks the
 * first one rather than the one under test.
 */
export async function pickCurrency(picker: Element, code: string): Promise<void> {
  const trigger = picker.querySelector<HTMLElement>('[data-testid="currency-trigger"]');
  if (!trigger) throw new Error('That element is not a currency picker');

  /*
   * jsdom keeps a portal's markup on `document.body` after its component
   * unmounts, so an earlier picker leaves its list behind. Clicking an option
   * in that one updates nothing, and the failure reads as a form bug.
   */
  for (const stale of document.querySelectorAll('[data-slot="combobox-content"]')) stale.remove();

  trigger.click();
  await flushPromises();

  const option = document.querySelector<HTMLElement>(`[data-testid="currency-option-${code}"]`);
  if (!option) throw new Error(`The picker does not offer ${code}`);
  option.click();
  await flushPromises();
}
