/**
 * The change against the previous period, as the badge states it.
 *
 * A delta is a ratio, not money: it is the one number in the app that is a
 * `number` on purpose (ADR 0001 governs amounts, and an amount never passes
 * through here). `0.05` is «+5 %».
 */
import type { AmountLocale } from '../amount-lockup/format-amount';

/** What the change means for this tile, which is what gives it its colour. */
export type DeltaTone = 'good' | 'bad' | 'flat';

/** A change smaller than this rounds to «0 %», so it claims no direction. */
const FLAT = 0.0005;

/**
 * Growth is not good news everywhere: income that grew is, spending that grew
 * is not. The tile says which it is with `upIsGood`, and the meaning — never
 * the sign — picks the fill.
 */
export function deltaTone(delta: number, upIsGood = true): DeltaTone {
  if (!Number.isFinite(delta) || Math.abs(delta) < FLAT) return 'flat';
  return delta > 0 === upIsGood ? 'good' : 'bad';
}

/** `up`, `down` or `flat` — the arrow, and the half of the meaning the sign carries. */
export function deltaDirection(delta: number): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(delta) || Math.abs(delta) < FLAT) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/**
 * The badge's text. The sign is part of it — the direction has to survive a
 * greyscale screen and a screen reader, so it can never live in the fill alone.
 *
 * Whole percents, except under one percent, where a single decimal is the
 * difference between «+0 %» and a change that actually happened.
 */
export function formatDelta(delta: number, locale: AmountLocale = 'en'): string {
  const flat = deltaDirection(delta) === 'flat';
  const value = flat ? 0 : delta;
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: Math.abs(value) < 0.01 ? 1 : 0,
    signDisplay: flat ? 'never' : 'exceptZero',
  }).format(value);
}
