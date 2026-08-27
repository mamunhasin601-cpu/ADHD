# Orbits — Phase A visual specification

**Статус:** Phase A product/design direction approved for documentation.
**Дата checkpoint:** 2026-08-27. **Implementation:** не начата.

Этот документ переводит approved references в implementation-neutral contract
для Focus. Он не утверждает production tokens, SVG, готовый React Native UI,
лицензированные provider marks или accessibility/runtime verification. PNG
provenance и контрольные суммы находятся в
[`visual-references/orbits/README.md`](visual-references/orbits/README.md).

## 1. Status and evidence boundary

Product direction approved: navigation direction 02 and Today direction 01.
Production tokens, SVG assets and React Native implementation are not approved
or runtime-verified, and physical Android-device evidence does not exist yet.
The concept board is inspiration only; navigation direction 01 is superseded.
This checkpoint does not claim completion of Task 0039 or start Phase B.

## Phase A.2 — navigation vector prototypes

Five separate documentation-only SVG prototypes now exist under
`docs/design/vector-source/orbits/navigation/`, with a local preview and
README. Labels remain real UI text in the preview; one SVG geometry is reused
between active and inactive states, while state is applied through the
navigation container, token-driven color, label treatment and accessibility
selected state. `Добавить` remains a distinct raised action rather than a
selected destination.

The prototypes use `currentColor` for primary geometry plus candidate turquoise
`#0FA9A8` and yellow `#F4B72A` accents. Final React Native conversion remains
pending, and final SVG geometry is not production-approved until user visual
review. Contrast, text scaling and physical-device validation remain pending.

## 2. Core principle

**Focus is calm but alive.** Warmth should feel adult rather than childish;
recognition should not let decoration compete with tasks; positive feedback
should encourage without pressure. Orbits supports ADHD-friendly clarity and
recovery without making medical claims or presenting itself as treatment.

Orbits — бесплатный/default visual pack Focus: calm but alive, тёплый светлый
фон, ясное действие, умеренная выразительность и мягкое чувство движения.
Визуальный слой должен помогать начать, вернуться и перестроить день без стыда:
он не оценивает человека, не превращает completion в моральную награду и не
скрывает базовый путь продукта за персонализацией.

Approved visual references:

- `orbits-navigation-approved-direction-02.png` — approved navigation direction;
- `today/today-orbits-approved-direction-01.png` — approved Today direction;
- `orbits-concept-board-01.png` — inspiration only;
- `orbits-navigation-approved-direction-01.png` — superseded history.

## 3. Current-source compatibility inventory

Read-only inventory на 2026-08-27 показывает compatibility anchors, а не
финальную систему:

- `apps/mobile/app/(tabs)/today.tsx`, `apps/mobile/components/ProgressRing.tsx`
  и `apps/mobile/app/(tabs)/_layout.tsx` используют `#6B5BFC` для primary
  purple/active tint/progress.
- `apps/mobile/components/GlobalCapture.tsx` и
  `apps/mobile/components/NotificationInvitation.tsx` используют `#5B4BE7`;
  это related purple, пока не утверждённый pressed token.
- `#F3F1FF` используется как soft-purple selected surface; белые и холодные
  серые поверхности (`#FFFFFF`, `#F9FAFB`, `#111827`, `#211D2E`, `#6B7280`,
  `#6B6477`) разбросаны по mobile screens/components.
- В `_layout.tsx` сейчас четыре маршрута (Сегодня, Мысли, Фокус, Настройки),
  текстовые placeholder-иконки и active tint; это не approved пять пунктов
  Orbits navigation.
- `ProgressRing` уже выражает completed/total и показывает число; `Timeline`
  вычисляет расположение задач/free windows и открывает capture в выбранный
  момент; `GlobalCapture` работает title-first для timed или untimed task.
  Today поддерживает quick add и timeline, но approved warm background,
  semantic category cues, completed visual treatment и navigation contract ещё
  не runtime-verified.

Следовательно, Phase B должен сначала собрать semantic tokens и reference
Today, а не считать существующие inline colors готовым Orbits implementation.

## 4. Candidate semantic token roles

Значения ниже — candidate roles. Только отмеченные compatibility anchors
существуют в текущем source; окончательные hex, contrast pairs и dark/high
contrast variants требуют отдельной проверки.

