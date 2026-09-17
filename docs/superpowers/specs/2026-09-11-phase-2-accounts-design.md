# Magermoney — Phase 2: Accounts, balance journal, transfers, import

Date: 2026-09-11. Status: approved in brainstorm, awaiting spec review.

Phase 2 puts the owner's money into the app: every Account from the spreadsheet's "Счета" sheet, a journal of declared balances per Account, Transfers between Accounts, a rates screen, and a local import script. It builds on the phase 1 foundation (`docs/superpowers/specs/2026-09-11-phase-1-foundation-design.md`). Vocabulary: `CONTEXT.md`. Irreversible choices: `docs/adr/` (ADR 0002 declared balances, ADR 0003 client read models). Brainstorm decisions are listed in §1.

## 1. Decisions made in the brainstorm

1. **Crypto is an Account per coin.** Binance BTC, Binance ETH and so on are separate Accounts with `kind = crypto_wallet`, `bank = 'Binance'`, `currency = 'BTC'`. The UI groups Accounts by provider (`bank`). "Holding" is removed from `CONTEXT.md` as a separate concept.
2. **Card conditions live in `note`.** Structured fields are only those that affect logic or the list: `kind`, `card_type` (new: debit/credit), `card_network`, `card_tier`, `card_last4`, `card_expires`. Fees, limits, perks, transfer rails, phone and passport are concatenated by the import into a markdown `note`.
3. **Only the latest Balance entry per Account is editable.** A manual entry can be edited or deleted while it is the newest one on its Account. Transfer-origin entries are never edited directly: the Transfer is edited or deleted as a whole, and only while both of its entries are the latest on their Accounts. Older entries are immutable; corrections are new entries.
4. **Import is a local CLI over CSV.** No Google API, no in-app screen. The owner downloads the sheet as CSV into a git-ignored `imports/` folder and runs `bun run import` inside `apps/api`, which writes to the database through the API's postgres client in one transaction. `--dry-run` prints what would be created.
5. **Accounts are the home screen.** Total capital and available-until-payday on top, grouped Account list below, bottom tab bar Accounts · Rates · Settings, floating "+" for "Record balance" and "Transfer". The dashboard (phase 3) will take over home; Accounts moves to its own tab then.
6. **Current balance is computed server-side, aggregates client-side.** `GET /accounts` returns each Account with its latest Balance entry (`distinct on`); totals, available-until-payday and conversions are pure functions in `packages/domain` run on the client (ADR 0003 unchanged). No materialised balance column, no full-journal download.

## 2. Domain (`packages/domain`)

New, pure, 100 % covered, fast-check where invariants exist.

- `AccountKind = 'bank_account' | 'card' | 'deposit' | 'broker' | 'crypto_wallet' | 'cash'`; `CardType = 'debit' | 'credit'`.
- `Account`: `{ id, name, bank, country, currency, kind, cardType?, isSpending, cardLast4?, cardNetwork?, cardTier?, cardExpires?, note?, sortOrder, archivedAt?, balance?: Money, balanceRecordedAt?: Date }`.
- `BalanceEntry`: `{ id, accountId, amount: Money, recordedAt: Date, origin: 'manual' | 'transfer', transferId?, note? }`. (`inflow` origin arrives in phase 3.)
- `deriveTransfer({ fromCurrency, toCurrency, amountSent, amountReceived })` → `{ realisedRate: Decimal | null, fee: Money | null }`.
  Same currency: `fee = sent − received`, must be ≥ 0, else `TransferError('negative_fee')`; `realisedRate = null`.
  Different currencies: `realisedRate = received / sent` (Decimal, 10 significant digits), `fee = null` (spread and fee cannot be separated without a market rate).
- `applyTransfer({ fromBalance, toBalance, amountSent, amountReceived, fromAccount })` → `{ fromAfter: Money, toAfter: Money }`. `fromAfter = fromBalance − sent`; negative allowed only when `fromAccount.kind === 'card' && fromAccount.cardType === 'credit'`, else `InsufficientFundsError`. An Account with no Balance entry has balance `Money.zero(currency)`.
- Read models (pure): `totalCapital(accounts, rates: RateTable, display)`, `availableUntilPayday(accounts, rates, display)` (sum of `isSpending`), `groupByProvider(accounts)` → `[{ bank, country, accounts, total }]` ordered by first `sortOrder`. Archived Accounts are excluded from totals. Each aggregate returns `{ total: Money, unconvertible: Account[] }`; an Account whose currency has no rate for the display currency is listed, never silently dropped.
- Property (fast-check): for a same-currency transfer, `fromBefore + toBefore − (fromAfter + toAfter) = fee`; for a cross-currency transfer, `sent × realisedRate` rounded to the receiving currency's scale equals `received`.

