---
id: TASK-019
title: 'Флаг счёта берётся из страны счёта, а не из валюты'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:12'
updated_date: '2026-09-19 14:33'
labels:
  - ui
  - accounts
dependencies: []
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Сейчас `resolveCurrencyIcon` (packages/ui/src/components/currency-icon/resolve-icon.ts) сначала смотрит в таблицу `FIAT_FLAG` и только потом в `country` счёта. Из-за этого у счёта в EUR с country=PT показывается флаг ЕС, хотя счёт португальский. Флаг должен отражать страну счёта; флаг валюты остаётся запасным вариантом, когда страна не указана. Заодно стоит пройтись по местам, где рисуется значок счёта, и проверить, что везде передаётся `country`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Счёт с currency=EUR и country=PT показывает флаг Португалии, а не ЕС
- [x] #2 Если у счёта нет страны, флаг берётся из FIAT_FLAG, как сейчас
- [x] #3 Флаг страны есть в подмножестве иконок: после изменения FIAT_FLAG/CRYPTO_KNOWN пересобран и закоммичен src/icons/subset.json
- [x] #4 Значок с учётом страны используется на карточке счёта, в списке счетов, на странице счёта и в полосе счетов на главной
- [x] #5 Тесты resolve-icon покрывают приоритет страны над валютой и запасной путь
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Красный тест: resolve-icon — страна важнее FIAT_FLAG (EUR+PT -> pt), без страны остаётся флаг валюты.
2. resolveCurrencyIcon: сначала country, потом FIAT_FLAG.
3. Разделить набор иконок: subset.json остаётся глазным (флаги валют + крипта, входной чанк), новый сгенерированный country-flags.json со всеми флагами стран грузится по требованию через loadCountryFlags().
4. CurrencyIcon получает проп country, дозагружает коллекцию стран на mount и до её регистрации показывает флаг валюты (иначе Iconify полез бы в сеть).
5. Протянуть country: AccountCardItem -> AccountCard, AccountRow, полоса на главной, заголовок страницы счёта.
6. Тесты: приоритет и запасной путь, реестр иконок покрывает флаги стран, проброс country в карточке и строке.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Приоритет: resolveCurrencyIcon сначала смотрит country, потом FIAT_FLAG (packages/ui/src/components/currency-icon/resolve-icon.ts).

Иконки разделены на два файла. subset.json (22 флага валют + 16 крипты, 26 КБ) остаётся в глазном импорте src/index.ts. Новый country-flags.json (235 флагов, 155 КБ) собирается тем же icons:build и грузится по требованию через loadCountryFlags() из src/icons/country-flags.ts. Так флаг Португалии доступен, а входной чанк не растёт: сборка web даёт отдельный country-flags-*.js на 161,52 КБ (gzip 35,41).

CurrencyIcon получил проп country: на mount просит чанк и до его регистрации рисует флаг валюты, а не спрашивает иконку у Iconify API — приложение не должно ходить в сеть за флагом. countryFlagsReady перерисовывает метку, когда чанк приехал.

country протянут в AccountCardItem -> AccountCard, AccountRow, AccountsPage, полосу счетов на главной; на странице счёта метка добавлена в заголовок (data-testid=account-mark).

Проверка: bun run test (ui 227, web 200), typecheck, lint, vite build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Флаг счёта теперь берётся из страны: resolveCurrencyIcon ставит country выше FIAT_FLAG, CurrencyIcon принимает country и дозагружает отдельный чанк с 235 флагами стран, а карточка, строка списка, страница счёта и полоса на главной этот country передают. Проверено тестами resolve-icon (приоритет, запасной путь, крипта, явная иконка), CurrencyIcon (EUR+PT рисует pt, без страны — european-union), icon-registry (каждая страна из COUNTRY_CODES зарегистрирована после загрузки) и account-card; плюс bun run test, typecheck, lint и vite build, который показал флаги отдельным чанком.
<!-- SECTION:FINAL_SUMMARY:END -->
