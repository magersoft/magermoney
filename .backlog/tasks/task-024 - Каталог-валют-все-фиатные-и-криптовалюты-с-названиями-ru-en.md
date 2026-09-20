---
id: TASK-024
title: 'Каталог валют: все фиатные и криптовалюты с названиями ru/en'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:17'
updated_date: '2026-09-20 14:54'
labels:
  - api
  - currencies
dependencies: []
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Сейчас список валют зашит: 19 штук в packages/domain/src/currency.ts (`DEFAULT_CURRENCIES`) и продублирован в seed миграции 20260911000002_currencies.sql. Чтобы можно было добавить любую валюту, например колумбийский песо, нужен полный каталог: все фиатные по ISO 4217 и криптовалюты с ходовыми тикерами. Каталог общий для всех пользователей, а какие валюты включены у конкретного человека, решает TASK-025. Для поиска по-русски у каждой записи нужны названия ru и en. Отдельно надо решить, откуда берутся курсы для новых валют: open-er-api отдаёт около 160 фиатных, а CoinGecko принимает не тикеры, а свои id, поэтому у крипты нужно хранить coingecko id. Это решение стоит записать в ADR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Миграция наполняет public.currencies всеми фиатными валютами ISO 4217 с scale, символом и названиями ru/en, сохраняя существующие 19 записей без изменений
- [x] #2 Криптовалюты: согласованный список (например топ по капитализации) с scale, названиями и coingecko id
- [x] #3 CurrencyRegistry в packages/domain собирается из каталога, а не из жёсткого списка; тесты домена остаются на 100% покрытия
- [x] #4 Выбор источника курсов для каталога зафиксирован в docs/adr, включая валюты, для которых курс получить нельзя
- [x] #5 Для валюты без источника курса это явно видно в данных, а не превращается в тихий ноль
- [x] #6 Данные каталога проверяются тестом на дубли кодов и корректный scale
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Curate the code lists: full active ISO 4217 fiat, plus a top-of-market crypto list with CoinGecko ids (apps/api/scripts/currency-catalogue/).
2. Generate names, scale and symbol from ICU; commit the generated catalogue.json and migration rather than re-deriving (the repo's Bun and Node ship different CLDR vintages).
3. Migration 20260920000014: add currencies.rate_source + coingecko_id with a check tying them to kind; upsert the catalogue leaving existing rows' kind/scale/symbol untouched.
4. Contracts: CurrencyDto.rateSource.
5. Registry from the catalogue: CurrencyLookup interface in the domain, CatalogueRegistry loading public.currencies once per cold start behind an app-level middleware; DEFAULT_CURRENCIES renamed SAMPLE_CURRENCIES so no production path can read it.
6. Providers take QuotableCurrency (code + provider id) and declare a source; fetchRates asks the repository which currencies each source covers, so a currency with no source is never requested.
7. ADR 0006; tests over the committed catalogue (dupes, scale, source/kind coherence) and over the registry and fetch-rates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Catalogue: 234 currencies (157 fiat, 77 crypto), generated into supabase/migrations/20260920000014_currency_catalogue.sql from apps/api/scripts/currency-catalogue/ (bun run catalogue:build in apps/api).

Decisions:
- rate_source ('open-er-api' | 'coingecko' | null) + coingecko_id on public.currencies, with a check constraint tying both to kind. Three ISO currencies have no source (KPW, SVC, VED); they are usable with manual rates. ADR 0006.
- Names, scale and symbol come from ICU at generation time, but the OUTPUT is committed (catalogue.json) and the tests read that: Bun and Node in this repo ship different CLDR vintages (the rupiah is scale 2 under one and 0 under the other). The nine shipped fiat scales are pinned by hand for the same reason — changing one would reinterpret stored balances.
- Fiat symbol stays null: packages/ui resolves the narrow symbol from ICU per locale, and a stored symbol overrides that. Crypto keeps its own (ICU knows no coins).
- The upsert leaves existing rows' kind/scale/symbol alone and only fills the null names, so the original 19 rows are byte-identical after the migration (verified against the local database).
- Mantle (MNT) left out of the crypto list: its ticker is the Mongolian tugrik's ISO code, and currencies.code is the primary key. The duplicate-code test is what caught it.
- CurrencyRegistry now comes from the catalogue: CatalogueRegistry loads public.currencies once per cold start behind an app-level middleware, answering synchronously thereafter (every use case validates inside a Result chain and cannot await). No compiled-in fallback on purpose. DEFAULT_CURRENCIES renamed SAMPLE_CURRENCIES / CurrencyRegistry.sample() so no production path can read it.
- Providers now take QuotableCurrency (code + provider id) and declare a source; the hardcoded COINGECKO_IDS map is gone. fetchRates asks the repository which currencies a source covers, so a currency with no source is never requested — that is also the seam TASK-025 narrows to connected currencies.

Verification: bun run test (877 passing, domain coverage 100%), bun run typecheck, bun run lint all green. Migration applied to the local database with supabase migration up; row counts and the 19 original rows checked by psql. Integration tests fail identically on a clean tree (env not reaching vitest) — pre-existing, unrelated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
public.currencies is now the catalogue: 234 currencies (157 ISO 4217 fiat, 77 crypto) generated from apps/api/scripts/currency-catalogue/ with names in ru/en, ISO scales and, per ADR 0006, a rate_source column naming which provider quotes each one (null when none does) plus coingecko_id, because CoinGecko prices by its own id rather than by ticker. The registry is built from that table via CatalogueRegistry instead of a list compiled into the build, and the rates job asks each provider only about the currencies the catalogue says it covers, so a currency with no source is never fetched and never reads as a zero. Verified with the full suite (877 tests, domain coverage 100%), typecheck, lint, and by applying the migration to the local database and checking that the original 19 rows are unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