## 3. Database

Three migrations, conventions from phase 1 (uuid PK, `user_id` + RLS owner-only, `created_at`/`updated_at`, unconstrained `numeric`, no soft delete except `archived_at` where the domain names it).

**`20260912000004_accounts.sql`**

- `create type account_kind as enum ('bank_account','card','deposit','broker','crypto_wallet','cash')`, `create type card_type as enum ('debit','credit')`.
- `accounts`: `id`, `user_id`, `name text not null`, `bank text not null`, `country text not null` (ISO 3166-1 alpha-2, `XX` for crypto and cash), `currency text not null references currencies(code)`, `kind account_kind not null`, `card_type card_type`, `is_spending bool not null default false`, `card_last4 text check (card_last4 ~ '^\d{4}$')`, `card_network text`, `card_tier text`, `card_expires date`, `note text`, `sort_order int not null default 0`, `archived_at timestamptz`, timestamps.
- `check (kind = 'card' or (card_type is null and card_last4 is null and card_network is null and card_tier is null and card_expires is null))`.
- Index `(user_id, archived_at, sort_order)`. No `goal_id` yet; phase 4 adds it with `alter table`.

**`20260912000005_transfers.sql`**

- `transfers`: `id`, `user_id`, `from_account_id references accounts(id) on delete restrict`, `to_account_id … on delete restrict`, `amount_sent numeric not null`, `amount_received numeric not null`, `occurred_at timestamptz not null`, `note text`, timestamps.
- `check (from_account_id <> to_account_id)`, `check (amount_sent > 0 and amount_received > 0)`. Index `(user_id, occurred_at desc)`.

**`20260912000006_balance_entries.sql`**

- `create type balance_entry_origin as enum ('manual','transfer','inflow')` (`inflow` reserved for phase 3).
- `balance_entries`: `id`, `user_id`, `account_id references accounts(id) on delete cascade`, `amount numeric not null`, `recorded_at timestamptz not null`, `origin balance_entry_origin not null`, `transfer_id uuid references transfers(id) on delete cascade`, `note text`, `created_at`.
- `check ((origin = 'transfer') = (transfer_id is not null))`. Index `(account_id, recorded_at desc, created_at desc)`: `created_at` is the tiebreaker so "latest entry" is deterministic when two entries share `recorded_at`.
- RLS on all three tables: `select/insert/update/delete to authenticated using (user_id = auth.uid())`.

Deleting an Account is refused by the FK while any Transfer references it; otherwise its Balance entries cascade. `docs/db/schema.dbml` is updated in the same PR (`card_type` column and enum, `goal_id` marked phase 4, `inflow_id` marked phase 3, `card` check, tiebreaker index).

## 4. API (`apps/api`)

Modules `accounts` and `transfers`, each `application / infrastructure / http`, in-memory and pg repositories, use cases return `Result`, HTTP mapping via `shared/errors`, transactions via the existing `shared/db` helper, schemas in `packages/contracts` (`account.ts`, `balance-entry.ts`, `transfer.ts`). Every use case takes `userId` and every SQL statement filters by it.

### Accounts

