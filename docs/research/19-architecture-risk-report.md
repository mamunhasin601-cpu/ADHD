# 19. Architecture Risk Report

Дата аудита: 2026-08-03  
Область: `apps/api`, `apps/mobile`, `packages/shared-types`, research docs `13-18`.

## Executive summary

Проект имеет понятную монорепо-структуру и базовое разделение `api/mobile/shared-types`, но обнаружены архитектурные риски, которые будут дорожать при росте продукта: крупные mobile-экраны, сервисы с несколькими ответственностями, дублирование OAuth-flow, жёсткие связи между слоями и повторяющиеся UI/business-константы. Наиболее критичные риски связаны с безопасностью OAuth/token handling, dev-upgrade/paywall flow, нестойкой генерацией пароля через `Math.random()` и отсутствием явных timeout/retry для внешних `fetch` на backend.

Критичность: **Critical / High / Medium / Low**.

## Матрица находок

| # | Категория | Файл | Критичность |
|---|---|---|---|
| 1 | SOLID/SRP, God Object, Low Cohesion | `apps/mobile/app/(tabs)/today.tsx` | High |
| 2 | SOLID/SRP, Large Component, Long Methods | `apps/mobile/app/task-form.tsx` | High |
| 3 | Tight Coupling, Shotgun Surgery | `apps/mobile/lib/api-client.ts`, `apps/mobile/stores/auth.store.ts` | High |
| 4 | Duplicate Code, Shotgun Surgery | `apps/api/src/auth/*oauth*.controller.ts`, `apps/api/src/auth/oauth.service.ts` | High |
| 5 | Security | `apps/api/src/auth/oauth.service.ts` | High |
| 6 | Security/Reliability | `apps/api/src/auth/*oauth*.controller.ts`, `apps/api/src/notifications/notifications.service.ts` | High |
| 7 | Security / Business Logic Abuse | `apps/mobile/app/paywall.tsx`, backend plan upgrade flow | Critical |
| 8 | Magic Strings, Security policy drift | Auth DTOs/services and mobile auth screens | Medium |
| 9 | Performance / Large Component | `apps/mobile/components/timeline/Timeline.tsx` | Medium |
| 10 | Dead Code | `apps/mobile/lib/timeline-layout.ts` | Low |
| 11 | Magic Numbers / Magic Strings | mobile screens/components, `apps/api/src/tasks/tasks.service.ts` | Medium |
| 12 | Duplicate Code / UI consistency | `apps/mobile/app/login.tsx`, `register.tsx`, `auth-provider-select.tsx` | Medium |
| 13 | Feature Envy / Layer violation | `apps/api/src/tasks/tasks.service.ts` | Medium |
| 14 | Tight Coupling / DIP violation | `apps/api/src/*/*.service.ts` using `PrismaService` directly | Medium |
| 15 | Cyclic Dependencies risk | `TasksModule`, `NotificationsModule`, `PlanModule`; mobile auth/api client | Low/Watch |
| 16 | Type safety / Maintainability | production casts `as any`, `unknown as string` | Medium |
| 17 | Dead artifact / Repo hygiene | `apps/api/tsconfig.tsbuildinfo` | Low |
| 18 | Security / Privacy | `apps/api/src/notifications/notifications.service.ts` | Medium |

---

## 1. `today.tsx`: экран стал feature-container/God Object

**Файл:** `apps/mobile/app/(tabs)/today.tsx`  
**Категории:** нарушения SOLID/SRP, God Object, Large Component, Low Cohesion, Long Methods  
**Критичность:** High

**Проблема:** экран Today объединяет навигацию, загрузку задач, фильтрацию и агрегацию прогресса, timeline interaction, empty states, modal quick-create, стили и обработку free-tier ошибок. Это нарушает Single Responsibility Principle: любое изменение в timeline, создании задач, UI-состояниях или тарифных лимитах затрагивает один и тот же файл.

**Риск:** высокая вероятность merge conflicts и regression; бизнес-логику трудно тестировать отдельно от React Native UI.

**Предложенное исправление:**
- выделить `useTodayViewModel(date)` для query/mutations/progress/currentTask;
- вынести quick-create modal в `QuickCreateTaskModal`;
- вынести header/date controls в `TodayHeader`;
- оставить `today.tsx` как композиционный экран без бизнес-вычислений.

---

## 2. `task-form.tsx`: крупная форма с бизнес-логикой

