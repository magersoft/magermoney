# Magermoney Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, authenticated Vue 3 PWA + Hono API + Supabase, with a tested domain core (Money, Currency, Rate) and daily/hourly currency rates, proven end to end by a Display currency switch on the home screen.

**Architecture:** bun + Turborepo monorepo. `packages/domain` is pure TypeScript shared by `apps/api` (Hono on Vercel Functions, Node 24, Supabase Postgres + Auth) and `apps/web` (Vue 3 PWA, module-per-domain layering, TanStack Query). `packages/contracts` holds zod schemas that produce OpenAPI on the server and types on the client. `packages/ui` is the project's own design system built from shadcn-vue.

**Tech Stack:** bun 1.3, Node 24, Turborepo 2, TypeScript 5, Vue 3.5, Vite 7, vue-router 5, Pinia 4, vue-i18n 11, @tanstack/vue-query 5, vite-plugin-pwa 1, Tailwind 4, shadcn-vue 2 / reka-ui 2, motion-v 2, unplugin-icons 24, Hono 4 + @hono/zod-openapi 1, zod 4, decimal.js 10, neverthrow 8, postgres 3, jose 6, pino 10, Supabase CLI, Vitest 5, fast-check 4, Playwright 1.63, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-11-phase-1-foundation-design.md`. Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/0001`–`0005`. Full schema: `docs/db/schema.dbml`.

## Global Constraints

- Node `24` (`.nvmrc`, `"engines": { "node": ">=24" }`); bun is the package manager and script runner; API runtime on Vercel is Node.
- Money and rates are `numeric` in Postgres, decimal strings in JSON, `Money`/`Decimal` in code. Never `number` for amounts. (ADR 0001)
- Every user table has `user_id`, RLS enabled, and every use case filters by `userId` from the auth context. `rates` rows with `user_id IS NULL` are shared.
- Dependency direction: `domain` ← `contracts` ← `api`, `web`; `ui` imports only Vue/Tailwind. Enforced by `eslint-plugin-boundaries`.
- No ORM. Hand-written SQL migrations in `supabase/migrations`, `postgres` (postgres.js) in the API.
- Domain errors are typed classes; use cases return `Result<T, E>` from neverthrow; HTTP mapping is centralised.
- Logs never contain amounts, emails, or tokens.
- Commits via the `/git-commit` skill, Conventional Commits, English. Code and comments in English. UI copy through i18n keys in `ru.json` and `en.json`; run `/humanize-text:humanize-text` on new copy.
- Any new UI surface: run `/frontend-design` before markup, `/impeccable` after; motion via `/animate`; `packages/ui` components enter only through the shadcn-vue MCP/CLI.
- Web app structure follows the `/vue-ddd-architecture` skill: `modules/<name>/{domain,application,infrastructure,ui}` with one public `index.ts`.
- The repo is public: no real financial data, no secrets, `.env*` ignored, staging seed is fake.

---

## File map

```
.nvmrc  package.json  bun.lock  turbo.json  tsconfig.base.json  eslint.config.js
AGENTS.md  CLAUDE.md  .mcp.json  .gitignore  .env.example
.github/workflows/ci.yml  .github/workflows/db.yml
packages/config/{package.json, tsconfig.base.json, eslint/index.js}
packages/domain/src/{currency.ts, money.ts, rate.ts, rate-table.ts, clock.ts, errors.ts, index.ts}
packages/domain/test/{currency.test.ts, money.test.ts, money.property.test.ts, rate-table.test.ts, clock.test.ts}
packages/contracts/src/{common.ts, currency.ts, rate.ts, profile.ts, index.ts}
packages/ui/{components.json, src/styles/tokens.css, src/components/ui/**, src/components/currency-icon/CurrencyIcon.vue, src/motion/presets.ts, src/index.ts}
supabase/config.toml  supabase/migrations/0001_profiles.sql  0002_currencies.sql  0003_rates.sql  supabase/seed.sql
apps/api/src/{index.ts, app.ts}
apps/api/src/shared/{auth/jwt.ts, auth/middleware.ts, db/client.ts, errors/http.ts, logger.ts, env.ts, openapi.ts}
apps/api/src/modules/profiles/{application/*.ts, infrastructure/*.ts, http/routes.ts}
apps/api/src/modules/rates/{application/*.ts, infrastructure/*.ts, http/routes.ts}
apps/api/src/jobs/fetch-rates.ts
apps/api/test/**  apps/api/vercel.ts  apps/api/api/index.ts
apps/web/src/app/{main.ts, router.ts, i18n.ts, query.ts, pwa.ts, theme.ts, App.vue}
apps/web/src/modules/{auth,profile,rates}/{domain,application,infrastructure,ui}/**  + index.ts
apps/web/src/shared/{layout/AppShell.vue, money/format.ts, api/client.ts}
apps/web/src/locales/{ru.json, en.json}
apps/web/e2e/smoke.spec.ts  apps/web/playwright.config.ts  apps/web/vercel.ts  apps/web/vite.config.ts
```

---

### Task 1: Monorepo skeleton and agent docs

**Files:**
- Create: `.nvmrc`, `package.json`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.env.example`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `packages/config/package.json`, `packages/config/tsconfig.base.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: workspace names `@magermoney/domain`, `@magermoney/contracts`, `@magermoney/ui`, `@magermoney/config`, `@magermoney/api`, `@magermoney/web`; turbo tasks `build`, `dev`, `lint`, `typecheck`, `test`.

- [ ] **Step 1: Pin Node and create the root package.json**

```bash
cd /Users/magersoft/Projects/magersoft/magermoney
echo "24" > .nvmrc
nvm use 24   # if the shell does not pick it up: export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
node --version   # v24.x
```

`package.json`:

```json
{
  "name": "magermoney",
  "private": true,
  "packageManager": "bun@1.3.14",
  "engines": { "node": ">=24" },
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "turbo": "^2.10.12",
    "typescript": "^5.9.0",
    "prettier": "^3.6.0",
    "eslint": "^9.36.0",
    "eslint-plugin-boundaries": "^7.2.0",
    "@vue/eslint-config-typescript": "^14.9.0",
    "eslint-plugin-vue": "^10.0.0",
    "typescript-eslint": "^8.44.0"
  }
}
```

- [ ] **Step 2: turbo.json and base tsconfig**

`turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".vercel/output/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] }
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": []
  }
}
```

`packages/config/package.json`:

```json
{ "name": "@magermoney/config", "version": "0.0.0", "private": true, "type": "module", "exports": { "./tsconfig.base.json": "./tsconfig.base.json" } }
```

Copy `tsconfig.base.json` to `packages/config/tsconfig.base.json` (packages extend `@magermoney/config/tsconfig.base.json`; the root one is for editor tooling).

- [ ] **Step 3: Root eslint with boundary rules**

`eslint.config.js`:

```js
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.vercel/**', '**/coverage/**'] },
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'packages/domain/**' },
        { type: 'contracts', pattern: 'packages/contracts/**' },
        { type: 'ui', pattern: 'packages/ui/**' },
        { type: 'api', pattern: 'apps/api/**' },
        { type: 'web', pattern: 'apps/web/**' },
      ],
    },
    rules: {
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'domain', allow: [] },
          { from: 'contracts', allow: ['domain'] },
          { from: 'ui', allow: [] },
          { from: 'api', allow: ['domain', 'contracts'] },
          { from: 'web', allow: ['domain', 'contracts', 'ui'] },
        ],
      }],
    },
  },
);
```

- [ ] **Step 4: .gitignore, .env.example**

Append to `.gitignore`:

```
dist/
coverage/
.vercel/
.turbo/
supabase/.temp/
playwright-report/
test-results/
```

`.env.example`:

```
# apps/api
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
CRON_SECRET=change-me
FIAT_RATES_URL=https://open.er-api.com/v6/latest/USD
CRYPTO_RATES_URL=https://api.coingecko.com/api/v3/simple/price
# apps/web
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://127.0.0.1:3000
```

- [ ] **Step 5: AGENTS.md, CLAUDE.md, .mcp.json**

`AGENTS.md`:

```markdown
# Magermoney — guide for agents

Personal multi-currency finance tracker. Read `CONTEXT.md` (vocabulary) before naming anything, and `docs/adr/` before changing architecture.

## Layout
- `apps/web` Vue 3 PWA. Modules in `src/modules/<name>/{domain,application,infrastructure,ui}` with a single public `index.ts`. Follow the `/vue-ddd-architecture` skill.
- `apps/api` Hono API on Vercel Functions. Modules in `src/modules/<name>/{application,infrastructure,http}`; `src/shared` for auth, db, errors, openapi.
- `packages/domain` pure model (Money, Currency, Rate…). No framework imports. 100 % test coverage.
- `packages/contracts` zod schemas for DTOs and routes → OpenAPI + client types.
- `packages/ui` the design system (shadcn-vue + Tailwind v4 + motion-v). Add components only via the shadcn-vue MCP / CLI.
- `supabase/migrations` hand-written SQL. No ORM.

## Rules
- Money is decimal end to end (ADR 0001). Never `number` for amounts.
- Every user table has `user_id` + RLS; every use case filters by `userId`.
- Use cases return `Result` (neverthrow); HTTP mapping lives in `apps/api/src/shared/errors`.
- TDD: write the failing test first. Domain uses Vitest + fast-check.
- Commits: use the `/git-commit` skill (Conventional Commits, English).
- Never log amounts, emails or tokens. Never commit real data or `.env*`.

## Skills to use
- `/vue-ddd-architecture` — any structural change in `apps/web`.
- `/frontend-design` — BEFORE the first line of markup of any new screen or component.
- `/impeccable` — audit and polish any UI you touched, before handing off.
- `/animate` — any motion or transition. Presets live in `packages/ui/src/motion`.
- `/humanize-text:humanize-text` — all user-facing copy, including i18n strings in `apps/web/src/locales`.
- `/design-taste-frontend` — ONLY for auth pages and a future landing. Never for product screens.
- `/git-commit` — every commit.
- shadcn-vue MCP (`.mcp.json`) — adding components to `packages/ui`.

## Commands
- `bun install` · `bun run dev` · `bun run test` · `bun run lint` · `bun run typecheck` · `bun run build`
- Local DB: `supabase start` / `supabase db reset` (applies migrations + seed).
- Env: `vercel env pull .env.local` inside `apps/api` and `apps/web`.
```

`CLAUDE.md`:

```
@AGENTS.md
```

`.mcp.json`:

```json
{
  "mcpServers": {
    "shadcn-vue": { "command": "npx", "args": ["-y", "shadcn-vue@latest", "mcp"] }
  }
}
```

- [ ] **Step 6: Install and verify turbo runs**

```bash
bun install
bunx turbo run lint --dry-run
```

Expected: turbo lists zero packages with a `lint` script (none yet) and exits 0.

- [ ] **Step 7: Commit**

Use `/git-commit`: `chore: scaffold bun + turborepo monorepo with agent docs`

---

### Task 2: `packages/domain` — Currency registry