| Route                                                        | Body / query                                                        | Result                                                                                                    | Errors                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /accounts`                                              | —                                                                   | `AccountDto[]` incl. archived, with `balance: DecimalString \| null`, `balanceRecordedAt: string \| null` | —                                                                                   |
| `POST /accounts`                                             | `AccountInput` + optional `openingBalance: { amount, recordedAt? }` | `AccountDto` (201)                                                                                        | 400 validation                                                                      |
| `PATCH /accounts/:id`                                        | partial `AccountInput`                                              | `AccountDto`                                                                                              | 404; 409 `account_has_history` when `currency` changes and any Balance entry exists |
| `POST /accounts/:id/archive`, `POST /accounts/:id/unarchive` | —                                                                   | `AccountDto`                                                                                              | 404                                                                                 |
| `DELETE /accounts/:id`                                       | —                                                                   | 204                                                                                                       | 404; 409 `account_has_transfers`                                                    |
| `PATCH /accounts/order`                                      | `{ ids: string[] }`                                                 | 204                                                                                                       | 400 if any id is not the user's                                                     |
| `GET /accounts/:id/balances`                                 | `limit` (default 50, max 200), `before` (cursor = `recordedAt       | id`)                                                                                                      | `BalanceEntryDto[]` newest first                                                    | 404 |
| `POST /accounts/:id/balances`                                | `{ amount, recordedAt?, note? }`                                    | `BalanceEntryDto` (201)                                                                                   | 404; 400 `recorded_in_future`                                                       |
| `PATCH /balances/:id`                                        | `{ amount?, recordedAt?, note? }`                                   | `BalanceEntryDto`                                                                                         | 404; 409 `entry_not_manual`, `entry_not_latest`                                     |
| `DELETE /balances/:id`                                       | —                                                                   | 204                                                                                                       | 404; 409 `entry_not_manual`, `entry_not_latest`                                     |

`AccountInput`: `name`, `bank`, `country` (2 uppercase letters), `currency`, `kind`, `cardType?`, `isSpending`, `cardLast4?`, `cardNetwork?`, `cardTier?`, `cardExpires?` (ISO date), `note?`, `sortOrder?`. Card fields are rejected with 400 unless `kind = 'card'`. `openingBalance` and the Account are inserted in one transaction. A `recordedAt` earlier than the latest entry is accepted (history backfill) and does not change the current balance. `PATCH /accounts/order` exists for the import script; the UI does not call it in phase 2.

"Latest" is defined by `(recorded_at desc, created_at desc)`; `entry_not_latest` is checked inside the transaction that performs the change.

### Transfers

| Route                   | Body / query                                                                      | Result                     | Errors                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /transfers`        | `limit`, `before` (cursor = `occurredAt                                           | id`), optional `accountId` | `TransferDto[]` newest first, each with derived `realisedRate`, `fee`                                                                              | —   |
| `POST /transfers`       | `{ fromAccountId, toAccountId, amountSent, amountReceived?, occurredAt?, note? }` | `TransferDto` (201)        | 404 either account; 400 `same_account`, `amount_received_required` (currencies differ), `negative_fee`, `insufficient_funds`, `recorded_in_future` |
| `PATCH /transfers/:id`  | same fields, all optional                                                         | `TransferDto`              | 404; 409 `transfer_not_latest`; the 400s above                                                                                                     |
| `DELETE /transfers/:id` | —                                                                                 | 204                        | 404; 409 `transfer_not_latest`                                                                                                                     |

