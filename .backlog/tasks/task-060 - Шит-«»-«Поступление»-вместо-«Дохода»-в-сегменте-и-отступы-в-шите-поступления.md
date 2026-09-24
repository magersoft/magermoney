---
id: TASK-060
title: >-
  Шит «+»: «Поступление» вместо «Дохода» в сегменте, и отступы в шите
  поступления
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 18:28'
updated_date: '2026-09-24 09:50'
labels:
  - web
  - ui
dependencies: []
references:
  - apps/web/src/app/QuickActions.vue
  - apps/web/src/modules/plan/ui/OperationSheet.vue
type: bug
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Две проблемы в одном месте, их нашёл владелец на телефоне.

1. У шита «Поступление» (InflowSheet, modules/income) у полей формы нет отступов слева и справа: подписи и поля прижаты к краям шита, хотя заголовок и кнопка «Записать» стоят с отступом. Кнопка «Ещё» тоже прилипла к левому краю.

2. «+» открывает OperationSheet (modules/plan) с сегментом «Перевод / Расход / Доход», где «Доход» создаёт Income source. Источник дохода заводят редко, а Inflow (поступление) записывают часто, но он спрятан во второстепенную кнопку под формой (QuickActions.vue, слот #secondary). Нужно поменять их местами: «Поступление» становится сегментом шита, а создание источника дохода уходит во второстепенные действия (или остаётся только на экране План → Доходы).

Термины из CONTEXT.md: Income source и Inflow, это разные понятия. Смежная задача: TASK-038 (ошибка загрузки чанка InflowSheet). Если поступление станет сегментом, её надо учесть или закрыть заодно.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Поля шита «Поступление» стоят с тем же горизонтальным отступом, что и заголовок и кнопка «Записать», при ширине телефона (проверено на 390px)
- [x] #2 В сегменте шита «+» есть «Поступление», и оно открывает форму поступления без лишнего нажатия
- [x] #3 «Доход» (создание источника дохода) убран из сегмента и доступен как второстепенное действие шита или с экрана План → Доходы
- [x] #4 Отдельная кнопка «Поступление» в #secondary убрана, чтобы одно действие не было в двух местах
- [x] #5 Тесты QuickActions/OperationSheet обновлены: сегмент открывает поступление, создание источника дохода по-прежнему достижимо
- [x] #6 Ленивая загрузка чанка income сохранена: он не попадает в входной чанк
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. InflowSheet переносится на QuickActionSheet (как расход, доход и перевод): сумма крупным полем сверху, валюта источника рядом, поля строками InputRow/SelectRow. Отступы даёт сам QuickActionSheet (p-4), это и чинит прижатые к краям поля.
2. InflowSheet принимает types/type и слот #secondary, как соседние шиты.
3. OperationSheet: сегмент transfer/expense/inflow, лениво грузит InflowSheet вместо IncomeSourceSheet.
4. QuickActions: убрать ленивый InflowSheet и кнопку quick-inflow; во второстепенных действиях кнопка «Новый источник дохода» ведёт на /plan/income/new (маршрут уже есть и открывает тот же шит источника).
5. Локали ru/en: quick.types.inflow, quick.incomeSource, inflows.close.
6. Тесты: InflowSheet.test на слоты quick-action-*, quick-actions.test на новый сегмент и кнопку; e2e smoke — селекторы поступления.
7. typecheck, lint, test, build; проверка на 390px в браузере.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Реализовано в e1474c9. InflowSheet теперь на QuickActionSheet: отступы даёт сам шит, поля строками SelectRow/InputRow, валюта источника рядом с суммой (у нового источника — выбор валюты там же). Сегмент «+»: transfer/expense/inflow; «Новый источник дохода» — второстепенная кнопка, ведёт на /plan/income/new. Экспорт IncomeSourceSheet из barrel убран, больше не нужен снаружи. Проверки: typecheck, lint, 413/413 тестов web, build — чанк income не в входном. Визуальная проверка на 390px не сделана: dev-сервер требует входа. TASK-038 про QuickActions устарела по сути (там больше нет ленивого InflowSheet), но та же вставка RouteError внизу страницы возможна у сегмента inflow в OperationSheet.

Finalization 2026-09-24, after merging task-060 into main (3d98321): quick-actions.test.ts and InflowSheet.test.ts green (21/21 with IncomeSourcePage), full monorepo lint/typecheck/test/build green on the merged main. AC6: the built entry chunk references InflowSheet only through a dynamic import(), the form code is in its own chunk. AC1 is proven structurally, not visually: InflowSheet.test asserts the fields render in QuickActionSheet's slots, whose container carries the same padding as the title and the button. No 390px browser check was done (the dev app needs sign-in).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The '+' sheet segment is now Перевод / Расход / Поступление: the inflow form opens directly from the segment, and creating an income source moved to a secondary button that goes to /plan/income/new. The separate 'Поступление' secondary button is gone. InflowSheet now uses QuickActionSheet, which fixes the fields sitting flush against the sheet edges. The income chunk stays lazy. Verified by quick-actions and InflowSheet tests and a full lint/typecheck/test/build on main; not checked visually at 390px. Commit e1474c9, merged in 3d98321.
<!-- SECTION:FINAL_SUMMARY:END -->
