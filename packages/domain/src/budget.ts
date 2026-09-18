import type { ActivePeriod } from './active-period.js';
import type { Money } from './money.js';

/** A variable spending category with a monthly limit. What was actually spent arrives with Spends in phase 5. */
export interface Budget extends ActivePeriod {
  id: string;
  name: string;
  icon: string | null;
  monthlyLimit: Money;
}