**Файл:** `apps/mobile/app/task-form.tsx`  
**Категории:** SOLID/SRP, Large Component, Long Methods, Magic Numbers, Shotgun Surgery  
**Критичность:** High

**Проблема:** форма содержит состояние множества полей, subtasks, presets, validation, submit orchestration, navigation и большой `StyleSheet`. Изменение правил задачи требует правок и в DTO/backend, и в этом UI-файле.

**Предложенное исправление:**
- `useTaskForm(initialTask?)` для состояния/валидации/submit;
- компоненты `TaskTimeFields`, `TaskRecurrenceFields`, `SubtaskEditor`, `ColorPresetPicker`;
- общая схема валидации DTO/формы через shared constants/schema, при этом backend остаётся source of truth.

---

## 3. `api-client` и `auth.store`: tight coupling и скрытый runtime-cycle risk

**Файлы:** `apps/mobile/lib/api-client.ts`, `apps/mobile/stores/auth.store.ts`  
**Категории:** Tight Coupling, Shotgun Surgery, потенциальные циклические зависимости  
**Критичность:** High

**Проблема:** store вызывает `setAuthToken` из API client, API hooks используют общий singleton client. Auth/session state и HTTP transport связаны напрямую. При добавлении refresh-token/interceptor/logout flow легко получить цикл: client должен знать store, store должен знать client.

**Предложенное исправление:**
- ввести `AuthTokenProvider`/`TokenStorage` interface;
- API client получает token через dependency injection или callback;
- auth store не импортирует конкретный axios client, а вызывает application service `authSessionService`.

---

## 4. OAuth controllers/service: дублирование provider flow

**Файлы:** `apps/api/src/auth/yandex-oauth.controller.ts`, `apps/api/src/auth/vk-oauth.controller.ts`, `apps/api/src/auth/mailru-oauth.controller.ts`, `apps/api/src/auth/oauth.service.ts`  
**Категории:** Duplicate Code, Shotgun Surgery, OCP violation, Low Cohesion  
**Критичность:** High

**Проблема:** каждый OAuth provider вручную реализует exchange code/token, fetch profile, map profile и error handling. Добавление provider или изменение логирования/timeout/security требует изменений в нескольких местах.

**Предложенное исправление:**
- создать `OAuthProviderStrategy` interface: `exchangeCode`, `fetchProfile`, `normalizeProfile`;
- общий `OAuthCallbackService` и тонкие provider adapters;
- provider-specific config вынести в конфигурацию и env validation.

---

## 5. Нестойкая генерация пароля для OAuth-пользователей

**Файл:** `apps/api/src/auth/oauth.service.ts`  
**Категория:** Security  
**Критичность:** High

**Проблема:** используется генерация случайного пароля через `Math.random().toString(36).slice(-16)`. `Math.random()` не криптографически стойкий и не подходит для security-sensitive значений.

**Предложенное исправление:**
```ts
import { randomBytes } from 'crypto';
const randomPassword = randomBytes(32).toString('base64url');
```
Лучше — для OAuth-only аккаунтов не создавать usable password вообще: хранить `passwordHash: null` и запрещать password login до явной установки пароля.

---

## 6. Backend `fetch(...)` без timeout/retry/redaction policy

**Файлы:** `apps/api/src/auth/*oauth*.controller.ts`, `apps/api/src/notifications/notifications.service.ts`  
**Категории:** Security, Performance/Reliability  
**Критичность:** High

**Проблема:** backend делает внешние `fetch(...)` к OAuth providers и Expo Push API. Без явного timeout такие вызовы могут зависать дольше ожидаемого и занимать ресурсы. Нет единой политики retry/backoff, circuit breaker и redaction логов.

**Предложенное исправление:**
- обернуть fetch в `HttpClientService` с `AbortController` timeout;
- retry только для transient ошибок;
- запретить логирование access/refresh tokens;
- добавить метрики latency/error-rate по provider.

---

## 7. Paywall/dev upgrade endpoint как критический business-security risk

**Файл:** `apps/mobile/app/paywall.tsx`; связанный backend plan upgrade flow  
**Категории:** Security, Business Logic Abuse  
**Критичность:** Critical

**Проблема:** в paywall flow отмечена временная dev-логика upgrade без полноценной IAP/receipt validation. Если такой endpoint доступен в production, пользователь может получить Pro без платежа.

**Предложенное исправление:**
- dev endpoint включать только при `NODE_ENV !== 'production'` и отдельном feature flag;
- production upgrade только через backend receipt validation;
- добавить audit log изменения плана;
- покрыть e2e тестом запрет dev-upgrade в production config.

