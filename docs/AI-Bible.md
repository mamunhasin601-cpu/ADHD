# AI Bible: Focus ADHD Planner

> Исполняемое руководство только для AI-агентов: GPT, Claude, Cline, Codex, Cursor, Windsurf, OpenHands и аналогов. Агент должен понять проект и выполнить изменение без устных пояснений человека.

## 0. Контракт агента

Рабочий корень: `d:\ADHD\ADHD`. Не выдумывай файлы, endpoints, модели, hooks или готовые возможности. Сначала найди реализацию, затем меняй её. При расхождении используй порядок доверия: **код → тесты → Prisma schema/migrations → ADR/research → прочие docs**. Расхождение фиксируй в PR и обновляй документацию, а не подгоняй код под устаревший текст.

Продукт — personal productivity platform для людей с ADHD/executive dysfunction. Главная ценность: снизить friction между намерением и действием. Центральная ось: `User → Tasks → Day View → Reminder/Focus/Premium effects`.

```text
apps/api/              NestJS API + Prisma + PostgreSQL + BullMQ/Redis
apps/mobile/           Expo Router React Native client
packages/shared-types/ общие TypeScript-контракты
docs/                  API, архитектура, ADR, исследования, эксплуатация
```

Поток: `mobile screen → lib/api → api-client → Nest Controller → DTO/Validation → Service → PrismaService → PostgreSQL`; для напоминания дополнительно `NotificationsService → BullMQ/Redis → processor → Expo Push`. Mobile не обращается к Prisma. Screen и Controller не содержат бизнес-логику.

## 1. Как искать код и зависимости

Перед изменением выполни из корня:

```bat
git status --short
git log -5 --oneline
```

Выполняй точечный поиск через `rg` (или глобальный поиск VS Code):

```bash
rg -n "class TasksService|TasksService|tasksService" apps/api apps/mobile packages
rg -n "@Controller|@Get|@Post|@Patch|@Put|@Delete" apps/api/src
rg -n "useQuery|useMutation|queryKey|invalidateQueries" apps/mobile/lib apps/mobile/app
rg -n "from ['\"]\.\.?/|from ['\"]@focus/" apps packages
```

Ищи definition, затем все usages, затем caller и callee. Импорт не доказывает runtime-вызов: найди фактический вызов, условия и обработку ошибки.

Backend entry points: `apps/api/src/app.module.ts` и `apps/api/src/main.ts`. Карта доменов:

| Домен | Backend | Mobile | Проверять |
|---|---|---|---|
| auth | `apps/api/src/auth/` | `app/login.tsx`, `register.tsx`, `auth-provider-select.tsx`, `stores/auth.store.ts` | JWT, refresh, OAuth |
| users | `apps/api/src/users/` | onboarding/settings и `lib/api/*` | timezone, push token |
| tasks | `apps/api/src/tasks/` | `lib/api/tasks.ts`, task form, today | ownership, limit, reminder |
| routines | `apps/api/src/routines/` | соответствующий `lib/api` | routine ≠ исполненная Task |
| plan | `apps/api/src/plan/` | `lib/api/plan.ts`, paywall | policy, client не задаёт plan |
| notifications | `apps/api/src/notifications/` | push registration | queue, processor, dedupe |
| focus | Prisma `FocusSession*`; ищи реальный source | `app/(tabs)/focus.tsx` | не считать Daily.co готовым без кода |

Для dependency/call graph выпиши `caller → changed symbol → callee → side effect`; проверь `app.module → domain.module → controller → service → injected dependency` и `screen → lib/api hook → apiClient → endpoint → controller`. `package.json` показывает package dependency, imports — code dependency, env — operational dependency. Не создавай циклы между domain modules.

## 2. Как искать Prisma-модели

Единственный источник схемы: `apps/api/prisma/schema.prisma`.

```bash
rg -n "^(model|enum|generator|datasource)|@relation|@@index|@@unique" apps/api/prisma/schema.prisma
rg -n "prisma\.[A-Za-z]+\.(find|create|update|delete|upsert|count)" apps/api/src
rg -n "class PrismaService|PrismaModule|PrismaClient" apps/api/src
dir /b apps/api/prisma/migrations
```

