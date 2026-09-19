---
id: TASK-019
title: 'Флаг счёта берётся из страны счёта, а не из валюты'
status: To Do
assignee: []
created_date: '2026-09-19 13:12'
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