`POST`: in one transaction lock the latest Balance entries of both Accounts (`select … for update` on the Accounts rows), compute `applyTransfer`, insert the Transfer and two `origin = 'transfer'` entries with `recorded_at = occurredAt`. `PATCH`: verify both entries are latest, revert the old amounts, re-apply with the new values, update the three rows. `DELETE`: verify, revert by deleting the two entries and the Transfer (the Accounts' previous entries become current again).

`DELETE /rates/manual?base=&date=` is added to the rates module (204; 404 when no override exists).

## 5. Web (`apps/web`)

Follows `/vue-ddd-architecture`: new modules `accounts` and `transfers`, each `domain / application / infrastructure / ui` with one public `index.ts`. UI is built with `/frontend-design` before markup, components via the shadcn-vue MCP into `packages/ui`, motion via `/animate` (presets in `packages/ui/src/motion`), audit via `/impeccable`, copy via `/humanize-text:humanize-text`, all strings in `ru.json` and `en.json` (EN may stay draft until phase 6).

### Module `accounts`

- `application`: `useAccounts()`, `useAccountBalances(id)`, `useCreateAccount()`, `useUpdateAccount()`, `useRecordBalance()`, `useEditBalance()`, `useDeleteBalance()`, `useArchiveAccount()`, `useDeleteAccount()`, `useCapitalSummary()` → `{ total, availableUntilPayday, unconvertible }` in the display currency, built on `packages/domain` read models plus `useRates`/`useDisplayCurrency` from the `rates` module. `useRecordBalance` patches the Account in the list cache optimistically and rolls back with a toast on error. Sorting: `sortOrder`, then `name`.
- `ui`: `AccountsPage` (route `/`): amount lockup "Всего денег" (animated number change on display-currency switch), "Доступно до зарплаты", provider groups (provider icon/flag, name, group total in display currency), account rows (`CurrencyIcon`, name, kind label, balance in own currency large, display currency small), an "Archived" disclosure at the bottom, an "unconvertible" hint when any Account lacks a rate. `AccountDetailPage` (`/accounts/:id`): details, `note`, balance timeline (date, amount, delta to previous), actions "Record balance", "Transfer", menu "Edit / Archive / Delete" (Delete disabled with explanation when Transfers exist). `AccountFormSheet` (create/edit; card fields appear when `kind = card`; currency locked when history exists). `RecordBalanceSheet` (large `MoneyInput`, date default now, note; reused for editing the latest manual entry).

### Module `transfers`

- `application`: `useTransfers(accountId?)`, `useCreateTransfer()`, `useUpdateTransfer()`, `useDeleteTransfer()`; success invalidates the accounts list and both Accounts' balance histories.
- `ui`: `TransferSheet`: from/to pickers (accounts with balances; different-currency targets marked), `amountSent`; when currencies differ, an `amountReceived` field plus a hint from today's `RateTable` ("по курсу дня ≈ …") and the derived realised rate; when equal, an optional fee field (= sent − received). `TransfersPage` (`/transfers`, reached from an Account's detail): list of Transfers with both Accounts and amounts, tap to edit/delete when still latest.

### Shell and shared

- `AppShell` gets a bottom tab bar: Accounts (`/`) · Rates (`/rates`) · Settings (`/settings`); touch targets `pointer-coarse:min-h-11`. A floating "+" on Accounts opens `QuickActionSheet` → "Record balance" (pick an Account first) / "Transfer".
- The phase 1 `HomePage` in `modules/rates/ui` is deleted; `modules/rates` gains `RatesPage`: rows "1 X = Y in display currency" for all reporting currencies, rate date, "manual" badge on overrides, `ManualRateSheet` (currency, date, value) and removal of an override.
- `packages/ui`: `MoneyInput` (decimal string in/out, locale decimal separator, `inputmode="decimal"`, scale from the currency, never a float), `AmountLockup`, `TabBar`, `Fab`, plus whatever shadcn-vue primitives the screens need (Sheet, Tabs, DropdownMenu, Badge, Separator).
- PWA: new routes match the existing `NetworkFirst` API RegExp; offline mutations pause through the existing TanStack persister and replay on reconnect.

## 6. Import (`apps/api/scripts/import-sheet.ts`)

Run inside `apps/api` as `bun run import -- --user <email> [--accounts imports/accounts.csv] [--rates imports/rates.csv] [--recorded-at <ISO>] [--dry-run] [--force]`, reading `DATABASE_URL` from `.env.prod.local` or `.env.local`. `imports/` is git-ignored. Parsing and mapping are pure functions in `apps/api/scripts/import/` with unit tests on a synthetic 6-row CSV; no real data enters the repo.