**Files:**
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/vitest.config.ts`, `packages/domain/src/errors.ts`, `packages/domain/src/currency.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/test/currency.test.ts`

**Interfaces:**
- Produces: `type CurrencyCode = string`; `interface Currency { code: CurrencyCode; kind: 'fiat' | 'crypto'; scale: number; symbol?: string }`; `class CurrencyRegistry { static default(): CurrencyRegistry; constructor(list: Currency[]); get(code): Result<Currency, UnknownCurrencyError>; has(code): boolean; all(): Currency[] }`; `class DomainError extends Error { readonly code: string }`; `class UnknownCurrencyError extends DomainError`.

- [ ] **Step 1: Package files**

`packages/domain/package.json`:

```json
{
  "name": "@magermoney/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } },
  "scripts": {
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test"
  },
  "dependencies": { "decimal.js": "^10.6.0", "neverthrow": "^8.2.0" },
  "devDependencies": { "vitest": "^5.0.0", "@vitest/coverage-v8": "^5.0.0", "fast-check": "^4.10.0" }
}
```

`packages/domain/tsconfig.json`:

```json
{ "extends": "@magermoney/config/tsconfig.base.json", "compilerOptions": { "rootDir": ".", "noEmit": true }, "include": ["src", "test"] }
```

`packages/domain/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/**'], thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 } },
  },
});
```

- [ ] **Step 2: Failing test**

`packages/domain/test/currency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, UnknownCurrencyError } from '../src/index.js';

describe('CurrencyRegistry', () => {
  it('knows the default fiat and crypto currencies', () => {
    const r = CurrencyRegistry.default();
    expect(r.get('USD')._unsafeUnwrap()).toEqual({ code: 'USD', kind: 'fiat', scale: 2 });
    expect(r.get('BTC')._unsafeUnwrap()).toEqual({ code: 'BTC', kind: 'crypto', scale: 8, symbol: '₿' });
    expect(r.has('USDT')).toBe(true);
  });

  it('fails with UnknownCurrencyError for an unknown code', () => {
    const err = CurrencyRegistry.default().get('XYZ')._unsafeUnwrapErr();
    expect(err).toBeInstanceOf(UnknownCurrencyError);
    expect(err.code).toBe('UNKNOWN_CURRENCY');
    expect(err.message).toContain('XYZ');
  });

  it('accepts a custom list and rejects duplicates', () => {
    const r = new CurrencyRegistry([{ code: 'ABC', kind: 'fiat', scale: 2 }]);
    expect(r.all()).toHaveLength(1);
    expect(() => new CurrencyRegistry([{ code: 'A', kind: 'fiat', scale: 2 }, { code: 'A', kind: 'fiat', scale: 2 }])).toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 3: Run, expect failure**

```bash
cd packages/domain && bun install && bunx vitest run
```

Expected: FAIL, cannot resolve `../src/index.js`.

- [ ] **Step 4: Implement**

`packages/domain/src/errors.ts`:

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class UnknownCurrencyError extends DomainError {
  readonly code = 'UNKNOWN_CURRENCY';
  constructor(readonly currency: string) { super(`Unknown currency: ${currency}`); }
}
export class CurrencyMismatchError extends DomainError {
  readonly code = 'CURRENCY_MISMATCH';
  constructor(readonly left: string, readonly right: string) { super(`Currency mismatch: ${left} vs ${right}`); }
}
export class RateMissingError extends DomainError {
  readonly code = 'RATE_MISSING';
  constructor(readonly base: string, readonly quote: string, readonly date: string) {
    super(`No rate for ${base}/${quote} on ${date}`);
  }
}
export class InvalidAmountError extends DomainError {
  readonly code = 'INVALID_AMOUNT';
  constructor(readonly raw: string) { super(`Invalid amount: ${raw}`); }
}
```

`packages/domain/src/currency.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError } from './errors.js';

export type CurrencyCode = string;
export type CurrencyKind = 'fiat' | 'crypto';
export interface Currency { code: CurrencyCode; kind: CurrencyKind; scale: number; symbol?: string }

const fiat = (code: string, scale = 2): Currency => ({ code, kind: 'fiat', scale });
const crypto = (code: string, scale: number, symbol?: string): Currency =>
  symbol === undefined ? { code, kind: 'crypto', scale } : { code, kind: 'crypto', scale, symbol };

export const DEFAULT_CURRENCIES: readonly Currency[] = [
  fiat('USD'), fiat('EUR'), fiat('RUB'), fiat('KZT'), fiat('UZS'), fiat('IDR'), fiat('EGP'), fiat('GEL'), fiat('KGS'),
  crypto('BTC', 8, '₿'), crypto('ETH', 8, 'Ξ'), crypto('USDT', 2, '₮'), crypto('XRP', 6), crypto('SOL', 6),
  crypto('DOGE', 4), crypto('PEPE', 8), crypto('AVAX', 6), crypto('ATOM', 6), crypto('TRX', 6),
];

export class CurrencyRegistry {
  private readonly byCode = new Map<CurrencyCode, Currency>();
  constructor(list: readonly Currency[]) {
    for (const c of list) {
      if (this.byCode.has(c.code)) throw new Error(`Duplicate currency: ${c.code}`);
      this.byCode.set(c.code, c);
    }
  }
  static default(): CurrencyRegistry { return new CurrencyRegistry(DEFAULT_CURRENCIES); }
  has(code: CurrencyCode): boolean { return this.byCode.has(code); }
  get(code: CurrencyCode): Result<Currency, UnknownCurrencyError> {
    const c = this.byCode.get(code);
    return c ? ok(c) : err(new UnknownCurrencyError(code));
  }
  all(): Currency[] { return [...this.byCode.values()]; }
}
```

`packages/domain/src/index.ts`:

```ts
export * from './errors.js';
export * from './currency.js';
```

- [ ] **Step 5: Run, expect pass**

```bash
bunx vitest run
```

Expected: 3 passed; coverage 100 % for `src/currency.ts` and `src/errors.ts` (unused error classes count as uncovered functions until Tasks 3–4; temporarily set `thresholds` off or accept the red coverage until Task 4 — do NOT lower thresholds permanently).

- [ ] **Step 6: Commit**

`/git-commit`: `feat(domain): add Currency registry with default fiat and crypto set`

---

### Task 3: `packages/domain` — Money value object

**Files:**
- Create: `packages/domain/src/money.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/money.test.ts`, `packages/domain/test/money.property.test.ts`

**Interfaces:**
- Produces: `class Money { static of(amount: string | number | Decimal, currency: Currency): Money; static parse(raw: string, currency: Currency): Result<Money, InvalidAmountError>; readonly amount: Decimal; readonly currency: Currency; add(o): Result<Money, CurrencyMismatchError>; subtract(o): Result<Money, CurrencyMismatchError>; multiply(factor: string | number | Decimal): Money; compare(o): Result<-1|0|1, CurrencyMismatchError>; round(): Money; isZero(): boolean; isNegative(): boolean; toString(): string; toJSON(): { amount: string; currency: string } }`.

- [ ] **Step 1: Failing tests**

`packages/domain/test/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CurrencyMismatchError, CurrencyRegistry, InvalidAmountError, Money } from '../src/index.js';

const reg = CurrencyRegistry.default();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const BTC = reg.get('BTC')._unsafeUnwrap();

describe('Money', () => {
  it('adds and subtracts same-currency amounts exactly', () => {
    const a = Money.of('0.1', USD);
    const b = Money.of('0.2', USD);
    expect(a.add(b)._unsafeUnwrap().toString()).toBe('0.3');
    expect(b.subtract(a)._unsafeUnwrap().toString()).toBe('0.1');
  });

  it('refuses to mix currencies', () => {
    const e = Money.of('1', USD).add(Money.of('1', EUR))._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(CurrencyMismatchError);
    expect(Money.of('1', USD).compare(Money.of('1', EUR)).isErr()).toBe(true);
  });

  it('rounds to the currency scale, half up', () => {
    expect(Money.of('1.005', USD).round().toString()).toBe('1.01');
    expect(Money.of('0.123456789', BTC).round().toString()).toBe('0.12345679');
  });

  it('multiplies by a factor and keeps precision until round', () => {
    expect(Money.of('10', USD).multiply('0.15').toString()).toBe('1.5');
    expect(Money.of('2100675.19', USD).multiply('0.0000847').round().toString()).toBe('177.93');
  });

  it('compares, detects zero and negative', () => {
    expect(Money.of('1', USD).compare(Money.of('2', USD))._unsafeUnwrap()).toBe(-1);
    expect(Money.of('0', USD).isZero()).toBe(true);
    expect(Money.of('-3', USD).isNegative()).toBe(true);
  });

  it('parses strings and rejects garbage', () => {
    expect(Money.parse('24715.00', USD)._unsafeUnwrap().toString()).toBe('24715');
    expect(Money.parse('abc', USD)._unsafeUnwrapErr()).toBeInstanceOf(InvalidAmountError);
    expect(Money.parse('', USD).isErr()).toBe(true);
    expect(Money.parse('NaN', USD).isErr()).toBe(true);
    expect(Money.parse('Infinity', USD).isErr()).toBe(true);
  });

  it('serialises to a JSON shape with a decimal string', () => {
    expect(JSON.parse(JSON.stringify(Money.of('1.50', EUR)))).toEqual({ amount: '1.5', currency: 'EUR' });
  });
});
```

`packages/domain/test/money.property.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CurrencyRegistry, Money } from '../src/index.js';

const USD = CurrencyRegistry.default().get('USD')._unsafeUnwrap();
const amount = fc.tuple(fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }), fc.integer({ min: 0, max: 999 }))
  .map(([int, frac]) => `${int}.${String(frac).padStart(3, '0')}`);

describe('Money properties', () => {
  it('addition is commutative and associative', () => {
    fc.assert(fc.property(amount, amount, amount, (a, b, c) => {
      const [x, y, z] = [Money.of(a, USD), Money.of(b, USD), Money.of(c, USD)];
      expect(x.add(y)._unsafeUnwrap().toString()).toBe(y.add(x)._unsafeUnwrap().toString());
      const l = x.add(y)._unsafeUnwrap().add(z)._unsafeUnwrap();
      const r = x.add(y.add(z)._unsafeUnwrap())._unsafeUnwrap();
      expect(l.toString()).toBe(r.toString());
    }));
  });

  it('round is idempotent and never exceeds the scale', () => {
    fc.assert(fc.property(amount, (a) => {
      const once = Money.of(a, USD).round();
      expect(once.round().toString()).toBe(once.toString());
      expect(once.amount.decimalPlaces()).toBeLessThanOrEqual(USD.scale);
    }));
  });

  it('parse(toString) round-trips', () => {
    fc.assert(fc.property(amount, (a) => {
      const m = Money.of(a, USD);
      expect(Money.parse(m.toString(), USD)._unsafeUnwrap().toString()).toBe(m.toString());
    }));
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
bunx vitest run
```

Expected: FAIL, `Money` is not exported.

- [ ] **Step 3: Implement**

`packages/domain/src/money.ts`:

```ts
import Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import type { Currency } from './currency.js';
import { CurrencyMismatchError, InvalidAmountError } from './errors.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type DecimalInput = string | number | Decimal;

export class Money {
  private constructor(readonly amount: Decimal, readonly currency: Currency) {}

  static of(amount: DecimalInput, currency: Currency): Money {
    return new Money(new D(amount), currency);
  }

  static parse(raw: string, currency: Currency): Result<Money, InvalidAmountError> {
    if (!/^-?\d+(\.\d+)?$/.test(raw.trim())) return err(new InvalidAmountError(raw));
    return ok(new Money(new D(raw.trim()), currency));
  }

  private same(other: Money): Result<true, CurrencyMismatchError> {
    return this.currency.code === other.currency.code
      ? ok(true)
      : err(new CurrencyMismatchError(this.currency.code, other.currency.code));
  }

  add(other: Money): Result<Money, CurrencyMismatchError> {
    return this.same(other).map(() => new Money(this.amount.plus(other.amount), this.currency));
  }
  subtract(other: Money): Result<Money, CurrencyMismatchError> {
    return this.same(other).map(() => new Money(this.amount.minus(other.amount), this.currency));
  }
  multiply(factor: DecimalInput): Money {
    return new Money(this.amount.times(new D(factor)), this.currency);
  }
  compare(other: Money): Result<-1 | 0 | 1, CurrencyMismatchError> {
    return this.same(other).map(() => this.amount.comparedTo(other.amount) as -1 | 0 | 1);
  }
  round(): Money {
    return new Money(this.amount.toDecimalPlaces(this.currency.scale, Decimal.ROUND_HALF_UP), this.currency);
  }
  isZero(): boolean { return this.amount.isZero(); }
  isNegative(): boolean { return this.amount.isNegative(); }
  toString(): string { return this.amount.toFixed(); }
  toJSON(): { amount: string; currency: string } { return { amount: this.toString(), currency: this.currency.code }; }
}
```

Add to `index.ts`: `export * from './money.js'; export { default as Decimal } from 'decimal.js';`

- [ ] **Step 4: Run, expect pass**

```bash
bunx vitest run
```

Expected: all money tests pass. If `toFixed()` prints `1.50` for `Money.of('1.50')`, note `new D('1.50').toFixed()` gives `1.5` (decimal.js normalises trailing zeros); the test expects `1.5`.

- [ ] **Step 5: Commit**

`/git-commit`: `feat(domain): add Money value object with exact decimal arithmetic`

---

### Task 4: `packages/domain` — Rate, RateTable, Clock

**Files:**
- Create: `packages/domain/src/rate.ts`, `packages/domain/src/rate-table.ts`, `packages/domain/src/clock.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/rate-table.test.ts`, `packages/domain/test/clock.test.ts`

**Interfaces:**
- Produces: `type IsoDate = string` (`YYYY-MM-DD`); `interface Rate { base: CurrencyCode; quote: 'USD'; value: Decimal; date: IsoDate; source: 'api' | 'manual' }`; `class RateTable { constructor(date: IsoDate, rates: Rate[], registry: CurrencyRegistry); readonly date; convert(money: Money, to: CurrencyCode): Result<Money, RateMissingError | UnknownCurrencyError>; rateOf(code): Result<Decimal, RateMissingError> }`; `interface Clock { now(): Date; today(): IsoDate }`; `SystemClock`, `FixedClock`.

- [ ] **Step 1: Failing tests**

`packages/domain/test/rate-table.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, Money, RateMissingError, RateTable, UnknownCurrencyError, type Rate, Decimal } from '../src/index.js';

const reg = CurrencyRegistry.default();
const c = (code: string) => reg.get(code)._unsafeUnwrap();
const rate = (base: string, value: string): Rate => ({ base, quote: 'USD', value: new Decimal(value), date: '2026-09-11', source: 'api' });
const table = new RateTable('2026-09-11', [rate('EUR', '1.16'), rate('RUB', '0.011911'), rate('BTC', '77389.36'), rate('USD', '1')], reg);

describe('RateTable', () => {
  it('converts through USD as the cross currency', () => {
    expect(table.convert(Money.of('100', c('EUR')), 'USD')._unsafeUnwrap().toString()).toBe('116');
    expect(table.convert(Money.of('116', c('USD')), 'EUR')._unsafeUnwrap().round().toString()).toBe('100');
    expect(table.convert(Money.of('1', c('BTC')), 'RUB')._unsafeUnwrap().round().toString()).toBe('6497303.33');
  });

  it('is identity for the same currency', () => {
    expect(table.convert(Money.of('5', c('EUR')), 'EUR')._unsafeUnwrap().toString()).toBe('5');
  });

  it('fails with RateMissingError when a leg is missing', () => {
    const e = table.convert(Money.of('1', c('EUR')), 'KZT')._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(RateMissingError);
    expect((e as RateMissingError).base).toBe('KZT');
  });

  it('fails with UnknownCurrencyError for an unknown target', () => {
    expect(table.convert(Money.of('1', c('EUR')), 'XYZ')._unsafeUnwrapErr()).toBeInstanceOf(UnknownCurrencyError);
  });

  it('never returns NaN or zero for a missing rate', () => {
    const empty = new RateTable('2026-09-11', [], reg);
    expect(empty.rateOf('EUR').isErr()).toBe(true);
  });
});
```

`packages/domain/test/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock, SystemClock } from '../src/index.js';

describe('Clock', () => {
  it('FixedClock returns the fixed instant and its ISO date', () => {
    const clock = new FixedClock(new Date('2026-09-11T23:30:00Z'));
    expect(clock.now().toISOString()).toBe('2026-09-11T23:30:00.000Z');
    expect(clock.today()).toBe('2026-09-11');
  });
  it('SystemClock returns a date close to now', () => {
    expect(Math.abs(new SystemClock().now().getTime() - Date.now())).toBeLessThan(1000);
    expect(new SystemClock().today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run, expect failure** — `bunx vitest run` → FAIL, missing exports.

- [ ] **Step 3: Implement**

`packages/domain/src/rate.ts`:

```ts
import type Decimal from 'decimal.js';
import type { CurrencyCode } from './currency.js';
export type IsoDate = string; // YYYY-MM-DD
export type RateSource = 'api' | 'manual';
export interface Rate { base: CurrencyCode; quote: 'USD'; value: Decimal; date: IsoDate; source: RateSource }
```

`packages/domain/src/rate-table.ts`:

```ts
import Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import type { CurrencyCode, CurrencyRegistry } from './currency.js';
import { RateMissingError, UnknownCurrencyError } from './errors.js';
import { Money } from './money.js';
import type { IsoDate, Rate } from './rate.js';

export class RateTable {
  private readonly byBase = new Map<CurrencyCode, Decimal>();
  constructor(readonly date: IsoDate, rates: readonly Rate[], private readonly registry: CurrencyRegistry) {
    for (const r of rates) this.byBase.set(r.base, r.value);
    if (!this.byBase.has('USD')) this.byBase.set('USD', new Decimal(1));
  }

  rateOf(code: CurrencyCode): Result<Decimal, RateMissingError> {
    const v = this.byBase.get(code);
    return v && v.isFinite() && !v.isZero() ? ok(v) : err(new RateMissingError(code, 'USD', this.date));
  }

  convert(money: Money, to: CurrencyCode): Result<Money, RateMissingError | UnknownCurrencyError> {
    return this.registry.get(to).andThen((target) => {
      if (target.code === money.currency.code) return ok(money);
      return this.rateOf(money.currency.code).andThen((fromRate) =>
        this.rateOf(target.code).map((toRate) => Money.of(money.amount.times(fromRate).div(toRate), target)),
      );
    });
  }
}
```

`packages/domain/src/clock.ts`:

```ts
import type { IsoDate } from './rate.js';
export interface Clock { now(): Date; today(): IsoDate }
const iso = (d: Date): IsoDate => d.toISOString().slice(0, 10);
export class SystemClock implements Clock { now() { return new Date(); } today() { return iso(this.now()); } }
export class FixedClock implements Clock {
  constructor(private readonly at: Date) {}
  now() { return new Date(this.at); }
  today() { return iso(this.at); }
}
```

`index.ts` adds: `export * from './rate.js'; export * from './rate-table.js'; export * from './clock.js';`

- [ ] **Step 4: Run with coverage, expect pass and 100 %**

```bash
bunx vitest run --coverage
```

Expected: all pass, coverage thresholds met. If a branch in `errors.ts` is uncovered, add a one-line test constructing it.

- [ ] **Step 5: Commit**

`/git-commit`: `feat(domain): add Rate, RateTable conversion through USD, and Clock`

---

### Task 5: `packages/contracts` — zod schemas and OpenAPI-ready routes

**Files:**
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/vitest.config.ts`, `packages/contracts/src/common.ts`, `packages/contracts/src/currency.ts`, `packages/contracts/src/rate.ts`, `packages/contracts/src/profile.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/schemas.test.ts`

**Interfaces:**
- Produces: `DecimalString` (zod string matching `^-?\d+(\.\d+)?$`), `IsoDateSchema`, `CurrencyCodeSchema`, `CurrencyDto`, `RateDto`, `ManualRateInput`, `ProfileDto`, `UpdateProfileInput`, `ErrorDto = { code: string; message: string }`; all as zod schemas (`*Schema`) plus inferred types.

- [ ] **Step 1: Package files**

`packages/contracts/package.json`:

```json
{
  "name": "@magermoney/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit", "lint": "eslint src test" },
  "dependencies": { "zod": "^4.6.2", "@hono/zod-openapi": "^1.6.3", "@magermoney/domain": "workspace:*" },
  "devDependencies": { "vitest": "^5.0.0" }
}
```

`tsconfig.json` and `vitest.config.ts`: same as `packages/domain` (no coverage thresholds).

- [ ] **Step 2: Failing test**

`packages/contracts/test/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DecimalString, ManualRateInputSchema, UpdateProfileInputSchema } from '../src/index.js';

describe('contracts', () => {
  it('accepts decimal strings and rejects numbers and junk', () => {
    expect(DecimalString.safeParse('24715.00').success).toBe(true);
    expect(DecimalString.safeParse('-0.5').success).toBe(true);
    expect(DecimalString.safeParse(1.5).success).toBe(false);
    expect(DecimalString.safeParse('1,5').success).toBe(false);
  });
  it('validates a manual rate', () => {
    expect(ManualRateInputSchema.safeParse({ base: 'RUB', date: '2026-09-10', value: '0.011855' }).success).toBe(true);
    expect(ManualRateInputSchema.safeParse({ base: 'RUB', date: '10.09.2026', value: '0.01' }).success).toBe(false);
  });
  it('validates profile updates', () => {
    expect(UpdateProfileInputSchema.safeParse({ reportingCurrencies: ['USD', 'EUR'], defaultCurrency: 'EUR' }).success).toBe(true);
    expect(UpdateProfileInputSchema.safeParse({ reportingCurrencies: [], defaultCurrency: 'EUR' }).success).toBe(false);
    expect(UpdateProfileInputSchema.safeParse({ reportingCurrencies: ['USD'], defaultCurrency: 'EUR' }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run, expect failure** — `cd packages/contracts && bun install && bunx vitest run` → FAIL.

- [ ] **Step 4: Implement**

`src/common.ts`:

```ts
import { z } from '@hono/zod-openapi';
export const DecimalString = z.string().regex(/^-?\d+(\.\d+)?$/).openapi({ example: '24715.00', description: 'Exact decimal as a string' });
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({ example: '2026-09-11' });
export const CurrencyCodeSchema = z.string().min(2).max(10).regex(/^[A-Z0-9]+$/).openapi({ example: 'EUR' });
export const ErrorDtoSchema = z.object({ code: z.string(), message: z.string() }).openapi('Error');
export type ErrorDto = z.infer<typeof ErrorDtoSchema>;
```

`src/currency.ts`:

```ts
import { z } from '@hono/zod-openapi';
import { CurrencyCodeSchema } from './common.js';
export const CurrencyDtoSchema = z.object({
  code: CurrencyCodeSchema, kind: z.enum(['fiat', 'crypto']), scale: z.number().int().min(0).max(18),
  symbol: z.string().nullable(), nameRu: z.string().nullable(), nameEn: z.string().nullable(), icon: z.string().nullable(),
}).openapi('Currency');
export type CurrencyDto = z.infer<typeof CurrencyDtoSchema>;
```

`src/rate.ts`:

```ts
import { z } from '@hono/zod-openapi';
import { CurrencyCodeSchema, DecimalString, IsoDateSchema } from './common.js';
export const RateDtoSchema = z.object({
  base: CurrencyCodeSchema, quote: z.literal('USD'), value: DecimalString, date: IsoDateSchema, source: z.enum(['api', 'manual']),
}).openapi('Rate');
export type RateDto = z.infer<typeof RateDtoSchema>;
export const RatesQuerySchema = z.object({ date: IsoDateSchema.optional() });
export const ManualRateInputSchema = z.object({ base: CurrencyCodeSchema, date: IsoDateSchema, value: DecimalString }).openapi('ManualRateInput');
export type ManualRateInput = z.infer<typeof ManualRateInputSchema>;
```

`src/profile.ts`:

```ts
import { z } from '@hono/zod-openapi';
import { CurrencyCodeSchema } from './common.js';
export const ProfileDtoSchema = z.object({
  id: z.string().uuid(), displayName: z.string().nullable(), locale: z.enum(['ru', 'en']),
  defaultCurrency: CurrencyCodeSchema, reportingCurrencies: z.array(CurrencyCodeSchema).min(1),
  onboardingCompletedAt: z.string().datetime().nullable(),
}).openapi('Profile');
export type ProfileDto = z.infer<typeof ProfileDtoSchema>;
export const UpdateProfileInputSchema = z.object({
  displayName: z.string().max(80).optional(), locale: z.enum(['ru', 'en']).optional(),
  defaultCurrency: CurrencyCodeSchema.optional(), reportingCurrencies: z.array(CurrencyCodeSchema).min(1).max(12).optional(),
}).refine((v) => !v.defaultCurrency || !v.reportingCurrencies || v.reportingCurrencies.includes(v.defaultCurrency), {
  message: 'defaultCurrency must be one of reportingCurrencies', path: ['defaultCurrency'],
}).openapi('UpdateProfileInput');
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
```

`src/index.ts`: re-export all four files.

- [ ] **Step 5: Run, expect pass** — `bunx vitest run` → 3 passed.

- [ ] **Step 6: Commit** — `/git-commit`: `feat(contracts): add zod schemas for currency, rate and profile DTOs`

---

### Task 6: Supabase project, migrations, RLS, seed

**Files:**
- Create: `supabase/config.toml` (generated), `supabase/migrations/20260911000001_profiles.sql`, `supabase/migrations/20260911000002_currencies.sql`, `supabase/migrations/20260911000003_rates.sql`, `supabase/seed.sql`, `supabase/README.md`
- Test: `supabase/test/rls.test.ts` (run from `apps/api` in Task 8's integration job; write it here)

**Interfaces:**
- Produces: tables `profiles`, `currencies`, `rates` exactly as in `docs/db/schema.dbml` phase 1; enum types `locale`, `currency_kind`, `rate_source`; trigger `handle_new_user`.

- [ ] **Step 1: Initialise local Supabase**

```bash
cd /Users/magersoft/Projects/magersoft/magermoney
supabase init            # creates supabase/config.toml
supabase start           # Docker; prints API URL, anon key, service_role key, DB URL, JWT secret
```

Copy the printed anon key and JWT secret into `.env.local` files later (Tasks 8, 14). Commit `config.toml`.

- [ ] **Step 2: Migration 1 — profiles**

`supabase/migrations/20260911000001_profiles.sql`:

```sql
create type public.locale as enum ('ru', 'en');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale public.locale not null default 'ru',
  default_currency text not null default 'EUR',
  reporting_currencies text[] not null default array['EUR','USD','RUB'],
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles: owner read"  on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
```

- [ ] **Step 3: Migration 2 — currencies with seed**

`supabase/migrations/20260911000002_currencies.sql`:

```sql
create type public.currency_kind as enum ('fiat', 'crypto');

create table public.currencies (
  code text primary key check (code ~ '^[A-Z0-9]{2,10}$'),
  kind public.currency_kind not null,
  scale int not null check (scale between 0 and 18),
  symbol text,
  name_ru text,
  name_en text,
  icon text
);

alter table public.currencies enable row level security;
create policy "currencies: authenticated read" on public.currencies for select to authenticated using (true);

insert into public.currencies (code, kind, scale, symbol, name_ru, name_en, icon) values
  ('USD','fiat',2,null,null,null,null), ('EUR','fiat',2,null,null,null,null), ('RUB','fiat',2,null,null,null,null),
  ('KZT','fiat',2,null,null,null,null), ('UZS','fiat',2,null,null,null,null), ('IDR','fiat',2,null,null,null,null),
  ('EGP','fiat',2,null,null,null,null), ('GEL','fiat',2,null,null,null,null), ('KGS','fiat',2,null,null,null,null),
  ('BTC','crypto',8,'₿','Биткоин','Bitcoin',null), ('ETH','crypto',8,'Ξ','Эфириум','Ethereum',null),
  ('USDT','crypto',2,'₮','Tether','Tether',null), ('XRP','crypto',6,null,'XRP','XRP',null),
  ('SOL','crypto',6,null,'Solana','Solana',null), ('DOGE','crypto',4,null,'Dogecoin','Dogecoin',null),
  ('PEPE','crypto',8,null,'Pepe','Pepe',null), ('AVAX','crypto',6,null,'Avalanche','Avalanche',null),
  ('ATOM','crypto',6,null,'Cosmos','Cosmos',null), ('TRX','crypto',6,null,'Tron','Tron',null);

alter table public.profiles
  add constraint profiles_default_currency_fkey foreign key (default_currency) references public.currencies(code);
```

- [ ] **Step 4: Migration 3 — rates**

`supabase/migrations/20260911000003_rates.sql`:

```sql
create type public.rate_source as enum ('api', 'manual');

create table public.rates (
  id uuid primary key default gen_random_uuid(),
  base text not null references public.currencies(code),
  quote text not null default 'USD' check (quote = 'USD'),
  value numeric not null check (value > 0),
  date date not null,
  source public.rate_source not null,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint rates_manual_needs_user check ((source = 'manual') = (user_id is not null))
);

create unique index rates_unique_idx on public.rates (base, quote, date, source, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index rates_date_idx on public.rates (date desc);
create index rates_user_idx on public.rates (user_id) where user_id is not null;

alter table public.rates enable row level security;
create policy "rates: shared read" on public.rates for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "rates: owner insert manual" on public.rates for insert to authenticated with check (user_id = auth.uid() and source = 'manual');
create policy "rates: owner delete manual" on public.rates for delete to authenticated using (user_id = auth.uid() and source = 'manual');
```

- [ ] **Step 5: Seed (fake, staging/local only)**

`supabase/seed.sql`:

```sql
-- Fake rates so local and staging have something to convert with. Never real user data.
insert into public.rates (base, value, date, source) values
  ('EUR', 1.16, current_date, 'api'), ('RUB', 0.011911, current_date, 'api'), ('KZT', 0.002218, current_date, 'api'),
  ('UZS', 0.0000847, current_date, 'api'), ('BTC', 77389.36, current_date, 'api'), ('USDT', 1, current_date, 'api')
on conflict do nothing;
```

- [ ] **Step 6: Apply and inspect**

```bash
supabase db reset
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "\d public.rates" -c "select count(*) from public.currencies"
```

Expected: `rates` shows the unique index and RLS enabled; `currencies` count = 19.

- [ ] **Step 7: RLS test (executed by Task 8's `test:integration`)**

`supabase/test/rls.test.ts`:

```ts
import { describe, expect, it, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!; const anon = process.env.SUPABASE_ANON_KEY!; const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function userClient(email: string) {
  const admin = createClient(url, service);
  const { data } = await admin.auth.admin.createUser({ email, password: 'pw-123456', email_confirm: true });
  const c = createClient(url, anon);
  await c.auth.signInWithPassword({ email, password: 'pw-123456' });
  return { c, id: data.user!.id };
}

describe('RLS', () => {
  let a: Awaited<ReturnType<typeof userClient>>; let b: typeof a;
  beforeAll(async () => { a = await userClient(`a-${Date.now()}@test.local`); b = await userClient(`b-${Date.now()}@test.local`); });

  it('creates a profile on signup and hides it from others', async () => {
    expect((await a.c.from('profiles').select('id').eq('id', a.id)).data).toHaveLength(1);
    expect((await b.c.from('profiles').select('id').eq('id', a.id)).data).toHaveLength(0);
  });

  it('shares api rates but isolates manual rates', async () => {
    await a.c.from('rates').insert({ base: 'RUB', value: '0.0123', date: '2026-01-01', source: 'manual', user_id: a.id });
    const seen = (await b.c.from('rates').select('source').eq('date', '2026-01-01')).data ?? [];
    expect(seen.every((r) => r.source === 'api')).toBe(true);
    const mine = (await a.c.from('rates').select('source').eq('date', '2026-01-01').eq('source', 'manual')).data ?? [];
    expect(mine).toHaveLength(1);
  });

  it('refuses a manual rate for another user', async () => {
    const { error } = await a.c.from('rates').insert({ base: 'RUB', value: '1', date: '2026-01-02', source: 'manual', user_id: b.id });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 8: Commit** — `/git-commit`: `feat(db): add profiles, currencies and rates migrations with RLS and fake seed`

---

### Task 7: `apps/api` skeleton — Hono app, env, logger, errors, OpenAPI, health

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/shared/env.ts`, `apps/api/src/shared/logger.ts`, `apps/api/src/shared/errors/http.ts`, `apps/api/src/shared/openapi.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/api/index.ts`, `apps/api/vercel.ts`
- Test: `apps/api/test/app.test.ts`, `apps/api/test/errors.test.ts`

**Interfaces:**
- Produces: `createApp(deps: AppDeps): OpenAPIHono<AppEnv>` where `AppEnv = { Variables: { userId: string; requestId: string } }`; `AppDeps = { profiles: ProfileRepository; rates: RateRepository; rateProviders: RateProvider[]; clock: Clock; jwtSecret: string; cronSecret: string }` (repository interfaces defined in Tasks 9–10; in this task `AppDeps` only needs `jwtSecret`, `cronSecret`, `clock`; extend later); `toHttpError(e: DomainError | NotFoundError | ForbiddenError): { status: number; body: ErrorDto }`.

- [ ] **Step 1: Package files**

`apps/api/package.json`:

```json
{
  "name": "@magermoney/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test"
  },
  "dependencies": {
    "hono": "^4.13.7", "@hono/zod-openapi": "^1.6.3", "@hono/swagger-ui": "^0.6.1", "@hono/node-server": "^2.1.1",
    "zod": "^4.6.2", "postgres": "^3.4.9", "jose": "^6.2.12", "pino": "^10.3.1", "neverthrow": "^8.2.0", "decimal.js": "^10.6.0",
    "@magermoney/domain": "workspace:*", "@magermoney/contracts": "workspace:*"
  },
  "devDependencies": { "vitest": "^5.0.0", "@supabase/supabase-js": "^2.116.0", "@types/node": "^24.0.0", "@vercel/config": "^0.7.0" }
}
```

`tsconfig.json`: extends base, `"types": ["node"]`, `include: ["src", "test", "api", "vercel.ts"]`. `tsconfig.build.json`: same but `"outDir": "dist"`, `"noEmit": false`, `include: ["src", "api"]`.

`vitest.config.ts`: `include: ['test/**/*.test.ts']`. `vitest.integration.config.ts`: `include: ['test/integration/**/*.test.ts', '../../supabase/test/**/*.test.ts']`, `testTimeout: 20000`.

