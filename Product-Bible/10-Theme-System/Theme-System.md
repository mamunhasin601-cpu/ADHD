# Theme System

> Статус: approved product direction; implementation planned, not runtime-verified.
>
> Компонентная реализация, токены и архитектурные ограничения должны быть согласованы с [Frontend](../../docs/Frontend.md), [Architecture](../../docs/Architecture.md) и [Engineering Handbook v5](../../docs/Engineering-Handbook-v5.md), но не дублируются здесь.

## Содержание

### 1. Purpose of themes

#### 1.1 Эмоциональная поддержка

#### 1.2 Ориентация и читаемость

#### 1.3 Персонализация без визуального шума

Focus должен ощущаться как спокойный, но живой напарник: **Focus is calm but
alive**. Тема поддерживает ориентацию и возвращение к действию, а не заменяет
его декоративной настройкой.

### 2. Theme model

#### 2.1 Базовая тема

Базовая тема — **Orbits**, бесплатная и доступная без entitlement. Направление
фона — тёплый светлый вместо холодного чисто-белого. Точные hex-значения,
типографические tokens и размеры поверхностей появятся только после
implementation/accessibility review.

#### 2.2 Theme packs

Будущие coherent packs применяются последовательно ко всему продукту:

- **Orbits** — free/default, с мягкими орбитальными мотивами;
- **Focus Sparks** — будущая paid alternative с мягкой четырёхлучевой искрой и
  орбитальной точкой;
- **Focusiki** — будущий paid emotional character pack с небольшими, читаемыми
  вариантами персонажа.

Pack меняет визуальный слой, но не скрывает задачи, recovery, undo, reminders
или другие recovery-critical actions. При недоступном entitlement/asset всегда
используется Orbits; пользовательские данные не меняются.

#### 2.3 Theme worlds

#### 2.4 Contextual and time-based variants

#### 2.5 User-created combinations

### 3. Semantic design language

#### 3.1 Semantic colors

- **Purple** — бренд, навигация и primary actions.
- **Turquoise** — спокойный прогресс и завершение.
- **Coral** — важность и срочность, никогда не моральная оценка.
- **Yellow** — награды, streaks и маленькие победы.

Состояние дополнительно сообщается текстом, формой, иконкой, порядком и
доступностью; цвет не является единственным носителем смысла. Одновременное
использование всех акцентов должно быть редким, чтобы не создавать visual noise.

#### 3.2 Typography roles

#### 3.3 Spacing and density roles

#### 3.4 State and feedback roles

#### 3.5 Component neutrality

Карточки, timeline, quick-add и навигация используют единый набор ролей для
spacing, sizing, rounded corners, restrained shadows, typography и states.
Компонент не должен зависеть от конкретного pack или персонажа.

### 4. Companion packs

#### 4.1 Emoji packs

Custom Focus emoji могут обозначать категории задач, mood, energy, focus,
overload, recovery, маленькие победы, streaks и крупные завершения. Они не
заменяют universal system icons и не обязательны для понимания critical actions.

#### 4.2 Icon packs

Focus развивает собственные узнаваемые icons и emotional symbols, но Back,
Close, Add, Delete, Settings и Confirm остаются знакомыми и предсказуемыми.
В долгосрочном auth-направлении placeholder letters вроде `Я`, `ВК` и `@` могут
быть заменены чистыми rounded provider marks; identity и применимые brand rules
сохраняются, а marks не входят в replaceable packs.

#### 4.3 Sound packs

#### 4.4 Animation packs

Анимация остаётся вторичной: завершение может мягко подтвердить действие,
но смысл доступен без неё.

#### 4.5 Haptics and motion

Haptics, sound и motion — опциональные усилители. Reduced motion и отключённые
haptics не убирают состояние, undo или следующий шаг.

Допустимые будущие применения — completion, expansion/collapse карточки,
progress-ring update, короткая celebration, переключение pack и переход между
ясными UI states. Движение короткое, предсказуемое, безопасное при повторе и
отключается системной reduced-motion настройкой.

#### 4.6 Authentication visual direction

