import { describe, expect, it } from 'vitest';
import {
  addToSwitch,
  makeMain,
  moveInSwitch,
  removeFromSwitch,
  reorderSwitch,
} from '../src/modules/currencies/domain/switch-list.js';

const list = (codes: string[], main = codes[0]!) => ({
  reportingCurrencies: codes,
  defaultCurrency: main,
});

describe('addToSwitch', () => {
  it('adds at the end, where the switch will show it', () => {
    expect(addToSwitch(list(['USD']), 'EUR')).toEqual(list(['USD', 'EUR']));
  });

  it('refuses a fourth, rather than sending one the API will bounce', () => {
    expect(addToSwitch(list(['USD', 'EUR', 'RUB']), 'KZT')).toBeNull();
  });

  it('refuses one that is already there', () => {
    expect(addToSwitch(list(['USD', 'EUR']), 'EUR')).toBeNull();
  });
});

describe('removeFromSwitch', () => {
  it('takes one out', () => {
    expect(removeFromSwitch(list(['USD', 'EUR']), 'EUR')).toEqual(list(['USD']));
  });

  it('moves the main currency along when it was the one removed', () => {
    expect(removeFromSwitch(list(['USD', 'EUR'], 'USD'), 'USD')).toEqual({
      reportingCurrencies: ['EUR'],
      defaultCurrency: 'EUR',
    });
  });

  it('refuses to empty the switch: every amount needs a currency to be shown in', () => {
    expect(removeFromSwitch(list(['USD']), 'USD')).toBeNull();
  });

  it('refuses a currency that is not in the switch', () => {
    expect(removeFromSwitch(list(['USD', 'EUR']), 'RUB')).toBeNull();
  });
});

describe('moveInSwitch', () => {
  it('moves one along, keeping the main currency', () => {
    expect(moveInSwitch(list(['USD', 'EUR', 'RUB'], 'EUR'), 'RUB', -1)).toEqual({
      reportingCurrencies: ['USD', 'RUB', 'EUR'],
      defaultCurrency: 'EUR',
    });
    expect(moveInSwitch(list(['USD', 'EUR', 'RUB']), 'USD', 1)?.reportingCurrencies).toEqual([
      'EUR',
      'USD',
      'RUB',
    ]);
  });

  it('refuses at either end', () => {
    expect(moveInSwitch(list(['USD', 'EUR']), 'USD', -1)).toBeNull();
    expect(moveInSwitch(list(['USD', 'EUR']), 'EUR', 1)).toBeNull();
  });
});

describe('reorderSwitch', () => {
  it('drops the currency where the drag ended, in either direction', () => {
    expect(reorderSwitch(list(['USD', 'EUR', 'RUB'], 'EUR'), 0, 2)?.reportingCurrencies).toEqual([
      'EUR',
      'RUB',
      'USD',
    ]);
    expect(reorderSwitch(list(['USD', 'EUR', 'RUB']), 2, 0)?.reportingCurrencies).toEqual([
      'RUB',
      'USD',
      'EUR',
    ]);
  });

  it('keeps the main currency, wherever it lands', () => {
    expect(reorderSwitch(list(['USD', 'EUR', 'RUB'], 'RUB'), 2, 0)?.defaultCurrency).toBe('RUB');
  });

  it('refuses a drag that ended where it started, or outside the list', () => {
    expect(reorderSwitch(list(['USD', 'EUR']), 1, 1)).toBeNull();
    expect(reorderSwitch(list(['USD', 'EUR']), 0, 2)).toBeNull();
    expect(reorderSwitch(list(['USD', 'EUR']), -1, 0)).toBeNull();
  });
});

describe('makeMain', () => {
  it('moves the main currency without reordering the switch', () => {
    expect(makeMain(list(['USD', 'EUR'], 'USD'), 'EUR')).toEqual({
      reportingCurrencies: ['USD', 'EUR'],
      defaultCurrency: 'EUR',
    });
  });

  it('refuses one that is not in the switch, or already main', () => {
    expect(makeMain(list(['USD', 'EUR'], 'USD'), 'RUB')).toBeNull();
    expect(makeMain(list(['USD', 'EUR'], 'USD'), 'USD')).toBeNull();
  });
});
