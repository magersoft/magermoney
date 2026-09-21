# Magermoney — Phase 4: Goals and Assets

Phase 4 gives the money a purpose and the owner's things a value. Goals
become the fifth tab, an Account can fund at most one of them, and Assets —
owned things with an estimated worth — join the capital on the Home screen
when their owner says they should.

Snapshots stay in phase 5. `docs/db/schema.dbml` already marked them that
way; only TASK-029's own acceptance criterion listed them here, and it is
the one that was wrong.

## 1. Decisions made in the brainstorm

1. Scope: Goals, `accounts.goal_id`, Assets. Snapshots, spends, savings
   analytics and the yearly-history import remain phase 5.
2. A Goal answers one question: _when will I reach it at the current rate?_
   So a Goal carries a target amount, and the screen carries a forecast.
3. The rate is measured, not declared: the average monthly growth of the
   linked Accounts over the last **6** months, from the `balance_entries`
   journal. Fewer than **2** full months of history, or a rate that is not
   positive, means there is no forecast — and the screen says so.
4. Assets live in the fifth tab as its second segment, beside Goals, the
   way Budgets live inside the Plan tab.
5. An Asset enters the total capital through its own `counts_in_total`
   flag, decided once when the Asset is created. The Home screen keeps one
   capital figure; there is no with/without switch.
6. A Goal's life is `active` → `achieved` → `archived`, and only the last
   step is manual. Archiving releases the Accounts it held.
7. An Account is linked to a Goal from the Goal's screen, choosing among
   the Accounts no Goal holds yet.
8. The tab is called "Goals" even though it also holds Assets — as the
   Plan tab is called Plan and holds Budgets.
9. `goals.monthly_share` and `goals.income_source_id`, sketched in
   `schema.dbml`, are dropped. They encoded the share-based split that
   decision #7 of phase 3 had already deferred.
10. An Asset's current value is derived from the last row of its valuation
    journal, never stored beside it — balances-as-journal, ADR 0002.

## 2. Domain (`packages/domain`)

Pure functions, no framework imports, 100 % coverage. Money stays decimal
(ADR 0001); dates are `IsoDate` and all arithmetic on them lives in
`calendar.ts`.

### Goal progress

`goalProgress(goal, linkedAccounts, rates)` → funded, remaining, ratio.
Funded is the sum of the linked Accounts' balances converted into the
Goal's currency at today's rates. An Account whose currency today's rates
cannot price is reported separately rather than silently counted as zero.

### Goal forecast

`goalForecast(goal, entries, today)` → an `IsoDate` or "not enough
history". The monthly rate is the average growth of the linked Accounts
across the last 6 whole months of `balance_entries`. It returns nothing
when there are fewer than 2 whole months of history, or when the rate is
zero or negative. A Goal already achieved has no forecast either.

### Assets

`assetValue(valuations)` → the row with the greatest `valued_on`.
`assetsTotal(assets, rates)` → the sum of the Assets whose
`counts_in_total` is set, in the display currency. `capital = accounts +
assetsTotal` feeds the Home screen.

### Properties (fast-check)

- Progress is never negative, and does not depend on the order of the
  Accounts.
- Funded equals the target exactly when the ratio is 1.
- A forecast, when present, is never in the past.
- A non-positive rate yields no forecast, whatever the remaining amount.
- `assetsTotal` ignores every Asset with `counts_in_total` unset, and
  equals the sum of the rest.

## 3. Database

Two migrations, hand-written SQL, no ORM. Every table carries `user_id`
and RLS; `created_at` / `updated_at` as everywhere.

```
goals
  id, user_id, name, icon, target_amount numeric, currency,
  target_date date null, achieved_at timestamptz null,
  archived_at timestamptz null, sort_order int
  index (user_id, archived_at, sort_order)

accounts
  + goal_id uuid null references goals(id) on delete set null

assets
  id, user_id, name, currency, counts_in_total bool not null default false,
  acquired_on date null, purchase_price numeric null,
  archived_at timestamptz null
  index (user_id, archived_at)

asset_valuations
  id, user_id, asset_id references assets(id) on delete cascade,
  value numeric not null, valued_on date not null
  unique (asset_id, valued_on)
  index (asset_id, valued_on desc)
```