- [ ] **Step 2: Failing tests**

`apps/api/test/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';

describe('app', () => {
  const app = createApp(testDeps({ clock: new FixedClock(new Date('2026-09-11T10:00:00Z')) }));

  it('answers health with the clock date', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, date: '2026-09-11' });
  });

  it('serves the OpenAPI document', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    expect((await res.json()).info.title).toBe('Magermoney API');
  });

  it('returns a JSON error body for unknown routes', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: 'NOT_FOUND', message: 'Route not found' });
  });
});
```

`apps/api/test/helpers/deps.ts` (helper, grows in later tasks):

```ts
import { SystemClock, type Clock } from '@magermoney/domain';
import type { AppDeps } from '../../src/app.js';
export function testDeps(over: Partial<AppDeps> = {}): AppDeps {
  return { clock: new SystemClock() as Clock, jwtSecret: 'test-secret-test-secret-test-secret-1234', cronSecret: 'cron', ...over } as AppDeps;
}
```

`apps/api/test/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RateMissingError, UnknownCurrencyError } from '@magermoney/domain';
import { NotFoundError, toHttpError } from '../src/shared/errors/http.js';

describe('toHttpError', () => {
  it('maps domain errors to statuses', () => {
    expect(toHttpError(new RateMissingError('KZT', 'USD', '2026-01-01')).status).toBe(422);
    expect(toHttpError(new UnknownCurrencyError('XYZ')).status).toBe(400);
    expect(toHttpError(new NotFoundError('profile'))).toEqual({ status: 404, body: { code: 'NOT_FOUND', message: 'profile not found' } });
  });
});
```

- [ ] **Step 3: Run, expect failure** — `cd apps/api && bun install && bunx vitest run` → FAIL.

- [ ] **Step 4: Implement**

`src/shared/env.ts`:

```ts
import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(8),
  FIAT_RATES_URL: z.string().url().default('https://open.er-api.com/v6/latest/USD'),
  CRYPTO_RATES_URL: z.string().url().default('https://api.coingecko.com/api/v3/simple/price'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});
export type Env = z.infer<typeof schema>;
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => schema.parse(source);
```

`src/shared/logger.ts`:

```ts
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: ['req.headers.authorization', 'email', '*.email', 'amount', '*.amount', 'value', '*.value'], censor: '[redacted]' },
});
```

`src/shared/errors/http.ts`:

```ts
import { DomainError, RateMissingError, UnknownCurrencyError, CurrencyMismatchError, InvalidAmountError } from '@magermoney/domain';
import type { ErrorDto } from '@magermoney/contracts';

export class NotFoundError extends Error { readonly code = 'NOT_FOUND'; constructor(readonly what: string) { super(`${what} not found`); } }
export class UnauthorizedError extends Error { readonly code = 'UNAUTHORIZED'; constructor() { super('Sign in required'); } }

export type AppError = DomainError | NotFoundError | UnauthorizedError;

export function toHttpError(e: AppError): { status: 400 | 401 | 404 | 422 | 500; body: ErrorDto } {
  if (e instanceof NotFoundError) return { status: 404, body: { code: e.code, message: e.message } };
  if (e instanceof UnauthorizedError) return { status: 401, body: { code: e.code, message: e.message } };
  if (e instanceof RateMissingError) return { status: 422, body: { code: e.code, message: e.message } };
  if (e instanceof UnknownCurrencyError || e instanceof CurrencyMismatchError || e instanceof InvalidAmountError)
    return { status: 400, body: { code: e.code, message: e.message } };
  return { status: 500, body: { code: 'INTERNAL', message: 'Unexpected error' } };
}
```

