import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AccountCard from '../src/components/account-card/AccountCard.vue';
import AccountColorPicker from '../src/components/account-card/AccountColorPicker.vue';
import { cardBrand, CARD_BRANDS } from '../src/components/account-card/card-brand';
import {
  cardHue,
  cardTintStyle,
  ACCOUNT_COLORWAYS,
  ACCOUNT_COLORWAY_HUES,
  type AccountColorway,
} from '../src/components/account-card/colorways';
import { currencyHue } from '../src/components/account-card/currency-tint';
import type { AccountCardItem } from '../src/components/account-card/types';

const account = (over: Partial<AccountCardItem> = {}): AccountCardItem => ({
  id: 'a1',
  name: 'Tinkoff',
  href: '/accounts/a1',
  amount: '1200.00',
  code: 'USD',
  kind: 'fiat',
  ...over,
});

describe('cardHue', () => {
  it('paints an unpainted account in the colour of what it holds', () => {
    expect(cardHue('USD')).toBe(currencyHue('USD'));
    expect(cardHue('USD', null)).toBe(currencyHue('USD'));
  });

  it('lets a colorway outrank the currency', () => {
    expect(cardHue('USD', 'teal')).toBe(ACCOUNT_COLORWAY_HUES.teal);
    /* Two accounts in different currencies, painted the same, are the same colour. */
    expect(cardHue('RUB', 'teal')).toBe(cardHue('USD', 'teal'));
  });

  /*
   * A card painted in a colour this build has never heard of still has to
   * render: colours are added over time and a stale client is a normal client.
   */
  it('falls back to the currency for a colour it does not know', () => {
    expect(cardHue('USD', 'ultramarine')).toBe(currencyHue('USD'));
  });

  it('keeps every colour far enough from the next to be told apart', () => {
    const sorted = [...ACCOUNT_COLORWAYS]
      .map((c) => ACCOUNT_COLORWAY_HUES[c])
      .sort((a, b) => a - b);
    expect(new Set(sorted).size).toBe(sorted.length);
    const gaps = sorted.map((hue, i) =>
      i === 0 ? 360 + sorted.at(-1)! - hue : hue - sorted[i - 1]!,
    );
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(30);
  });

  /*
   * The hue is all a colorway hands in. Lightness and chroma stay the theme's,
   * which is what `tokens-contrast.test.ts` proves across the whole wheel — a
   * colorway that shipped a lightness of its own would step outside that proof.
   */
  it('hands the card a hue and nothing else', () => {
    expect(Object.keys(cardTintStyle('USD', 'rose'))).toEqual(['--mm-card-hue']);
  });
});

describe('cardBrand', () => {
  it('reads a scheme out of however it was typed', () => {
    expect(cardBrand('Visa')).toBe('visa');
    expect(cardBrand('visa debit')).toBe('visa');
    expect(cardBrand('Master Card')).toBe('mastercard');
    expect(cardBrand('MASTERCARD')).toBe('mastercard');
    expect(cardBrand('МИР')).toBe('mir');
  });

  it('names no scheme when the field is empty or says something else', () => {
    expect(cardBrand(null)).toBeNull();
    expect(cardBrand('')).toBeNull();
    expect(cardBrand('   ')).toBeNull();
    expect(cardBrand('Sberbank')).toBeNull();
  });

  it('knows every scheme it claims to', () => {
    for (const brand of CARD_BRANDS) expect(cardBrand(brand)).toBe(brand);
  });
});

describe('AccountCard, as a bank card', () => {
  it('shows a payment card its scheme, its digits and its expiry', () => {
    const card = mount(AccountCard, {
      props: {
        account: account({
          isCard: true,
          network: 'Visa',
          last4: '2340',
          expires: '04/25',
        }),
      },
    });
    expect(card.find('[data-slot="card-brand"]').attributes('data-brand')).toBe('visa');
    expect(card.find('[data-slot="account-card-footing"]').text()).toBe('•• 2340');
    expect(card.find('[data-slot="account-card-expires"]').text()).toBe('04/25');
    /* The one shape that says «card» before a word is read. */
    expect(card.find('[data-slot="account-card-chip"]').exists()).toBe(true);
  });

  it('draws the mastercard glyph rather than a word', () => {
    const card = mount(AccountCard, {
      props: { account: account({ isCard: true, network: 'Mastercard' }) },
    });
    const mark = card.find('[data-slot="card-brand"]');
    expect(mark.element.tagName.toLowerCase()).toBe('svg');
    expect(mark.findAll('circle')).toHaveLength(2);
  });

  /* Four digits is all this app ever holds of a card, so four is all it can say. */
  it('never writes more of a number than the last four digits', () => {
    const card = mount(AccountCard, {
      props: { account: account({ isCard: true, last4: '2340' }) },
    });
    expect(card.text()).not.toMatch(/\d{5}/);
  });

  it('gives an account that is not a payment card where it is held instead', () => {
    const card = mount(AccountCard, {
      props: { account: account({ isCard: false, reference: 'Tinkoff · RU', last4: '2340' }) },
    });
    expect(card.find('[data-slot="account-card-footing"]').text()).toBe('Tinkoff · RU');
    expect(card.find('[data-slot="card-brand"]').exists()).toBe(false);
    expect(card.find('[data-slot="account-card-expires"]').exists()).toBe(false);
  });

  it('carries the picked colour into its fill, and the currency when none was picked', () => {
    const painted = mount(AccountCard, { props: { account: account({ colorway: 'rose' }) } });
    expect(painted.attributes('style')).toContain(`--mm-card-hue: ${ACCOUNT_COLORWAY_HUES.rose}`);
    expect(painted.attributes('data-colorway')).toBe('rose');

    const plain = mount(AccountCard, { props: { account: account() } });
    expect(plain.attributes('style')).toContain(`--mm-card-hue: ${currencyHue('USD')}`);
  });
});