---

## 8. Размытые security/business policies между слоями

**Файлы:** `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/oauth.service.ts`, DTOs, `apps/mobile/app/register.tsx`  
**Категории:** Magic Strings, Shotgun Surgery, Security policy drift  
**Критичность:** Medium

**Проблема:** значения вроде timezone defaults, минимальной длины пароля, default duration/color и validation hints легко расходятся между backend и mobile. Это создаёт policy drift: UI может обещать одно, backend требовать другое.

**Предложенное исправление:**
- `packages/shared-types/src/policies.ts`: `DEFAULT_TIMEZONE`, `MIN_PASSWORD_LENGTH`, `DEFAULT_TASK_DURATION_MINUTES`, `DEFAULT_TASK_COLOR`;
- backend должен оставаться source of truth, mobile использует shared constants только для UX/pre-validation.

---

## 9. Timeline rendering: потенциальная performance-проблема

**Файл:** `apps/mobile/components/timeline/Timeline.tsx`  
**Категории:** Performance, Large Component potential  
**Критичность:** Medium

**Проблема:** `ScrollView` рендерит все `hours` и все `tasks`; при большом числе задач это даёт лишнюю нагрузку на JS/UI thread. Также `useEffect` для auto-scroll может иметь неполный dependency list, если использует вычисленные параметры вне deps.

**Предложенное исправление:**
- добавить корректные dependencies для auto-scroll effect;
- мемоизировать `TaskBlock`;
- при росте данных перейти на virtualized list/windowing;
- вынести press-to-create calculation в pure helper с unit-тестами.

---

## 10. Dead code в timeline layout

**Файл:** `apps/mobile/lib/timeline-layout.ts`  
**Категория:** Dead Code  
**Критичность:** Low

**Проблема:** переменная `clusterStart` присваивается, но фактически не используется; `void clusterStart` выглядит как подавление предупреждения после незавершённого refactoring.

**Предложенное исправление:** удалить `clusterStart` полностью или использовать его для явной модели cluster range, если это часть алгоритма.

---

## 11. Magic numbers/colors в UI и backend

**Файлы:** множество mobile screens/components (`#6B5BFC`, `24`, `32`, `12`, `90`, `10_000`), `apps/api/src/tasks/tasks.service.ts`  
**Категории:** Magic Numbers, Duplicate Code  
**Критичность:** Medium

**Проблема:** брендовые цвета, spacing, radii, durations и лимиты используются inline. Это затрудняет theme switch/accessibility и вызывает shotgun surgery.

**Предложенное исправление:**
- `apps/mobile/theme/tokens.ts`: colors, spacing, radius, typography;
- business defaults — в shared constants;
- ESLint rule/no-restricted-literals для brand colors вне tokens.

---

## 12. Дублирование login/register/OAuth UI

**Файлы:** `apps/mobile/app/login.tsx`, `apps/mobile/app/register.tsx`, `apps/mobile/app/auth-provider-select.tsx`  
**Категории:** Duplicate Code, Shotgun Surgery, Low Cohesion  
**Критичность:** Medium

**Проблема:** auth screens повторяют layout, toggles, button styles, error extraction и token persistence flow. Изменение UX или обработки ошибок требует синхронных правок в нескольких файлах.

**Предложенное исправление:**
- общий `AuthScreenShell`, `AuthSubmitButton`, `IdentifierPasswordForm`;
- `useAuthSubmit(mode)` для login/register;
- OAuth provider buttons сделать config-driven.

---

## 13. `TasksService`: feature envy к Plan/Notifications

**Файл:** `apps/api/src/tasks/tasks.service.ts`  
**Категории:** Feature Envy, Tight Coupling, SRP  
**Критичность:** Medium

**Проблема:** `TasksService` занимается не только CRUD задач, но и проверкой тарифных лимитов через `PlanService`, планированием уведомлений через `NotificationsService`, recurring/subtasks orchestration. Сервис знает слишком много о соседних bounded contexts.

**Предложенное исправление:**
- доменные/application events `TaskCreated`, `TaskUpdated`, `TaskDeleted`;
- handlers: `ScheduleTaskReminderHandler`, `CheckTaskQuotaPolicy`;
- `TasksService` оставить owner-ом task persistence/use-cases.

---

## 14. Direct Prisma everywhere: инфраструктурная связность