`src/shared/openapi.ts`:

```ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import type { AppEnv } from '../app.js';
export function mountOpenApi(app: OpenAPIHono<AppEnv>, exposeUi: boolean) {
  app.doc('/openapi.json', { openapi: '3.1.0', info: { title: 'Magermoney API', version: '0.1.0' } });
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
  if (exposeUi) app.get('/docs', swaggerUI({ url: '/openapi.json' }));
}
```

`src/app.ts`:

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import type { Clock } from '@magermoney/domain';
import { mountOpenApi } from './shared/openapi.js';
import { logger } from './shared/logger.js';

export type AppEnv = { Variables: { userId: string; requestId: string } };
export interface AppDeps { clock: Clock; jwtSecret: string; cronSecret: string; exposeDocs?: boolean }

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: (result, c) => {
    if (!result.success) return c.json({ code: 'VALIDATION', message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);
  } });
  app.use('*', requestId());
  app.use('*', cors({ origin: (o) => o, credentials: true }));
  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Route not found' }, 404));
  app.onError((e, c) => { logger.error({ err: e, requestId: c.get('requestId') }, 'unhandled'); return c.json({ code: 'INTERNAL', message: 'Unexpected error' }, 500); });

  app.openapi(createRoute({ method: 'get', path: '/health', responses: { 200: { description: 'ok', content: { 'application/json': { schema: z.object({ ok: z.boolean(), date: z.string() }) } } } } }),
    (c) => c.json({ ok: true, date: deps.clock.today() }, 200));

  mountOpenApi(app, deps.exposeDocs ?? true);
  return app;
}
```

`src/index.ts` (local dev):

```ts
import { serve } from '@hono/node-server';
import { SystemClock } from '@magermoney/domain';
import { createApp } from './app.js';
import { loadEnv } from './shared/env.js';
const env = loadEnv();
const app = createApp({ clock: new SystemClock(), jwtSecret: env.SUPABASE_JWT_SECRET, cronSecret: env.CRON_SECRET, exposeDocs: env.NODE_ENV !== 'production' });
serve({ fetch: app.fetch, port: 3000 }, (i) => console.log(`api on http://localhost:${i.port}`));
```

`api/index.ts` (Vercel entry):

```ts
import { handle } from 'hono/vercel';
import { SystemClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/shared/env.js';
const env = loadEnv();
const app = createApp({ clock: new SystemClock(), jwtSecret: env.SUPABASE_JWT_SECRET, cronSecret: env.CRON_SECRET, exposeDocs: env.NODE_ENV !== 'production' });
export default handle(app);
```

`vercel.ts`:

```ts
import { routes, type VercelConfig } from '@vercel/config/v1';
export const config: VercelConfig = {
  framework: null,
  rewrites: [routes.rewrite('/(.*)', '/api')],
  crons: [{ path: '/jobs/rates?kind=fiat', schedule: '15 6 * * *' }, { path: '/jobs/rates?kind=crypto', schedule: '5 * * * *' }],
};
```

- [ ] **Step 5: Run, expect pass** — `bunx vitest run` → 4 passed. Then `bun run dev` and `curl localhost:3000/health` → `{"ok":true,"date":"..."}`; open `http://localhost:3000/docs`.

- [ ] **Step 6: Commit** — `/git-commit`: `feat(api): scaffold Hono app with OpenAPI, error mapping and health route`

---

### Task 8: `apps/api` — Supabase JWT auth middleware and DB client

**Files:**
- Create: `apps/api/src/shared/auth/jwt.ts`, `apps/api/src/shared/auth/middleware.ts`, `apps/api/src/shared/db/client.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/auth.test.ts`, `apps/api/test/helpers/token.ts`

**Interfaces:**
- Produces: `verifySupabaseJwt(token, secret): Promise<Result<{ userId: string }, UnauthorizedError>>`; `requireUser(secret): MiddlewareHandler<AppEnv>` which sets `c.var.userId`; `createDb(url): Sql` (postgres.js instance with `transform: postgres.camel`, `types` mapping `numeric` → string); test helper `signTestToken(userId, secret)`.

- [ ] **Step 1: Failing test**

`apps/api/test/helpers/token.ts`:

```ts
import { SignJWT } from 'jose';
export const signTestToken = (sub: string, secret: string, exp = '1h') =>
  new SignJWT({ role: 'authenticated', aud: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuedAt().setExpirationTime(exp).sign(new TextEncoder().encode(secret));
```

`apps/api/test/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { requireUser } from '../src/shared/auth/middleware.js';
import { signTestToken } from './helpers/token.js';
import type { AppEnv } from '../src/app.js';

const secret = 'test-secret-test-secret-test-secret-1234';
const app = new OpenAPIHono<AppEnv>();
app.use('/me', requireUser(secret));
app.get('/me', (c) => c.json({ userId: c.var.userId }));

describe('requireUser', () => {
  it('rejects a missing token', async () => {
    const res = await app.request('/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: 'UNAUTHORIZED', message: 'Sign in required' });
  });
  it('rejects a token signed with another secret', async () => {
    const t = await signTestToken('u1', 'x'.repeat(40));
    expect((await app.request('/me', { headers: { authorization: `Bearer ${t}` } })).status).toBe(401);
  });
  it('rejects an expired token', async () => {
    const t = await signTestToken('u1', secret, '-1s');
    expect((await app.request('/me', { headers: { authorization: `Bearer ${t}` } })).status).toBe(401);
  });
  it('accepts a valid token and exposes userId', async () => {
    const t = await signTestToken('11111111-1111-1111-1111-111111111111', secret);
    const res = await app.request('/me', { headers: { authorization: `Bearer ${t}` } });
    expect(await res.json()).toEqual({ userId: '11111111-1111-1111-1111-111111111111' });
  });
});
```

- [ ] **Step 2: Run, expect failure** — `bunx vitest run test/auth.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/shared/auth/jwt.ts`:

```ts
import { jwtVerify } from 'jose';
import { err, ok, type Result } from 'neverthrow';
import { UnauthorizedError } from '../errors/http.js';
export async function verifySupabaseJwt(token: string, secret: string): Promise<Result<{ userId: string }, UnauthorizedError>> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], audience: 'authenticated' });
    return typeof payload.sub === 'string' ? ok({ userId: payload.sub }) : err(new UnauthorizedError());
  } catch { return err(new UnauthorizedError()); }
}
```

`src/shared/auth/middleware.ts`:

```ts
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../../app.js';
import { toHttpError, UnauthorizedError } from '../errors/http.js';
import { verifySupabaseJwt } from './jwt.js';
export const requireUser = (secret: string): MiddlewareHandler<AppEnv> => async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const verified = token ? await verifySupabaseJwt(token, secret) : undefined;
  if (!verified || verified.isErr()) { const { status, body } = toHttpError(new UnauthorizedError()); return c.json(body, status); }
  c.set('userId', verified.value.userId);
  await next();
};
```

`src/shared/db/client.ts`:

```ts
import postgres from 'postgres';
export type Sql = ReturnType<typeof createDb>;
export const createDb = (url: string) => postgres(url, {
  transform: postgres.camel, max: 5, idle_timeout: 20, prepare: false,
  types: { numeric: { to: 1700, from: [1700], serialize: (v: string) => v, parse: (v: string) => v } },
});
```

(`prepare: false` because Supabase's pooler in transaction mode does not support prepared statements; `numeric` stays a string so `Money.parse` receives exact text.)

- [ ] **Step 4: Run, expect pass** — 4 passed.

- [ ] **Step 5: Commit** — `/git-commit`: `feat(api): verify Supabase JWT and expose a numeric-safe postgres client`

---

### Task 9: `apps/api` — profiles module (`GET/PATCH /me`)

**Files:**
- Create: `apps/api/src/modules/profiles/application/profile-repository.ts`, `.../application/get-profile.ts`, `.../application/update-profile.ts`, `.../infrastructure/pg-profile-repository.ts`, `.../infrastructure/memory-profile-repository.ts`, `.../http/routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/test/helpers/deps.ts`
- Test: `apps/api/test/profiles.test.ts`, `apps/api/test/integration/pg-profile-repository.test.ts`

**Interfaces:**
- Produces: `interface Profile { id: string; displayName: string | null; locale: 'ru' | 'en'; defaultCurrency: string; reportingCurrencies: string[]; onboardingCompletedAt: string | null }`; `interface ProfileRepository { findById(id): Promise<Profile | null>; update(id, patch: Partial<Omit<Profile,'id'>>): Promise<Profile | null> }`; `getProfile(repo)(userId): Promise<Result<Profile, NotFoundError>>`; `updateProfile(repo, registry)(userId, input: UpdateProfileInput): Promise<Result<Profile, NotFoundError | UnknownCurrencyError>>`; `profileRoutes(deps): OpenAPIHono<AppEnv>` mounted at `/me`. `AppDeps` gains `profiles: ProfileRepository`.

- [ ] **Step 1: Failing tests**

`apps/api/test/profiles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MemoryProfileRepository } from '../src/modules/profiles/infrastructure/memory-profile-repository.js';
import { testDeps } from './helpers/deps.js';
import { signTestToken } from './helpers/token.js';

const uid = '11111111-1111-1111-1111-111111111111';
const secret = 'test-secret-test-secret-test-secret-1234';
const auth = async () => ({ authorization: `Bearer ${await signTestToken(uid, secret)}`, 'content-type': 'application/json' });

function setup() {
  const profiles = new MemoryProfileRepository([{ id: uid, displayName: null, locale: 'ru', defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD', 'RUB'], onboardingCompletedAt: null }]);
  return { app: createApp(testDeps({ profiles, jwtSecret: secret })), profiles };
}

describe('/me', () => {
  it('returns the caller profile', async () => {
    const { app } = setup();
    const res = await app.request('/me', { headers: await auth() });
    expect(res.status).toBe(200);
    expect((await res.json()).defaultCurrency).toBe('EUR');
  });
  it('404s when the profile row is missing', async () => {
    const app = createApp(testDeps({ profiles: new MemoryProfileRepository([]), jwtSecret: secret }));
    expect((await app.request('/me', { headers: await auth() })).status).toBe(404);
  });
  it('updates reporting currencies and default', async () => {
    const { app } = setup();
    const res = await app.request('/me', { method: 'PATCH', headers: await auth(), body: JSON.stringify({ reportingCurrencies: ['USD', 'KZT'], defaultCurrency: 'KZT' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ reportingCurrencies: ['USD', 'KZT'], defaultCurrency: 'KZT' });
  });
  it('rejects an unknown currency with 400', async () => {
    const { app } = setup();
    const res = await app.request('/me', { method: 'PATCH', headers: await auth(), body: JSON.stringify({ reportingCurrencies: ['USD', 'XYZ'] }) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('UNKNOWN_CURRENCY');
  });
  it('rejects a default outside the reporting list with 400', async () => {
    const { app } = setup();
    const res = await app.request('/me', { method: 'PATCH', headers: await auth(), body: JSON.stringify({ reportingCurrencies: ['USD'], defaultCurrency: 'EUR' }) });
    expect(res.status).toBe(400);
  });
});
```

`apps/api/test/integration/pg-profile-repository.test.ts`:

```ts
import { describe, expect, it, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';
import { PgProfileRepository } from '../../src/modules/profiles/infrastructure/pg-profile-repository.js';

describe('PgProfileRepository', () => {
  const sql = createDb(process.env.DATABASE_URL!);
  const repo = new PgProfileRepository(sql);
  let id: string;
  beforeAll(async () => {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.auth.admin.createUser({ email: `p-${Date.now()}@test.local`, password: 'pw-123456', email_confirm: true });
    id = data.user!.id;
  });
  it('reads the trigger-created profile and updates it', async () => {
    expect((await repo.findById(id))?.locale).toBe('ru');
    const updated = await repo.update(id, { locale: 'en', reportingCurrencies: ['USD'], defaultCurrency: 'USD' });
    expect(updated).toMatchObject({ locale: 'en', reportingCurrencies: ['USD'], defaultCurrency: 'USD' });
    expect(await repo.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure** — `bunx vitest run test/profiles.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`application/profile-repository.ts`:

```ts
export interface Profile { id: string; displayName: string | null; locale: 'ru' | 'en'; defaultCurrency: string; reportingCurrencies: string[]; onboardingCompletedAt: string | null }
export type ProfilePatch = Partial<Omit<Profile, 'id'>>;
export interface ProfileRepository { findById(id: string): Promise<Profile | null>; update(id: string, patch: ProfilePatch): Promise<Profile | null> }
```

`application/get-profile.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { Profile, ProfileRepository } from './profile-repository.js';
export const getProfile = (repo: ProfileRepository) => async (userId: string): Promise<Result<Profile, NotFoundError>> => {
  const p = await repo.findById(userId);
  return p ? ok(p) : err(new NotFoundError('profile'));
};
```

`application/update-profile.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { type CurrencyRegistry, UnknownCurrencyError } from '@magermoney/domain';
import type { UpdateProfileInput } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { Profile, ProfileRepository } from './profile-repository.js';

export const updateProfile = (repo: ProfileRepository, registry: CurrencyRegistry) =>
  async (userId: string, input: UpdateProfileInput): Promise<Result<Profile, NotFoundError | UnknownCurrencyError>> => {
    for (const code of [...(input.reportingCurrencies ?? []), ...(input.defaultCurrency ? [input.defaultCurrency] : [])]) {
      if (!registry.has(code)) return err(new UnknownCurrencyError(code));
    }
    const current = await repo.findById(userId);
    if (!current) return err(new NotFoundError('profile'));
    const reporting = input.reportingCurrencies ?? current.reportingCurrencies;
    const def = input.defaultCurrency ?? current.defaultCurrency;
    if (!reporting.includes(def)) return err(new UnknownCurrencyError(`${def} is not in reporting currencies`));
    const updated = await repo.update(userId, { ...input, reportingCurrencies: reporting, defaultCurrency: def });
    return updated ? ok(updated) : err(new NotFoundError('profile'));
  };
```

`infrastructure/memory-profile-repository.ts`:

```ts
import type { Profile, ProfilePatch, ProfileRepository } from '../application/profile-repository.js';
export class MemoryProfileRepository implements ProfileRepository {
  private rows: Map<string, Profile>;
  constructor(seed: Profile[]) { this.rows = new Map(seed.map((p) => [p.id, p])); }
  async findById(id: string) { return this.rows.get(id) ?? null; }
  async update(id: string, patch: ProfilePatch) {
    const cur = this.rows.get(id); if (!cur) return null;
    const next = { ...cur, ...patch }; this.rows.set(id, next); return next;
  }
}
```

`infrastructure/pg-profile-repository.ts`:

```ts
import type { Sql } from '../../../shared/db/client.js';
import type { Profile, ProfilePatch, ProfileRepository } from '../application/profile-repository.js';
const cols = 'id, display_name, locale, default_currency, reporting_currencies, onboarding_completed_at';
export class PgProfileRepository implements ProfileRepository {
  constructor(private readonly sql: Sql) {}
  async findById(id: string): Promise<Profile | null> {
    const [row] = await this.sql<Profile[]>`select ${this.sql.unsafe(cols)} from profiles where id = ${id}`;
    return row ?? null;
  }
  async update(id: string, patch: ProfilePatch): Promise<Profile | null> {
    const data: Record<string, unknown> = {};
    if (patch.displayName !== undefined) data.display_name = patch.displayName;
    if (patch.locale !== undefined) data.locale = patch.locale;
    if (patch.defaultCurrency !== undefined) data.default_currency = patch.defaultCurrency;
    if (patch.reportingCurrencies !== undefined) data.reporting_currencies = patch.reportingCurrencies;
    if (patch.onboardingCompletedAt !== undefined) data.onboarding_completed_at = patch.onboardingCompletedAt;
    if (Object.keys(data).length === 0) return this.findById(id);
    const [row] = await this.sql<Profile[]>`update profiles set ${this.sql(data)} where id = ${id} returning ${this.sql.unsafe(cols)}`;
    return row ?? null;
  }
}
```

`http/routes.ts`:

```ts
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { ErrorDtoSchema, ProfileDtoSchema, UpdateProfileInputSchema } from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { toHttpError } from '../../../shared/errors/http.js';
import { getProfile } from '../application/get-profile.js';
import { updateProfile } from '../application/update-profile.js';

const errors = { 400: { description: 'Bad request', content: { 'application/json': { schema: ErrorDtoSchema } } }, 401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorDtoSchema } } }, 404: { description: 'Not found', content: { 'application/json': { schema: ErrorDtoSchema } } } };

export function profileRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  r.use('*', requireUser(deps.jwtSecret));
  r.openapi(createRoute({ method: 'get', path: '/', security: [{ bearer: [] }], responses: { 200: { description: 'Profile', content: { 'application/json': { schema: ProfileDtoSchema } } }, ...errors } }),
    async (c) => { const res = await getProfile(deps.profiles)(c.var.userId); return res.match((p) => c.json(p, 200), (e) => { const h = toHttpError(e); return c.json(h.body, h.status as 404); }); });
  r.openapi(createRoute({ method: 'patch', path: '/', security: [{ bearer: [] }], request: { body: { content: { 'application/json': { schema: UpdateProfileInputSchema } } } }, responses: { 200: { description: 'Updated', content: { 'application/json': { schema: ProfileDtoSchema } } }, ...errors } }),
    async (c) => { const res = await updateProfile(deps.profiles, deps.registry)(c.var.userId, c.req.valid('json')); return res.match((p) => c.json(p, 200), (e) => { const h = toHttpError(e); return c.json(h.body, h.status as 400); }); });
  return r;
}
```

`app.ts` changes: `AppDeps` gains `profiles: ProfileRepository; registry: CurrencyRegistry`; add `app.route('/me', profileRoutes(deps));`. `index.ts` and `api/index.ts` build `PgProfileRepository(createDb(env.DATABASE_URL))` and `CurrencyRegistry.default()`. `test/helpers/deps.ts` defaults `profiles: new MemoryProfileRepository([])`, `registry: CurrencyRegistry.default()`.

- [ ] **Step 4: Run** — `bunx vitest run` → all pass. Then with `supabase start` running and `.env.local` exported: `bun run test:integration` → RLS + PgProfileRepository pass.

- [ ] **Step 5: Commit** — `/git-commit`: `feat(api): add profiles module with GET and PATCH /me`

---

### Task 10: `apps/api` — currencies and rates read routes

**Files:**
- Create: `apps/api/src/modules/rates/application/rate-repository.ts`, `.../application/get-rates.ts`, `.../application/list-currencies.ts`, `.../infrastructure/memory-rate-repository.ts`, `.../infrastructure/pg-rate-repository.ts`, `.../http/routes.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/test/helpers/deps.ts`
- Test: `apps/api/test/rates-read.test.ts`, `apps/api/test/integration/pg-rate-repository.test.ts`

**Interfaces:**
- Produces: `interface RateRow { base: string; quote: 'USD'; value: string; date: string; source: 'api' | 'manual'; userId: string | null }`; `interface RateRepository { latestOnOrBefore(date, userId): Promise<RateRow[]>; upsertMany(rows: Omit<RateRow,'quote'>[]): Promise<number>; listCurrencies(): Promise<CurrencyDto[]> }`; `getRates(repo)(userId, date): Promise<RateDto[]>` — for each base returns the newest row with `date <= requested`, where a user's manual row for the exact date beats the shared api row; `GET /currencies`, `GET /rates?date=`.

- [ ] **Step 1: Failing test**

`apps/api/test/rates-read.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { testDeps } from './helpers/deps.js';
import { signTestToken } from './helpers/token.js';

const uid = '11111111-1111-1111-1111-111111111111'; const other = '22222222-2222-2222-2222-222222222222';
const secret = 'test-secret-test-secret-test-secret-1234';
const auth = async () => ({ authorization: `Bearer ${await signTestToken(uid, secret)}` });
const rates = new MemoryRateRepository([
  { base: 'EUR', quote: 'USD', value: '1.15', date: '2026-09-09', source: 'api', userId: null },
  { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-10', source: 'api', userId: null },
  { base: 'RUB', quote: 'USD', value: '0.0119', date: '2026-09-10', source: 'api', userId: null },
  { base: 'RUB', quote: 'USD', value: '0.0120', date: '2026-09-10', source: 'manual', userId: uid },
  { base: 'KZT', quote: 'USD', value: '0.0022', date: '2026-09-10', source: 'manual', userId: other },
]);
const app = createApp(testDeps({ rates, jwtSecret: secret, clock: new FixedClock(new Date('2026-09-11T00:00:00Z')) }));

describe('GET /rates', () => {
  it('returns the newest rate per base on or before the date, manual beating api for the caller', async () => {
    const res = await app.request('/rates?date=2026-09-10', { headers: await auth() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.find((r: { base: string }) => r.base === 'EUR')).toMatchObject({ value: '1.16', source: 'api' });
    expect(body.find((r: { base: string }) => r.base === 'RUB')).toMatchObject({ value: '0.0120', source: 'manual' });
    expect(body.find((r: { base: string }) => r.base === 'KZT')).toBeUndefined();
  });
  it('defaults to today and falls back to older rates', async () => {
    const body = await (await app.request('/rates', { headers: await auth() })).json();
    expect(body.find((r: { base: string }) => r.base === 'EUR').date).toBe('2026-09-10');
  });
  it('lists currencies', async () => {
    const body = await (await app.request('/currencies', { headers: await auth() })).json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('scale');
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

`application/rate-repository.ts`:

```ts
import type { CurrencyDto } from '@magermoney/contracts';
export interface RateRow { base: string; quote: 'USD'; value: string; date: string; source: 'api' | 'manual'; userId: string | null }
export interface RateRepository {
  latestOnOrBefore(date: string, userId: string): Promise<RateRow[]>;   // all candidate rows visible to userId with date <= date
  upsertMany(rows: Omit<RateRow, 'quote'>[]): Promise<number>;
  listCurrencies(): Promise<CurrencyDto[]>;
}
```

`application/get-rates.ts`:

```ts
import type { RateDto } from '@magermoney/contracts';
import type { RateRepository, RateRow } from './rate-repository.js';
// Pick per base: newest date wins; on the same date a manual row (owned by the caller) beats api.
export const pickLatest = (rows: RateRow[]): RateDto[] => {
  const best = new Map<string, RateRow>();
  for (const r of rows) {
    const cur = best.get(r.base);
    if (!cur || r.date > cur.date || (r.date === cur.date && r.source === 'manual' && cur.source === 'api')) best.set(r.base, r);
  }
  return [...best.values()].map(({ base, quote, value, date, source }) => ({ base, quote, value, date, source }));
};
export const getRates = (repo: RateRepository) => async (userId: string, date: string): Promise<RateDto[]> => pickLatest(await repo.latestOnOrBefore(date, userId));
```

`application/list-currencies.ts`: `export const listCurrencies = (repo: RateRepository) => () => repo.listCurrencies();`

`infrastructure/memory-rate-repository.ts`:

```ts
import type { CurrencyDto } from '@magermoney/contracts';
import { DEFAULT_CURRENCIES } from '@magermoney/domain';
import type { RateRepository, RateRow } from '../application/rate-repository.js';
export class MemoryRateRepository implements RateRepository {
  constructor(public rows: RateRow[] = []) {}
  async latestOnOrBefore(date: string, userId: string) { return this.rows.filter((r) => r.date <= date && (r.userId === null || r.userId === userId)); }
  async upsertMany(rows: Omit<RateRow, 'quote'>[]) {
    let n = 0;
    for (const r of rows) {
      const i = this.rows.findIndex((x) => x.base === r.base && x.date === r.date && x.source === r.source && x.userId === r.userId);
      if (i >= 0) this.rows[i] = { ...r, quote: 'USD' }; else { this.rows.push({ ...r, quote: 'USD' }); n++; }
    }
    return n;
  }
  async listCurrencies(): Promise<CurrencyDto[]> { return DEFAULT_CURRENCIES.map((c) => ({ code: c.code, kind: c.kind, scale: c.scale, symbol: c.symbol ?? null, nameRu: null, nameEn: null, icon: null })); }
}
```

`infrastructure/pg-rate-repository.ts`:

```ts
import type { CurrencyDto } from '@magermoney/contracts';
import type { Sql } from '../../../shared/db/client.js';
import type { RateRepository, RateRow } from '../application/rate-repository.js';
export class PgRateRepository implements RateRepository {
  constructor(private readonly sql: Sql) {}
  async latestOnOrBefore(date: string, userId: string): Promise<RateRow[]> {
    return this.sql<RateRow[]>`
      select distinct on (base, source) base, quote, value::text as value, to_char(date, 'YYYY-MM-DD') as date, source, user_id
      from rates where date <= ${date} and (user_id is null or user_id = ${userId})
      order by base, source, date desc`;
  }
  async upsertMany(rows: Omit<RateRow, 'quote'>[]): Promise<number> {
    if (rows.length === 0) return 0;
    const res = await this.sql`
      insert into rates ${this.sql(rows.map((r) => ({ base: r.base, value: r.value, date: r.date, source: r.source, user_id: r.userId })))}
      on conflict (base, quote, date, source, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update set value = excluded.value`;
    return res.count;
  }
  async listCurrencies(): Promise<CurrencyDto[]> {
    return this.sql<CurrencyDto[]>`select code, kind, scale, symbol, name_ru, name_en, icon from currencies order by kind, code`;
  }
}
```

`http/routes.ts` (rates module) registers `GET /currencies` and `GET /rates` (query `RatesQuerySchema`, default `deps.clock.today()`), both behind `requireUser`, responses `z.array(CurrencyDtoSchema)` / `z.array(RateDtoSchema)`. Mount in `app.ts`: `app.route('/', ratesRoutes(deps))`. `AppDeps` gains `rates: RateRepository`; `testDeps` defaults `rates: new MemoryRateRepository()`; `index.ts`/`api/index.ts` use `PgRateRepository(sql)`.

`test/integration/pg-rate-repository.test.ts`: insert two api rows for `EUR` on different dates through `upsertMany`, call `latestOnOrBefore('2026-09-10', anyUuid)`, expect the newer one; call `upsertMany` again with the same key and a new value, expect the value updated and no duplicate.

- [ ] **Step 4: Run unit and integration tests, expect pass.**

- [ ] **Step 5: Commit** — `/git-commit`: `feat(api): add currencies and rates read endpoints`

---

### Task 11: `apps/api` — rate providers, fetch job, manual override

**Files:**
- Create: `apps/api/src/modules/rates/application/rate-provider.ts`, `.../application/fetch-rates.ts`, `.../application/set-manual-rate.ts`, `.../infrastructure/open-er-api-provider.ts`, `.../infrastructure/coingecko-provider.ts`, `apps/api/src/jobs/fetch-rates.ts`
- Modify: `apps/api/src/modules/rates/http/routes.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/api/index.ts`, `apps/api/test/helpers/deps.ts`
- Test: `apps/api/test/fetch-rates.test.ts`, `apps/api/test/providers.test.ts`, `apps/api/test/manual-rate.test.ts`

**Interfaces:**
- Produces: `interface RateProvider { kind: 'fiat' | 'crypto'; fetch(codes: string[]): Promise<Result<{ base: string; value: string }[], ProviderError>> }` (values are "1 base = value USD"); `fetchRates(repo, providers, registry, clock)(kind): Promise<Result<{ stored: number }, ProviderError>>`; `setManualRate(repo, registry)(userId, input: ManualRateInput): Promise<Result<RateDto, UnknownCurrencyError>>`; routes `POST /jobs/rates?kind=fiat|crypto` (header `authorization: Bearer <CRON_SECRET>`), `PUT /rates/manual` (user JWT). `AppDeps` gains `rateProviders: RateProvider[]`.

- [ ] **Step 1: Failing tests**

`apps/api/test/providers.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { OpenErApiProvider } from '../src/modules/rates/infrastructure/open-er-api-provider.js';
import { CoinGeckoProvider } from '../src/modules/rates/infrastructure/coingecko-provider.js';

describe('providers', () => {
  it('open.er-api: inverts USD-based quotes into 1 base = x USD, exactly as strings', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ result: 'success', rates: { USD: 1, EUR: 0.862069, UZS: 11802.79 } })));
    const p = new OpenErApiProvider('https://x', fetcher);
    const out = (await p.fetch(['EUR', 'UZS', 'XXX']))._unsafeUnwrap();
    expect(out).toEqual([{ base: 'EUR', value: '1.16' }, { base: 'UZS', value: '0.0000847258' }]);
  });
  it('open.er-api: fails on non-success', async () => {
    const p = new OpenErApiProvider('https://x', async () => new Response('{"result":"error"}', { status: 500 }));
    expect((await p.fetch(['EUR'])).isErr()).toBe(true);
  });
  it('coingecko: maps tickers to ids and back', async () => {
    const fetcher = vi.fn(async (url: string) => { expect(url).toContain('ids=bitcoin%2Ctether'); return new Response(JSON.stringify({ bitcoin: { usd: 77389.36 }, tether: { usd: 1.0004 } })); });
    const p = new CoinGeckoProvider('https://cg', fetcher);
    expect((await p.fetch(['BTC', 'USDT']))._unsafeUnwrap()).toEqual([{ base: 'BTC', value: '77389.36' }, { base: 'USDT', value: '1.0004' }]);
  });
});
```

(Precision note: `1 / 0.862069` = 1.15999… → round to 10 significant digits then strip zeros → `1.16`; `1 / 11802.79` → `0.0000847258`. The provider uses `Decimal` with `toSignificantDigits(10)`.)

`apps/api/test/fetch-rates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ok, err } from 'neverthrow';
import { CurrencyRegistry, FixedClock } from '@magermoney/domain';
import { fetchRates } from '../src/modules/rates/application/fetch-rates.js';
import { ProviderError } from '../src/modules/rates/application/rate-provider.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';

