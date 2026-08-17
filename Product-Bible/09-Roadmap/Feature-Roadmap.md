# Feature Roadmap

> Статус: структура и оглавление.
>
> Текущие engineering-статусы, known gaps и technical debt остаются в [Engineering Handbook v5](../../docs/Engineering-Handbook-v5.md) и [Technical Debt Roadmap](../../docs/Technical-Debt-Roadmap.md). Этот документ хранит продуктовые приоритеты и evidence gates.

## Содержание

### 1. Roadmap model

#### 1.1 Горизонты: now, next, later, parked

#### 1.2 Разница между идеей, гипотезой и обязательством

#### 1.3 Статусы: proposed, validated, planned, shipped, retired

#### 1.4 Как фиксировать неопределенность

### 2. Current product baseline

#### 2.1 Подтвержденная пользовательская ценность

#### 2.2 Реализованные продуктовые поверхности

#### 2.3 Неполные или ограниченные capability

#### 2.4 Явно отсутствующие capability

### 3. Phase 1: dependable day planning

#### 3.1 Timeline и day navigation

#### 3.2 Быстрое создание и редактирование задач

#### 3.3 Subtasks и routines

#### 3.4 Надежные reminders

#### 3.5 Onboarding и первый полезный старт

#### Принятое направление Phase 1

Phase 1 реализует минимальное ядро из [PDR-001](../12-Decisions/PDR-001-Timeline-Centered-Day-Experience.md):

- Today как вертикальный таймлайн;
- карточку «Сейчас» как главный объект;
- быстрое добавление после одного названия;
- приблизительную длительность и вариант `Не знаю`;
- мысли без обязательного планирования;
- базовый recovery с preview и undo;
- отдых, буферы и свободные окна как допустимую часть дня.

#### Ближайшая последовательность Phase 1

Завершенная работа:

1. **Task 0012 — actionable `Сейчас` card — completed.**
2. **Task 0013 — user-facing `Мысли` language — completed.**
3. **Task 0014 — explicit quick-capture destinations — completed.**

4. **Task 0015 — approximate task duration with a first-class
   `Не знаю` option — completed.** Реализован и проверен ограниченный production slice:
   `durationMinutes` хранит точную модель `number | null`, а `Не знаю` доступно
   в полной форме и quick capture без скрытой подстановки длительности.
   `Не знаю` является полноценным допустимым ответом, а не ошибкой или
   незавершенным состоянием; при его выборе Focus не придумывает длительность
   молча. Возможность указать приблизительную длительность сохраняет
   title-first capture и не заставляет пользователя планировать до фиксации.
   Slice согласован с
   [PDR-001](../12-Decisions/PDR-001-Timeline-Centered-Day-Experience.md) и
   [Future Screen Map](../05-Experience/Future-Screen-Map.md).

5. **Task 0016 — user-controlled time format — completed.** Профиль хранит
   независимое предпочтение `SYSTEM | H24 | H12`; настройка применяется через
   единый presentation-only контракт ко всем существующим мобильным clock-time
   поверхностям, не меняя timezone, timestamps, границы дня или scheduling.
   Реализация следует [PDR-002](../12-Decisions/PDR-002-User-Controlled-Time-Format.md).

6. **Task 0017 — explicit task start state — completed.** Пользователь явно
   начинает задачу из карточки `Сейчас`; сервер сохраняет первый `startedAt`,
   а расписание само по себе никогда не означает начало. Это историческое,
   неэксклюзивное событие без focus session, паузы, таймера или поведения
   помощника и соответствует принятому [PDR-001](../12-Decisions/PDR-001-Timeline-Centered-Day-Experience.md).

7. **Task 0018 — persisted first step and difficult-start support — completed.**
   Пользователь может сохранить короткий наблюдаемый первый шаг и открыть спокойную
   поддержку трудного начала из карточки `Сейчас`. Сохранение не начинает задачу;
   только отдельное явное действие использует существующую команду начала. Это не
   AI-декомпозиция, таймер, focus session или capability помощника.

8. **Task 0019 — first useful onboarding moment — completed.** Онбординг теперь
   просит только название первого намерения, явно добавляет его на сейчас с
   неизвестной длительностью и передаёт управление авторитетному auth guard,
   чтобы пользователь сразу попал к канонической карточке `Сейчас`. Пропуск и
   частичные ошибки остаются спокойными и повторяемыми без дублирования задачи.

9. **Task 0020 — contextual notification permission — completed.** Нативный запрос разрешения больше не запускается при аутентифицированной загрузке: спокойное приглашение появляется только после полезной Now Card, отказ «Не сейчас» хранится отдельно от системного запрета, а единый lifecycle-владелец обслуживает Today, Settings и AppState.

