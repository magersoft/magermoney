import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { createIncomeSource } from '../../src/modules/income-sources/application/create-income-source.js';
import { createInflow } from '../../src/modules/inflows/application/create-inflow.js';
import { deleteInflow } from '../../src/modules/inflows/application/delete-inflow.js';
import { updateInflow } from '../../src/modules/inflows/application/update-inflow.js';
import { createTransfer } from '../../src/modules/transfers/application/create-transfer.js';
import { deps, newUser, salary, sql, usd } from './helpers.js';

const { repos } = deps;

describe('credited inflows under concurrency', () => {
  it('a credit racing a transfer on the same account never loses an update', async () => {
    const uid = await newUser('race');
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    const main = await repos.accounts.create(uid, usd('main'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const savings = await repos.accounts.create(uid, usd('savings'));

    const [credit, transfer] = await Promise.all([
      createInflow(deps)(uid, { incomeSourceId: source.id, amount: '50', accountId: main.id }),
      createTransfer(deps)(uid, {
        fromAccountId: main.id,
        toAccountId: savings.id,
        amountSent: '70',
      }),
    ]);

    // The account lock serialises the two writes. Whichever ran second either built on the first one's
    // balance or was refused as "not the latest"; it never overwrote it. So the final balance is exactly
    // the opening balance plus the writes that report success.
    expect(credit.isOk() || transfer.isOk()).toBe(true);
    const expected = new Decimal(100)
      .plus(credit.isOk() ? 50 : 0)
      .minus(transfer.isOk() ? 70 : 0)
      .toFixed();
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe(expected);
    expect((await repos.accounts.findById(uid, savings.id))?.balance ?? '0').toBe(
      transfer.isOk() ? '70' : '0',
    );
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from balance_entries where user_id = ${uid} and account_id = ${main.id}`;
    expect(row!.count).toBe(1 + (credit.isOk() ? 1 : 0) + (transfer.isOk() ? 1 : 0));
    if (credit.isErr())
      expect(['credit_not_latest']).toContain((credit.error as { code: string }).code);
    if (transfer.isErr())
      expect(['transfer_not_latest']).toContain((transfer.error as { code: string }).code);
  });

  it('two simultaneous credits to one account both land', async () => {
    const uid = await newUser('race');
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    const main = await repos.accounts.create(uid, usd('main'), {
      amount: '10',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const run = (amount: string) =>
      createInflow(deps)(uid, { incomeSourceId: source.id, amount, accountId: main.id });
    const results = await Promise.all([run('5'), run('7')]);
    const landed = results.filter((r) => r.isOk());
    expect(landed.length).toBeGreaterThanOrEqual(1);
    const sum = results.reduce(
      (acc, r, i) => (r.isOk() ? acc.plus(i === 0 ? 5 : 7) : acc),
      new Decimal(10),
    );
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe(sum.toFixed());
  });

  it('refuses to edit or delete a credited inflow once a newer entry exists, and leaves everything intact', async () => {
    const uid = await newUser('race');
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    const main = await repos.accounts.create(uid, usd('main'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const inflow = (
      await createInflow(deps)(uid, { incomeSourceId: source.id, amount: '50', accountId: main.id })
    )._unsafeUnwrap();
    // A newer declared balance supersedes the credit. Written through the repository so the date can sit a minute ahead.
    await repos.balances.insert(uid, {
      accountId: main.id,
      amount: '140',
      recordedAt: new Date(Date.now() + 60_000).toISOString(),
      origin: 'manual',
      transferId: null,
      inflowId: null,
      note: null,
    });

    const edited = await updateInflow(deps)(uid, inflow.id, { amount: '60' });
    expect(edited.isErr()).toBe(true);
    expect((edited._unsafeUnwrapErr() as { code: string }).code).toBe('inflow_not_latest');
    const removed = await deleteInflow(deps)(uid, inflow.id);
    expect(removed.isErr()).toBe(true);
    expect((removed._unsafeUnwrapErr() as { code: string }).code).toBe('inflow_not_latest');

    const [row] = await sql<{ amount: string; creditedAmount: string }[]>`
      select amount::text as amount, credited_amount::text as credited_amount from inflows
      where user_id = ${uid} and id = ${inflow.id}`;
    expect(row).toEqual({ amount: '50', creditedAmount: '50' });
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe('140');
  });

  it('edits and deletes a credited inflow while its entry is still the latest', async () => {
    const uid = await newUser('race');
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    const main = await repos.accounts.create(uid, usd('main'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const inflow = (
      await createInflow(deps)(uid, { incomeSourceId: source.id, amount: '50', accountId: main.id })
    )._unsafeUnwrap();
    expect((await updateInflow(deps)(uid, inflow.id, { amount: '80' })).isOk()).toBe(true);
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe('180');
    expect((await deleteInflow(deps)(uid, inflow.id)).isOk()).toBe(true);
    expect((await repos.accounts.findById(uid, main.id))?.balance).toBe('100');
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from balance_entries where user_id = ${uid} and origin = 'inflow'`;
    expect(row!.count).toBe(0);
  });
});
