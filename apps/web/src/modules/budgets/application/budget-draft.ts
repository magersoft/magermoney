import type { BudgetInput } from '@magermoney/contracts';
import { Decimal, type IsoDate } from '@magermoney/domain';

/**
 * What the new-budget wizard is holding while it is being filled in, and the
 * rules about it. Pure: no Vue, no query, no API — so the walk through the
 * steps can be read and tested without mounting anything.
 *
 * A Budget here is one category with one ceiling (CONTEXT.md), and the
 * reference's wizard picks several categories at once — so one pass through
 * these steps writes one budget per category picked.
 */

export const BUDGET_STEPS = ['period', 'currency', 'categories', 'limits', 'confirm'] as const;
export type BudgetStep = (typeof BUDGET_STEPS)[number];

/** One category the wizard is carrying: from the palette, or typed in. */
export interface PickedCategory {
  /** A palette key, or `custom:<name>` for one typed in. */
  id: string;
  name: string;
  emoji?: string;
}

export interface BudgetDraft {
  activeFrom: IsoDate | '';
  /** Empty means an open period. */
  activeTo: IsoDate | '';
  currency: string;
  picked: PickedCategory[];
  /** Category id → the exact decimal string typed for it. */
  limits: Record<string, string>;
}

export const emptyDraft = (today: IsoDate, currency: string): BudgetDraft => ({
  activeFrom: today,
  activeTo: '',
  currency,
  picked: [],
  limits: {},
});

const aboveZero = (value: string | undefined): boolean => {
  if (value === undefined || value === '') return false;
  try {
    return new Decimal(value).greaterThan(0);
  } catch {
    return false;
  }
};

/** Whether the step has everything it asked for. The wizard will not move on without it. */
export function isStepComplete(draft: BudgetDraft, step: BudgetStep): boolean {
  switch (step) {
    case 'period':
      /* A period that ends before it starts is not a period. */
      return (
        draft.activeFrom !== '' && (draft.activeTo === '' || draft.activeTo >= draft.activeFrom)
      );
    case 'currency':
      return draft.currency !== '';
    case 'categories':
      return draft.picked.length > 0;
    case 'limits':
      /* Only what is still picked is asked about: a limit left behind by a
       * category that was dropped holds nothing up. */
      return draft.picked.every((c) => aboveZero(draft.limits[c.id]));
    case 'confirm':
      return true;
  }
}

const at = (step: BudgetStep) => BUDGET_STEPS.indexOf(step);
export const nextStep = (step: BudgetStep): BudgetStep =>
  BUDGET_STEPS[Math.min(at(step) + 1, BUDGET_STEPS.length - 1)]!;
export const previousStep = (step: BudgetStep): BudgetStep =>
  BUDGET_STEPS[Math.max(at(step) - 1, 0)]!;

/** One budget per category picked, in the order they were picked. */
export function budgetInputs(draft: BudgetDraft): BudgetInput[] {
  return draft.picked.map((c) => ({
    name: c.name,
    icon: c.emoji ?? null,
    monthlyLimit: draft.limits[c.id] ?? '0',
    currency: draft.currency,
    activeFrom: draft.activeFrom as IsoDate,
    activeTo: draft.activeTo === '' ? null : draft.activeTo,
  }));
}
