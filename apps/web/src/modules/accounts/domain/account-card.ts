/**
 * An account DTO, as the design system's card.
 *
 * Three screens draw the same card — the Home strip, the Accounts stack and the
 * account's own screen — and a card that said different things on each would
 * stop being one object seen three times. So the assembly happens here, once,
 * as a pure function: what the card is painted in, what its foot says, and
 * which scheme mark it carries.
 *
 * The full card number is not among the inputs, because it is not among the
 * things this app stores. Four digits are the whole of what a card is known by
 * here, and they are never written anywhere but this screen.
 */
import type { AccountDto } from '@magermoney/contracts';
import type { AccountCardItem } from '@magermoney/ui';

export interface CardLabels {
  /** What the star on a pinned card is announced as. */
  pinned?: string;
}

export interface CardCurrency {
  kind: 'fiat' | 'crypto';
  scale: number;
}

/**
 * `YYYY-MM-DD` as the `MM/YY` a card is embossed with. The date arithmetic in
 * this app lives in `packages/domain/src/calendar.ts`, but this is not
 * arithmetic — it is two slices of a string that is an IsoDate by contract.
 */
export function cardExpiry(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const [year, month] = isoDate.split('-');
  return year && month ? `${month}/${year.slice(2)}` : null;
}

/**
 * The foot of an account that is not a payment card: where the money is kept.
 * The bank and the country, which is the only identity such an account has —
 * account numbers are deliberately not stored.
 */
export function accountReference(dto: Pick<AccountDto, 'bank' | 'country'>): string {
  return `${dto.bank} · ${dto.country}`;
}

/** The whole card, from the account and what its currency turns out to be. */
export function toCardItem(
  dto: AccountDto,
  currency: CardCurrency,
  labels: CardLabels = {},
): AccountCardItem {
  const isCard = dto.kind === 'card';
  return {
    id: dto.id,
    name: dto.name,
    href: `/accounts/${dto.id}`,
    amount: dto.balance ?? '0',
    code: dto.currency,
    kind: currency.kind,
    country: dto.country,
    scale: currency.scale,
    pinned: dto.isPinned,
    pinnedLabel: labels.pinned,
    colorway: dto.colorway,
    isCard,
    network: dto.cardNetwork,
    last4: dto.cardLast4,
    expires: cardExpiry(dto.cardExpires),
    reference: isCard ? null : accountReference(dto),
  };
}
