---
id: TASK-004
title: 'Фундамент: перенести токены, типографику и форму на палитру Moni'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-19 11:11'
updated_date: '2026-09-19 11:20'
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
- [ ] #1 Токены светлой и тёмной темы в tokens.css соответствуют таблицам из direction.md, включая разделение accent/accent-fill и positive/positive-fill
- [ ] #2 Добавлен --mm-surface-sunken (бежевый) и --mm-surface-raised в обеих темах
- [ ] #3 Радиусы обновлены: контролы 12px, карточки 20px, шиты 28px, пилюли 999px
- [ ] #4 Объявлен токен тени карточки; в тёмной теме подъём несёт светлота поверхности, а не тень
- [ ] #5 Типографическая шкала и пары интерлиньяжа из direction.md заведены токенами; заголовки и метки по умолчанию весом 500
- [ ] #6 Контрастный тест проверяет, что каждый текстовый токен даёт >=4.5 на своей поверхности, а line-strong >=3 (для тёмной темы точка отсчёта — surface-raised)
- [ ] #7 Обе темы переключаются как раньше: prefers-color-scheme и data-theme, без расхождения значений между ветками
- [ ] #8 bun run test, lint, typecheck проходят
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Написать тест контраста (packages/ui/test/tokens-contrast.test.ts): парсит tokens.css, конвертирует oklch -> linear sRGB -> relative luminance, проверяет каждый текстовый токен >=4.5 на своих поверхностях и line-strong >=3 (тёмная тема считает от surface-raised), плюс accent-fg на accent-fill и ink на positive-fill. Тест падает на текущей палитре.
2. Переписать палитру в tokens.css по таблицам direction.md: light/dark ветки, accent/accent-fill, positive/positive-fill, surface-sunken и surface-raised в обеих темах.
3. Радиусы: --radius-lg 12px, --radius-xl 20px, --radius-2xl 28px, --radius-full 999px; токен тени карточки --mm-shadow-card, в тёмной теме none.
4. Типографика: шкала 11/12/14/16/22/28/34/40 с парами интерлиньяжа и трекингом токенами --text-*; заголовки и метки по умолчанию весом 500 в base-слое index.css.
5. Обновить маппинг shadcn в index.css (accent-fill/positive-fill, sunken, тень, радиус) и прогнать test, lint, typecheck.
<!-- SECTION:PLAN:END -->
