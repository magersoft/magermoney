import type { IsoDate } from './rate.js';

/**
 * The dates between which an Income source, Expense or Budget counts. Nothing
 * is deleted when it ends; `activeTo` is the last day it still counts.
 */
export interface ActivePeriod {
  activeFrom: IsoDate;
  activeTo: IsoDate | null;
}

export function isActiveOn(p: ActivePeriod, date: IsoDate): boolean {
  return p.activeFrom <= date && (p.activeTo === null || date <= p.activeTo);
}

/** True when the period overlaps the inclusive range on at least one day. */
export function isActiveWithin(p: ActivePeriod, from: IsoDate, to: IsoDate): boolean {
  return p.activeFrom <= to && (p.activeTo === null || from <= p.activeTo);
}
