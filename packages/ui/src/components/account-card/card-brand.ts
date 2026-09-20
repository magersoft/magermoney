/**
 * Which payment scheme a card belongs to, read from whatever the owner typed.
 *
 * `cardNetwork` is a free-text field — people write «Visa», «visa debit»,
 * «МИР», «Master Card». The card has one small slot for a mark, so the string
 * is matched down to a scheme here, once, rather than by each screen guessing.
 *
 * Nothing is inferred from the card number: we never hold one. The last four
 * digits are all there is, and four digits are not an issuer.
 */
export const CARD_BRANDS = ['visa', 'mastercard', 'mir', 'unionpay', 'amex', 'jcb'] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];

/**
 * Each scheme and the spellings that mean it, in the order they are tried.
 * Matching is on the letters alone: spaces, dashes and case are noise, which is
 * what turns «Master Card», «master-card» and «MASTERCARD» into one answer.
 */
const SPELLINGS: Record<CardBrand, readonly string[]> = {
  visa: ['visa'],
  mastercard: ['mastercard', 'maestro', 'мастеркард'],
  mir: ['mir', 'мир'],
  unionpay: ['unionpay', 'chinaunionpay'],
  amex: ['amex', 'americanexpress'],
  jcb: ['jcb'],
};

/** Letters and digits only, lowercased — the form the spellings are written in. */
const squash = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * The scheme a network string names, or null when it names none. Null is a
 * normal answer: a card from a bank whose scheme nobody typed still draws, it
 * just draws without a mark.
 */
export function cardBrand(network?: string | null): CardBrand | null {
  if (!network) return null;
  const text = squash(network);
  if (!text) return null;
  for (const brand of CARD_BRANDS)
    if (SPELLINGS[brand].some((spelling) => text.includes(spelling))) return brand;
  return null;
}
