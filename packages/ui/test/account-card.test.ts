import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AccountCard from '../src/components/account-card/AccountCard.vue';
import AccountCardStrip from '../src/components/account-card/AccountCardStrip.vue';
import AccountCardStack from '../src/components/account-card/AccountCardStack.vue';
import { currencyHue, CURRENCY_TINT_ORDER } from '../src/components/account-card/currency-tint';
import type { AccountCardItem } from '../src/components/account-card/types';
import * as ui from '../src/index';

const account = (over: Partial<AccountCardItem> = {}): AccountCardItem => {
  const id = over.id ?? 'a1';
  return {
    id,
    name: 'Tinkoff',
    href: `/accounts/${id}`,
    amount: '1200.00',
    code: 'USD',
    kind: 'fiat',
    ...over,
  };
};

describe('currencyHue', () => {
  it('answers with the same hue for the same currency, every time', () => {
    expect(currencyHue('USD')).toBe(currencyHue('USD'));
    expect(currencyHue('usd')).toBe(currencyHue('USD'));
  });

  it('gives every currency the app ships a hue of its own, far from its neighbours', () => {
    const sorted = CURRENCY_TINT_ORDER.map(currencyHue).sort((a, b) => a - b);
    expect(new Set(sorted).size).toBe(sorted.length);
    const gaps = sorted.map((hue, i) =>
      i === 0 ? 360 + sorted.at(-1)! - hue : hue - sorted[i - 1]!,
    );
    expect(Math.min(...gaps)).toBeGreaterThan(10);
  });

  /*
   * Hues are handed out by position, so the order is the data. Pinned here
   * because a reorder is not a refactor: it recolours every card after it.
   */
  it('hands hues out in the order the app seeds its currencies', () => {
    expect(CURRENCY_TINT_ORDER).toEqual([
      'USD',
      'EUR',
      'RUB',
      'KZT',
      'UZS',
      'IDR',
      'EGP',
      'GEL',
      'KGS',
      'BTC',
      'ETH',
      'USDT',
      'XRP',
      'SOL',
      'DOGE',
      'PEPE',
      'AVAX',
      'ATOM',
      'TRX',
    ]);
  });

  it('still answers for a currency it has never heard of', () => {
    const hue = currencyHue('ZZZ');
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
    expect(currencyHue('ZZZ')).toBe(hue);
  });
});

describe('AccountCard', () => {
  it('shows the name, the balance through the lockup and the currency mark', () => {
    const w = mount(AccountCard, { props: { account: account() } });
    expect(w.text()).toContain('Tinkoff');
    expect(w.get('[data-slot="amount-lockup"]').text()).toContain('1,200');
    expect(w.find('[role="img"]').attributes('aria-label')).toBe('USD');
    w.unmount();
  });

  it('takes its fill from the currency, not from the caller', () => {
    const usd = mount(AccountCard, { props: { account: account() } });
    const eur = mount(AccountCard, { props: { account: account({ code: 'EUR' }) } });
    const hue = (w: typeof usd) => w.get('[data-slot="account-card"]').attributes('style');
    expect(hue(usd)).toContain(`${currencyHue('USD')}`);
    expect(hue(usd)).not.toBe(hue(eur));
    // A second account in the same currency is the same colour: colour groups.
    const other = mount(AccountCard, { props: { account: account({ id: 'a2', name: 'Cash' }) } });
    expect(hue(other)).toBe(hue(usd));
    usd.unmount();
    eur.unmount();
    other.unmount();
  });

  it('marks an account held in something other than the base currency', () => {
    const foreign = mount(AccountCard, { props: { account: account(), baseCode: 'RUB' } });
    const home = mount(AccountCard, {
      props: { account: account({ code: 'RUB' }), baseCode: 'RUB' },
    });
    expect(foreign.get('[data-slot="account-card-foreign"]').text()).toBe('USD');
    expect(foreign.attributes('data-foreign')).toBe('true');
    expect(home.find('[data-slot="account-card-foreign"]').exists()).toBe(false);
    expect(home.attributes('data-foreign')).toBeUndefined();
    foreign.unmount();
    home.unmount();
  });

  it('is a link to the account, with a target a thumb can hit', () => {
    const w = mount(AccountCard, { props: { account: account() } });
    const card = w.get('[data-slot="account-card"]');
    expect(card.element.tagName).toBe('A');
    expect(card.attributes('href')).toBe('/accounts/a1');
    expect(card.classes().join(' ')).toContain('min-h-');
    w.unmount();
  });

  /*
   * A routed screen swaps `as` for its router link, which wants `to`, not
   * `href` — a card that quietly led nowhere would look completely fine.
   */
  it('hands the destination to whatever it renders as', () => {
    const RouterLinkStub = { props: ['to'], template: '<a :data-to="to"><slot /></a>' };
    const w = mount(AccountCard, { props: { account: account(), as: RouterLinkStub } });
    expect(w.get('[data-slot="account-card"]').attributes('data-to')).toBe('/accounts/a1');
    w.unmount();
  });
});