Будущий auth-flow может использовать тёплый светлый фон, мягкие градиенты,
restrained color shapes, unified rounded controls и узнаваемые provider marks.
Декор не должен отвлекать от login, registration, recovery или выбора провайдера.
Сохраняется политика Task 0038: показываются только явно доступные providers,
Email/Phone остаётся доступным, discovery fail-closed, а визуальная подача не
делает disabled provider callable. Provider marks не являются частью theme packs.

#### 4.7 Rewards and encouragement

Focus может коротко и искренне отмечать маленькие шаги, возвращение после
пропуска, важную задачу, спокойную серию и recovery после overload. Celebration
не блокирует работу, остаётся optional и не стирает broader progress после
пропущенного дня.

### 5. Accessibility and sensory safety

#### 5.1 Contrast and color independence

Каждая реализация проверяется на контраст, системное масштабирование, малый
экран и non-color cues. Красный/коралловый не используется как наказание за
пропуск или просрочку.

#### 5.2 Reduced motion

Переходы сохраняют причинно-следственную связь в reduced-motion режиме и не
мигают, не запускают бесконечные циклы и не требуют наблюдения.

#### 5.3 Sound and haptic controls

Haptics должны быть subtle, meaningful, optional и independently disableable,
где это уместно. Ни sound, ни vibration не являются единственным подтверждением.

#### 5.4 Cognitive load

На одном состоянии не конкурируют одновременно акцент, reward, character,
animation и несколько равнозначных CTA. Пустые и overload-состояния предлагают
один понятный следующий шаг.

#### 5.5 Accessible fallback theme

Fallback остаётся спокойным, читаемым и функционально полным. Настройки
персонализации должны позволять preview/reset, но не требовать их до действия.
Dark theme остаётся только future compatibility consideration и не заявляется
как реализованная возможность.

### 6. Product and monetization policy

#### 6.1 Free theme baseline

Free включает Orbits и базовую поддержку Focus character. Основной путь
«увидеть → начать → вернуться», recovery и undo не зависят от оплаты.

#### 6.2 Pro theme value

Sparks и Focusiki — будущая дополнительная эмоциональная ценность, а не
функциональный lock. Для коммерческой модели (one-time, subscription или
широкий premium tier) отдельное решение ещё не принято.

#### 6.3 No functional disadvantage through theming

Платный pack не скрывает данные, не ухудшает контраст и не отнимает возможность
отменить, перенести, уменьшить или продолжить план.

#### 6.4 Theme previews and reset

Будущий профиль показывает preview и reset; ошибка загрузки pack честно
возвращает Orbits. Runtime preview, store и entitlement пока не реализованы.

### 7. Content and quality rules

#### 7.1 Tone and emotional fit

Focus character используется для tips, congratulations, recovery после
сорванного плана, empty states и мягкого onboarding. Он optional/non-blocking,
не занимает главный экран постоянно, не требует реакции, не появляется после
каждого обычного действия и не говорит чрезмерно детским голосом. Support
остаётся доступным бесплатно; paid character pack расширяет только варианты.

#### 7.2 Localization

#### 7.3 Asset licensing

#### 7.4 Performance and battery expectations

#### 7.5 Theme review checklist

- [ ] Направление узнаваемо как Focus и не копирует Structured.
- [ ] Today — первый reference screen, а не обещание полного rollout.
- [ ] Проверены contrast, text scaling, touch targets, screen reader, reduced
  motion, sound/haptic opt-out и small-screen composition.
- [ ] Персонаж необязателен, не стыдит и не превращает продукт в детскую игру.
- [ ] Assets лицензированы до использования; provider marks не считаются
  реализованными без отдельного approval.

## 8. Honesty boundary

Этот документ не утверждает наличие готовых tokens, SVG/bitmap assets, Theme
Worlds, Focus Sparks, Focusiki, billing, pricing, entitlement или rollout на
каждый экран. Это продуктовая политика и план evidence-first реализации.

## Orbits background preference (Phase B.3, 2026-08-30)

Orbits is the free/default visual pack. Its user-selectable backgrounds are exactly warm, gray and dark; warm is the default and local fail-safe. This device-local preference is neither billing nor entitlement and is not synchronized through an account or server. Focus Sparks and Focusiki remain future paid alternative packs. Implementation tests do not establish physical-device, VoiceOver, TalkBack or large-text approval, and Task 0039/Phase B remain in progress.