Фактические модели: `User`, `Task`, `Routine`, `FocusSession`, `FocusSessionParticipant`, `NotificationLog`; enum `Plan { FREE PRO }`. `Task` имеет self-relation `parentTask/subTasks`, scheduling, recurrence и `userId`. Новая user-owned модель обязана иметь relation к `User`, foreign key и индекс.

Только `PrismaService` обращается к Prisma Client. Каждый user-owned query фильтруется `userId`; `userId` нельзя принимать из body. Для resource id используй owner-aware `where` либо проверку ownership с `ForbiddenException`.

После изменения schema:

```bat
cd apps\api
npx prisma migrate dev --name describe_change
npx prisma generate
cd ..\..
npm run build:api
npm run test:api
```

Schema и migration коммитятся вместе. Production: `npx prisma migrate deploy`; не редактируй применённую migration и не заменяй историю через `db push`. `prisma:reset` удаляет локальные данные. Stale generated client исправляй `npx prisma generate`, не `as any`.

## 3. Как искать API, DTO и сервисы

```bash
rg -n "@Controller|@UseGuards|@CurrentUser|@Param|@Query|@Body|@HttpCode" apps/api/src
rg -n "apiClient\.(get|post|patch|put|delete)|'/[A-Za-z0-9_/:?-]+'" apps/mobile/lib/api apps/mobile/app
rg -n "export class .*Dto|PartialType|class-validator|IsString|IsUUID|IsOptional" apps/api/src
rg -n "@Injectable|constructor\(" apps/api/src/{auth,tasks,routines,users,plan,notifications}
```

Для каждого endpoint зафиксируй method, path, auth, DTO, response, status, errors, ownership, cache key и mobile caller. DTO лежат в `apps/api/src/<domain>/dto/`; глобальный `ValidationPipe` в `main.ts` включает `whitelist`, `forbidNonWhitelisted`, `transform`. Каждое внешнее поле получает validator. DTO не является Prisma model. Для update используй `PartialType` только при ясной nullable/clear semantics; `@IsInt({ each: true })` не проверяет диапазон `daysOfWeek 0..6`.

Controller тонкий: приватный route использует `JwtAuthGuard`, identity берётся через `@CurrentUser()`, UUID — `ParseUUIDPipe`, бизнес-логика и Prisma остаются в Service. Service — use case, ownership/security check, Plan policy и orchestration. Вторичный сбой queue не должен ломать уже сохранённый CRUD; ориентир — `TasksService.syncReminder`.

## 4. Как искать компоненты и hooks

Routes находятся в `apps/mobile/app/`, tab routes — `app/(tabs)/`, layouts — `_layout.tsx`. Используй Expo Router (`router.push`, `router.back`), не ручной React Navigation route.

```bash
rg -n "export default function|function [A-Z]|const [A-Z].*=|Stack\.Screen|router\.(push|replace|back)" apps/mobile/app apps/mobile/components
rg -n "useQuery|useMutation|useQueryClient|queryKey|invalidateQueries" apps/mobile/lib/api apps/mobile/app apps/mobile/components
rg -n "create\(|use[A-Z].*Store|SecureStore|secure-storage" apps/mobile/stores apps/mobile/lib
```

React Query hooks и API functions находятся в `apps/mobile/lib/api/`: server state, cache key, mutation и invalidation. Zustand (`stores/auth.store.ts`) — client/session state и SecureStore persistence. Не клади server state в Zustand и не делай raw axios/fetch из JSX. Optimistic mutation: `cancelQueries → previous → setQueryData → rollback onError → invalidate onSettled`. Screen отображает pending/error/empty/data.

## 5. Как писать новый код

Используй vertical slice:

1. Выбери домен и опиши сценарий.
2. Определи auth, ownership, errors, status, response и cache key.
3. При необходимости добавь schema + additive migration.
4. Создай DTO с полной валидацией.
5. Добавь Service use case.
6. Добавь Controller и module; зарегистрируй module в `app.module.ts`.
7. Добавь mobile API function/hook в `apps/mobile/lib/api/`.
8. Подключи route/screen через Expo Router.
9. Добавь tests и docs в том же PR.

