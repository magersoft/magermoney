import type { IsoDate } from './rate.js';
export interface Clock { now(): Date; today(): IsoDate }
const iso = (d: Date): IsoDate => d.toISOString().slice(0, 10);
export class SystemClock implements Clock { now() { return new Date(); } today() { return iso(this.now()); } }
export class FixedClock implements Clock {
  constructor(private readonly at: Date) {}
  now() { return new Date(this.at); }
  today() { return iso(this.at); }
}