describe('AccountCardStrip', () => {
  const props = { accounts: [account(), account({ id: 'a2', name: 'Kaspi', code: 'KZT' })] };

  it('lays the cards out in a row that scrolls, one card per account', () => {
    const w = mount(AccountCardStrip, { props });
    expect(w.findAll('[data-slot="account-card"]')).toHaveLength(2);
    expect(w.get('[data-slot="account-card-strip"]').classes()).toContain('overflow-x-auto');
    w.unmount();
  });

  it('ends with the add tile, when the strip is given somewhere to add', () => {
    const w = mount(AccountCardStrip, {
      props: { ...props, addHref: '/accounts/new', addLabel: 'Добавить счёт' },
    });
    const items = w.findAll('li');
    expect(items).toHaveLength(3);
    expect(items.at(-1)!.get('a').attributes('href')).toBe('/accounts/new');
    expect(items.at(-1)!.text()).toContain('Добавить счёт');
    w.unmount();
  });

  it('leaves the tile out when there is nowhere to add', () => {
    const w = mount(AccountCardStrip, { props });
    expect(w.find('[data-slot="add-account-tile"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('AccountCardStack', () => {
  const accounts = [
    account(),
    account({ id: 'a2', name: 'Kaspi', code: 'KZT' }),
    account({ id: 'a3', name: 'Ledger', code: 'BTC', kind: 'crypto', scale: 8 }),
  ];

  it('builds the overlap from the same card, in the order it was given', () => {
    const w = mount(AccountCardStack, { props: { accounts } });
    const cards = w.findAll('[data-slot="account-card"]');
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.attributes('href'))).toEqual([
      '/accounts/a1',
      '/accounts/a2',
      '/accounts/a3',
    ]);
  });

  it('keeps the tab order the visual order: DOM order, and no tabindex of its own', () => {
    const w = mount(AccountCardStack, { props: { accounts } });
    const items = w.findAll('li');
    expect(items.map((i) => i.get('a').attributes('href'))).toEqual([
      '/accounts/a1',
      '/accounts/a2',
      '/accounts/a3',
    ]);
    expect(w.findAll('[tabindex]')).toHaveLength(0);
    w.unmount();
  });

  it('reserves only the peek for every card but the last, and raises the focused one', () => {
    const w = mount(AccountCardStack, { props: { accounts } });
    const items = w.findAll('li');
    const peeked = items.slice(0, -1);
    expect(peeked.every((i) => i.attributes('style')?.includes('height'))).toBe(true);
    expect(items.at(-1)!.attributes('style')).toBeUndefined();
    expect(items[0]!.classes().join(' ')).toContain('focus-within:z-');
    w.unmount();
  });

  it('passes the base currency down, so a foreign account is marked in the stack too', () => {
    const w = mount(AccountCardStack, { props: { accounts, baseCode: 'USD' } });
    expect(w.findAll('[data-slot="account-card-foreign"]').map((m) => m.text())).toEqual([
      'KZT',
      'BTC',
    ]);
    w.unmount();
  });
});

describe('the public surface', () => {
  it('exports the card, both layouts and the tint', () => {
    expect(ui.AccountCard).toBeTruthy();
    expect(ui.AccountCardStrip).toBeTruthy();
    expect(ui.AccountCardStack).toBeTruthy();
    expect(ui.currencyHue('USD')).toBe(currencyHue('USD'));
  });
});