`accounts.goal_id` is single-valued, so "at most one Goal per Account"
needs no constraint of its own. Deleting a Goal releases its Accounts;
deleting an Asset takes its valuations with it, since a valuation outside
its Asset means nothing.

`schema.dbml` is updated in the same change: the phase 4 block loses
`monthly_share` and `income_source_id` and gains `archived_at` on both new
tables.

## 4. API (`apps/api`)

Two modules, `goals` and `assets`, laid out like `budgets`:
`application/{dto, use-case, repository}`,
`infrastructure/{memory,pg}-…-repository`, `http/routes.ts`. Use cases
return `Result`; HTTP mapping stays in `shared/errors`. Every use case
filters by `userId`.

### Goals

`GoalDto`: `id`, `name`, `icon`, `targetAmount`, `currency`, `targetDate`,
`achievedAt`, `archivedAt`, `sortOrder`. The funded amount is **not** in
the DTO — the client computes it from Accounts and rates, so the server
never serves a number that is stale the moment a rate moves.

- `GET /goals` — all of them, achieved and archived included, as
  `GET /budgets` returns ended Budgets. The client decides what to show.
- `POST /goals`, `PATCH /goals/{id}`, `DELETE /goals/{id}`.

`achievedAt` is never sent by the client. On every write that can change
the funded amount, the use case compares funded against the target and
stamps it once. It is not cleared when a rate falls back — a Goal that
blinks between achieved and not is worse than one that is slightly
generous — and only an explicit edit returns the Goal to active.

Archiving is the one place a Goal writes outside its own table:
`PATCH /goals/{id}` with `archivedAt` runs inside `deps.uow`, stamping the
Goal and nulling `goal_id` on its Accounts in one transaction. Split
across two, an interrupted request leaves an archived Goal whose Accounts
still believe they are taken.

### Linking an Account

`PATCH /accounts/{id}` gains an optional `goalId`. The column belongs to
`accounts`, so the `goals` module never writes it, and the list of free
Accounts is `goalId === null` over the Accounts the client already holds —
no extra endpoint, no extra request. 409 `account_already_linked` if the
Account is held by another Goal.

### Assets

`AssetDto`: `id`, `name`, `currency`, `countsInTotal`, `acquiredOn`,
`purchasePrice`, `archivedAt`, plus `value` and `valuedOn` — the last
valuation, exactly as `AccountDto` carries `balance` and
`balanceRecordedAt` over its journal.

- `GET /assets`, `POST /assets`, `PATCH /assets/{id}`,
  `DELETE /assets/{id}`.
- `GET /assets/{id}/valuations` with the cursor pagination the balance
  journal uses, `POST /assets/{id}/valuations`, `PATCH /valuations/{id}`,
  `DELETE /valuations/{id}`.

400 `non_positive_amount` for a target or a valuation that is not
positive; 409 `valuation_exists` when a second valuation claims a date the
Asset already has.

## 5. Web (`apps/web`)

### Routes and shell

`nav.ts` gains a fifth entry between Plan and Settings — Settings stays
last — with `owns: ['/goals', '/assets']`. Both navigations read that one
list, so the tab appears in the phone's pill and the wide window's bar
together.

The pill and its contrast proof were built for four tabs (TASK-049, whose
comment says as much). Five tabs re-open both questions: the capsule's
translation geometry and the proof itself, verified at the narrowest phone
width, not only at a middling one.

### Module `savings`

Owns no data. It owns the tab: `/goals`, with the segmented control the
Plan tab uses, and it composes the two segments through the barrels of
`goals` and `assets`. Those two never import each other.

### Module `goals`

- `GoalsSegment` — a card per Goal: name and icon, an amount lockup of
  funded against target, a progress bar, and one line of forecast
  ("March 2027 at the current rate"). Where there is no forecast, that line
  says so plainly rather than leaving a gap or printing an infinity.
  Achieved Goals sit in a block below the active ones; archived Goals are
  not listed. The bar's action is "New goal".
- `GoalPage` (`/goals/:id`) — progress, forecast, target date; the linked
  Accounts as rows, not cards, which would shout; "Add account" opening a
  sheet that lists only free Accounts, so the one-Goal rule shows itself
  instead of being explained. Unlinking is a swipe on the row. The bar's
  action is "Edit"; archiving and deleting live in the form.
