---
id: TASK-025
title: 'Подключённые валюты пользователя: хранение, API и курсы'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:17'
updated_date: '2026-09-20 15:02'
labels:
  - api
  - currencies
dependencies:
  - TASK-024
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
После появления полного каталога (TASK-024) в приложении не должно быть сотни лишних валют: человек сам подключает те, что ему нужны. Подключённая валюта становится доступной везде — в счетах, доходах, расходах и на экране курсов. Курсы джоба должна тянуть только для валют, которые подключил хоть кто-то, иначе она будет бить провайдеров впустую. Сейчас `useCurrencies` на вебе отдаёт весь общий список.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Таблица user_currencies (user_id, code) с RLS по user_id; существующим пользователям подключаются валюты, которые они уже используют, плюс базовый набор
- [x] #2 API: список подключённых, подключить и отключить валюту; use cases возвращают Result и фильтруют по userId
- [x] #3 Нельзя отключить валюту, которой пользуются счета, доходы, расходы или бюджеты; ошибка понятна и маппится через apps/api/src/shared/errors
- [x] #4 Джоба fetch-rates тянет курсы для объединения подключённых валют всех пользователей, а не для всего каталога
- [x] #5 Для только что подключённой валюты курс появляется без ожидания ночной джобы
- [x] #6 useCurrencies на вебе отдаёт подключённые валюты; формы счетов и остальные экраны видят подключённую валюту сразу
- [x] #7 Контракты в packages/contracts, тесты use cases на memory-репозитории, включая запрет отключения
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migration 20260920000015: user_currencies (user_id, code, connected_at) with RLS; backfill every code a person already uses (accounts, budgets, expenses, income_sources, inflows, default_currency, reporting_currencies) plus USD/EUR/RUB; handle_new_user connects the profile's own defaults.
2. Contracts: CurrencyUsage, ConnectCurrencyInput, the code path param.
3. apps/api/src/modules/currencies/: UserCurrencyRepository port, connect / disconnect / list-connected use cases returning Result, pg and memory implementations.
4. Disconnect guard: repo.usage counts accounts, budgets, expenses, income sources, inflows and the profile in one round trip; refusal is a ConflictError CURRENCY_IN_USE naming each place, plus LAST_CURRENCY for the final one.
5. Routes under /me/currencies (GET, POST, DELETE /{code}).
6. fetch-rates narrowing: PgRateRepository.quotable adds 'exists (select 1 from user_currencies…)'.
7. warmRate: fetch one code immediately on connect, best-effort.
8. Web: useCurrencies reads /me/currencies, useCurrencyCatalogue reads /currencies, useConnectedCurrencies for connect/disconnect; query keys in their own file plus a currencies/offline.ts entry.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migration 20260920000015 creates public.user_currencies (user_id, code, connected_at) with owner-only RLS, backfilled from every place a person already uses a currency — accounts, budgets, expenses, income_sources, inflows, plus default_currency and reporting_currencies — and the USD/EUR/RUB base set, so nothing anybody owns became unreachable. handle_new_user now connects the new profile's own defaults. Verified locally: 359 rows across 17 distinct codes rather than 234 per user.

API: apps/api/src/modules/currencies/ with a UserCurrencyRepository port, connect / disconnect / list-connected use cases returning Result, and pg + memory implementations. Routes live under /me/currencies (GET, POST, DELETE /{code}) because this is the person's list, not the catalogue at /currencies.

Disconnect guard is a use case rather than a foreign key: the refusal has to be a sentence the screen shows ('EUR is still used by 1 accounts, 3 expenses'), and usage() counts all six places in one round trip so it can name them. Two refusals: CURRENCY_IN_USE (409) and LAST_CURRENCY (409) — a list of none shows nothing.

Job narrowing (AC#4): PgRateRepository.quotable gained 'exists (select 1 from user_currencies uc where uc.code = c.code)'. Verified against the local database: 17 quotable currencies out of 234 in the catalogue.

AC#5 is warmRate — one code, fetched on the connect request from the provider whose source owns it. Deliberately not throttled (one code, on an action just taken) and deliberately best-effort: a provider being down is a log line, not a reason to refuse the connection.

Web: useCurrencies now reads /me/currencies; useCurrencyCatalogue reads /currencies lazily for the picker; useConnectedCurrencies owns connect/disconnect. Connect writes the response straight into the cache rather than invalidating — the response IS the new list, and invalidating on top of it threw the fresh answer away (caught by the new test). Query keys moved into their own file plus a currencies/offline.ts entry, matching the rates module.

Verification: bun run test (902 passing), typecheck and lint green; migration applied locally with supabase migration up and the backfill and narrowing queries checked by psql.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Currencies are now connected per person: public.user_currencies with RLS, backfilled from everything an existing account already uses, and /me/currencies to list, connect and disconnect. Disconnecting is refused while accounts, budgets, expenses, income sources, inflows or the profile still point at the currency, and the refusal names each place so the person knows what to deal with. The rates job now asks providers only about the union of connected currencies — 17 rather than 234 on the local database — and connecting a currency fetches its rate on the spot instead of leaving every amount unconvertible until the nightly run. On the web, useCurrencies reads the connected list and the full catalogue is a separate lazy query for the picker. Verified with the full suite (902 tests), typecheck, lint, and psql against the migrated local database.
<!-- SECTION:FINAL_SUMMARY:END -->