const clock = new FixedClock(new Date('2026-09-11T06:15:00Z'));
const fiat = { kind: 'fiat' as const, fetch: async () => ok([{ base: 'EUR', value: '1.16' }, { base: 'RUB', value: '0.0119' }]) };
const broken = { kind: 'crypto' as const, fetch: async () => err(new ProviderError('coingecko', 'boom')) };

describe('fetchRates', () => {
  it('stores today\'s api rates for the requested kind only', async () => {
    const repo = new MemoryRateRepository();
    const res = await fetchRates(repo, [fiat, broken], CurrencyRegistry.default(), clock)('fiat');
    expect(res._unsafeUnwrap()).toEqual({ stored: 2 });
    expect(repo.rows).toEqual([
      { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api', userId: null },
      { base: 'RUB', quote: 'USD', value: '0.0119', date: '2026-09-11', source: 'api', userId: null },
    ]);
  });
  it('propagates provider failure', async () => {
    expect((await fetchRates(new MemoryRateRepository(), [broken], CurrencyRegistry.default(), clock)('crypto')).isErr()).toBe(true);
  });
  it('POST /jobs/rates requires the cron secret', async () => {
    const app = createApp(testDeps({ rateProviders: [fiat], clock }));
    expect((await app.request('/jobs/rates?kind=fiat', { method: 'POST' })).status).toBe(401);
    const ok2 = await app.request('/jobs/rates?kind=fiat', { method: 'POST', headers: { authorization: 'Bearer cron' } });
    expect(ok2.status).toBe(200);
    expect(await ok2.json()).toEqual({ stored: 2 });
  });
});
```

`apps/api/test/manual-rate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { testDeps } from './helpers/deps.js';
import { signTestToken } from './helpers/token.js';
const uid = '11111111-1111-1111-1111-111111111111'; const secret = 'test-secret-test-secret-test-secret-1234';
describe('PUT /rates/manual', () => {
  it('stores a manual rate for the caller and returns it', async () => {
    const rates = new MemoryRateRepository();
    const app = createApp(testDeps({ rates, jwtSecret: secret }));
    const res = await app.request('/rates/manual', { method: 'PUT', headers: { authorization: `Bearer ${await signTestToken(uid, secret)}`, 'content-type': 'application/json' }, body: JSON.stringify({ base: 'RUB', date: '2026-09-10', value: '0.011855' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ base: 'RUB', quote: 'USD', value: '0.011855', date: '2026-09-10', source: 'manual' });
    expect(rates.rows[0]?.userId).toBe(uid);
  });
  it('400s on an unknown currency', async () => {
    const app = createApp(testDeps({ jwtSecret: secret }));
    const res = await app.request('/rates/manual', { method: 'PUT', headers: { authorization: `Bearer ${await signTestToken(uid, secret)}`, 'content-type': 'application/json' }, body: JSON.stringify({ base: 'XYZ', date: '2026-09-10', value: '1' }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

`application/rate-provider.ts`:

```ts
import type { Result } from 'neverthrow';
export class ProviderError extends Error { readonly code = 'PROVIDER_FAILED'; constructor(readonly provider: string, detail: string) { super(`${provider}: ${detail}`); } }
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export interface RateProvider { kind: 'fiat' | 'crypto'; fetch(codes: string[]): Promise<Result<{ base: string; value: string }[], ProviderError>> }
```

`infrastructure/open-er-api-provider.ts`:

```ts
import Decimal from 'decimal.js';
import { err, ok } from 'neverthrow';
import { ProviderError, type Fetcher, type RateProvider } from '../application/rate-provider.js';
export class OpenErApiProvider implements RateProvider {
  readonly kind = 'fiat' as const;
  constructor(private readonly url: string, private readonly fetcher: Fetcher = fetch) {}
  async fetch(codes: string[]) {
    try {
      const res = await this.fetcher(this.url);
      if (!res.ok) return err(new ProviderError('open.er-api', `HTTP ${res.status}`));
      const body = (await res.json()) as { result: string; rates?: Record<string, number> };
      if (body.result !== 'success' || !body.rates) return err(new ProviderError('open.er-api', 'result not success'));
      const out: { base: string; value: string }[] = [];
      for (const code of codes) {
        const perUsd = body.rates[code];
        if (typeof perUsd === 'number' && perUsd > 0 && code !== 'USD') out.push({ base: code, value: new Decimal(1).div(perUsd).toSignificantDigits(10).toFixed() });
      }
      return ok(out);
    } catch (e) { return err(new ProviderError('open.er-api', String(e))); }
  }
}
```

`infrastructure/coingecko-provider.ts`:

```ts
import Decimal from 'decimal.js';
import { err, ok } from 'neverthrow';
import { ProviderError, type Fetcher, type RateProvider } from '../application/rate-provider.js';
export const COINGECKO_IDS: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', XRP: 'ripple', SOL: 'solana', DOGE: 'dogecoin', PEPE: 'pepe', AVAX: 'avalanche-2', ATOM: 'cosmos', TRX: 'tron' };
export class CoinGeckoProvider implements RateProvider {
  readonly kind = 'crypto' as const;
  constructor(private readonly url: string, private readonly fetcher: Fetcher = fetch) {}
  async fetch(codes: string[]) {
    const known = codes.filter((c) => COINGECKO_IDS[c]);
    if (known.length === 0) return ok([]);
    const ids = known.map((c) => COINGECKO_IDS[c]!).join(',');
    try {
      const res = await this.fetcher(`${this.url}?ids=${encodeURIComponent(ids)}&vs_currencies=usd&precision=full`);
      if (!res.ok) return err(new ProviderError('coingecko', `HTTP ${res.status}`));
      const body = (await res.json()) as Record<string, { usd?: number }>;
      return ok(known.flatMap((c) => { const v = body[COINGECKO_IDS[c]!]?.usd; return typeof v === 'number' && v > 0 ? [{ base: c, value: new Decimal(v).toFixed() }] : []; }));
    } catch (e) { return err(new ProviderError('coingecko', String(e))); }
  }
}
```

`application/fetch-rates.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import type { Clock, CurrencyRegistry } from '@magermoney/domain';
import type { RateRepository } from './rate-repository.js';
import type { ProviderError, RateProvider } from './rate-provider.js';
export const fetchRates = (repo: RateRepository, providers: RateProvider[], registry: CurrencyRegistry, clock: Clock) =>
  async (kind: 'fiat' | 'crypto'): Promise<Result<{ stored: number }, ProviderError>> => {
    const codes = registry.all().filter((c) => c.kind === kind).map((c) => c.code);
    const today = clock.today();
    let stored = 0;
    for (const p of providers.filter((p) => p.kind === kind)) {
      const res = await p.fetch(codes);
      if (res.isErr()) return err(res.error);
      stored += await repo.upsertMany(res.value.map((r) => ({ ...r, date: today, source: 'api' as const, userId: null })));
    }
    return ok({ stored });
  };
```

`application/set-manual-rate.ts`:

```ts
import { err, ok, type Result } from 'neverthrow';
import { type CurrencyRegistry, UnknownCurrencyError } from '@magermoney/domain';
import type { ManualRateInput, RateDto } from '@magermoney/contracts';
import type { RateRepository } from './rate-repository.js';
export const setManualRate = (repo: RateRepository, registry: CurrencyRegistry) =>
  async (userId: string, input: ManualRateInput): Promise<Result<RateDto, UnknownCurrencyError>> => {
    if (!registry.has(input.base)) return err(new UnknownCurrencyError(input.base));
    await repo.upsertMany([{ base: input.base, value: input.value, date: input.date, source: 'manual', userId }]);
    return ok({ base: input.base, quote: 'USD', value: input.value, date: input.date, source: 'manual' });
  };
```

`jobs/fetch-rates.ts` exposes `jobRoutes(deps)` with `POST /jobs/rates` that checks `authorization === \`Bearer ${deps.cronSecret}\`` (401 otherwise), validates `kind` via `z.enum(['fiat','crypto'])`, runs `fetchRates`, returns `{ stored }` or 502 with `{ code: 'PROVIDER_FAILED', message }`. Note: Vercel Cron sends `authorization: Bearer $CRON_SECRET` automatically when the `CRON_SECRET` env var exists.

Add `PUT /rates/manual` to the rates routes (body `ManualRateInputSchema`, response `RateDtoSchema`). Wire providers in `index.ts` / `api/index.ts`: `[new OpenErApiProvider(env.FIAT_RATES_URL), new CoinGeckoProvider(env.CRYPTO_RATES_URL)]`. `testDeps` defaults `rateProviders: []`.

- [ ] **Step 4: Run, expect pass.** Then locally: `curl -X POST -H "authorization: Bearer $CRON_SECRET" "localhost:3000/jobs/rates?kind=fiat"` → `{"stored":8}`; `curl ... "?kind=crypto"` → `{"stored":10}`. Verify UZS, KGS, GEL, EGP came back (spec risk 11).

- [ ] **Step 5: Commit** — `/git-commit`: `feat(api): fetch fiat and crypto rates on a cron and allow manual overrides`

---

### Task 12: `packages/ui` — design system base (shadcn-vue, tokens, CurrencyIcon, motion)

Run `/frontend-design` before this task to settle the visual direction (palette, type, radius, motion character) and write it to `docs/design/direction.md`. This task implements tokens from that document; the values below are placeholders to be replaced by the direction doc's values.

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/components.json`, `packages/ui/src/styles/tokens.css`, `packages/ui/src/styles/index.css`, `packages/ui/src/lib/utils.ts`, `packages/ui/src/components/ui/**` (generated), `packages/ui/src/components/currency-icon/CurrencyIcon.vue`, `packages/ui/src/components/currency-icon/resolve-icon.ts`, `packages/ui/src/motion/presets.ts`, `packages/ui/src/index.ts`, `docs/design/direction.md`
- Test: `packages/ui/test/resolve-icon.test.ts`, `packages/ui/test/CurrencyIcon.test.ts`

**Interfaces:**
- Produces: `@magermoney/ui` exporting `Button, Input, Select*, Card*, Sheet*, Toaster + useToast, Skeleton, CurrencyIcon`, `cn()`, `motion presets { fadeUp, scaleIn, listStagger }`, and `@magermoney/ui/styles` (CSS entry). `resolveCurrencyIcon({ code, kind, icon?, country? }): { kind: 'iconify'; name: string } | { kind: 'initials'; text: string }`.

- [ ] **Step 1: Package and shadcn-vue init**

`packages/ui/package.json`:

```json
{
  "name": "@magermoney/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./styles": "./src/styles/index.css" },
  "scripts": { "test": "vitest run", "typecheck": "vue-tsc --noEmit", "lint": "eslint src test" },
  "dependencies": { "vue": "^3.5.42", "reka-ui": "^2.10.4", "motion-v": "^2.4.2", "class-variance-authority": "^0.7.1", "clsx": "^2.1.1", "tailwind-merge": "^3.3.0", "lucide-vue-next": "^0.544.0", "@vueuse/core": "^13.9.0" },
  "devDependencies": { "tailwindcss": "^4.3.3", "@tailwindcss/vite": "^4.3.3", "unplugin-icons": "^24.0.0", "@iconify-json/cryptocurrency-color": "^1.2.4", "@iconify-json/circle-flags": "^1.2.11", "@iconify-json/lucide": "^1.2.131", "vitest": "^5.0.0", "@vue/test-utils": "^2.5.0", "happy-dom": "^18.0.0", "vue-tsc": "^3.0.0", "vite": "^7.1.0", "@vitejs/plugin-vue": "^6.0.0" }
}
```

```bash
cd packages/ui && bun install
bunx shadcn-vue@latest init --defaults --css src/styles/index.css --base-color neutral
```

Answer prompts: TypeScript yes, framework Vite, components alias `@/components`, utils `@/lib/utils`. Then add the base set through the MCP (or CLI equivalent):

```bash
bunx shadcn-vue@latest add button input select card sheet sonner skeleton
```

- [ ] **Step 2: Tokens**

`src/styles/tokens.css` (values from `docs/design/direction.md`; example shape):

```css
@import "tailwindcss";
@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
  --radius-sm: 0.5rem; --radius-md: 0.75rem; --radius-lg: 1rem;
  --color-bg: oklch(0.985 0.004 250); --color-surface: oklch(1 0 0); --color-ink: oklch(0.22 0.02 260);
  --color-muted: oklch(0.55 0.02 260); --color-line: oklch(0.9 0.01 260);
  --color-accent: oklch(0.6 0.14 170); --color-accent-fg: oklch(0.99 0 0);
  --color-positive: oklch(0.65 0.15 150); --color-negative: oklch(0.6 0.19 25); --color-warning: oklch(0.75 0.15 80);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --duration-fast: 150ms; --duration-base: 240ms; --duration-slow: 400ms;
}
:root[data-theme="dark"], :root:not([data-theme="light"]) { @media (prefers-color-scheme: dark) { /* dark overrides for the same tokens */ } }
:root[data-theme="dark"] { --color-bg: oklch(0.17 0.01 260); --color-surface: oklch(0.21 0.012 260); --color-ink: oklch(0.95 0.005 260); --color-muted: oklch(0.7 0.015 260); --color-line: oklch(0.3 0.01 260); }
@media (prefers-reduced-motion: reduce) { :root { --duration-fast: 0ms; --duration-base: 0ms; --duration-slow: 0ms; } }
```

`src/styles/index.css` imports `tokens.css` and the shadcn-generated layer, then maps shadcn's `--background/--foreground/--primary…` variables to the tokens above so components inherit the palette.

- [ ] **Step 3: CurrencyIcon — failing tests**

`test/resolve-icon.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveCurrencyIcon } from '../src/components/currency-icon/resolve-icon.js';
describe('resolveCurrencyIcon', () => {
  it('uses a circle flag for fiat by country', () => {
    expect(resolveCurrencyIcon({ code: 'USD', kind: 'fiat' })).toEqual({ kind: 'iconify', name: 'circle-flags:us' });
    expect(resolveCurrencyIcon({ code: 'EUR', kind: 'fiat' })).toEqual({ kind: 'iconify', name: 'circle-flags:european-union' });
    expect(resolveCurrencyIcon({ code: 'UZS', kind: 'fiat' })).toEqual({ kind: 'iconify', name: 'circle-flags:uz' });
  });
  it('uses cryptocurrency-color by ticker for crypto', () => {
    expect(resolveCurrencyIcon({ code: 'BTC', kind: 'crypto' })).toEqual({ kind: 'iconify', name: 'cryptocurrency-color:btc' });
  });
  it('prefers an explicit override', () => {
    expect(resolveCurrencyIcon({ code: 'PEPE', kind: 'crypto', icon: 'local:pepe' })).toEqual({ kind: 'iconify', name: 'local:pepe' });
  });
  it('falls back to initials for unknown fiat', () => {
    expect(resolveCurrencyIcon({ code: 'ZZZ', kind: 'fiat' })).toEqual({ kind: 'initials', text: 'ZZ' });
  });
});
```

`test/CurrencyIcon.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CurrencyIcon from '../src/components/currency-icon/CurrencyIcon.vue';
describe('CurrencyIcon', () => {
  it('renders initials with an accessible label when no icon exists', () => {
    const w = mount(CurrencyIcon, { props: { code: 'ZZZ', kind: 'fiat', size: 20 } });
    expect(w.text()).toBe('ZZ');
    expect(w.attributes('aria-label')).toBe('ZZZ');
  });
});
```

- [ ] **Step 4: Implement**

`src/components/currency-icon/resolve-icon.ts`:

```ts
const FIAT_FLAG: Record<string, string> = { USD: 'us', EUR: 'european-union', RUB: 'ru', KZT: 'kz', UZS: 'uz', IDR: 'id', EGP: 'eg', GEL: 'ge', KGS: 'kg', GBP: 'gb', TRY: 'tr', AED: 'ae', CNY: 'cn', JPY: 'jp', CHF: 'ch', PLN: 'pl', CZK: 'cz', AMD: 'am', BYN: 'by', UAH: 'ua', THB: 'th', VND: 'vn' };
const CRYPTO_KNOWN = new Set(['btc', 'eth', 'usdt', 'xrp', 'sol', 'doge', 'avax', 'atom', 'trx', 'bnb', 'ada', 'dot', 'ltc', 'matic', 'link', 'usdc']);
export type ResolvedIcon = { kind: 'iconify'; name: string } | { kind: 'initials'; text: string };
export function resolveCurrencyIcon(c: { code: string; kind: 'fiat' | 'crypto'; icon?: string | null }): ResolvedIcon {
  if (c.icon) return { kind: 'iconify', name: c.icon };
  if (c.kind === 'fiat' && FIAT_FLAG[c.code]) return { kind: 'iconify', name: `circle-flags:${FIAT_FLAG[c.code]}` };
  if (c.kind === 'crypto' && CRYPTO_KNOWN.has(c.code.toLowerCase())) return { kind: 'iconify', name: `cryptocurrency-color:${c.code.toLowerCase()}` };
  return { kind: 'initials', text: c.code.slice(0, 2).toUpperCase() };
}
```

`CurrencyIcon.vue` renders `<Icon :icon="name">` from `@iconify/vue` for the iconify case (add `@iconify/vue` and the two JSON sets registered offline via `addCollection` in `src/index.ts`, so no runtime network), otherwise a `<span role="img" :aria-label="code">` circle with initials, size prop in px, `rounded-full` with `bg-line text-ink`.

`src/motion/presets.ts`:

```ts
export const fadeUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.24, ease: [0.25, 1, 0.5, 1] } } as const;
export const scaleIn = { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.2, ease: [0.25, 1, 0.5, 1] } } as const;
export const listStagger = (i: number) => ({ ...fadeUp, transition: { ...fadeUp.transition, delay: i * 0.04 } });
```

`src/index.ts` re-exports components, `cn`, presets, `CurrencyIcon`, and registers icon collections.

- [ ] **Step 5: Run tests, expect pass.** `bunx vitest run` → 5 passed. Run `/impeccable` on `CurrencyIcon.vue` and the token file.

- [ ] **Step 6: Commit** — `/git-commit`: `feat(ui): bootstrap design system with tokens, shadcn-vue base set, CurrencyIcon and motion presets`

---

### Task 13: `apps/web` skeleton — Vite, router, i18n, TanStack Query, PWA, theme, shell

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/app/main.ts`, `apps/web/src/app/App.vue`, `apps/web/src/app/router.ts`, `apps/web/src/app/i18n.ts`, `apps/web/src/app/query.ts`, `apps/web/src/app/theme.ts`, `apps/web/src/shared/layout/AppShell.vue`, `apps/web/src/shared/money/format.ts`, `apps/web/src/shared/api/client.ts`, `apps/web/src/locales/ru.json`, `apps/web/src/locales/en.json`, `apps/web/public/icons/*` (PWA icons 192/512/maskable), `apps/web/vercel.ts`, `apps/web/vitest.config.ts`
- Test: `apps/web/test/format.test.ts`, `apps/web/test/theme.test.ts`

**Interfaces:**
- Produces: `formatMoney(amount: string, code: string, locale: 'ru'|'en', opts?: { scale?: number; symbol?: string | null; hide?: boolean }): string`; `useTheme(): { theme: Ref<'system'|'light'|'dark'>; set(t) }`; `createApiClient(getToken: () => Promise<string | null>): { fetch(path, init?): Promise<Response> }` (adds `Authorization`, base URL `VITE_API_URL`); router with routes `/` (home), `/settings`, `/sign-in`; `queryClient` with IndexedDB persister (`idb-keyval`) and `networkMode: 'offlineFirst'`.

- [ ] **Step 1: Package and Vite config**

`apps/web/package.json` dependencies: `vue`, `vue-router ^5.3.1`, `pinia ^4.0.3`, `vue-i18n ^11.4.10`, `@tanstack/vue-query ^5.102.8`, `@tanstack/query-persist-client-core`, `@tanstack/query-async-storage-persister`, `idb-keyval ^6.3.0`, `@supabase/supabase-js ^2.116.0`, `@vueuse/core`, `motion-v`, `@magermoney/domain`, `@magermoney/contracts`, `@magermoney/ui`. Dev: `vite ^7.1`, `@vitejs/plugin-vue`, `vite-plugin-pwa ^1.3.0`, `@tailwindcss/vite`, `unplugin-icons`, `vue-tsc`, `vitest`, `@vue/test-utils`, `happy-dom`, `@playwright/test ^1.63.0`, `@vercel/config`. Scripts: `dev: vite`, `build: vue-tsc --noEmit && vite build`, `preview`, `test: vitest run`, `test:e2e: playwright test`, `typecheck: vue-tsc --noEmit`, `lint`.

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import Icons from 'unplugin-icons/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue(), tailwindcss(), Icons({ compiler: 'vue3' }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { name: 'Magermoney', short_name: 'Magermoney', start_url: '/', display: 'standalone', background_color: '#101418', theme_color: '#101418',
        icons: [{ src: '/icons/192.png', sizes: '192x192', type: 'image/png' }, { src: '/icons/512.png', sizes: '512x512', type: 'image/png' }, { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] },
      workbox: { navigateFallback: '/index.html', runtimeCaching: [{ urlPattern: ({ url }) => url.origin === import.meta.env.VITE_API_URL, handler: 'NetworkFirst', options: { cacheName: 'api', networkTimeoutSeconds: 4 } }] },
    })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
});
```

`vercel.ts`: `{ framework: 'vite', rewrites: [routes.rewrite('/(.*)', '/index.html')] }` plus a header `Cache-Control: no-cache` for `/sw.js`.

- [ ] **Step 2: Failing tests**

`test/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatMoney } from '../src/shared/money/format.js';
describe('formatMoney', () => {
  it('formats fiat with Intl per locale', () => {
    expect(formatMoney('1234.5', 'EUR', 'ru')).toBe('1 234,50 €');
    expect(formatMoney('1234.5', 'USD', 'en')).toBe('$1,234.50');
  });
  it('formats crypto with the given scale and symbol', () => {
    expect(formatMoney('0.01570000', 'BTC', 'en', { scale: 8, symbol: '₿' })).toBe('₿0.0157');
    expect(formatMoney('24715', 'USDT', 'ru', { scale: 2, symbol: '₮' })).toBe('24 715,00 ₮');
  });
  it('hides digits when asked', () => {
    expect(formatMoney('1234.5', 'EUR', 'ru', { hide: true })).toBe('•••• €');
  });
});
```

(Intl uses non-breaking spaces; compare with `.replace(/ | /g, ' ')` inside the test helper if needed.)

`test/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyTheme } from '../src/app/theme.js';
describe('applyTheme', () => {
  it('stamps data-theme for explicit choices and clears it for system', () => {
    applyTheme('dark'); expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('system'); expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
```

- [ ] **Step 3: Implement**

`src/shared/money/format.ts`:

```ts
export function formatMoney(amount: string, code: string, locale: 'ru' | 'en', opts: { scale?: number; symbol?: string | null; hide?: boolean } = {}): string {
  const n = Number(amount); // display only; exact value stays in Money
  const isIso = /^[A-Z]{3}$/.test(code) && opts.symbol == null;
  if (isIso) {
    const f = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
    if (!opts.hide) return f.format(n);
    return f.formatToParts(n).map((p) => (['integer', 'group', 'decimal', 'fraction'].includes(p.type) ? '' : p.value)).join('').replace(/\s+/g, ' ').trim().replace(/^/, '•••• ').replace('••••  ', '•••• ');
  }
  const scale = opts.scale ?? 2;
  const f = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: Math.min(2, scale), maximumFractionDigits: scale });
  const digits = opts.hide ? '••••' : f.format(n);
  const sym = opts.symbol ?? code;
  return locale === 'ru' ? `${digits} ${sym}` : `${sym}${digits}`;
}
```

`src/app/theme.ts`:

```ts
import { ref, watchEffect } from 'vue';
export type Theme = 'system' | 'light' | 'dark';
export function applyTheme(t: Theme) { if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }
const theme = ref<Theme>((localStorage.getItem('theme') as Theme) ?? 'system');
export function useTheme() { watchEffect(() => { applyTheme(theme.value); localStorage.setItem('theme', theme.value); }); return { theme, set: (t: Theme) => (theme.value = t) }; }
```

`src/app/query.ts`:

```ts
import { QueryClient } from '@tanstack/vue-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 7 * 24 * 3_600_000, networkMode: 'offlineFirst', retry: 1 }, mutations: { networkMode: 'offlineFirst' } } });
persistQueryClient({ queryClient, persister: createAsyncStoragePersister({ storage: { getItem: (k) => get(k), setItem: (k, v) => set(k, v), removeItem: (k) => del(k) } }), maxAge: 7 * 24 * 3_600_000 });
```

`src/app/i18n.ts`: `createI18n({ legacy: false, locale: 'ru', fallbackLocale: 'en', messages: { ru, en } })`. `src/app/router.ts`: `createRouter({ history: createWebHistory(), routes })` with lazy imports from module `index.ts` files (`/` → `modules/rates` HomePage, `/settings` → `modules/profile` SettingsPage, `/sign-in` → `modules/auth` SignInPage), `meta: { public: true }` on sign-in; the auth guard is added in Task 14.

`src/shared/api/client.ts`:

```ts
export type GetToken = () => Promise<string | null>;
export function createApiClient(base: string, getToken: GetToken) {
  return { async fetch(path: string, init: RequestInit = {}) {
    const token = await getToken();
    const headers = new Headers(init.headers); if (token) headers.set('authorization', `Bearer ${token}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    return fetch(`${base}${path}`, { ...init, headers });
  } };
}
```

`AppShell.vue`: top bar with app name, currency switch slot (filled in Task 16), theme toggle, bottom tab bar on mobile (Home, Settings). `App.vue` renders `<AppShell><RouterView /></AppShell>`. `main.ts` mounts Pinia, router, i18n, `VueQueryPlugin` with `queryClient`, imports `@magermoney/ui/styles`, registers the PWA (`virtual:pwa-register`).

`locales/ru.json` / `en.json` minimal keys: `app.name`, `nav.home`, `nav.settings`, `theme.system|light|dark`, `home.greeting` ("Привет, {name}" / "Hi, {name}"), `home.sample` ("Пример суммы" / "Sample amount"). Run `/humanize-text:humanize-text` on the JSON files.

- [ ] **Step 4: Run** — `bunx vitest run` → pass; `bun run dev` → shell renders at `http://localhost:5173`, manifest served at `/manifest.webmanifest`; `bun run build` succeeds and `dist/sw.js` exists.

- [ ] **Step 5: Commit** — `/git-commit`: `feat(web): scaffold Vue PWA shell with router, i18n, query persistence and theme`

---

### Task 14: `apps/web` — auth module (Supabase sign-in, guard)

**Files:**
- Create: `apps/web/src/modules/auth/index.ts`, `.../auth/domain/session.ts`, `.../auth/application/use-session.ts`, `.../auth/infrastructure/supabase.ts`, `.../auth/infrastructure/session-store.ts`, `.../auth/ui/SignInPage.vue`, `.../auth/ui/AuthCallbackPage.vue`
- Modify: `apps/web/src/app/router.ts`, `apps/web/src/app/main.ts`
- Test: `apps/web/test/auth-guard.test.ts`

**Interfaces:**
- Produces: `useSession(): { user: Ref<{ id: string; email: string | null } | null>; ready: Ref<boolean>; signInWithGoogle(): Promise<void>; signInWithMagicLink(email): Promise<Result<void, Error>>; signOut(): Promise<void>; getAccessToken(): Promise<string | null> }`; `authGuard(session): NavigationGuard` (redirects to `/sign-in` when no user and route is not `public`); route `/auth/callback`.

- [ ] **Step 1: Failing test**

`test/auth-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { authGuard } from '../src/modules/auth/application/auth-guard.js';
const mk = (user: null | { id: string }) => authGuard({ user: ref(user), ready: ref(true) });
describe('authGuard', () => {
  it('redirects anonymous users to sign-in with a redirect back', () => {
    expect(mk(null)({ path: '/settings', fullPath: '/settings', meta: {} } as never, {} as never)).toEqual({ name: 'sign-in', query: { redirect: '/settings' } });
  });
  it('lets public routes through and signed-in users everywhere', () => {
    expect(mk(null)({ path: '/sign-in', fullPath: '/sign-in', meta: { public: true } } as never, {} as never)).toBe(true);
    expect(mk({ id: 'u' })({ path: '/', fullPath: '/', meta: {} } as never, {} as never)).toBe(true);
  });
  it('sends signed-in users away from sign-in', () => {
    expect(mk({ id: 'u' })({ path: '/sign-in', fullPath: '/sign-in', meta: { public: true }, name: 'sign-in' } as never, {} as never)).toEqual({ path: '/' });
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

`infrastructure/supabase.ts`: `export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } })`.

`infrastructure/session-store.ts` (Pinia): state `user`, `ready`; `init()` calls `supabase.auth.getSession()` then `onAuthStateChange` to keep `user` in sync.

`application/auth-guard.ts`:

```ts
import type { Ref } from 'vue';
import type { NavigationGuardWithThis, RouteLocationNormalized } from 'vue-router';
export const authGuard = (s: { user: Ref<{ id: string } | null>; ready: Ref<boolean> }): NavigationGuardWithThis<undefined> => (to: RouteLocationNormalized) => {
  const isPublic = Boolean(to.meta.public);
  if (s.user.value && to.name === 'sign-in') return { path: '/' };
  if (!s.user.value && !isPublic) return { name: 'sign-in', query: { redirect: to.fullPath } };
  return true;
};
```

`application/use-session.ts` wraps the store: `signInWithGoogle` → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } })`; `signInWithMagicLink(email)` → `signInWithOtp({ email, options: { emailRedirectTo } })` returning `Result`; `getAccessToken` → `(await supabase.auth.getSession()).data.session?.access_token ?? null`.

`ui/SignInPage.vue`: run `/design-taste-frontend` for this page only. Google button, email field + "Send link", success state "Check your inbox". `ui/AuthCallbackPage.vue`: calls `supabase.auth.exchangeCodeForSession(location.href)` then routes to `redirect` or `/`.

Router: `router.beforeEach(authGuard(store))` after `await store.init()` in `main.ts` (mount only after `ready`). `main.ts` passes `createApiClient(import.meta.env.VITE_API_URL, session.getAccessToken)` via `provide('api', client)`.

- [ ] **Step 4: Run tests; manual check** — `bunx vitest run` → pass. With local Supabase: open `/sign-in`, send a magic link, open Inbucket at `http://127.0.0.1:54324`, click the link, land on `/`. Sign-out from settings returns to `/sign-in`.

- [ ] **Step 5: Commit** — `/git-commit`: `feat(web): add Supabase sign-in with Google and magic link, route guard`

---

### Task 15: `apps/web` — profile module (settings)

**Files:**
- Create: `apps/web/src/modules/profile/index.ts`, `.../profile/domain/profile.ts`, `.../profile/application/use-profile.ts`, `.../profile/infrastructure/profile-api.ts`, `.../profile/ui/SettingsPage.vue`, `.../profile/ui/CurrencyListEditor.vue`
- Modify: `apps/web/src/locales/*.json`
- Test: `apps/web/test/profile-api.test.ts`, `apps/web/test/use-profile.test.ts`

**Interfaces:**
- Produces: `useProfile(): { profile: Ref<ProfileDto | undefined>; isLoading; update(input: UpdateProfileInput): Promise<void> }` (TanStack `useQuery(['me'])` + `useMutation` with optimistic update and rollback); `useCurrencies(): Ref<CurrencyDto[]>` (`['currencies']`, staleTime 24 h); `profileApi(client): { get(): Promise<ProfileDto>; update(input): Promise<ProfileDto> }` validating responses with `ProfileDtoSchema`.

- [ ] **Step 1: Failing tests**

`test/profile-api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { profileApi } from '../src/modules/profile/infrastructure/profile-api.js';
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const profile = { id: '11111111-1111-1111-1111-111111111111', displayName: null, locale: 'ru', defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD'], onboardingCompletedAt: null };
describe('profileApi', () => {
  it('gets and validates the profile', async () => {
    const client = { fetch: vi.fn(async () => ok(profile)) };
    expect(await profileApi(client).get()).toEqual(profile);
    expect(client.fetch).toHaveBeenCalledWith('/me', expect.anything());
  });
  it('throws a typed ApiError on failure', async () => {
    const client = { fetch: vi.fn(async () => ok({ code: 'UNAUTHORIZED', message: 'Sign in required' }, 401)) };
    await expect(profileApi(client).get()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });
  it('rejects a malformed body', async () => {
    const client = { fetch: vi.fn(async () => ok({ nope: 1 })) };
    await expect(profileApi(client).get()).rejects.toThrow();
  });
});
```

`test/use-profile.test.ts` mounts a tiny component using `useProfile` with `VueQueryPlugin` and a mocked `api` provide; asserts optimistic update: after `update({ defaultCurrency: 'USD' })` the ref shows `USD` before the mocked fetch resolves, and rolls back to `EUR` if the fetch rejects.

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

`src/shared/api/client.ts` gains `export class ApiError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }` and a helper `parse<T>(res, schema): Promise<T>` that throws `ApiError` for non-2xx (reading `ErrorDtoSchema`) and validates 2xx bodies.

`infrastructure/profile-api.ts`:

```ts
import { ProfileDtoSchema, type ProfileDto, type UpdateProfileInput } from '@magermoney/contracts';
import { parse, type ApiClient } from '@/shared/api/client';
export const profileApi = (client: ApiClient) => ({
  get: async (): Promise<ProfileDto> => parse(await client.fetch('/me'), ProfileDtoSchema),
  update: async (input: UpdateProfileInput): Promise<ProfileDto> => parse(await client.fetch('/me', { method: 'PATCH', body: JSON.stringify(input) }), ProfileDtoSchema),
});
```

`application/use-profile.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { ProfileDto, UpdateProfileInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { profileApi } from '../infrastructure/profile-api';
export function useProfile() {
  const api = profileApi(useApi()); const qc = useQueryClient();
  const query = useQuery({ queryKey: ['me'], queryFn: api.get });
  const mutation = useMutation({
    mutationFn: api.update,
    onMutate: async (input) => { await qc.cancelQueries({ queryKey: ['me'] }); const prev = qc.getQueryData<ProfileDto>(['me']); if (prev) qc.setQueryData(['me'], { ...prev, ...input }); return { prev }; },
    onError: (_e, _i, ctx) => { if (ctx?.prev) qc.setQueryData(['me'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
  return { profile: query.data, isLoading: query.isLoading, update: (input: UpdateProfileInput) => mutation.mutateAsync(input).then(() => undefined) };
}
```

`ui/SettingsPage.vue` (run `/frontend-design` then `/impeccable`): display name, language (ru/en, switches `i18n.locale` immediately), theme (system/light/dark), reporting currencies editor (`CurrencyListEditor.vue`: multi-select from `useCurrencies()` with `CurrencyIcon`, drag order optional, default currency radio limited to the chosen list), sign-out button. Errors shown via toast with the `ApiError.message`.

- [ ] **Step 4: Run** — `bunx vitest run` → pass. Manual: change default currency, reload, it sticks; go offline (devtools), change again, go online, PATCH is sent.

- [ ] **Step 5: Commit** — `/git-commit`: `feat(web): add profile settings with reporting currencies and optimistic updates`

---

### Task 16: `apps/web` — rates module, Display currency switch, home screen

**Files:**
- Create: `apps/web/src/modules/rates/index.ts`, `.../rates/domain/index.ts`, `.../rates/application/use-rates.ts`, `.../rates/application/use-display-currency.ts`, `.../rates/infrastructure/rates-api.ts`, `.../rates/ui/CurrencySwitch.vue`, `.../rates/ui/HomePage.vue`, `.../rates/ui/MoneyText.vue`
- Modify: `apps/web/src/shared/layout/AppShell.vue`, `apps/web/src/app/router.ts`, locales
- Test: `apps/web/test/use-display-currency.test.ts`, `apps/web/test/MoneyText.test.ts`

**Interfaces:**
- Produces: `useRates(date?): { table: Ref<RateTable | undefined>; isLoading }` (query `['rates', date]`, builds `RateTable` from `RateDto[]` with `CurrencyRegistry` derived from `useCurrencies()`); `useDisplayCurrency(): { current: Ref<string>; options: Ref<string[]>; set(code) }` — `options` from profile `reportingCurrencies`, `current` initialised from profile `defaultCurrency`, persisted per device in `localStorage('displayCurrency')` if it is still in `options`; `convertToDisplay(money: Money): Result<Money, RateMissingError | UnknownCurrencyError>`; `<MoneyText :amount :currency />` renders converted + formatted value with a subtle motion on change.

- [ ] **Step 1: Failing tests**

`test/use-display-currency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { createDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
describe('display currency', () => {
  it('starts from the profile default and only accepts listed options', () => {
    const profile = ref({ defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD', 'RUB'] });
    const d = createDisplayCurrency(profile, { get: () => null, set: () => {} });
    expect(d.current.value).toBe('EUR');
    d.set('USD'); expect(d.current.value).toBe('USD');
    d.set('KZT'); expect(d.current.value).toBe('USD');
  });
  it('restores a remembered choice when still listed, else falls back', () => {
    const profile = ref({ defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD'] });
    expect(createDisplayCurrency(profile, { get: () => 'USD', set: () => {} }).current.value).toBe('USD');
    expect(createDisplayCurrency(profile, { get: () => 'KZT', set: () => {} }).current.value).toBe('EUR');
  });
});
```

`test/MoneyText.test.ts` mounts `MoneyText` with a provided fake `RateTable` (EUR 1.16) and display currency `USD`, props `amount="100" currency="EUR"`, expects text `$116.00`; with display `KZT` and no rate expects the fallback text `—` and a `title` containing `KZT`.

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

`application/use-display-currency.ts`:

```ts
import { computed, ref, watch, type Ref } from 'vue';
type Storage = { get(): string | null; set(v: string): void };
export function createDisplayCurrency(profile: Ref<{ defaultCurrency: string; reportingCurrencies: string[] } | undefined>, storage: Storage) {
  const options = computed(() => profile.value?.reportingCurrencies ?? []);
  const pick = () => { const saved = storage.get(); return saved && options.value.includes(saved) ? saved : (profile.value?.defaultCurrency ?? 'USD'); };
  const current = ref(pick());
  watch(options, () => { if (!options.value.includes(current.value)) current.value = pick(); });
  const set = (code: string) => { if (options.value.includes(code)) { current.value = code; storage.set(code); } };
  return { current, options, set };
}
export function useDisplayCurrency() { /* singleton over useProfile().profile with localStorage-backed Storage */ }
```

`application/use-rates.ts`: `useQuery({ queryKey: ['rates', date], queryFn: () => ratesApi(api).list(date) })`, `table = computed(() => data && registry ? new RateTable(date, data.map(toRate), registry) : undefined)` where `toRate` builds `Decimal` from the string. Registry comes from `useCurrencies()` mapped to `Currency[]` (so newly added currencies in the DB are known without a release).

`ui/CurrencySwitch.vue`: segmented control of `options` with `CurrencyIcon` + code, animated indicator (`motion-v` layout animation, run `/animate`). Placed in `AppShell` header slot.

`ui/MoneyText.vue`: props `amount: string`, `currency: string`; injects `useRates().table` and `useDisplayCurrency().current`; computes `convert` and renders `formatMoney(...)` with the currency's `scale`/`symbol` from `useCurrencies()`; on change, a 240 ms fade-up of the new value (`fadeUp` preset). If conversion fails, renders `—` with `title="No rate for KZT on 2026-09-11"`.

`ui/HomePage.vue` (run `/frontend-design` then `/impeccable`): greeting (`home.greeting` with display name or email local part), a card "Sample amount" showing `MoneyText amount="1000" currency="EUR"` and the rate date, and an empty-state hint that accounts arrive in the next phase (copy through i18n; run `/humanize-text:humanize-text`).

- [ ] **Step 4: Run** — unit tests pass; manual: switch EUR → USD → RUB on the home card, values change instantly; offline reload still shows the last values.

- [ ] **Step 5: Commit** — `/git-commit`: `feat(web): add display currency switch and home sample conversion`

---

### Task 17: Pre-commit hooks, CI workflows, Playwright smoke

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/db.yml`, `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`, `.husky/pre-commit`, `.lintstagedrc.json`
- Modify: root `package.json`

- [ ] **Step 1: Husky + lint-staged**

Run the `setup-pre-commit` skill. Expected result: `.husky/pre-commit` runs `bunx lint-staged`; `.lintstagedrc.json`:

```json
{ "*.{ts,vue,js}": ["eslint --fix", "prettier --write"], "*.{json,md,css,sql}": ["prettier --write"] }
```

- [ ] **Step 2: ci.yml**

```yaml
name: ci
on: { pull_request: {}, push: { branches: [main] } }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.14 }
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: bun install --frozen-lockfile
      - run: bunx turbo run lint typecheck test build
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.14 }
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: bun install --frozen-lockfile
      - run: supabase start -x studio,imgproxy,edge-runtime,logflare,vector
      - run: |
          eval "$(supabase status -o env)"
          export DATABASE_URL="$DB_URL" SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_JWT_SECRET="$JWT_SECRET" CRON_SECRET=ci-cron
          bun run --filter @magermoney/api test:integration
  e2e:
    needs: [checks]
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.14 }
      - run: bun install --frozen-lockfile
      - uses: patrickedqvist/wait-for-vercel-preview@v1.3.2
        id: preview
        with: { token: "${{ secrets.GITHUB_TOKEN }}", max_timeout: 600 }
      - run: bunx playwright install --with-deps chromium
      - run: bun run --filter @magermoney/web test:e2e
        env:
          E2E_BASE_URL: ${{ steps.preview.outputs.url }}
          E2E_API_URL: ${{ secrets.STAGING_API_URL }}
          E2E_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          E2E_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.STAGING_SUPABASE_SERVICE_ROLE_KEY }}
          E2E_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