- `GoalFormSheet` — a quick-action sheet, not a wizard. Name, icon,
  amount, currency, optional date. The Budget wizard earns its steps by
  the number of fields; here it would be ceremony.

### Module `assets`

- `AssetsSegment` — the Assets total on top, then a row per Asset: name,
  current value, the date it was valued, and a muted mark on the ones
  outside the capital.
- `AssetPage` (`/assets/:id`) — current value, the change against the
  purchase price, and the valuation journal with the same cursor
  pagination as an Account's journal. The bar's action is "Add valuation".
- `AssetFormSheet`, `ValuationSheet`.

### Module `dashboard`

`buildDashboard` takes `assets` as a new input and the capital becomes
Accounts plus the qualifying Assets. The core stays pure; the module
reaches the Assets through the `assets` barrel.

### Offline

`goals/offline.ts` and `assets/offline.ts` — query keys and the offline
mutation registration only, no UI, so a static import from `app/` cannot
drag the screens into the entry chunk. Creating a Goal, linking an
Account and adding a valuation park until the connection returns, like
expenses and inflows. Edits and deletions park nowhere in this app yet:
that is TASK-036, and phase 4 neither fixes nor deepens it.

### Failure states

Every query's `isError` reaches a `RouteError`, as the Home screen does
since TASK-044 — a failed list must not render as an empty one, which is
the known phase 3 follow-up this phase declines to repeat. When rates
never arrive, the Goals screen shows the amounts in their own currencies
unconverted instead of a skeleton that never resolves; TASK-037 owns that
fix for Home and Accounts, and phase 4 does not add a third screen to it.

### Copy

Every `ru` / `en` string in `src/locales` goes through
`/humanize-text` — in particular the missing-forecast line, which is easy
to write as a brush-off.

## 6. Testing

- Domain: Vitest + fast-check, the properties in §2, 100 % coverage.
- API: use-case tests on `memoryUnitOfWork` — archiving releases the
  Accounts in one transaction; `achievedAt` is stamped once and never
  cleared by a falling rate; every use case filters by `userId`; the
  repositories take the injected clock, so no test reads the wall clock.
- Web: component tests mount inside `AppShell`, or there is no bar title
  and no bar action to assert on.
- One Playwright smoke on the preview: create a Goal, link an Account, see
  the progress.

TDD throughout: the failing test first.

## 7. Delivery

Three tasks, in order, each ending green:

1. TASK-031 — Goals: domain, migration, API, the fifth tab and its Goals
   segment.
2. TASK-032 — `accounts.goal_id`: migration, the `PATCH /accounts` field,
   linking and unlinking from the Goal's screen.
3. TASK-033 — Assets: migration, API, the Assets segment and the Asset
   screen with its valuation journal.
4. Capital on Home includes the qualifying Assets — folded into TASK-033,
   since it is the same change viewed from the other screen.

## 8. Definition of done

- The fifth tab is in both navigations, and the pill is proven at the
  narrowest phone width with five tabs.
- A Goal can be created, funded by linking an Account, achieved, and
  archived; archiving releases its Accounts.
- A Goal with two months of history shows a forecast; one without says why
  it cannot.
- An Asset can be created, valued repeatedly, and shows its history.
- The Home capital includes the Assets marked for it and excludes the
  rest.
- `bun run test`, `lint`, `typecheck`, `build` green; domain at 100 %.

## 9. Out of scope

- Snapshots, spends, savings analytics, yearly-history import — phase 5.
- Splitting one Account's balance across several Goals by share — deferred
  in phase 3 and still deferred.
- Parking edits and deletions offline (TASK-036).
- The never-resolving skeleton when rates never arrive (TASK-037).
- Automatic valuation of an Asset from any external source. Valuations are
  typed by hand.

## 10. Risks

- **The forecast reads as a promise.** A measured rate over six months is
  an observation, not a plan, and a date on a screen looks like a
  commitment. The copy carries the whole weight here.
- **Five tabs on a small phone.** The glass pill's geometry and its
  contrast proof both assumed four.
- **`achievedAt` and a falling rate.** Stamping once and never clearing is
  a deliberate asymmetry; if it turns out to read as a bug rather than as
  kindness, the fix is a manual "reopen", not an automatic unstamp.
