---
id: TASK-021
title: 'API: обновить курсы по запросу пользователя'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:15'
updated_date: '2026-09-20 11:09'
labels:
  - api
  - rates
dependencies: []
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Курсы сейчас подтягивает только фоновая джоба (apps/api/src/jobs/fetch-rates.ts), а в HTTP-роутах rates есть только чтение и ручные курсы. Чтобы pull-to-refresh на экране курсов что-то обновлял, нужен эндпоинт, который по запросу дёргает провайдеров (`fetchRates` для fiat и crypto) и возвращает свежие курсы. Эндпоинт открыт пользователю, поэтому его надо защитить от частых вызовов, иначе можно выбить лимиты внешних провайдеров.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 POST-эндпоинт в модуле rates обновляет курсы fiat и crypto и возвращает количество сохранённых записей
- [x] #2 Требует авторизации, ошибка провайдера превращается в понятный HTTP-ответ через apps/api/src/shared/errors
- [x] #3 Повторный вызов чаще заданного интервала не ходит к провайдерам и отвечает без ошибки, что курсы свежие
- [x] #4 Контракт добавлен в packages/contracts и попадает в OpenAPI
- [x] #5 Тесты use case на memory-репозитории: успех, ошибка провайдера, троттлинг

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Migration: rates.refreshed_at timestamptz default now(); upsert touches it.
2. RateRepository.lastApiRefreshAt(): Date | null — pg + memory implementations.
3. Use case refreshRates(repo, providers, registry, clock, throttleMs): throttled -> ok({stored:0, refreshed:false}); otherwise fetch fiat + crypto and store.
4. Contract RefreshRatesResultSchema in packages/contracts/src/rate.ts, exported through index.
5. POST /rates/refresh behind requireUser; ProviderError -> 502 with a clear body.
6. Tests: success, provider failure, throttled call does not reach the providers.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Throttling needs a write timestamp: rates.date is a calendar day, so migration 20260920000013 adds rates.refreshed_at (touched on insert and on conflict) and RateRepository gains lastApiRefreshAt(). refreshRates() runs both kinds in one call — the caller pulled a list, not a kind — and returns {stored, refreshed, refreshedAt}; refreshed=false is a 200, not an error. Provider failure maps to 502 with code PROVIDER_FAILED. Verified: bun run test (api 189 passed, including 8 new in test/refresh-rates.test.ts), bun run typecheck, bun run lint.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

POST /rates/refresh refreshes fiat and crypto on demand behind requireUser, throttled to one provider round per 15 minutes via the new rates.refreshed_at column; a throttled call answers 200 with refreshed=false and never reaches a provider, a provider failure answers 502 PROVIDER_FAILED. Contract RefreshRatesResultSchema is in packages/contracts and therefore in OpenAPI. Verified by apps/api/test/refresh-rates.test.ts (success, provider failure, throttle, interval expiry, auth) plus the full monorepo test/typecheck/lint run.
<!-- SECTION:FINAL_SUMMARY:END -->
