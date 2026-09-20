---
id: TASK-028
title: 'Экран валют: выбор избранных валют отчёта'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:17'
updated_date: '2026-09-20 15:44'
labels:
  - ui
  - currencies
dependencies:
  - TASK-026
  - TASK-027
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Логика избранных (TASK-027) не имеет смысла без экрана, где их выбирают. Человек должен видеть, какие валюты стоят в переключателе, отмечать и снимать их и понимать, почему нельзя выбрать четвёртую.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 На экране валют у каждой подключённой валюты есть отметка «в переключателе»; отмеченные видны сверху в порядке переключателя
- [x] #2 Порядок избранных можно менять
- [x] #3 При трёх отмеченных остальные отметки неактивны, рядом счётчик «2 из 3» и подсказка, что нужно снять одну
- [x] #4 Последнюю избранную валюту снять нельзя, объяснение показано рядом
- [x] #5 CurrencySwitch в шапке сразу отражает изменения; при одной валюте переключатель не занимает места
- [x] #6 Строки в en.json и ru.json, тексты через /humanize-text, тесты выбора, лимита и порядка
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pure rules first: currencies/domain/switch-list.ts with addToSwitch / removeFromSwitch / moveInSwitch / makeMain, each returning the whole next pair (list + main) or null when the move is not allowed.
2. CurrenciesPage splits into two sections: the switch's currencies on top in switch order, everything else below.
3. Each switch row: the main-currency radio, up/down reorder, the in-switch tick (disabled at one left) and remove. Each other row: the tick (disabled when the switch is full) and remove.
4. A '{n} of {max}' counter beside the heading, and the hint under it becomes 'take one off to add another' once full; the last-one note sits once under the list rather than on every row.
5. SettingsPage loses CurrencyListEditor, which this screen replaces; the file is deleted.
6. Tests: 11 for the rules, 8 for the screen's switch section, plus one that the header switch disappears at a single currency.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The rules are a pure module (currencies/domain/switch-list.ts) rather than inline handlers: each returns the whole next pair — the list and which of it is main — because the API refuses a default that is not in the list, and working that out in four call sites is how one of them gets it wrong. Each returns null when the move is not allowed, so the screen's disabled states and what it sends cannot disagree.

Layout (AC#1): the switch's currencies sit in their own section at the top, in the order the switch shows them; everything else is below under its own heading. A tick scattered down a list of twenty does not let anyone picture the control it drives.

Reordering (AC#2) is up/down buttons rather than drag: they work from a keyboard and under a finger without a gesture to discover, and each is named for its currency.

The counter (AC#3) sits beside the heading and reads '2 of 3'; once full, the hint under it changes to 'Take one off to add another.' and every unticked box is disabled. The last-one note (AC#4) is said once under the list rather than repeated on each row.

CurrencyListEditor in Settings is deleted — this screen is what it was standing in for, and it had already lost its add control to the picker. Its 'main currency' radio moved onto the switch rows, so nothing was lost. SettingsPage now just links here.

AC#5 needed no change: CurrencySwitch reads reportingCurrencies through useDisplayCurrency, and the profile mutation writes the cache optimistically, so the header moves as the tick does; the switch already renders nothing at one currency. Both are now covered by tests.

Found while testing: a currency in the switch had no remove control at all, because the remove button only existed on the 'everything else' rows. Added — the backend takes a disconnected currency out of the switch itself (TASK-027), so there is no order to get right.

Verification: bun run test (969 passing, 20 new), typecheck, lint, /impeccable detector clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The currencies screen now owns the display switch: its currencies sit at the top in the order the switch shows them, each with a tick, up/down reordering and the main-currency radio, and everything else follows below. A '2 of 3' counter beside the heading answers why a fourth tick is inactive, and the hint changes to say what to do about it; the last currency cannot be unticked, explained once under the list. The rules live in a pure module that returns the whole next pair or null, so the disabled states and the request can never disagree. CurrencyListEditor in Settings is deleted — this screen replaces it. Verified with 11 tests for the rules, 8 for the screen and one that the header switch disappears at a single currency, plus the full suite (969 tests), typecheck, lint and a clean detector run.
<!-- SECTION:FINAL_SUMMARY:END -->