```

- [ ] **Step 3: db.yml**

```yaml
name: db
on:
  pull_request: { paths: ['supabase/migrations/**'] }
  push: { branches: [main], paths: ['supabase/migrations/**'] }
jobs:
  lint:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start -x studio,imgproxy,edge-runtime,logflare,vector
      - run: supabase db lint --level warning
  staging:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_STAGING_REF }}
        env: { SUPABASE_ACCESS_TOKEN: "${{ secrets.SUPABASE_ACCESS_TOKEN }}", SUPABASE_DB_PASSWORD: "${{ secrets.SUPABASE_STAGING_DB_PASSWORD }}" }
      - run: supabase db push
        env: { SUPABASE_ACCESS_TOKEN: "${{ secrets.SUPABASE_ACCESS_TOKEN }}", SUPABASE_DB_PASSWORD: "${{ secrets.SUPABASE_STAGING_DB_PASSWORD }}" }
  production:
    needs: [staging]
    runs-on: ubuntu-latest
    environment: production   # requires a manual approval configured in GitHub → Settings → Environments
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROD_REF }}
        env: { SUPABASE_ACCESS_TOKEN: "${{ secrets.SUPABASE_ACCESS_TOKEN }}", SUPABASE_DB_PASSWORD: "${{ secrets.SUPABASE_PROD_DB_PASSWORD }}" }
      - run: supabase db push
        env: { SUPABASE_ACCESS_TOKEN: "${{ secrets.SUPABASE_ACCESS_TOKEN }}", SUPABASE_DB_PASSWORD: "${{ secrets.SUPABASE_PROD_DB_PASSWORD }}" }