describe('AccountColorPicker', () => {
  const labels = Object.fromEntries(ACCOUNT_COLORWAYS.map((c) => [c, `Colour ${c}`]));
  const picker = (colorway: AccountColorway | null = null) =>
    mount(AccountColorPicker, {
      props: {
        account: account(),
        label: 'Card colour',
        colorLabels: labels,
        defaultLabel: 'Currency colour',
        'onUpdate:modelValue': (v: unknown) => picked.push(v as string | null),
        modelValue: colorway,
      },
    });
  let picked: (string | null)[] = [];
  const swipe = async (wrapper: ReturnType<typeof picker>, by: number) => {
    const surface = wrapper.find('[data-testid="colorway-swipe"]');
    await surface.trigger('pointerdown', { clientX: 200, pointerId: 1 });
    await surface.trigger('pointermove', { clientX: 200 + by, pointerId: 1 });
    await surface.trigger('pointerup', { pointerId: 1 });
  };

  it('deals the next colour when the card is swiped, and the previous one back', async () => {
    picked = [];
    await swipe(picker(), -120);
    expect(picked).toEqual([ACCOUNT_COLORWAYS[0]]);

    picked = [];
    await swipe(picker(), 120);
    /* The deck wraps: back from the account's own colour is the last paint. */
    expect(picked).toEqual([ACCOUNT_COLORWAYS.at(-1)]);
  });

  it('ignores a drag too short to be a swipe, so a tap never repaints a card', async () => {
    picked = [];
    await swipe(picker(), -8);
    expect(picked).toEqual([]);
  });

  it('offers every colour as one choice out of many, named and with its state', async () => {
    const wrapper = picker('teal');
    const group = wrapper.find('[role="radiogroup"]');
    expect(group.attributes('aria-label')).toBe('Card colour');
    const dots = group.findAll('[role="radio"]');
    expect(dots).toHaveLength(ACCOUNT_COLORWAYS.length + 1);
    const teal = wrapper.find('[data-testid="colorway-teal"]');
    expect(teal.attributes('aria-checked')).toBe('true');
    /* One tab stop for the whole set, on the colour that is on. */
    expect(teal.attributes('tabindex')).toBe('0');
    expect(wrapper.find('[data-testid="colorway-rose"]').attributes('tabindex')).toBe('-1');
    expect(teal.attributes('aria-label')).toBe('Colour teal');
    expect(wrapper.find('[data-testid="colorway-default"]').attributes('aria-label')).toBe(
      'Currency colour',
    );

    picked = [];
    await wrapper.find('[data-testid="colorway-rose"]').trigger('click');
    expect(picked).toEqual(['rose']);
  });

  it('paints the preview in the colour being tried, not the one that is saved', () => {
    const wrapper = picker('violet');
    expect(wrapper.find('[data-testid="colorway-preview"]').attributes('data-colorway')).toBe(
      'violet',
    );
  });

  /*
   * The colour still changes under reduced motion — that is the point of the
   * gesture. What goes is the spring back, which is the only part that was
   * animation rather than the finger's own movement.
   */
  it('keeps the card still under reduced motion instead of springing it back', () => {
    const preview = picker().find('[data-testid="colorway-preview"]');
    expect(preview.classes()).toContain('motion-reduce:transition-none');
    /* Nothing is offset at rest, so there is no transform to reduce either. */
    expect(preview.attributes('style') ?? '').not.toContain('translateX');
  });

  /* The gesture is a shortcut; the arrows are the way through without one. */
  it('steps through the deck with the arrow keys', async () => {
    picked = [];
    const wrapper = picker();
    await wrapper
      .find('[data-testid="colorway-default"]')
      .trigger('keydown', { key: 'ArrowRight' });
    expect(picked).toEqual([ACCOUNT_COLORWAYS[0]]);
  });
});