| Role | Semantic meaning | Candidate/source evidence | Allowed use | Prohibited/required cue | Evidence still required |
| --- | --- | --- | --- | --- | --- |
| `background.warm` | Базовый тёплый светлый canvas | Candidate — requires contrast and device review; exact value open | Screen background, large calm areas | Не использовать для текста; не делать чисто холодным white | Contrast с primary/secondary text, small-screen review |
| `surface.primary` | Основная task/card surface | `#FFFFFF` compatibility anchor; candidate final — requires contrast and device review | Timeline cards, fields, sheets | Не единственный сигнал selected/completed | Contrast, elevation and warm-background pairing |
| `surface.elevated` | Raised Add/control surface | Candidate — requires contrast and device review; exact value open | Central Add, modal/popover | Не превращать всё в floating cards | Shadow/contrast/touch-target review |
| `text.primary` | Основной читаемый текст | `#111827`/`#211D2E` source anchors; candidate final — requires contrast and device review | Headings, task titles, labels | Не использовать color alone for status | Contrast at text scaling |
| `text.secondary` | Поддерживающий текст | `#6B7280`/`#6B6477` source anchors; candidate final — requires contrast and device review | Date, hints, metadata | Не снижать ниже readable contrast | Contrast and localization length |
| `brand.primary` | Orbits brand, active navigation, primary action | `#6B5BFC` compatibility anchor to retain unless review finds a blocker; final — requires contrast and device review | Active Today, Add action, focus control | Не кодировать success/importance только purple | Contrast on warm/surface and color-blind review |
| `brand.primaryPressed` | Pressed/selected brand state | `#5B4BE7` related source anchor | Pressed state, transient emphasis | Не использовать как unrelated category color | Contrast, state transition and reduced-motion review |
| `brand.soft` | Мягкая brand tint | `#F3F1FF` compatibility anchor; candidate final — requires contrast and device review | Active background, quiet selected surface | Не использовать как sole selected cue | Contrast with text/icon and elevation |
| `focus.primary` | Focus mode/attention cue | Candidate — requires contrast and device review; turquoise/purple value open | Focus progress and focus state | Не сигнализировать ошибку/importance | Contrast, non-color cue and empty/loading states |
| `focus.soft` | Мягкая focus surface | Candidate — requires contrast and device review; exact value open | Focus card/badge background | Не создавать шумные разноцветные блоки | Contrast and sensory review |
| `importance.primary` | Importance/urgency without moral judgement | Candidate — requires contrast and device review; coral value open | Importance icon/badge and concise cue | Never rely on coral alone; no alarmist full-screen fill | Contrast, icon/label cue, color-blind review |
| `importance.soft` | Мягкая importance surface | Candidate — requires contrast and device review; exact value open | Subtle badge/card tint | Не делать overdue feel punitive | Contrast and emotional-tone review |
| `reward.primary` | Small win/streak/reward cue | Candidate — requires contrast and device review; yellow value open | Confetti-free micro reward, streak marker | Not task priority or required completion signal | Contrast, reduced-motion and distraction review |
| `border.subtle` | Boundary and grouping | Candidate — requires contrast and device review; current neutral borders are fragmented | Card/field separation | Не заменять text contrast or status cue | Contrast on warm/surface |
| `timeline.neutral` | Rest/buffer/free-time baseline | Candidate — requires contrast and device review; exact value open | Timeline line, rest/buffer treatment | Не конкурировать с task category colors | Small-screen density and contrast |

Правило: цвет всегда сопровождается текстом, формой, иконкой, положением,
паттерном или explicit accessibility label. Нельзя отличать completion,
importance, focus или reward только цветом.

## 5. Typography roles

Orbits сохраняет взрослый, спокойный tone и читаемость при системном
масштабировании. До отдельного typography decision используется существующая
system-font compatibility; custom font или лицензия не утверждены.

