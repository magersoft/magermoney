import type { CurrencyDto, CurrencyUsage } from '@magermoney/contracts';
import type { UserCurrencyRepository } from '../application/user-currency-repository.js';

const NO_USAGE: CurrencyUsage = {
  accounts: 0,
  budgets: 0,
  expenses: 0,
  incomeSources: 0,
  inflows: 0,
  profile: false,
};

/**
 * The in-memory stand-in. Usage is set per code by the test rather than derived
 * from other repositories: what these use cases decide is what to do with the
 * answer, and a fake that recounted the whole database would only be testing
 * the fake.
 */
export class MemoryUserCurrencyRepository implements UserCurrencyRepository {
  public usageByCode: Record<string, CurrencyUsage> = {};

  constructor(
    private readonly catalogue: CurrencyDto[],
    private readonly connected: Record<string, string[]> = {},
  ) {}

  /**
   * The codes as stored. A user the test never mentioned has the whole
   * catalogue connected, which is what a test with nothing to say about
   * connections wants; `{ [user]: [...] }` is how a test says otherwise.
   */
  codesOf(userId: string): string[] {
    return [...(this.connected[userId] ?? this.catalogue.map((c) => c.code))];
  }
  async listConnected(userId: string): Promise<CurrencyDto[]> {
    const codes = new Set(this.codesOf(userId));
    return this.catalogue
      .filter((c) => codes.has(c.code))
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  async catalogueEntry(code: string): Promise<CurrencyDto | null> {
    return this.catalogue.find((c) => c.code === code) ?? null;
  }
  async connect(userId: string, code: string) {
    const codes = (this.connected[userId] ??= []);
    if (!codes.includes(code)) codes.push(code);
  }
  async disconnect(userId: string, code: string) {
    this.connected[userId] = (this.connected[userId] ?? []).filter((c) => c !== code);
  }
  async usage(_userId: string, code: string): Promise<CurrencyUsage> {
    return this.usageByCode[code] ?? NO_USAGE;
  }
}
