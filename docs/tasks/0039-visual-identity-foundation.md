# Task 0039 — Visual Identity Foundation

## Статус

Запланировано. Эта задача фиксирует продуктовое направление и границы будущей
реализации; production UI, assets, tokens, billing и entitlement в ней не
меняются.

## Контекст

Focus уже описан как спокойный взрослый напарник, который помогает начать,
вернуться и перестроить день без стыда. В Product Bible есть отдельные места
для тем, accessibility и монетизации, но нет единого visual identity contract.
Без него экраны могут получить случайную палитру, перегрузку акцентами или
платную персонализацию, которая выглядит как функциональный paywall.

## Цель

Создать согласованный фундамент визуальной идентичности и персонализации,
сохранив ясность действия, adult tone и право пользователя вернуться в любой
день. Направление: **Focus is calm but alive** — тёплый светлый фон, спокойные
поверхности, умеренная выразительность и заметное, но не шумное движение.

## Принятое направление

- Базовый фон — тёплый светлый, а не холодный чисто-белый. Финальные hex/tokens
  определяются только на этапе реализации и accessibility-проверки.
- Семантическая палитра: purple — бренд, навигация и primary actions; turquoise —
  спокойный прогресс и завершение; coral — важность и срочность без моральной
  оценки; yellow — награды, streaks и маленькие победы. Цвет никогда не является
  единственным сигналом.
- Первый reference screen — **Today**: короткое приветствие и дата, процент
  выполнения, progress ring, читаемый timeline карточек задач, понятный quick-add,
  спокойные empty states и ясная нижняя навигация. Today служит проверочным
  экраном, а не разрешением раскатать стиль на весь продукт.
- Бесплатный/default pack — **Orbits**. Будущие платные альтернативы —
  **Focus Sparks** (мягкая четырёхлучевая искра и орбитальная точка) и
  **Focusiki** (эмоциональный персонажный pack). Они меняют визуальный слой,
  но не скрывают задачи, recovery или базовые действия.
- Иконки и emoji должны оставаться читаемыми, локализуемыми и знакомыми. Нельзя
  обещать лицензированные provider marks или использовать их как реализованный
  runtime-факт. Долгосрочное направление auth — заменить placeholder letters
  (`Я`, `ВК`, `@`) чистыми rounded marks с сохранением provider identity и brand
  rules; эти marks не входят в replaceable packs.
- Focus character — опциональный помощник: не блокирует, не наблюдает постоянно,
  не наказывает, не стыдит и не делает продукт детским. Базовая поддержка
  остаётся бесплатной.

## План работ

### Phase A — Documentation and visual spec (обязательно первой)

1. Определить точную palette/semantic tokens и tokens для spacing, sizing,
   radii, restrained shadows и typography.
2. Определить icon/emoji language, accessibility и visual-noise constraints;
   спроектировать полный бесплатный Orbits set.
3. Подготовить текстовый wireframe и visual mockup Today: header/progress ring,
   timeline card, quick-add, empty state, bottom navigation и completed state.
4. Проверить mockup на небольшом экране, системном масштабировании, screen
   reader labels, контрасте, reduced motion и отключённых haptics.
5. Получить product/design approval. До approval implementation не начинается.

### Phase B — First implementation (после approval)

1. Реализовать shared tokens, базовый Orbits pack и unified buttons/cards/badges/
   fields через архитектуру, допускающую будущие Sparks/Focusiki.
2. Реализовать только Today как первый reference implementation и проверить
   переходы, completion, recovery/undo, loading/error/empty states.
3. Добавить accessibility и sensory regression evidence: contrast, text scaling,
   touch targets, non-color cues, reduced motion, sound/haptic opt-out.
4. Добавить focused behavioral tests, runtime evidence и честный список gaps.
5. Не раскатывать стиль на остальные экраны без отдельного evidence gate.

### Phase C — Future personalization and monetization (отдельно)

