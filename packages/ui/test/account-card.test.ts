import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
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
  /*
   * A card is the shape of a card, not a box with a height someone chose: 85.6
   * × 54 mm is the ID-1 format every payment card is cut to. Pinned here
   * because the ratio is what stops the card stretching to the width of a
   * desktop page, and because the strip's add tile copies it — a height set
   * anywhere else would be a second opinion, and the two would drift.
   */
  it('has the proportions of a real card, at both sizes', () => {
    for (const size of ['sm', 'md'] as const) {
      const card = mount(AccountCard, { props: { account: account(), size } });
      expect(card.classes()).toContain('aspect-[1.586/1]');
    }
    /* And a ceiling on how wide it may get, so a wide page cannot inflate it. */
    expect(mount(AccountCard, { props: { account: account() } }).classes()).toContain(
      'max-w-[22rem]',
    );
  });

  it('shows the name, the balance through the lockup and the currency mark', () => {
    const w = mount(AccountCard, { props: { account: account() } });
    expect(w.text()).toContain('Tinkoff');
    expect(w.get('[data-slot="amount-lockup"]').text()).toContain('1,200');
    expect(w.find('[role="img"]').attributes('aria-label')).toBe('USD');
    w.unmount();
  });

  it('pins a card that is kept on the home screen, and only announces it once', () => {
    const plain = mount(AccountCard, { props: { account: account() } });
    expect(plain.find('[data-slot="account-card-pinned"]').exists()).toBe(false);
    plain.unmount();

    const w = mount(AccountCard, {
      props: { account: account({ pinned: true, pinnedLabel: 'On Home' }) },
    });
    const pin = w.get('[data-slot="account-card-pinned"]');
    expect(pin.attributes('aria-label')).toBe('On Home');
    // The name stays the name: the pin is furniture, not part of the label.
    expect(w.text()).toBe('Tinkoff$1,200.00$1,200.00');
    w.unmount();
  });

  /*
   * The card is where the country first has to survive the trip: it is handed
   * an account, not an icon, so the mark can only be Portuguese if the card
   * passes the country down.
   */
  it('marks the card with the country the account is held in', async () => {
    const pt = mount(AccountCard, { props: { account: account({ code: 'EUR', country: 'PT' }) } });
    const eu = mount(AccountCard, { props: { account: account({ code: 'EUR' }) } });
    const mark = (w: typeof pt) => w.find('svg').element.innerHTML.replace(/SVG[A-Za-z0-9]+/g, '');
    await ui.loadCountryFlags();
    await nextTick();

    expect(mark(pt)).not.toBe(mark(eu));
    pt.unmount();
    eu.unmount();
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
    /* Its size comes from its proportions now, not from a minimum height. */
    expect(card.classes()).toContain('aspect-[1.586/1]');
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
    const strip = w.get('[data-slot="account-card-strip"]');
    expect(strip.classes()).toContain('overflow-x-auto');
    /* Without scroll-padding a mandatory strip snaps its first card past the
       gutter, and the row ends up out of line with everything under it. */
    expect(strip.classes()).toContain('scroll-px-4');
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

  it('hands the tile its destination the way the element it renders as expects it', () => {
    /* A link shaped like a router's: it takes `to`, and an `href` it did not ask
       for would leave the anchor with none — and an anchor with no href cannot
       be focused. */
    const RouterLinkish = {
      props: { to: { type: String, default: '' } },
      template: '<a :href="to"><slot /></a>',
    };
    const w = mount(AccountCardStrip, {
      props: { ...props, as: RouterLinkish, addHref: '/accounts/new', addLabel: 'Добавить счёт' },
    });
    expect(w.get('[data-slot="add-account-tile"]').attributes('href')).toBe('/accounts/new');
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

  /*
   * Two cards in the same currency are the same colour, so the seam between
   * them is drawn rather than implied: the canvas-coloured ring, the shadow the
   * covering card casts upwards, and the card's own hairline edge. The last two
   * are what carry the dark theme, where the fill has no shadow under it.
   */
  it('separates one card from the next with a ring, a shadow and an edge', () => {
    const w = mount(AccountCardStack, { props: { accounts } });
    const classes = w.findAll('[data-slot="account-card"]').map((c) => c.classes().join(' '));
    expect(classes.every((c) => c.includes('ring-background'))).toBe(true);
    expect(classes.every((c) => c.includes('shadow-stack'))).toBe(true);
    expect(classes.every((c) => c.includes('border-card-edge'))).toBe(true);
    // The stack's shadow replaces the card's own; two box-shadows cannot both win.
    expect(classes.some((c) => c.includes('shadow-card'))).toBe(false);
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
