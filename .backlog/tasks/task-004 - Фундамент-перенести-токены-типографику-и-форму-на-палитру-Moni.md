---
id: TASK-004
title: 'Фундамент: перенести токены, типографику и форму на палитру Moni'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-19 11:11'
updated_date: '2026-09-19 11:26'
labels:
  - design
  - ui
  - tokens
dependencies: []
documentation:
  - docs/design/direction.md
  - docs/design/moni-review.md
type: task
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Разбор референса (TASK-003) переводит приложение с бумажно-чернильного языка на язык Moni: светло-голубое полотно, белые карточки, синий акцент. Пока токены не переехали, ни один компонент и ни один экран переделать нельзя — это корень всей нарезки.

Все целевые значения уже посчитаны и проверены на контраст в docs/design/direction.md, разделы Tokens, Type и Форма и глубина; брать их оттуда, а не выводить заново. Ключевая тонкость: брендовые синий и зелёный непригодны как цвет текста (4.24 и 1.65 на полотне), поэтому у акцента и плюса по два токена — заливка брендовая, текст затемнённый. Радиусы выросли, хайрлайн-разделители уступили место краю карточки и мягкой тени, заголовки набираются весом 500.

Затрагивает packages/ui/src/styles/tokens.css и index.css; после смены токенов существующие экраны будут выглядеть переходно — это ожидаемо, их переделывают задачи слоя экранов.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Токены светлой и тёмной темы в tokens.css соответствуют таблицам из direction.md, включая разделение accent/accent-fill и positive/positive-fill
- [x] #2 Добавлен --mm-surface-sunken (бежевый) и --mm-surface-raised в обеих темах
- [x] #3 Радиусы обновлены: контролы 12px, карточки 20px, шиты 28px, пилюли 999px
- [x] #4 Объявлен токен тени карточки; в тёмной теме подъём несёт светлота поверхности, а не тень
- [x] #5 Типографическая шкала и пары интерлиньяжа из direction.md заведены токенами; заголовки и метки по умолчанию весом 500
- [x] #6 Контрастный тест проверяет, что каждый текстовый токен даёт >=4.5 на своей поверхности, а line-strong >=3 (для тёмной темы точка отсчёта — surface-raised)
- [x] #7 Обе темы переключаются как раньше: prefers-color-scheme и data-theme, без расхождения значений между ветками
- [x] #8 bun run test, lint, typecheck проходят
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Написать тест контраста (packages/ui/test/tokens-contrast.test.ts): парсит tokens.css, конвертирует oklch -> linear sRGB -> relative luminance, проверяет каждый текстовый токен >=4.5 на своих поверхностях и line-strong >=3 (тёмная тема считает от surface-raised), плюс accent-fg на accent-fill и ink на positive-fill. Тест падает на текущей палитре.
2. Переписать палитру в tokens.css по таблицам direction.md: light/dark ветки, accent/accent-fill, positive/positive-fill, surface-sunken и surface-raised в обеих темах.
3. Радиусы: --radius-lg 12px, --radius-xl 20px, --radius-2xl 28px, --radius-full 999px; токен тени карточки --mm-shadow-card, в тёмной теме none.
4. Типографика: шкала 11/12/14/16/22/28/34/40 с парами интерлиньяжа и трекингом токенами --text-*; заголовки и метки по умолчанию весом 500 в base-слое index.css.
5. Обновить маппинг shadcn в index.css (accent-fill/positive-fill, sunken, тень, радиус) и прогнать test, lint, typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Палитра переписана по таблицам direction.md; у акцента и плюса теперь по два токена (accent/accent-fill, positive/positive-fill), добавлены surface-sunken и surface-raised в обеих темах и --mm-shadow-card (в тёмной теме none — подъём несёт светлота поверхности).

Два отклонения от таблиц, обе внесены обратно в direction.md:
1. --mm-dark-line-strong поднят с oklch(0.520 0.015 265) до oklch(0.595 0.015 265). По доке он давал 3.1 на полотне, но AC#6 считает тёмную тему от surface-raised, где он давал 2.29 — граница поля в шите не читалась бы.
2. В таблицы дописаны строки, которых там не было, но которые нужны токенам: light surface-raised, dark surface-sunken, dark accent-fg и dark positive-fill.

Радиусы задаются в @theme (--radius-lg 12px / xl 20px / 2xl 28px / full 999px); проверено в собранном CSS: .rounded-full{border-radius:var(--radius-full)}. Шкала 11/12/14/16/22/28/34/40 заведена как --text-2xs…--text-3xl с парами интерлиньяжа и трекингом -0.01em от 28px; вес 500 для заголовков и меток — правилом base-слоя в index.css (в собранном CSS: h1,h2,...,label{font-weight:500}).

Маппинг shadcn: --primary теперь accent-fill (заливка) при --primary-foreground accent-fg, --secondary — surface-sunken (бежевые чипы), чарты перешли на *-fill. Осознанно не трогал правило direction.md «в светлой теме первичная кнопка тёмная» — это решение слоя компонентов (TASK-005+), на уровне токенов кнопка остаётся брендово-синей в обеих темах.

Для теста контраста packages/ui получил @types/node и "types": ["node"] в tsconfig — тест читает tokens.css с диска (vitest отдаёт пустую строку на css?raw, поэтому node:fs).

Проверка: bun run test (115 файлов, все зелёные), bun run lint, bun run typecheck, bun run build — успешно. Тест парности тем проверен мутацией: удаление одной строки из ветки data-theme='dark' роняет его.
<!-- SECTION:NOTES:END -->
