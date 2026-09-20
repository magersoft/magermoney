import { describe, expect, it } from 'vitest';
import {
  BUDGET_STEPS,
  budgetInputs,
  emptyDraft,
  isStepComplete,
  nextStep,
  previousStep,
  type BudgetDraft,
} from '../src/modules/budgets/application/budget-draft.js';

const draft = (over: Partial<BudgetDraft> = {}): BudgetDraft => ({
  ...emptyDraft('2026-09-19', 'USD'),
  ...over,
});
const picked = [
  { id: 'groceries', name: 'Продукты', emoji: '🛒' },
  { id: 'custom:Няня', name: 'Няня' },
];

describe('the budget draft', () => {
  it('opens on today, in the currency the screens report in, with nothing picked', () => {
    const d = emptyDraft('2026-09-19', 'USD');
    expect(d).toMatchObject({ activeFrom: '2026-09-19', activeTo: '', currency: 'USD' });
    expect(d.picked).toEqual([]);
    expect(d.limits).toEqual({});
  });

  it('knows which step is finished and which is not', () => {
    expect(isStepComplete(draft(), 'period')).toBe(true);
    expect(isStepComplete(draft({ activeFrom: '' }), 'period')).toBe(false);
    /* A period that ends before it starts is not a period. */
    expect(isStepComplete(draft({ activeTo: '2026-01-01' }), 'period')).toBe(false);
    expect(isStepComplete(draft({ activeTo: '2027-01-01' }), 'period')).toBe(true);

    expect(isStepComplete(draft({ currency: '' }), 'currency')).toBe(false);
    expect(isStepComplete(draft(), 'categories')).toBe(false);
    expect(isStepComplete(draft({ picked }), 'categories')).toBe(true);
  });

  it('holds the limits step until every category picked has one above zero', () => {
    const d = draft({ picked, limits: { groceries: '300' } });
    expect(isStepComplete(d, 'limits')).toBe(false);
    expect(
      isStepComplete({ ...d, limits: { groceries: '300', 'custom:Няня': '0' } }, 'limits'),
    ).toBe(false);
    expect(
      isStepComplete({ ...d, limits: { groceries: '300', 'custom:Няня': '120' } }, 'limits'),
    ).toBe(true);
  });

  /* A limit typed for a category that was then dropped is not asked about again. */
  it('ignores a limit left behind by a category that is no longer picked', () => {
    const d = draft({ picked: [picked[0]!], limits: { groceries: '300', taxi: '0' } });
    expect(isStepComplete(d, 'limits')).toBe(true);
  });

  it('walks forward and back without falling off either end', () => {
    expect(nextStep('period')).toBe('currency');
    expect(previousStep('period')).toBe('period');
    expect(nextStep('confirm')).toBe('confirm');
    expect(previousStep('confirm')).toBe('limits');
    expect(BUDGET_STEPS).toEqual(['period', 'currency', 'categories', 'limits', 'confirm']);
  });

  it('turns the draft into one budget per category picked', () => {
    const inputs = budgetInputs(
      draft({
        picked,
        limits: { groceries: '300', 'custom:Няня': '120' },
        activeTo: '2027-01-01',
      }),
    );
    expect(inputs).toEqual([
      {
        name: 'Продукты',
        icon: '🛒',
        monthlyLimit: '300',
        currency: 'USD',
        activeFrom: '2026-09-19',
        activeTo: '2027-01-01',
      },
      {
        name: 'Няня',
        icon: null,
        monthlyLimit: '120',
        currency: 'USD',
        activeFrom: '2026-09-19',
        activeTo: '2027-01-01',
      },
    ]);
  });

  /* No end date is an open period, which the API is told as `null`, not as ''. */
  it('sends no end date as null', () => {
    const inputs = budgetInputs(draft({ picked: [picked[0]!], limits: { groceries: '300' } }));
    expect(inputs[0]?.activeTo).toBeNull();
  });
});
