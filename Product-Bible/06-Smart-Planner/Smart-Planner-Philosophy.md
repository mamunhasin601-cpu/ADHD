# Smart Planner Philosophy

> Статус: структура и оглавление.
>
> Это спецификация продуктового поведения. Реализация планирования, API и data flow должны быть сверены с [Engineering Handbook v5](../../docs/Engineering-Handbook-v5.md) и [System Bible](../../docs/System-Bible.md).

## Содержание

### 1. Purpose and boundaries

#### 1.1 Какую проблему решает Smart Planner

#### 1.2 Что Smart Planner не обещает

#### 1.3 Граница между помощником и автопилотом

### 2. Planning principles

#### 2.1 Suggest before act

#### 2.2 Realistic capacity over maximal utilization

#### 2.3 Buffers, uncertainty, and recovery time

#### 2.4 One useful next step

#### 2.5 Plan for variability, not an ideal day

### 3. Inputs and context

#### 3.1 User intent and priorities

#### 3.2 Time, duration, and constraints

#### 3.3 Energy and context signals

#### 3.4 Explicit preferences

#### 3.5 Missing or unreliable information

### 4. Planner modes

#### 4.1 Morning assembly

#### 4.2 During-task support

#### 4.3 Missed-task recovery

#### 4.4 Overload reduction

#### 4.5 Evening reset

### 5. Actions

#### 5.1 Suggest

#### 5.2 Preview

#### 5.3 Accept

#### 5.4 Edit

#### 5.5 Reschedule

#### 5.6 Simplify

#### 5.7 Cancel

#### 5.8 Undo and restore

### 6. Explainability and trust

#### 6.1 Why a suggestion was made

#### 6.2 What will change

#### 6.3 Confidence and uncertainty

#### 6.4 User override

#### 6.5 No silent re-planning

### 7. Learning loop

#### 7.1 Explicit feedback

#### 7.2 Behavioral signals

#### 7.3 Personalization boundaries

#### 7.4 Resetting stale assumptions

### 8. Safety rules

#### 8.1 Impossible schedule handling

#### 8.2 No moral scoring

#### 8.3 No medical inference

#### 8.4 No irreversible high-impact action without consent

### 9. Evaluation

#### 9.1 Helpful-start metric

#### 9.2 Return-after-interruption metric

#### 9.3 Overload and abandonment signals

#### 9.4 Qualitative evaluation scenarios

#### 9.5 Stop conditions