| Role | Contract |
| --- | --- |
| `type.display` | Короткое greeting/экранный заголовок; выразительный, но не декоративный; один главный фокус |
| `type.heading` | Название Today/секции; чёткая иерархия без all-caps |
| `type.supportive` | Спокойная next-step/supportive copy; не заменяет действие и не стыдит |
| `type.body` | Task title и основное действие; readable при увеличении текста |
| `type.timeline` | Время/длительность timeline; вторично по отношению к task title |
| `type.category` | Короткий category label рядом с icon/shape cue; не только цвет |
| `type.label` | Нижняя навигация, Add, статусы; слова остаются видимыми |
| `type.meta` | Дата, длительность, secondary hint; не использовать для обязательного смысла |
| `type.numeric` | Процент/число progress ring; рядом должен быть понятный label |

Не сжимать line-height, не обрезать task titles ради одной строки и не
использовать emoji как единственный text substitute. Локализация должна
переживать длинные русские и английские строки.

## 6. Spacing and shape principles

Точные числа остаются candidate до измерения на малом экране. Предпочтение —
последовательная базовая шкала с шагом 4/8, а не уникальные inline offsets.

| Role | Candidate contract | Boundary |
| --- | --- | --- |
| `space.page` | Устойчивый горизонтальный inset для warm canvas | Не жертвовать touch target или text scaling |
| `space.section` | Явный вертикальный ритм между greeting, progress, timeline и quick add | Не создавать пустоту, скрывающую next action |
| `space.card` | Внутренний padding task card для title, time и controls | Не обрезать локализованный title |
| `size.touch` | Минимум 44 x 44 pt для actionable controls | Не уменьшать icon hit area ради плотности |
| `size.icon` | 24–32 pt navigation/action icons; larger illustration only when non-actionable | Не брать raster pixel size как token |
| `radius.card` | Мягко закруглённая task/surface shape | Радиус не должен выглядеть детским или pill-only |
| `radius.control` | Чёткая форма button/input/Add | Shape и label дополняют цвет |
| `radius.navigation` | Спокойный radius нижнего navigation bar | Не превращать bar в декоративную капсулу |
| `surface.activeCompact` | Компактная soft background active-tab cue | Не заливать весь bar и не полагаться только на fill |
| `size.add` | Raised central Add с отдельной зоной и безопасной досягаемостью | Exact size requires small-screen/safe-area review |
| `elevation.control` | Один restrained shadow/contrast level для raised Add | Не превращать экран в stack of floating cards |
| `elevation.card` | Минимальная separation от warm background | Border/fill должны работать без shadow |

## 7. Navigation contract and icon language

Orbits icons — простые rounded geometric marks с ясным силуэтом, устойчивые к
малому размеру и локализации. В approved direction 02 слова видимы; иконка
поддерживает слово, не заменяет его.

Системный набор должен включать:

- Today — orbit/now cue, selected by label + icon + soft background;
- Plan — calendar/route cue for planning;
- Add — singular raised central action, plus sign or equivalent familiar mark;
- Progress — ring/arc cue paired with text/number;
- Profile — person/identity cue, not a provider logo.

Emoji допустимы только как optional expressive content with text fallback;
не использовать platform-dependent emoji glyphs для mandatory status.
Rounded icon marks must have accessible labels and selected/disabled states.

## 8. Simplified Orbits navigation icon contract

Концептуальные meanings: Today — four-point spark with one minimal orbit arc;
Plan — simple calendar/timeline with one orbit accent; Add — plain plus inside
a restrained orbit circle; Progress — rising arc ending in one dot or spark;
Profile — person silhouette with one orbit arc.

Shared requirements: one stroke family, consistent optical size, restrained
detail, no glossy 3D treatment and no decorative particles. The orbit dot must
never carry critical meaning alone. Active and inactive treatments are separate;
final SVG geometry requires dedicated review. SVG files не создаются в Phase A.

## 9. Approved bottom-navigation contract

Visual contract: `Сегодня | План | Добавить | Прогресс | Профиль`.

- Все пять слов видимы в обычном состоянии; active item получает icon + label,
  brand tint и мягкую background cue, но не огромную заливку всего bar.
- Центральная `Добавить` — raised primary action; это action, а не destination,
  поэтому возврат после capture не должен терять текущий экран.
- Иконки простые, rounded и знакомые; target каждой action — не менее 44 x 44 pt.
- Selected state доступен screen reader (`selected`/current destination), а
  color не является единственным сигналом.
- `orbits-navigation-approved-direction-01.png` superseded: большая active
  Today background и слабое отделение Add не являются contract.