- **User**: `auth.users` by email → `user_id`; missing → exit 1.
- **CSV**: own RFC 4180 parser (quotes, embedded newlines in "Подробности"). Numbers: strip spaces and NBSP, comma → dot; empty or `-` → null. The flag emoji column is ignored; country comes from a dictionary of the Russian names (Россия→RU, Португалия→PT, Узбекистан→UZ, Казахстан→KZ, Грузия→GE, Кыргызстан→KG, Индонезия→ID, Египет→EG, Crypto→XX, Cash→XX).
- **Accounts mapping** (sheet columns → fields): `currency` = "Валюта"; `bank` = "Название банка" with a trailing ` <the row's own currency code>` and/or ` Вклад` / ` Инвест` removed, except cash rows, which keep their name as written (the currency stripped is the row's own, not a fixed code list); `name` = "Название банка" as written. When two or more rows share both `name` and `currency` (the duplicate key), each gets `" · <tier | Card | Account>"` appended (the row's `card_tier` when it has one, else "Card" for a card row, else "Account"); if names still collide after that suffix (same tier, or both tier-less), a numeric suffix (` 2`, ` 3`, …) is appended in row order until every imported name is unique. `kind`: "Тип" = Account → `bank_account`, name contains "Вклад" → `deposit`, "Тип" = Investing → `broker` for fiat, `crypto_wallet` for crypto; Classic/Gold/Platinum/Elite/Digital → `card` with `card_tier`; country Cash → `cash`; country Crypto with "Тип" = Account → `crypto_wallet`. `card_type` from "BIN Type"; `card_network` from "Платежная система" (VISA→Visa, MasterCard, Mir); `card_last4` = last four digits of "Номер карты"; `card_expires` = last day of "MM/YY". `is_spending = false`; `sort_order` = row index. `note` = markdown lines `- <Column>: <value>` for non-empty Оплата, Снятие, Обслуживание, Лимиты, Именная, Привилегии, ApplePay, NFC, Переводы, СИМ, Паспорт, Подробности, Бонусы.
- Each row → one `accounts` row + one `balance_entries` row (`origin = manual`, `recorded_at` = `--recorded-at` or now, `note = 'Imported from spreadsheet'`), including zero balances. Any currency absent from `currencies` fails the run before writing, listing the codes.
- **Rates mapping**: CSV of the "Курсы пересчёта" block (rows "Курс USD/RUB" and "Курс EUR/USD", columns = years) → manual `rates` dated `<year>-01-01`: `RUB` value `= 1 / usdRub`, `EUR` value `= eurUsd`, `source = manual`, `user_id` = the user, 10 significant digits, `on conflict … do update`.
- **Idempotency**: if the user already has Accounts, the run stops unless `--force`; with `--force` it deletes the user's Accounts that have no Transfers (cascading their entries) and re-imports. Everything runs in one transaction.
- `--dry-run` prints a table (name, bank, country, currency, kind, balance, note length) and totals ("48 accounts, 24 rates"), then rolls back without writing. A real run prints only the totals line, no table, and commits.
- `README.md` gains a short "Import from the spreadsheet" section.

## 7. Testing

- **Domain**: TDD, 100 %, fast-check properties from §2.
- **API**: use cases on in-memory repositories covering every 400/409 branch; routes via `app.request()`; pg repositories in the existing integration job: two concurrent transfers from one Account (locking gives a deterministic result), RLS isolation between two users, `entry_not_latest` after a newer entry appears.
- **Import**: parser and mapper tests on the synthetic CSV (card, deposit, broker, crypto coin, cash, duplicated Credo Bank USD), rates block with two years.
- **Web**: Vitest for `useCapitalSummary` and `useRecordBalance` (optimistic patch and rollback), component tests for `TransferSheet` (received field appears when currencies differ) and `MoneyInput` ("13 723,27" → `13723.27`).
- **E2E**: the smoke gains one scenario (create Account → record balance → transfer → total changes), still gated by `E2E_ENABLED`.

## 8. Delivery

Branch `feat/phase-2-accounts`, subagent-driven execution of the plan, PR to `main`, migrations applied by `db.yml` behind the `production` environment approval. After merge the owner exports the CSVs, runs the import locally against production and checks the home screen on the iPhone. Commits via `/git-commit`. Rulings recorded in `docs/discovery/phase-2-execution-ledger.md`.

## 9. Definition of done

1. Migrations 0004–0006 applied in production; `docs/db/schema.dbml` and `CONTEXT.md` updated (Holding removed; Card type and Provider added).
2. The owner's 48 Accounts appear grouped by provider; "Всего денег" matches the sheet's cell up to the day's rate difference.
3. Recording a balance and making same- and cross-currency Transfers work from the phone; an offline mutation replays on reconnect.
4. The Rates screen shows today's table and can set and remove a manual rate.
5. The import runs with `--dry-run` and for real in one command; a second run without `--force` refuses.
6. CI green; execution ledger committed.

## 10. Risks

- The CSV export may mangle the flag emoji; the country mapping uses the Russian name column, never the flag.
- `numeric` accepts PEPE-scale amounts (up to 18 decimals); the domain rounds to the currency scale only for display, never on write.
- `PATCH /accounts/order` is untested by UI in this phase; it is exercised only by the import script's tests.