```

- [ ] **Step 4: Playwright smoke**

`apps/web/playwright.config.ts`: `testDir: 'e2e'`, `use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173' }`, one project `chromium` with `viewport: { width: 390, height: 844 }` (iPhone width), `webServer` only when `E2E_BASE_URL` is unset.

`apps/web/e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Signs in by generating a magic link server-side (no inbox needed), then drives the UI.
test('sign in, see home, switch currency', async ({ page }) => {
  const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!);
  const email = `e2e-${Date.now()}@magermoney.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { token_hash } = data.properties!;
  const anon = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_ANON_KEY!);
  const { data: s } = await anon.auth.verifyOtp({ token_hash, type: 'magiclink' });

  await page.goto('/sign-in');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`sb-${new URL(process.env.E2E_SUPABASE_URL!).host.split('.')[0]}-auth-token`, JSON.stringify(s.session)]);
  await page.goto('/');

  await expect(page.getByTestId('home-greeting')).toBeVisible();
  const before = await page.getByTestId('sample-amount').innerText();
  await page.getByTestId('currency-switch').getByRole('button', { name: 'USD' }).click();
  await expect(page.getByTestId('sample-amount')).not.toHaveText(before);
  await expect(page.getByTestId('sample-amount')).toContainText('$');
});
```

Add `data-testid` attributes `home-greeting`, `sample-amount`, `currency-switch` to the components from Task 16.

- [ ] **Step 5: Run locally** — `bun run --filter @magermoney/web test:e2e` against `supabase start` + `bun run dev` (set the `E2E_*` vars from `supabase status -o env`). Expected: 1 passed.

- [ ] **Step 6: Commit** — `/git-commit`: `ci: add checks, integration, e2e and database workflows with pre-commit hooks`

---

### Task 18: GitHub, Supabase and Vercel projects; first production deploy

This task is operational; every step is a real command against real accounts. Nothing here is committed except the small config files noted.

**Files:**
- Create: `apps/web/.vercel/` and `apps/api/.vercel/` (ignored), `README.md`

- [ ] **Step 1: GitHub repository**

```bash
cd /Users/magersoft/Projects/magersoft/magermoney
gh repo create magersoft/magermoney --public --source=. --remote=origin --description "Personal multi-currency finance tracker: Vue 3 PWA + Hono + Supabase" --push
gh api -X PUT repos/magersoft/magermoney/branches/main/protection -f required_status_checks='{"strict":true,"contexts":["checks","integration"]}' -f enforce_admins=false -f required_pull_request_reviews='{"required_approving_review_count":0}' -f restrictions=null -F required_linear_history=true
```

- [ ] **Step 2: Supabase projects (staging, prod)**

```bash
supabase projects create magermoney-staging --org-id <ORG> --region eu-central-1 --db-password "$(openssl rand -base64 24)"
supabase projects create magermoney-prod    --org-id <ORG> --region eu-central-1 --db-password "$(openssl rand -base64 24)"
```

Save both passwords in a password manager. For each project in the Supabase dashboard: Authentication → Providers → enable Google (create OAuth client in Google Cloud Console with redirect `https://<ref>.supabase.co/auth/v1/callback`), enable Email with magic link; Authentication → URL configuration → Site URL = production web URL, additional redirect URLs = `https://*.vercel.app/auth/callback`, `http://localhost:5173/auth/callback`.