- Current four-tab Expo layout is a gap to resolve in Phase B, not a claim that
  the five-item navigation already exists.

## 10. Today composition

Порядок иерархии сверху вниз:

1. Тёплый canvas и короткое greeting без перегруза.
2. Дата/контекст дня как secondary text.
3. Progress ring с процентом/числом и явным label; ring не единственный cue.
4. Спокойная supportive next-step copy.
5. Заголовок `Ваш день`.
6. Вертикальный timeline: now indicator, task cards, duration/free/rest/buffer
   states. Линия спокойная (`timeline.neutral`), task category cue — отдельный.
7. Task cards.
8. Fixed bottom navigation contract из раздела 10.

Card contract: readable task title, time/duration context, completion control,
optional importance/focus cue, and a non-color state cue (check, strike,
icon, text or position). Completed card may soften contrast, but title and
recovery/undo remain discoverable; no punitive red or celebratory noise is
required.

Approved Today semantics: purple reinforces work/plan, turquoise may reinforce
completion and must pair with a check/explicit state, coral may reinforce
importance and must pair with an importance symbol/text/shape, and rest remains
calm and non-alarming. Simplified Orbits category icons support recognition;
sample tasks/date in the raster are illustrative, not hardcoded requirements.
Low progress never receives guilt, shame or alarming treatment.

## 11. Motion, sound and haptics boundary

Motion is restrained: short page-load/staggered reveal or progress transition
may clarify state, never gate an action. Reduced-motion mode removes or sharply
reduces non-essential movement while preserving state and navigation. Sound and
haptics are optional reinforcement only; completion, Add, undo and error must
remain fully understandable and usable with sound/haptics disabled. Never use
infinite, flashing or attention-demanding motion.

## 12. Accessibility acceptance checklist

- Проверить contrast для every text/icon/background pair in light, high-contrast
  и будущих theme variants; do not approve candidate hex by inspection alone.
- Поддержать system text scaling, reflow и длинные localized labels without
  clipping; test the five visible navigation words.
- Ensure actionable controls are at least 44 x 44 pt and do not overlap raised
  Add or timeline cards.
- Expose semantic screen-reader labels, current/selected state, progress value,
  task completion and undo/recovery action.
- Provide non-color cues for active, complete, importance, focus, reward, error,
  loading and rest/buffer; verify color-blind comprehension.
- Check Russian-label truncation and central Add reachability/safe-area behavior.
- Verify reduced motion, disabled haptics/sound, keyboard/focus order where
  supported, and small-screen density before Phase B approval.

These are future validation items, not claims of current runtime verification.

## 13. Raster and production-asset boundary

PNG files in `visual-references/orbits/` are immutable references. Do not crop,
trace, recolor, export or copy raster fragments into `apps/` or `packages/`.
Production implementation must create reviewed vector/icon assets and semantic
tokens separately. The concept board is particularly non-production: its
glossy mini-icons are inspiration, not final small-size iconography. Provider
marks, third-party logos and licensing remain outside this approval.
No production asset enters `apps/mobile/assets` during Phase A; image-generation
artifacts are not exact specifications.

## 14. Deferred decisions

- Final hex values, contrast pairs, dark/high-contrast themes and token package.
- Exact type scale/font decision and localization-specific line-height.
- SVG/icon source, licensing and provider-brand implementation.
- Expo route migration from current tabs to the five-item contract.
- Timeline category taxonomy, empty/error/loading copy and completed-card motion.
- Motion duration/easing, haptic mapping and sound policy after device review.
- Words-only calm-mode placement and personalization architecture, preview/reset
  and Orbits fallback for future Focus Sparks/Focusiki packs.
- Pricing, billing, entitlement, store or paywall behavior (separate task).

## Approval and evidence boundary

Approved on 2026-08-27: Orbits visual language as documented, navigation direction
02, and Today direction 01. Retained for history: navigation direction 01.

Not approved or not evidenced: production SVG/vector assets, exact shared
tokens, full five-item runtime navigation, redesigned Today implementation,
physical Android behavior, contrast/text-scaling/screen-reader runtime checks,
reduced-motion/haptics verification, provider marks, paid packs and billing.
Phase B may begin only after its implementation and accessibility evidence gate;
this document alone does not claim completion of Task 0039.
