---
id: TASK-007
title: 'Компоненты: чип-фильтр и чип-категория'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-19 11:11'
updated_date: '2026-09-19 12:06'
labels:
  - design
  - ui
dependencies:
  - TASK-004
documentation:
  - docs/design/moni-review.md
type: task
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Референс держит состояние фильтрации в строке чипов с крестиком: April x, Visa 2340 x, Family x, и рядом Clear all (слайды 12, 14). Отдельная разновидность — чип категории с эмодзи, который при выборе заливается синим (слайд 16). Оба нужны экранам счёта, Плана и формам, поэтому собираются один раз.

Сейчас фильтры у нас нигде не показаны строкой и снимаются только через тот же контрол, которым были поставлены; видимое состояние фильтра — половина смысла экрана Счёт и Плана.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Чип-фильтр показывает значение и кнопку снятия; снятие — отдельная цель нажатия >=44px
- [ ] #2 Строка чипов переносится или скроллится, не ломая раскладку, и умеет показать снятие всех
- [ ] #3 Чип-категория показывает эмодзи и название; выбранный заливается акцентом, невыбранный — приглушённой поверхностью
- [ ] #4 Выбор чипа-категории доступен с клавиатуры, состояние передано через aria
- [ ] #5 Оба чипа проходят AA в обеих темах, включая выбранное состояние
- [ ] #6 Тесты покрывают снятие чипа, снятие всех, переключение выбора категории
- [ ] #7 bun run test, lint, typecheck проходят
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. packages/ui/src/components/chip/types.ts: FilterChipItem { id, label, removeLabel } и CategoryChipItem { id, label, emoji? } — плоские значения, без домена, как у AccountCardItem.
2. FilterChip.vue: пилюля на surface-sunken, метка ink 14/500, внутри — кнопка снятия. Видимый крестик 24px, цель нажатия 44px за счёт псевдоэлемента (after:-inset-2.5), а не размера пилюли: строка фильтров должна остаться компактной. aria-label кнопки задаёт экран (removeLabel), копия живёт в apps/web/src/locales.
3. FilterChipRow.vue: ul с flex-wrap по умолчанию и вариантом scroll (layout='scroll') для узких мест; снятие всех — тихая кнопка-текст в конце того же потока, показывается только когда есть что снимать и экран передал clearLabel. Пустой список не рендерит ничего.
4. CategoryChip.vue: button type=button с aria-pressed — клавиатура работает нативно. Невыбранный — surface-sunken + ink, выбранный — accent-fill + accent-fg (заливка бренда, а не текстовый токен). Эмодзи aria-hidden: название и есть имя чипа.
5. tokens-contrast.test.ts: добавить AA чернил и muted на surface-sunken в обеих темах — невыбранный чип; выбранный держит уже существующая проверка accent-fg на accent-fill.
6. test/chip.test.ts: снятие чипа (emit с id), снятие всех, отсутствие строки и кнопки, когда нечего снимать, переключение выбора категории, aria-pressed, aria-label крестика, перенос/скролл раскладки.
7. Экспорт из packages/ui/src/index.ts, проверка в браузере на временной странице в обеих темах и на 320px, затем bun run test, lint, typecheck.
<!-- SECTION:PLAN:END -->
