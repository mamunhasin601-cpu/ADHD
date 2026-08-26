# Product Decision Records

> Статус: структура и оглавление.
>
> Архитектурные решения оформляются в [ADR](../../docs/ADR/README.md). Этот документ предназначен только для продуктовых решений и их последствий.

## Содержание

### 1. Purpose and scope

#### 1.1 Что считается продуктовым решением

#### 1.2 Что должно быть ADR

#### 1.3 Когда достаточно обновить существующий документ

### 2. Decision record structure

#### 2.1 Context

#### 2.2 User problem

#### 2.3 Options considered

#### 2.4 Decision

#### 2.5 Expected outcome

#### 2.6 Risks and trade-offs

#### 2.7 Evidence and confidence

#### 2.8 Owner and review date

#### 2.9 Status and supersession

### 3. Decision classes

#### 3.1 Vision and positioning

#### 3.2 User philosophy

#### 3.3 UX and interaction

#### 3.4 ADHD safety

#### 3.5 Smart Planner and AI behavior

#### 3.6 Monetization

#### 3.7 Roadmap and platform

#### 3.8 Themes and personalization

### 4. Evidence quality

#### 4.1 Observation

#### 4.2 Hypothesis

#### 4.3 Validated insight

#### 4.4 Product assumption

#### 4.5 Unknown

### 5. Review and change

#### 5.1 Review cadence

#### 5.2 Trigger for reopening

#### 5.3 Rollback or supersession

#### 5.4 Cross-reference requirements

### 6. Index

#### 6.1 Active decisions

- [PDR-001: Timeline-centered day experience](PDR-001-Timeline-Centered-Day-Experience.md)
  — принято 2026-08-12; задает таймлайн как основу Today, приоритет «Сейчас»,
  recovery без стыда и границу между вдохновением Structured и копированием.
- [PDR-002: User-controlled time format](PDR-002-User-Controlled-Time-Format.md)
  — принято 2026-08-12; дает пользователю независимый от языка и часового пояса
  выбор системного, 24-часового или 12-часового отображения времени во всем Focus.

#### 6.2 Superseded decisions

#### 6.3 Open decisions

- Точная визуальная композиция Today и карточки «Сейчас».
- Финальная модель постоянной нижней навигации после проверки прототипа.
- Граница Free/Pro для расширенного помощника без ограничения базового recovery.
- Коммерческая модель visual packs: one-time purchase, subscription или часть
  более широкого premium tier.
- Финальные color/spacing/type tokens, assets и approval criteria для Orbits,
  Focus Sparks и Focusiki после Today mockup.

#### 6.4 Approved direction with planned implementation

Task 0039 утверждает направление **Focus is calm but alive**: тёплый светлый
фон, семантическая палитра, Orbits как free/default и Today как первый reference
screen. Это не PDR о runtime-реализации; rollout, packs, billing и entitlement
требуют отдельных evidence gates.
