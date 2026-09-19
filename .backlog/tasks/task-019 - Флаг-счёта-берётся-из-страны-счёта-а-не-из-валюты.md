---
id: TASK-019
title: 'Флаг счёта берётся из страны счёта, а не из валюты'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-19 13:12'
updated_date: '2026-09-19 14:14'
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
- [ ] #1 Счёт с currency=EUR и country=PT показывает флаг Португалии, а не ЕС
- [ ] #2 Если у счёта нет страны, флаг берётся из FIAT_FLAG, как сейчас
- [ ] #3 Флаг страны есть в подмножестве иконок: после изменения FIAT_FLAG/CRYPTO_KNOWN пересобран и закоммичен src/icons/subset.json
- [ ] #4 Значок с учётом страны используется на карточке счёта, в списке счетов, на странице счёта и в полосе счетов на главной
- [ ] #5 Тесты resolve-icon покрывают приоритет страны над валютой и запасной путь
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