**Файлы:** `apps/api/src/*/*.service.ts`  
**Категории:** Tight Coupling, DIP violation, Testability  
**Критичность:** Medium

**Проблема:** сервисы напрямую зависят от `PrismaService`. Для небольшого Nest app это допустимо, но уже видны домены plan/tasks/notifications/auth. Замена persistence или тестирование business rules без Prisma mock становится дорогим.

**Предложенное исправление:**
- постепенно ввести repository interfaces для агрегатов с бизнес-логикой (`TaskRepository`, `UserRepository`);
- не оборачивать всё сразу, начать с Tasks/Auth;
- держать Prisma types на infrastructure boundary.

---

## 15. Cyclic dependencies: явных циклов не найдено, но есть зоны риска

**Файлы:** `apps/api/src/tasks/tasks.module.ts`, `apps/api/src/notifications/notifications.module.ts`, `apps/api/src/plan/plan.module.ts`, mobile `api-client`/`auth.store`  
**Категория:** Cyclic Dependencies  
**Критичность:** Low/Watch

**Проблема:** явные `forwardRef`/циклы в просмотренных файлах не выявлены, но `TasksModule` импортирует `NotificationsModule` и `PlanModule`, а сервисы вызывают друг друга на application level. При добавлении callback из Notifications/Plan обратно в Tasks появится Nest-cycle.

**Предложенное исправление:**
- зафиксировать правило dependency direction: features не импортируют друг друга для side effects;
- cross-feature communication через events/ports;
- добавить dependency-cruiser/madge check в CI.

---

## 16. Type safety smells: `any` и forced casts

**Файлы:** `apps/mobile/lib/timeline-layout.ts`, `apps/mobile/app/paywall.tsx`, тесты `*.spec.ts`  
**Категории:** Maintainability, Security adjacent  
**Критичность:** Medium

**Проблема:** casts вроде `new Date(task.startTime as unknown as string)`, style casts `as any`, многочисленные test mocks `as any` могут скрыть несовместимость shared types и API serialization.

**Предложенное исправление:**
- в shared-types разделить domain type `Task` и API DTO `TaskResponse` с ISO strings;
- добавить mapper `parseTaskResponse`;
- для RN style width использовать typed helper или `DimensionValue`;
- в тестах заменить часть `any` typed mock factories.

---

## 17. Repo hygiene/dead artifact

**Файл:** `apps/api/tsconfig.tsbuildinfo`  
**Категория:** Dead Code / Build Artifact  
**Критичность:** Low

**Проблема:** TypeScript build info попал в рабочее дерево/поиск и загрязняет аудит. Если он tracked, это источник шумных diff.

**Предложенное исправление:** добавить `*.tsbuildinfo` в `.gitignore`, удалить из git index, если tracked.

---

## 18. Potential data/privacy issue в push notification flow

**Файл:** `apps/api/src/notifications/notifications.service.ts`  
**Категории:** Security, Privacy, Compliance  
**Критичность:** Medium

**Проблема:** notification payload для Expo Push API должен оставаться минимальным. Любое расширение body/data может случайно отправить персональные данные, названия задач, notes или subtask names во внешний сервис.

**Предложенное исправление:**
- тип `PushPayload` с allowlist полей;
- snapshot/unit test, что payload не содержит `task.title`, notes, subtask names;
- centralized redaction logger.

---

## Рекомендованный порядок исправлений

1. **Critical:** закрыть/ограничить dev upgrade endpoint, внедрить production receipt validation.
2. **High security:** заменить `Math.random()` в OAuth, ввести backend `HttpClientService` с timeout/retry/redaction.
3. **High architecture:** унифицировать OAuth provider strategy и разорвать `api-client`/`auth.store` coupling.
4. **High mobile maintainability:** декомпозировать `today.tsx` и `task-form.tsx`.
5. **Medium consistency:** вынести shared business constants и mobile theme tokens.
6. **Medium domain boundaries:** перевести Tasks side effects на events/handlers.
7. **Low hygiene:** удалить `clusterStart`, проверить `*.tsbuildinfo`, добавить dependency-cycle check.

## Предлагаемые automated guards

- `madge` или `dependency-cruiser` для циклов и direction rules.
- ESLint rules: no hardcoded brand colors outside theme, no `Math.random()` in backend security-sensitive paths, no floating backend `fetch` without timeout wrapper.
- Jest/e2e: dev-upgrade forbidden in production, push payload PII allowlist, OAuth provider strategy contract tests.
- TypeScript: separate API response types for serialized dates.