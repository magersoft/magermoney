---
id: TASK-026
title: 'Экран валют: добавление любой валюты через автокомплит'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:17'
updated_date: '2026-09-20 15:27'
labels:
  - ui
  - currencies
dependencies:
  - TASK-025
  - TASK-050
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Человек должен уметь набрать «колумбийский песо» и подключить валюту в пару касаний, без правки кода. Сейчас на экране курсов (/settings/rates) показываются только зашитые валюты, добавить новую нельзя. Нужен выбор из каталога (TASK-024) с поиском, которым подключаются валюты (TASK-025).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Кнопка «Добавить валюту» открывает выбор с автокомплитом по названию на текущем языке (ru/en) и по коду; фиатные и крипта в одном поиске с разделением по типу
- [x] #2 Каждый вариант показывает значок: флаг для фиатной, иконка для крипты, инициалы, если картинки нет; подмножество иконок пересобрано и закоммичено
- [x] #3 Уже подключённые валюты в списке помечены и не подключаются повторно
- [x] #4 Подключённая валюта сразу появляется в списке курсов и в формах счетов
- [x] #5 Отключение валюты с экрана; при запрете (валюта используется) показывается объяснение
- [x] #6 Компонент выбора с поиском переиспользуем и годится для страны из TASK-020; работает с клавиатуры и читается скринридером
- [x] #7 Строки в en.json и ru.json, тексты через /humanize-text, тесты поиска, добавления и отключения
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Icons first: fiatFlag() derives a flag from the currency code's ISO country prefix against COUNTRY_CODES, with exceptions for the two guilders and none for the supranational francs; CORE_FIAT_FLAG stays the eager subset and CurrencyIcon fetches the lazy country chunk for anything outside it. CRYPTO_KNOWN grows to the 41 tickers cryptocurrency-color actually ships. Rebuild and commit the subset.
2. CurrencySelect gains disabledCodes / disabledLabel so an already-connected currency stays in the list, marked and unpickable.
3. New screen /settings/currencies in the currencies module: the connected list with each name, a note for a currency no provider quotes, remove per row, and the catalogue picker; bar action opens the same picker.
4. Settings gets a link row to it.
5. Strings under 'currencies' in en/ru through /humanize-text; tests for the list, the catalogue fetch, the marked duplicates, adding, the no-rate note, removing and the 409 explanation.
6. /impeccable audit pass over both files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Screen: /settings/currencies, owned by the currencies module (CurrenciesPage, async from the barrel), linked from Settings. It lists the connected currencies by name with the code in mono, and says under any currency no provider quotes that its rate has to be typed by hand — which is what stops an unconverted amount reading as a zero (ADR 0006).

Adding (AC#1, #3): the picker is TASK-050's CurrencySelect over the whole catalogue. Already-connected currencies stay in the list, marked 'added' and unpickable, rather than disappearing — a currency that is simply absent reads as one the app does not have, and gets searched for again. That needed a new disabledCodes/disabledLabel pair on the component. The bar action opens the same picker instead of being a second way to add, so the two cannot disagree about what is connected.

Icons (AC#2): rather than hand-listing 157 flags, fiatFlag() derives the flag from the ISO 3166 country the currency code starts with, checked against COUNTRY_CODES — the same list that decides which flags ship, so a currency shows a flag exactly when we have that country's. Exceptions: both guilders point at Curaçao, and the CFA francs, the East Caribbean dollar and the CFP franc get no flag at all, because they belong to a dozen countries each and any flag would name the wrong one; they fall back to initials. CORE_FIAT_FLAG stays the eagerly registered subset (22 flags, first paint), and CurrencyIcon now sends for the lazy country chunk for any flag outside it — previously only an account with a country did. CRYPTO_KNOWN grew from 16 to the 41 tickers cryptocurrency-color actually ships; the other 36 coins draw as initials. Subset rebuilt and committed: 22 currency flags, 41 crypto marks, 235 country flags.

AC#4 falls out of TASK-025: connect answers with the new connected list, which is written straight into the cache every form reads.

/impeccable audit: detector clean. Three fixes applied — dropped a :key that remounted a 234-row component on every add, hoisted a per-row lookup out of the template, and raised the remove button to a 44px target under a finger.

Verification: bun run test (942 passing, 8 new for this screen), typecheck and lint green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A currencies screen at /settings/currencies: the list of what you use, an autocomplete over the whole catalogue to add to it, and removal with the API's own explanation when something still points at the currency. Typing «колумбийский песо» — or 'colombian', or 'COP' — now connects it in two taps. Currencies already on the list stay visible in the picker, marked and unpickable. Every fiat currency draws its flag, derived from the country its code starts with against the same list that decides which flags ship, with initials for the ones no single country issues; the icon subset was rebuilt and committed. Verified with 8 new tests covering the list, the catalogue, the marked duplicates, adding, the no-rate note, removing and the 409 refusal, plus the full suite (942 tests), typecheck, lint and an /impeccable audit pass.
<!-- SECTION:FINAL_SUMMARY:END -->