1. Спроектировать pack architecture, preview/reset и безопасный fallback на Orbits
   при недоступном entitlement или asset.
2. Исследовать Focus Sparks и Focusiki как coherent visual packs; не смешивать
   их с Phase B без отдельного approval.
3. Решение о коммерческой модели (one-time purchase, subscription или часть
   более широкого premium tier) остаётся открытым и требует отдельного решения.
4. Не добавлять pricing, store, billing или entitlement runtime в эту задачу.

## Acceptance / evidence gates

- Product Bible содержит один источник visual identity policy и ссылки из UX,
  ADHD, Today screen map, monetization и roadmap.
- Approved direction явно отделена от planned/not implemented и от runtime facts.
- Today mockup и implementation проходят accessibility/sensory review; animation,
  sound и haptics не обязательны для смысла.
- Free/default Orbits сохраняет полный базовый путь «увидеть → начать →
  вернуться». Pack unavailable/expired не повреждает задачи и данные.
- Нет финальных asset-файлов, лицензированных логотипов, цен, paywall flow,
  database/schema/migration или production deployment claims.

## Phase A checkpoint — 2026-08-27

- Concept board архивирован в `docs/design/visual-references/orbits/` как
  visual-language inspiration; четыре supplied PNG сохранены без изменений.
- `orbits-navigation-approved-direction-02.png` утверждён как navigation
  direction; `orbits-navigation-approved-direction-01.png` сохранён как
  superseded design history.
- `today/today-orbits-approved-direction-01.png` утверждён как Today visual
  direction.
- Добавлены reference index и implementation-neutral спецификация:
  `docs/design/visual-references/orbits/README.md` и
  `docs/design/orbits-visual-spec.md`.
- Production SVG, app code, shared runtime tokens, provider marks и
  accessibility runtime evidence не добавлялись.
- Exact semantic colors, contrast pairs, typography/spacing values, SVG/icon
  sources и runtime/device checks остаются открытыми для Phase B evidence gate.
- Phase B не начата; статус задачи остаётся «Запланировано».

## Phase A.2 checkpoint — 2026-08-27

- Созданы пять SVG navigation prototypes Orbits: Today, Plan, Add, Progress и
  Profile; добавлены active/inactive preview и inspection на 24/28/32 px.
- `Добавить` остаётся отдельным raised action, а не selected destination.
- В preview labels остаются реальным UI text; SVG используют `currentColor` и
  candidate accents, без production integration.
- Application code, `apps/mobile/assets` и runtime navigation не изменялись.
- Production asset approval не заявляется; visual approval пользователем для
  финальной vector geometry остаётся обязательным.
- Contrast, screen-reader/text-scaling/device evidence и другие accessibility
  проверки остаются открытыми; Phase B не начата, статус задачи не изменён.

## Honesty boundary

Эта задача не означает, что:

- redesigned Today уже реализован;
- финальные production SVG assets одобрены;
- character system завершён;
- paid packs реализованы;
- billing подключён;
- pricing определён;
- commercial model определена;
- provider marks лицензированы, одобрены или реализованы;
- accessibility runtime-verified;
- motion и haptics проверены на physical Android device;
- каждый экран приложения использует новую систему.

Concept images и mockups остаются design references, а не production assets.

## Связанные документы

- [Product Bible](../../Product-Bible/Product-Bible.md)
- [UX Principles](../../Product-Bible/03-UX/UX-Principles.md)
- [ADHD Principles](../../Product-Bible/04-ADHD/ADHD-Principles.md)
- [Future Screen Map](../../Product-Bible/05-Experience/Future-Screen-Map.md)
- [Monetization Philosophy](../../Product-Bible/08-Monetization/Monetization-Philosophy.md)
- [Feature Roadmap](../../Product-Bible/09-Roadmap/Feature-Roadmap.md)
- [Theme System](../../Product-Bible/10-Theme-System/Theme-System.md)
