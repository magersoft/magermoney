import type Decimal from 'decimal.js';
import type { CurrencyCode } from './currency.js';
export type IsoDate = string; // YYYY-MM-DD
export type RateSource = 'api' | 'manual';
export interface Rate { base: CurrencyCode; quote: 'USD'; value: Decimal; date: IsoDate; source: RateSource }