Private endpoint всегда использует `@UseGuards(JwtAuthGuard)`, identity — `@CurrentUser()`, UUID — `ParseUUIDPipe`. Не используй `:userId` как identity и не доверяй `plan: PRO` из mobile body.

Notification pipeline требует `notifications.constants.ts`, typed minimal payload, deterministic `jobId`, retry/backoff, `removeOn...`, processor и `NotificationLog`. Не клади чувствительные детали в push data; учитывай отсутствие token и `DeviceNotRegistered`.

## 6. Как изменять старый код и искать баги

Перед изменением проверь `git status`, definition/usages/routes/tests/docs и baseline `npm run build:api`, `npm run test:api`. Не затирай чужие незакоммиченные изменения.

Bug algorithm: воспроизведи success/error; проследи `mobile → api-client → controller → DTO → service`; сначала проверь JWT и ownership; затем schema/migration/generated client; для reminder — timezone, delay, job id, Redis и processor; для UI — auth gate в `app/_layout.tsx`, query key и invalidation; добавь regression test.

Опасные project facts: физический телефон не видит `localhost` (нужен LAN IP); root `dev:web` ссылается на отсутствующий `apps/web`; OAuth/JWT/env нельзя логировать; Redis outage не должен удалить сохранённую задачу.

Refactoring: сначала characterization test; затем один слой и маленький diff. Не меняй одновременно naming, API contract и schema. API: additive field/endpoint → callers → deprecate → remove. Prisma: additive column → backfill → dual read/write → removal. Query keys сохраняй либо явно инвалидируй.

## 7. Как писать тесты

Для нового use case обязательны: success правильного пользователя; validation/invalid UUID/extra field; not found; чужой ресурс; FREE limit и PRO path если затронут plan; side-effect success/failure; retry/deduplication для queue.

```bat
dir /s /b apps\api\src\*.spec.ts apps\api\test\*.ts
rg -n "describe\(|it\(|beforeEach|TestingModule|jest\.fn|expect\(" apps/api/src apps/api/test
npm run test:api
npm run build:api
```

Ориентиры: `tasks.service.spec.ts`, `notifications.service.spec.ts`, `notifications.processor.spec.ts`. Mock границы (`PrismaService`, queue, provider), а не Prisma internals. Для bug fix сначала добавь падающий regression test. Известную baseline-ошибку отдели от feature diff.

## 8. Как обновлять документацию

Изменяй docs в том же PR и сверяй их с реальным call/data flow:

| Изменение | Файл |
|---|---|
| endpoint/DTO/status/error | `docs/API.md` |
| boundary/flow/responsibility | `docs/Architecture.md`, `docs/System-Bible.md` |
| решение/trade-off | `docs/ADR/ADR-NNN-*.md` |
| startup/env/migration/deploy | `docs/Development.md`, `docs/Deployment.md` |
| AI workflow | `docs/AI-Bible.md` |
| developer workflow | `docs/Developer-Bible.md` |

ADR: `Context → Decision → Alternatives → Consequences → Status`. Не описывай checkout, Daily.co, payment webhook или `apps/web` как готовые возможности без source/test evidence. Указывай реальные пути, команды и ограничения.

## 9. Pull Request для AI-агента

```text
Title: [domain] краткое изменение
Summary: что изменено и какой сценарий исправлен
Boundaries: API / mobile / Prisma / queue / shared-types
Contract: routes, DTO, status/errors, query keys, migration/backfill
Security: guard, CurrentUser, ownership, secret/token handling
Tests: exact commands/result; baseline failures отдельно
Docs: изменённые файлы
Risks/Rollback: migration, cache, queue/provider, откат
```

Перед PR выполни `git diff --check`, `git diff --stat`, `git diff`; удали `.env`, tokens, generated client и случайные artifacts из diff. Не коммить `apps/api/.env` и `apps/mobile/.env`.

## 10. Оценка рисков

Оцени `0` нет, `1` ограниченный, `2` высокий; `0–3 low`, `4–7 medium`, `8+ high`. Security/data-loss автоматически high:

```text
API contract/status/DTO       +2
JWT/OAuth/identity/secret     +3
ownership/authorization       +3
Prisma schema/migration/data  +3
React Query cache/session     +2
BullMQ/Redis/push             +2
shared-types consumers        +2
destructive/irreversible      +3
```

High risk требует regression tests, migration/rollback plan, явного review и docs. Для migration проверь backup, nullability, old/new compatibility и production `migrate deploy`.

## 11. Architecture Rules

1. `@CurrentUser()` из JWT — единственный authenticated identity.
2. User-owned read/write ограничен `userId` и проверяет ownership.
3. Controller тонкий; DTO валидирует input; Service содержит use case.
4. Только `PrismaService` обращается к Prisma Client.
5. Mobile не знает DB и не делает API calls из screen.
6. React Query = server state; Zustand = client/session state.
7. Expo Router filesystem = источник mobile routes.
8. `PlanService` = единая FREE/PRO policy точка.
9. Async effects имеют typed payload, dedupe, retry, observability.
10. Shared types не являются свалкой backend implementation details.
11. Domain imports не образуют циклы.

## 12. Code Review Rules

Отклоняй diff при любом из следующих нарушений: user id из body/query/path; user-owned query без `userId`; private route без `JwtAuthGuard`; Prisma/бизнес-логика в Controller; невалидированный DTO; server state в Zustand/raw fetch в JSX; migration отсутствует/переписана/заменена `db push`; queue без deterministic id/retry; секреты или tokens в логах/diff; только happy-path тест; docs утверждают несуществующую функцию.

Каждый review comment должен содержать файл/символ, нарушенное правило, failure/exploit scenario, исправление и требуемый тест.

## 13. Best Practices

- Делай маленький вертикальный diff в стиле соседнего домена.
- Ищи точное имя класса, route, model и query key до поиска по смыслу.
- Фиксируй observable contract тестом до refactor.
- Сначала проверяй ownership и generated client, потом косметику.
- Secondary notification failure отделяй от primary CRUD.
- Документируй status/error semantics и rollback.
- В PR перечисляй команды, baseline failures, риски и rollback.

## 14. Anti Patterns

```ts
// запрещено: подмена владельца и Prisma в Controller
create(@Body() body: { userId: string }) {
  return this.prisma.task.create({ data: body });
}
```

```tsx
// запрещено: server state и API в UI
useEffect(() => { fetch('/tasks').then(setTasks); }, []);
```

Также запрещены `as any` для stale types, отключение TypeScript/validation, AsyncStorage для access/refresh token, ручной route мимо Expo Router, baseline-fix в feature PR и массовое форматирование.

## 15. Danger Zones

- `prisma:reset` удаляет локальную БД.
- `migrate dev` нельзя использовать в production.
- OAuth/JWT secrets, `.env`, push token не логировать и не коммитить.
- Redis retry и duplicate delivery требуют политики.
- Timezone пользователя влияет на reminders.
- `localhost` с физического телефона указывает на телефон.
- Prisma schema может быть новее generated client.
- Focus/Daily.co и payment provider не считать реализованными по модели или экрану.

## 16. Финальный Checklist

- [ ] Прочитаны git status, relevant code, tests и callers.
- [ ] Определены domain, auth, ownership, errors и side effects.
- [ ] Найдены реальные route/DTO/service/model/component/hook.
- [ ] Нет user id из client input; есть guard и `@CurrentUser()`.
- [ ] Schema, migration, generate и indexes согласованы.
- [ ] Server/client state разделены; query keys/invalidation проверены.
- [ ] Queue имеет typed payload, deterministic id, retry и tests.
- [ ] Есть success, validation/error, ownership и regression tests.
- [ ] `npm run build:api` и `npm run test:api` выполнены; baseline отделён.
- [ ] API/architecture/ADR docs обновлены по необходимости.
- [ ] `git diff --check` пройден; secrets, `.env`, generated artifacts отсутствуют.
- [ ] PR содержит impact, security, tests, docs, risk и rollback.

**Definition of Done:** другой AI-агент может по этому документу и PR восстановить изменение, границы ответственности, ownership-проверку, тесты и rollback без вопроса человеку.