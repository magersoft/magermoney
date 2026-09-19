---
id: TASK-002
title: Основная навигация bottom-navigation приложения
status: To Do
assignee: []
created_date: '2026-09-19 10:33'
updated_date: '2026-09-19 10:39'
labels:
  - design
  - web
  - ui
dependencies: []
type: enhancement
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Контекст
Сейчас нижняя панель живёт прямо в `apps/web/src/shared/layout/AppShell.vue` (4 текстовые вкладки, `min-h-11`), а плавающий «+» (`QuickActions`, `apps/web/src/app/QuickActions.vue`) подключён через слот `fab` и виден только на `/` и `/accounts`.

## Что нужно
- Вынести мобильную нижнюю навигацию в отдельный компонент (например `apps/web/src/shared/layout/BottomNav.vue`); AppShell только подключает его.
- Порядок: Главная | Счета | (+) | План | Настройки.
- Увеличить высоту панели, у каждой вкладки иконка (Lucide) над подписью.
- По центру заметная круглая кнопка (+), выступающая над панелью. Открывает существующее меню QuickActions (записать баланс / перевод / поступление).
- Плавающий FAB на мобильном убираем: его заменяет центральная кнопка. На десктопе (≥md) нижней панели нет, остаются верхняя навигация и текущий FAB.

## Решения
- Действие (+): переиспользуем меню QuickActions как bottom sheet; содержимое меню отдельной задачей не меняем.
- (+) доступна на всех экранах с навбаром, а не только на `/` и `/accounts` (убрать `FAB_PATHS` для мобильного).
- Иконки: Lucide через `@iconify-json/lucide`, добавить в offline subset (как CurrencyIcon), без запросов к Iconify API.
- Логика активной вкладки (`NAV.owns`, `isCurrent`) переезжает в компонент без изменения поведения; акцент только на текущей вкладке.

## Ограничения проекта
- Скиллы: `/frontend-design` до разметки, `/animate` для нажатия (+) (пресеты в `packages/ui/src/motion`), `/impeccable` для аудита, `/humanize-text:humanize-text` для новых строк в `locales`.
- Цель нажатия ≥44px, safe-area-inset-bottom, тёмная и светлая темы, `prefers-reduced-motion`.
- Иконки: после изменения набора выполнить `bun run icons:build` в `packages/ui` и закоммитить `src/icons/subset.json`.
- TDD: сначала падающий тест. Коммит через `/git-commit`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Нижняя навигация вынесена в отдельный компонент, AppShell её только подключает
- [ ] #2 Порядок вкладок: Главная, Счета, (+), План, Настройки; у каждой вкладки Lucide-иконка и подпись
- [ ] #3 Панель выше прежней; центральная (+) круглая, выступает над панелью, цель нажатия ≥44px
- [ ] #4 Нажатие (+) открывает меню QuickActions на любом экране с навбаром
- [ ] #5 На мобильном отдельного плавающего FAB нет, на ≥md нижней панели нет, FAB и верхняя навигация как раньше
- [ ] #6 Активная вкладка подсвечивается по тем же правилам (owns), в том числе на вложенных маршрутах; проставлен aria-current
- [ ] #7 Иконки в offline subset (icons:build, subset.json закоммичен), работают без сети
- [ ] #8 Учтены safe-area, светлая и тёмная темы, prefers-reduced-motion, фокус с клавиатуры
- [ ] #9 Компонентный тест на порядок вкладок, активное состояние и открытие меню по (+); строки в en.json и ru.json
- [ ] #10 bun run test, lint, typecheck проходят
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `/frontend-design`: определить форму панели и кнопки (+) в рамках docs/design/direction.md.
2. Иконки: добавить нужные Lucide-иконки в subset, `bun run icons:build` в packages/ui, экспортировать компонент иконки, если его нет.
3. Тест-первым: BottomNav (порядок, aria-current, клик по (+)).
4. Создать BottomNav.vue, перенести NAV/isCurrent, слот или emit для (+).
5. Переработать QuickActions: убрать FAB_PATHS и плавающую кнопку на мобильном, открывать меню от (+) в навбаре.
6. Обновить AppShell (отступ main pb под новую высоту), локали en/ru.
7. `/animate` + `/impeccable`, затем test/lint/typecheck и ручная проверка в браузере на мобильной ширине.
<!-- SECTION:PLAN:END -->
