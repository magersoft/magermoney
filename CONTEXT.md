# Magermoney

Personal multi-currency finance tracker. Each user sees only their own data; users never interact. It tracks where the money is, what comes in, what goes out, and how fast savings goals are being reached. Replaces a long-lived Google Sheet.

## Language

### Money and rates

**Money**:
An exact decimal amount together with its currency (fiat or crypto). Never a bare number, never a float.

**Rate**:
The price of one currency in another on a given date. Rates are dated; a conversion always names which date's rate it used.

**Display currency**:
The currency every amount on screen is converted into right now. Switchable on any screen from the user's list of Reporting currencies; one of them is the default. Stored amounts never change when it switches.
_Avoid_: Base currency, main currency

**Reporting currencies**:
The user-chosen list of currencies offered by the Display currency switch. Any currency with a Rate can be in it.
_Avoid_: Supported currencies

### Where the money is

**Account**:
A place that holds Money in exactly one currency: a bank account, a card, a deposit, a broker, a crypto wallet, or cash. Belongs to a bank (or wallet provider) and a country. May be flagged as a Spending account, and may be pinned to the Home screen with the star on its own screen. An Account holds one currency, so a wallet with several coins is several Accounts sharing a Provider.

**Provider**:
The bank, broker, exchange or wallet an Account belongs to (the `bank` field). Accounts are shown grouped by Provider.
_Avoid_: Institution, group

**Card type**:
Whether a card Account is debit or credit. Only a credit card may hold a negative balance.

**Spending account**:
An Account whose balance is what is available until payday. Everything not flagged is treated as savings.
_Avoid_: Card, current account
_Avoid_: Card (a card is a kind of Account), balance (that is the Account's amount)

**Pinned account**:
An Account the user chose to see on the Home screen. Only pinned Accounts are in the strip there; the rest are on the Accounts screen. Nothing is pinned by default, and nothing falls back to showing every Account. Pinning is a star on the Account's own screen, next to its menu — never a field in the Account form.
_Avoid_: Favourite, primary (that is the Income source's word). The star is the icon; «pinned» is still the word, in code and in prose.

**Balance entry**:
A dated statement "Account X held amount Y". An Account's current balance is its latest Balance entry; earlier entries are kept. Balances are declared, not computed from transactions. Only the newest entry of an Account may be edited or deleted; older ones are history. An entry made by a Transfer or an Inflow is changed only through that Transfer or Inflow.
_Avoid_: Transaction, adjustment, update

**Transfer**:
A move of Money between two of the user's Accounts on a date. Produces one Balance entry on each side; when currencies differ, the amount sent and the amount received are both declared and the realised rate and fee are derived. A Transfer never changes total capital except by its fee. A Transfer can be edited or deleted only while both of its Balance entries are still the newest on their Accounts.
_Avoid_: Exchange, conversion, swap

### What comes in

**Income source**:
A recurring origin of income with a monthly gross amount, tax rate, commission rate, a pay schedule (days of month) and an active period. Net is derived, never stored: gross × (1 − tax) × (1 − commission). One source is marked primary. A source with no pay days is irregular: it counts in the month plan with its expected amount (which may be zero) and never appears among upcoming events. One-off receipts belong to such a source ("Other"), so every Inflow has a source.
_Avoid_: Salary, job

**Pay schedule**:
The days of the month on which an Income source is expected to pay. The monthly net is split evenly across them; the last payout of the month absorbs the rounding remainder. A pay day beyond the month's length falls on the month's last day. "Days to payday" counts to the primary source's next pay day; payday today is zero.

**Active period**:
The dates between which an Income source or Expense counts towards current totals. Nothing is deleted when it ends; history keeps referring to it.
_Avoid_: Disabled, archived, deleted

**Inflow**:
An actual dated receipt of money from an Income source, in its own currency, optionally with the USD rate realised that day. May be credited to an Account, producing one Balance entry (new balance = latest balance + credited amount). When the Account's currency differs, both amounts are declared — the Inflow amount and the credited amount — and the realised rate is derived, exactly as for a cross-currency Transfer; nothing is converted automatically. A credited Inflow must be the newest entry on its Account when recorded, and can be edited or deleted only while it still is.
_Avoid_: Поступление as a separate concept from Inflow, transaction

### What goes out

**Expense**:
A fixed recurring obligation with a known amount, a period (monthly or yearly), a category, an essential/discretionary mark and an active period. Yearly expenses are normalised to monthly for totals.
_Avoid_: Subscription (a subscription is a kind of Expense), payment, bill

**Essential expenses**:
The sum of Expenses marked essential: what must be paid no matter what.
_Avoid_: Minimum

**Budget**:
A variable spending category (groceries, restaurants, taxi) with a monthly limit chosen by the user. Unlike an Expense, the actual amount is not known in advance.
_Avoid_: Allowance, envelope, category (on its own)

**Spend**:
The actual amount spent against one Budget in one month, entered once when the month is closed. One number per Budget per month, not per receipt.
_Avoid_: Transaction, purchase, expense

**Planned monthly outgo**:
Sum of monthly-normalised Expenses plus sum of Budget limits.
_Avoid_: Expenses total, costs

### Where it is going

**Goal**:
Something being saved for: a target amount, a target date, a share of monthly savings, and the Accounts that fund it. An Account funds at most one Goal; the funded amount is the sum of those Accounts' balances in the Goal's currency.
_Avoid_: Category, savings category, bucket

**Asset**:
Something owned that has an estimated value but is not Money on an Account, e.g. a car. Has a history of valuations and may or may not count towards total capital. Never a Goal.
_Avoid_: Purchase, property

**Snapshot**:
The balance of every Account and every Rate fixed at the end of a month, plus a comment. Totals in any Display currency are derived from it later. Created as a draft automatically, then confirmed by the user; immutable once confirmed.
A legacy Snapshot (imported from the spreadsheet) holds only pre-summed totals and cannot be re-derived in other currencies.
_Avoid_: History row, month record

**Saved**:
For a month: Inflows minus Outflows. Excludes Revaluation, so market and FX noise never counts as saving.
_Avoid_: Delta, change in capital (that is the whole difference between two Snapshots)

**Revaluation**:
The part of a month's capital change caused only by Rates moving while balances stayed the same.
_Avoid_: FX, market, unrealised gain

**Outflows**:
The remainder of a month's capital change after Inflows and Revaluation: spending and purchases.
_Avoid_: Expenses (those are the planned recurring obligations)

### Views (not stored)

**Dashboard**:
The home screen: a read model assembled from Accounts, Income sources, Inflows, Expenses, Budgets and Rates (Goals from phase 4). Shows total capital, what is available until payday and per day, the month plan (net income − Planned monthly outgo = remainder), this month's Inflows against the expected net per source, and the payouts and charges of the next 30 days. Has no data of its own.

**Savings analytics**:
A read model over Snapshots and Inflows: monthly delta, averages, forecast.
