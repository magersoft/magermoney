import { readFile } from 'node:fs/promises';
import { err, ok, type Result } from 'neverthrow';
import type { Sql } from '../../src/shared/db/client.js';
import { PgAccountRepository } from '../../src/modules/accounts/infrastructure/pg-account-repository.js';
import { PgRateRepository } from '../../src/modules/rates/infrastructure/pg-rate-repository.js';
import { parseCsv } from './csv.js';
import { ImportError, mapAccounts, type MappedAccount } from './accounts-mapper.js';
import { mapRates } from './rates-mapper.js';
import { mapIncomeSources, type MappedIncomeSource } from './income-mapper.js';
import { mapInflows, type MappedInflow } from './inflows-mapper.js';
import { mapExpenses, type MappedBudget, type MappedExpense } from './expenses-mapper.js';
import { parseCurrencyOf } from './native-currency.js';

export const IMPORT_KINDS = ['accounts', 'rates', 'income', 'expenses', 'inflows'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export interface ImportArgs {
  user: string;
  accounts: string | undefined;
  rates: string | undefined;
  incomeSources: string | undefined;
  expenses: string | undefined;
  inflows: string | undefined;
  recordedAt: string | undefined;
  currencyOf: string[];
  fallbackCurrency: string;
  asBudget: string[];
  only: ImportKind[] | undefined;
  dryRun: boolean;
  force: boolean;
}

/** Date, time and a zone; `Date.parse` alone would happily accept "2026-09-11" or "yesterday" in some runtimes. */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const VALUE_FLAGS = [
  '--user',
  '--accounts',
  '--rates',
  '--income-sources',
  '--expenses',
  '--inflows',
  '--recorded-at',
  '--fallback-currency',
  '--only',
];
const REPEAT_FLAGS = ['--currency-of', '--as-budget'];
const BOOL_FLAGS = ['--dry-run', '--force'];

export function parseArgs(argv: string[]): ImportArgs {
  const values: Record<string, string> = {};
  const repeated: Record<string, string[]> = { '--currency-of': [], '--as-budget': [] };
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (VALUE_FLAGS.includes(arg) || REPEAT_FLAGS.includes(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`);
      if (REPEAT_FLAGS.includes(arg)) repeated[arg]!.push(value);
      else values[arg] = value;
      i++;
    } else if (BOOL_FLAGS.includes(arg)) {
      flags.add(arg);
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
  }
  const user = values['--user'];
  if (!user) throw new Error('--user <email> is required');
  const recordedAt = values['--recorded-at'];
  // Checked here, before anything touches the database: a mistyped date would
  // otherwise only surface as a Postgres error in the middle of the import.
  if (recordedAt !== undefined && !ISO_DATETIME.test(recordedAt))
    throw new Error(
      `--recorded-at must be an ISO datetime such as 2026-09-11T12:00:00Z, not "${recordedAt}"`,
    );
  const fallbackCurrency = values['--fallback-currency'] ?? 'EUR';
  if (!/^[A-Z0-9]{2,10}$/.test(fallbackCurrency))
    throw new Error(
      `--fallback-currency must be a currency code such as EUR, not "${fallbackCurrency}"`,
    );
  const only = values['--only']?.split(',').map((k) => k.trim());
  const unknownKind = only?.find((k) => !(IMPORT_KINDS as readonly string[]).includes(k));
  if (unknownKind !== undefined)
    throw new Error(`--only accepts ${IMPORT_KINDS.join(', ')}; got "${unknownKind}"`);
  return {
    user,
    accounts: values['--accounts'],
    rates: values['--rates'],
    incomeSources: values['--income-sources'],
    expenses: values['--expenses'],
    inflows: values['--inflows'],
    recordedAt,
    currencyOf: repeated['--currency-of']!,
    fallbackCurrency,
    asBudget: repeated['--as-budget']!,
    only: only as ImportKind[] | undefined,
    dryRun: flags.has('--dry-run'),
    force: flags.has('--force'),
  };
}

const FILE_FLAG: Record<ImportKind, string> = {
  accounts: '--accounts',
  rates: '--rates',
  income: '--income-sources',
  expenses: '--expenses',
  inflows: '--inflows',
};
const fileOf = (args: ImportArgs, kind: ImportKind): string | undefined =>
  ({
    accounts: args.accounts,
    rates: args.rates,
    income: args.incomeSources,
    expenses: args.expenses,
    inflows: args.inflows,
  })[kind];

/** Every kind whose file was passed, narrowed by `--only`; a kind named without its file is a mistake. */
export function activeKinds(args: ImportArgs): Set<ImportKind> {
  if (args.only === undefined)
    return new Set(IMPORT_KINDS.filter((k) => fileOf(args, k) !== undefined));
  for (const k of args.only)
    if (fileOf(args, k) === undefined)
      throw new Error(`--only names "${k}", but ${FILE_FLAG[k]} was not passed`);
  return new Set(args.only);
}

/**
 * Numbers an imported name that is already taken by an account kept because it
 * has transfers, the way the mapper numbers collisions inside one import: two
 * accounts with the same name are indistinguishable in the list.
 */
export function avoidTakenNames(accounts: MappedAccount[], taken: string[]): MappedAccount[] {
  const used = new Set(taken);
  return accounts.map((a) => {
    if (!used.has(a.name)) {
      used.add(a.name);
      return a;
    }
    let n = 2;
    while (used.has(`${a.name} ${n}`)) n++;
    const name = `${a.name} ${n}`;
    used.add(name);
    return { ...a, name };
  });
}

export interface PlannedSource extends MappedIncomeSource {
  activeFrom: string;
  activeTo: string | null;
}

export interface Phase3Plan {
  sources: PlannedSource[];
  inflows: MappedInflow[];
  categories: string[];
  expenses: MappedExpense[];
  budgets: MappedBudget[];
  /** YYYY-MM-DD; `active_from` of expenses and budgets. */
  importDay: string;
}

export const EMPTY_PHASE3: Phase3Plan = {
  sources: [],
  inflows: [],
  categories: [],
  expenses: [],
  budgets: [],
  importDay: '1970-01-01',
};

export interface Phase3Input {
  /** Parsed CSV rows of each sheet; undefined when that kind is not part of the run. */
  incomeRows: string[][] | undefined;
  inflowRows: string[][] | undefined;
  expenseRows: string[][] | undefined;
  /** Name → currency of the user's sources already in the database. */
  existingSources: ReadonlyMap<string, string>;
  /** YYYY-MM-DD; `active_from` of everything the sheets do not date. */
  importDay: string;
  known: ReadonlySet<string>;
  currencyOf: ReadonlyMap<string, string>;
  fallback: string;
  asBudget: ReadonlySet<string>;
}

/**
 * The import day: the UTC date of `--recorded-at`. Slicing the string would
 * read the local date the person wrote, which is a different day either side
 * of midnight in any zone but UTC.
 */
export const importDayOf = (recordedAt: string): string =>
  new Date(recordedAt).toISOString().slice(0, 10);

/**
 * A forced inflows import deletes only the uncredited inflows, so the credited
 * ones would survive and the sheet's rows would be inserted next to them. There
 * is no safe way to tell a duplicate from a genuine second receipt, so the run
 * stops and leaves the choice to the person.
 */
export function refuseForcedInflows(creditedCount: number): ImportError | null {
  if (creditedCount === 0) return null;
  return new ImportError(
    `${creditedCount} inflows are already credited to accounts; a forced inflows import would duplicate them — delete or un-credit them in the app, or run without --inflows`,
  );
}

/** Everything the three phase 3 sheets turn into, decided without touching the database. */
export function planPhase3(input: Phase3Input): Result<Phase3Plan, ImportError> {
  const native = { currencyOf: input.currencyOf, fallback: input.fallback, known: input.known };
  const plan: Phase3Plan = { ...EMPTY_PHASE3, importDay: input.importDay };

  // The three sheets are judged independently so one dry run lists every
  // problem; only inflows wait for the income sheet, whose currencies they need.
  const problems: string[] = [];
  let sheetSources: MappedIncomeSource[] = [];
  let incomeFailed = false;
  if (input.incomeRows) {
    const mapped = mapIncomeSources(input.incomeRows, native);
    if (mapped.isErr()) {
      problems.push(mapped.error.message);
      incomeFailed = true;
    } else sheetSources = mapped.value;
  }
  let spans = new Map<string, { first: string; last: string }>();
  let inflowOnly: MappedIncomeSource[] = [];
  if (input.inflowRows && !incomeFailed) {
    const mapped = mapInflows(input.inflowRows, {
      ...native,
      sources: input.incomeRows
        ? new Map(sheetSources.map((s) => [s.name, s.currency]))
        : input.existingSources,
      createMissing: input.incomeRows !== undefined,
    });
    if (mapped.isErr()) problems.push(mapped.error.message);
    else {
      plan.inflows = mapped.value.inflows;
      spans = mapped.value.spans;
      inflowOnly = mapped.value.created;
    }
  }
  plan.sources = [
    ...sheetSources.map((s) => ({
      ...s,
      activeFrom: spans.get(s.name)?.first ?? input.importDay,
      activeTo: null,
    })),
    // Known only from past receipts: not something to expect money from today.
    ...inflowOnly.map((s) => ({
      ...s,
      activeFrom: spans.get(s.name)!.first,
      activeTo: spans.get(s.name)!.last,
    })),
  ];
  if (input.expenseRows) {
    const mapped = mapExpenses(input.expenseRows, { ...native, asBudget: input.asBudget });
    if (mapped.isErr()) problems.push(mapped.error.message);
    else {
      plan.categories = mapped.value.categories;
      plan.expenses = mapped.value.expenses;
      plan.budgets = mapped.value.budgets;
    }
  }
  if (problems.length > 0) return err(new ImportError(problems.join('\n')));
  return ok(plan);
}

export function renderTotals(
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
  plan: Phase3Plan = EMPTY_PHASE3,
): string {
  return [
    `${accounts.length} accounts`,
    `${rates.length} rates`,
    `${plan.sources.length} income sources`,
    `${plan.inflows.length} inflows`,
    `${plan.expenses.length} expenses`,
    `${plan.budgets.length} budgets`,
  ].join(', ');
}

const renderAccounts = (accounts: MappedAccount[]): string[] =>
  accounts.map((a) =>
    [
      a.name.padEnd(32),
      a.bank.padEnd(20),
      a.country,
      a.currency.padEnd(5),
      a.kind.padEnd(13),
      a.balance.padStart(16),
      `note ${a.note?.length ?? 0}`,
    ].join('  '),
  );

export function renderPlan(
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
): string {
  return [...renderAccounts(accounts), renderTotals(accounts, rates)].join('\n');
}

const flagsOf = (row: { ambiguous: boolean; approx?: boolean }): string =>
  [row.ambiguous ? 'ambiguous' : '', row.approx ? 'approx' : ''].filter(Boolean).join(' ');

export function renderSources(sources: PlannedSource[]): string[] {
  return sources.map((s) =>
    [
      s.name.padEnd(28),
      s.currency.padEnd(5),
      s.grossAmount.padStart(14),
      `tax ${s.taxRate}`.padEnd(10),
      `fee ${s.commissionRate}`.padEnd(10),
      `${s.activeFrom}…${s.activeTo ?? ''}`.padEnd(22),
      flagsOf(s),
    ]
      .join('  ')
      .trimEnd(),
  );
}

/** One line per source: a journal of eighty rows is noise, its shape is not. */
export function renderInflows(inflows: MappedInflow[]): string[] {
  const groups = new Map<string, MappedInflow[]>();
  for (const i of inflows) groups.set(i.source, [...(groups.get(i.source) ?? []), i]);
  return [...groups].map(([source, list]) => {
    const dates = list.map((i) => i.receivedOn).sort();
    // Display only: amounts are summed as scaled integers to stay exact.
    const total = list.reduce((sum, i) => sum + toMinor(i.amount), 0n);
    return [
      source.padEnd(28),
      `${list.length} inflows`.padEnd(12),
      `${dates[0]}…${dates.at(-1)}`.padEnd(22),
      `${fromMinor(total)} ${list[0]!.currency}`.padStart(20),
    ].join('  ');
  });
}

const MINOR = 8;
const toMinor = (amount: string): bigint => {
  const [int, frac = ''] = amount.split('.') as [string, string | undefined];
  return BigInt(int + frac.padEnd(MINOR, '0').slice(0, MINOR));
};
const fromMinor = (v: bigint): string => {
  const s = v.toString().padStart(MINOR + 1, '0');
  const frac = s.slice(-MINOR).replace(/0+$/, '');
  return frac === '' ? s.slice(0, -MINOR) : `${s.slice(0, -MINOR)}.${frac}`;
};

export function renderExpenses(expenses: MappedExpense[], budgets: MappedBudget[]): string[] {
  return [
    ...expenses.map((e) =>
      [
        e.name.padEnd(32),
        e.category.padEnd(10),
        e.currency.padEnd(5),
        e.amount.padStart(12),
        e.period.padEnd(8),
        flagsOf(e),
      ]
        .join('  ')
        .trimEnd(),
    ),
    ...budgets.map((b) =>
      [
        b.name.padEnd(32),
        'budget'.padEnd(10),
        b.currency.padEnd(5),
        b.monthlyLimit.padStart(12),
        'monthly'.padEnd(8),
        flagsOf(b),
      ]
        .join('  ')
        .trimEnd(),
    ),
  ];
}

/** The dry-run report: one table per kind that is part of the run, then the totals line. */
export function renderDryRun(
  kinds: ReadonlySet<ImportKind>,
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
  plan: Phase3Plan,
): string {
  const section = (title: string, lines: string[]) =>
    lines.length > 0 ? [`# ${title}`, ...lines, ''] : [];
  return [
    ...(kinds.has('accounts') ? section('Accounts', renderAccounts(accounts)) : []),
    ...(kinds.has('income') || kinds.has('inflows')
      ? section('Income sources', renderSources(plan.sources))
      : []),
    ...(kinds.has('inflows') ? section('Inflows', renderInflows(plan.inflows)) : []),
    ...(kinds.has('expenses')
      ? section('Expenses and budgets', renderExpenses(plan.expenses, plan.budgets))
      : []),
    renderTotals(accounts, rates, plan),
  ].join('\n');
}

class DryRun extends Error {}

const unwrap = <T>(r: Result<T, Error>): T =>
  r.match(
    (v) => v,
    (e) => {
      throw e;
    },
  );

const count = async (
  t: Sql,
  table: 'income_sources' | 'inflows' | 'expenses' | 'budgets',
  userId: string,
) =>
  (
    await t<{ n: number }[]>`select count(*)::int as n from ${t(table)} where user_id = ${userId}`
  )[0]!.n;

/**
 * Writes the phase 3 plan inside the caller's transaction. Each kind guards
 * itself: rows of that kind already there stop the run unless `--force`, which
 * clears what nothing else depends on (uncredited inflows, sources without
 * inflows, expenses, budgets, categories left empty) and imports again.
 */
async function writePhase3(
  t: Sql,
  userId: string,
  plan: Phase3Plan,
  kinds: ReadonlySet<ImportKind>,
  force: boolean,
  io: { log: (s: string) => void },
): Promise<void> {
  const refuse = (what: string, n: number) => {
    if (n > 0 && !force)
      throw new ImportError(`User already has ${n} ${what}; pass --force to replace them`);
  };
  if (kinds.has('inflows')) refuse('inflows', await count(t, 'inflows', userId));
  if (kinds.has('income')) refuse('income sources', await count(t, 'income_sources', userId));
  if (kinds.has('expenses')) {
    refuse('expenses', await count(t, 'expenses', userId));
    refuse('budgets', await count(t, 'budgets', userId));
  }

  if (force && kinds.has('inflows')) {
    const [credited] = await t<{ n: number }[]>`
      select count(*)::int as n from inflows
      where user_id = ${userId} and account_id is not null`;
    const refusal = refuseForcedInflows(credited!.n);
    if (refusal) throw refusal;
    const gone = await t`delete from inflows where user_id = ${userId} and account_id is null`;
    io.log(`removed ${gone.count} uncredited inflows`);
  }
  if (force && kinds.has('income')) {
    const gone = await t`
      delete from income_sources s
      where s.user_id = ${userId}
        and not exists (select 1 from inflows i where i.income_source_id = s.id and i.user_id = s.user_id)`;
    io.log(`removed ${gone.count} income sources without inflows`);
  }
  if (force && kinds.has('expenses')) {
    await t`delete from expenses where user_id = ${userId}`;
    await t`delete from budgets where user_id = ${userId}`;
    await t`
      delete from expense_categories c
      where c.user_id = ${userId}
        and not exists (select 1 from expenses e where e.category_id = c.id and e.user_id = c.user_id)`;
  }

  const sourceIds = new Map<string, { id: string; currency: string }>();
  if (kinds.has('income') || kinds.has('inflows'))
    for (const s of await t<{ id: string; name: string; currency: string }[]>`
      select id, name, currency from income_sources where user_id = ${userId}`)
      sourceIds.set(s.name, { id: s.id, currency: s.currency });

  // With only `inflows` active the plan holds no sheet sources, just the ones
  // the inflows brought; with only `income` active it holds no inflow-only ones.
  for (const s of plan.sources) {
    const kept = sourceIds.get(s.name);
    if (kept) {
      // A source that survived --force still has credited inflows: reuse it.
      if (kept.currency !== s.currency)
        throw new ImportError(
          `Income source "${s.name}" already exists in ${kept.currency}, the sheet says ${s.currency}`,
        );
      // Refresh what the sheet knows; pay days, the primary mark and the active
      // period were set by hand and stay. An inflow-only source has nothing to refresh.
      if (kinds.has('income') && s.activeTo === null)
        await t`
          update income_sources
          set gross_amount = ${s.grossAmount}, tax_rate = ${s.taxRate}, commission_rate = ${s.commissionRate}
          where id = ${kept.id} and user_id = ${userId}`;
      continue;
    }
    const [row] = await t<{ id: string }[]>`
      insert into income_sources
        (user_id, name, gross_amount, currency, tax_rate, commission_rate, pay_days, is_primary, active_from, active_to)
      values
        (${userId}, ${s.name}, ${s.grossAmount}, ${s.currency}, ${s.taxRate}, ${s.commissionRate},
         '{}'::int[], false, ${s.activeFrom}, ${s.activeTo})
      returning id`;
    sourceIds.set(s.name, { id: row!.id, currency: s.currency });
  }

  for (const i of plan.inflows) {
    const source = sourceIds.get(i.source);
    if (!source) throw new ImportError(`No income source named "${i.source}"`);
    if (source.currency !== i.currency)
      throw new ImportError(
        `Income source "${i.source}" is in ${source.currency}, its inflows were read as ${i.currency}`,
      );
    await t`
      insert into inflows (user_id, income_source_id, amount, currency, received_on, realised_rate_to_usd, note)
      values (${userId}, ${source.id}, ${i.amount}, ${i.currency}, ${i.receivedOn}, ${i.realisedRateToUsd},
              'Imported from spreadsheet')`;
  }

  const categoryIds = new Map<string, string>();
  if (kinds.has('expenses'))
    for (const c of await t<{ id: string; name: string }[]>`
      select id, name from expense_categories where user_id = ${userId}`)
      categoryIds.set(c.name.toLowerCase(), c.id);
  for (const [index, name] of plan.categories.entries()) {
    if (categoryIds.has(name.toLowerCase())) continue;
    const [row] = await t<{ id: string }[]>`
      insert into expense_categories (user_id, name, sort_order)
      values (${userId}, ${name}, ${index})
      returning id`;
    categoryIds.set(name.toLowerCase(), row!.id);
  }
  for (const e of plan.expenses)
    await t`
      insert into expenses (user_id, category_id, name, amount, currency, period, is_essential, active_from)
      values (${userId}, ${categoryIds.get(e.category.toLowerCase())!}, ${e.name}, ${e.amount}, ${e.currency},
              ${e.period}, false, ${plan.importDay})`;
  for (const b of plan.budgets)
    await t`
      insert into budgets (user_id, name, monthly_limit, currency, active_from)
      values (${userId}, ${b.name}, ${b.monthlyLimit}, ${b.currency}, ${plan.importDay})`;
}

export async function runImport(
  args: ImportArgs,
  sql: Sql,
  io: { log: (s: string) => void } = console,
): Promise<void> {
  const kinds = activeKinds(args);
  const currencyOf = unwrap(parseCurrencyOf(args.currencyOf));
  const [userRow] = await sql<
    { id: string }[]
  >`select id from auth.users where email = ${args.user}`;
  if (!userRow) throw new ImportError('No user found for the given --user email');
  const userId = userRow.id;
  const known = new Set(
    (await sql<{ code: string }[]>`select code from currencies`).map((r) => r.code),
  );
  const rowsOf = async (kind: ImportKind, path: string | undefined) =>
    kinds.has(kind) && path !== undefined ? parseCsv(await readFile(path, 'utf8')) : undefined;

  const accountRows = await rowsOf('accounts', args.accounts);
  const accounts = accountRows ? unwrap(mapAccounts(accountRows, { known })) : [];
  const rateRows = await rowsOf('rates', args.rates);
  const rates = rateRows ? unwrap(mapRates(rateRows)) : [];

  const recordedAt = args.recordedAt ?? new Date().toISOString();
  const existingSources = new Map(
    kinds.has('inflows') && !kinds.has('income')
      ? (
          await sql<{ name: string; currency: string }[]>`
            select name, currency from income_sources where user_id = ${userId}`
        ).map((s) => [s.name, s.currency] as const)
      : [],
  );
  const plan = unwrap(
    planPhase3({
      incomeRows: await rowsOf('income', args.incomeSources),
      inflowRows: await rowsOf('inflows', args.inflows),
      expenseRows: await rowsOf('expenses', args.expenses),
      existingSources,
      importDay: importDayOf(recordedAt),
      known,
      currencyOf,
      fallback: args.fallbackCurrency,
      asBudget: new Set(args.asBudget.map((n) => n.replace(/\s+/g, ' ').trim())),
    }),
  );
  io.log(
    args.dryRun ? renderDryRun(kinds, accounts, rates, plan) : renderTotals(accounts, rates, plan),
  );

  try {
    await sql.begin(async (tx) => {
      const t = tx as unknown as Sql;
      const accountRepo = new PgAccountRepository(t);
      const existing = await accountRepo.list(userId);
      const kept: string[] = [];
      if (accounts.length > 0 && existing.length > 0) {
        if (!args.force)
          throw new ImportError(
            `User already has ${existing.length} accounts; pass --force to replace the ones without transfers`,
          );
        for (const a of existing) {
          const outcome = await accountRepo.delete(userId, a.id);
          if (outcome !== 'deleted') kept.push(a.name);
          io.log(`${outcome === 'deleted' ? 'removed' : 'kept (still referenced)'}: ${a.name}`);
        }
      }
      for (const { balance, ...data } of avoidTakenNames(accounts, kept))
        await accountRepo.create(userId, data, {
          amount: balance,
          recordedAt,
          note: 'Imported from spreadsheet',
        });
      if (rates.length > 0)
        await new PgRateRepository(t).upsertMany(
          rates.map((r) => ({ ...r, source: 'manual' as const, userId })),
        );
      await writePhase3(t, userId, plan, kinds, args.force, io);
      if (args.dryRun) throw new DryRun();
    });
    io.log(kinds.size > 0 ? 'Imported.' : 'Nothing to import.');
  } catch (e) {
    if (e instanceof DryRun) {
      io.log('Dry run: rolled back.');
      return;
    }
    throw e;
  }
}