Apply migrations once to staging and prod (afterwards `db.yml` does it):

```bash
supabase link --project-ref <staging-ref> && supabase db push
supabase link --project-ref <prod-ref> && supabase db push
```

- [ ] **Step 3: Vercel projects**

```bash
cd apps/api && vercel link --yes --project magermoney-api
cd ../web && vercel link --yes --project magermoney-web
```

In the Vercel dashboard for each project: Git → connect `magersoft/magermoney`, Root Directory `apps/api` / `apps/web`, Ignored Build Step `npx turbo-ignore`, Node.js version 24. For `magermoney-api` set env vars for Production (prod Supabase) and Preview (staging Supabase): `DATABASE_URL` (use the pooler URL, port 6543, `?sslmode=require`), `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (Project Settings → API → JWT secret), `CRON_SECRET` (random), `NODE_ENV=production`. For `magermoney-web`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (`https://magermoney-api.vercel.app` for prod; for previews point at the api preview URL pattern or the staging api production URL).

GitHub secrets: `STAGING_API_URL`, `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_REF`, `SUPABASE_STAGING_DB_PASSWORD`, `SUPABASE_PROD_REF`, `SUPABASE_PROD_DB_PASSWORD`. GitHub Environments: `staging` (no rules), `production` (required reviewer: the owner).

- [ ] **Step 4: First deploy via PR**

```bash
git checkout -b chore/first-deploy
echo "# Magermoney" > README.md && printf '\nPersonal multi-currency finance tracker. See AGENTS.md for the map and CONTEXT.md for vocabulary.\n' >> README.md
git add README.md && git commit -m "docs: add README" && git push -u origin chore/first-deploy
gh pr create --fill
```

Expected: `checks`, `integration`, `e2e` green; two Vercel preview comments. Merge with `gh pr merge --squash --delete-branch`. Expected: production deploys for web and api; `db.yml` is skipped (no migration change) because migrations were pushed manually in Step 2.

- [ ] **Step 5: Verify the definition of done**

```bash
curl -s https://magermoney-api.vercel.app/health            # {"ok":true,"date":"2026-..."}
curl -s -X POST -H "authorization: Bearer $CRON_SECRET" "https://magermoney-api.vercel.app/jobs/rates?kind=fiat"    # {"stored":8}
curl -s -X POST -H "authorization: Bearer $CRON_SECRET" "https://magermoney-api.vercel.app/jobs/rates?kind=crypto"  # {"stored":10}
```

Then in the Supabase prod SQL editor: `select base, value, date from rates order by base;` → 18 rows for today. Open the production web URL on the iPhone: Add to Home Screen, sign in with Google, see the greeting, switch currency, values change. Sign in with magic link in a private window works too. Vercel Cron shows both jobs scheduled.

- [ ] **Step 6: Record**

Append to `docs/discovery/decisions-log.md`: production URLs, Supabase refs (not passwords), date of first deploy. Commit via `/git-commit`: `docs: record first production deployment`.

---

## Self-review

**Spec coverage.** §2 repo layout → Task 1; §3 domain → Tasks 2–4; §4 database → Task 6; §5 API (all six endpoints, auth, errors, OpenAPI, cron, providers, logging) → Tasks 7–11; §6 web (modules auth/profile/rates, PWA, theme, i18n, TanStack persistence, `packages/ui` base set + CurrencyIcon) → Tasks 12–16; §7 environments and CI/CD → Tasks 17–18; §8 agent guidance (`AGENTS.md`, `CLAUDE.md`, `.mcp.json`) → Task 1; §9 testing (domain 100 % + fast-check, API unit + integration, web unit, one Playwright smoke) → spread across tasks, e2e in Task 17; §10 definition of done → Task 18 Step 5; §11 risks → Task 11 Step 4 verifies fiat coverage. `docs/db/schema.dbml` already exists. Gap check: `contracts` had no task in the spec's task list but is required by §2 → Task 5.

**Placeholders.** Token values in Task 12 are explicitly placeholders replaced by `docs/design/direction.md`, which `/frontend-design` produces at the start of that task; everything else is concrete.

**Type consistency.** `AppDeps` grows across Tasks 7 → 9 → 10 → 11 (`clock, jwtSecret, cronSecret, exposeDocs, profiles, registry, rates, rateProviders`); `testDeps` mirrors it. `RateRow.value` is a string everywhere; `RateDto` omits `userId`. `Money.toString()` returns the normalised decimal (no trailing zeros) and tests are written for that. `formatMoney` takes a string amount. `resolveCurrencyIcon` input uses `icon?: string | null` to match `CurrencyDto.icon`.