10. **Task 0021 — calm seven-day navigation — completed.** Компактная полоса
    понедельник–воскресенье усиливает существующий Today-таймлайн: выбранный день
    открывается одним нажатием через канонический запрос, сегодняшний день отмечен
    отдельно, а текущие Now/Recovery/progress/notification/autoscroll поведения не
    переносятся в planning view другой даты. Полоса не создаёт Week screen,
    дополнительных запросов, task-count индикаторов, жестов или нового кэша.

11. **Task 0022 — honest basic recurring tasks — completed.** Every-day and
    Monday–Friday repeats now produce bounded, stable, independently actionable
    occurrences in the profile calendar timezone. Series-wide edit/delete scope
    is explicit; DST wall time, free-tier counting, reminders, recovery isolation,
    complete start/stop transitions, atomic history-preserving edits, bounded batched renewal, and idempotent generation are defined in
    [the Task 0022 record](../../docs/tasks/0022-honest-basic-recurring-tasks.md).

12. **Task 0023 — calm global title-first capture — completed.** Один владелец
    глобального `+` теперь доступен в Today, Thoughts, Focus и Settings. Он
    сохраняет название первым, честно оставляет длительность неизвестной и по
    умолчанию отправляет запись в «Мысли», а Today передаёт тому же владельцу
    точный выбранный instant таймлайна. Подробности и границы проверки записаны
    в [Task 0023](../../docs/tasks/0023-calm-global-title-first-capture.md).

13. **Task 0024 — profile-local timeline geometry — completed.** Вертикальные
    координаты задач, пересечений, линии «сейчас» и начального autoscroll теперь
    используют одну profile-local wall-clock систему. Валидная IANA timezone
    профиля имеет приоритет, а отсутствующая или невалидная timezone явно
    использует device-local поля без UTC fallback. Planning views другой даты
    не показывают и не имитируют текущий момент. Контракт и проверка описаны в
    [Task 0024](../../docs/tasks/0024-profile-local-timeline-geometry.md).

14. **Task 0025 - honest atomic manual task parts - completed.** Ordinary root
    tasks now persist an optional user-authored parts draft atomically with the
    parent. Parts remain distinct from `firstStep`, recurring tasks, root task
    counting, reminders, and independent Today/Thoughts items. Contract and
    validation evidence are recorded in
    [Task 0025](../../docs/tasks/0025-honest-atomic-manual-task-parts.md).

Остальные capability Phase 1 остаются на горизонте, но их точный порядок пока
не принят. Контекстный помощник, overload mode и focus session относятся к
следующему расширению опыта; AI-декомпозиция, energy-aware suggestions и
explainable rescheduling не блокируют проверку минимального ядра. Принятое
требование формата времени в Профиле зафиксировано в
[PDR-002](../12-Decisions/PDR-002-User-Controlled-Time-Format.md), но не становится
автоматически Task 0015 и не ставится впереди approximate duration.

### 4. Phase 2: focus and body doubling

#### 4.1 Focus session experience

#### 4.2 Public и private rooms

#### 4.3 Presence без обязательной камеры

#### 4.4 Timer и session completion

#### 4.5 Safety, moderation, and privacy

### 5. Phase 3: Smart Planner and AI

#### 5.1 Planning suggestions

#### 5.2 Recovery and overload modes

#### 5.3 AI task decomposition

#### 5.4 Explainable rescheduling

#### 5.5 Evaluation gates before expansion

### 6. Phase 4: content and community

#### 6.1 Evidence-based content hypotheses

#### 6.2 Community experiments

#### 6.3 Partnerships and moderation

#### 6.4 Out-of-scope medical content

### 7. Platform expansion

#### 7.1 Web

#### 7.2 Tablets and desktop

#### 7.3 Wearables and ambient surfaces

#### 7.4 Cross-platform capability parity

### 8. Prioritization framework

#### 8.1 User problem severity

#### 8.2 Expected reduction of friction

#### 8.3 ADHD safety and dignity impact

#### 8.4 Evidence strength

#### 8.5 Cost, risk, and reversibility

#### 8.6 Monetization fit without value distortion

### 9. Discovery and validation gates

#### 9.1 Research gate

#### 9.2 Prototype gate

#### 9.3 Pilot gate

#### 9.4 Launch gate

#### 9.5 Stop or rollback gate

### 10. Release and deprecation principles

#### 10.1 Communication of product changes

#### 10.2 Migration expectations

#### 10.3 Sunset and removal

#### 10.4 Learning after release
