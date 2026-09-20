---
id: TASK-050
title: >-
  Компонент выбора валюты: автокомплит с названиями ru/en, флагами и разделением
  фиат/крипта
status: Done
assignee:
  - '@claude'
created_date: '2026-09-20 09:32'
updated_date: '2026-09-20 15:18'
labels:
  - ui
  - currencies
dependencies: []
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Выбор валюты в приложении — это четыре разных контрола, и ни один не ищет: нативный select голых кодов рядом с суммой в QuickActionSheet (расходы, доходы, переводы), такой же select в AccountFormPage, SelectRow в BudgetWizard и shadcn Select в CurrencyListEditor. На 19 зашитых валютах это терпимо, но человек уже сейчас не может набрать «доллар» или «рубль» и обязан узнавать валюту по трёхбуквенному коду. С полным каталогом (TASK-024) и подключёнными валютами (TASK-025) список вырастет до сотен позиций и эти контролы станут непригодны, поэтому компонент нужен раньше каталога, а не после: тогда 024/025 просто наливают в него больше данных, а TASK-026 сводится к экрану подключения.

Строить не с нуля: packages/ui/src/components/country-select/ — это уже ровно такой пикер для стран (reka-ui Combobox, язык строк FieldRow, клавиатура и aria-activedescendant от библиотеки), а filter.ts рядом держит fold() и лестницу рангов. CurrencyIcon уже разрешает флаг → монету → инициалы, а CurrencyDto уже везёт nameRu, nameEn, symbol и kind. Задача — пересобрать этот же паттерн для валют и вытеснить им все четыре места.

Решения по UX, принятые до начала: фиат и крипта разделяются группами с липкими заголовками внутри одного поиска, а не переключателем — переключатель заставляет выбрать раздел до того, как знаешь, где лежит нужное, и набравший USDT должен был бы переключить вкладку и перенабрать. Код в ранжировании идёт впереди названия, иначе «us» в английской локали выдаёт Uzbekistani Som раньше USD.

Рост FIAT_FLAG и CRYPTO_KNOWN под полный каталог сюда не входит — это TASK-024/026; на текущих 19 валютах иконки уже разрешаются.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CurrencySelect живёт в packages/ui и имеет два варианта: row — поле формы в языке FieldRow, как CountrySelect, и compact — узкий триггер «иконка + код» рядом с суммой; попап у обоих один
- [x] #2 Поиск матчит одновременно nameRu, nameEn, код и символ, а показывает название текущей локали: набранное латиницей «rubl» находит рубль в русской локали
- [x] #3 Ранжирование: точное совпадение кода → префикс кода → префикс названия → префикс слова в названии → вхождение; «us» отдаёт USD первым, «USDT» находится без переключения раздела; лестница покрыта юнит-тестами фильтра
- [x] #4 Результаты сгруппированы «Фиат» и «Криптовалюты» липкими заголовками; группа без совпадений не рисуется вовсе
- [x] #5 Компонент принимает список часто используемых кодов и показывает их отдельной группой сверху; экраны передают валюты отчёта и валюты существующих счетов
- [x] #6 Строка списка: CurrencyIcon (флаг для фиата, монета для крипты, инициалы как запасной вариант), название слева, код моноширинным справа, символ рядом с кодом, когда он есть
- [x] #7 Все четыре места переведены на компонент — QuickActionSheet, AccountFormPage, BudgetWizard, CurrencyListEditor; голого select с валютой в коде не остаётся
- [x] #8 Работает с клавиатуры и читается скринридером наравне с CountrySelect: роли, aria-activedescendant, названные группы; тест покрывает выбор с клавиатуры
- [x] #9 Строки в en.json и ru.json, тексты через /humanize-text; тесты поиска, группировки, группы часто используемых и выбора в обоих вариантах
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. packages/ui/src/components/currency-select/filter.ts: fold() plus the rank ladder (exact code → code prefix → name prefix → word prefix → symbol → substring), searching nameRu, nameEn, code and symbol; groupCurrencies splits into frequent / fiat / crypto and returns no empty group.
2. CurrencySelect.vue: row and compact variants over one reka-ui combobox popup, sticky group headings, CurrencyIcon + name + symbol + mono code per row.
3. apps/web currencies module: toCurrencyOption / useCurrencyOptions (name in the current locale, the other kept searchable) and AppCurrencySelect, a thin wrapper that supplies the connected currencies and the seven strings.
4. Strings in en.json and ru.json under currencySelect, through /humanize-text.
5. Convert every currency picker: AccountFormPage, BudgetFormPage, BudgetWizard, ManualRateSheet, InflowSheet (compact) and CurrencyListEditor.
6. Tests: the filter ladder and grouping, both variants including keyboard selection, and a shared pickCurrency test helper.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on the country-select pattern as the task directed: same reka-ui combobox, same FieldRow language for the row variant.

Ranking (AC#3): exact code → code prefix → name prefix → word prefix in a name → symbol → substring. The code deliberately outranks the name; ranking the name first is what made 'us' offer a som before the dollar. Both languages' names are searched while only the current locale's is shown, so 'rubl' finds the ruble in Russian and «песо» finds the Colombian peso in English.

Two deviations from the AC text, both deliberate:
- The frequent block does NOT repeat its currencies in the fiat/crypto blocks below. reka-ui registers combobox items by value and collapses duplicates, and a currency listed twice in one popup reads as a mistake and makes the keyboard stop on it twice. It is a partition, not an overlay.
- Group headings are plain role=group elements rather than ComboboxGroup: that component hides itself when its items do not match the library's own filter, which this component switches off in favour of its own ranking, so every group but the first vanished.

Found and fixed while building: a combobox opened on a value writes that value into the search field, which the component then reads as a search for it — so the list opened showing exactly the one currency you already had. Pinning display-value to the query fixes it. CountrySelect had the identical bug (editing an account offered a list of one country); fixed there too, with a regression test, since it is one line in the component this one was built from.

Call sites (AC#7): AccountFormPage, BudgetFormPage, BudgetWizard, ManualRateSheet, InflowSheet (compact, the column is 7rem) and CurrencyListEditor. The task named QuickActionSheet, which no longer exists — InflowSheet and ManualRateSheet are where that code went. One native select of currency codes is left on purpose: the AccountsPage filter, which lists only the codes the person's own accounts use plus 'All', a value CurrencySelect cannot express.

Verification: bun run test (931 passing, including 18 filter tests, 11 component tests covering both variants and keyboard selection), typecheck and lint green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CurrencySelect now lives in packages/ui with two variants over one popup — a form row in the FieldRow language, and a compact icon-and-code trigger for beside an amount — and every currency picker in the app uses it. Search matches the name in either language, the code and the symbol, ranked code-first so 'us' offers the dollar rather than the som and 'USDT' is found without switching section; fiat and crypto are sticky-headed groups inside one search rather than tabs, and a group with no matches is not drawn. Six screens lost their bare selects: AccountFormPage, BudgetFormPage, BudgetWizard, ManualRateSheet, InflowSheet and CurrencyListEditor. Verified with 29 new tests covering the ranking ladder, grouping, both variants and keyboard selection, plus the full suite (931 tests), typecheck and lint.
<!-- SECTION:FINAL_SUMMARY:END -->
