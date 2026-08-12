# Backend

## Modules

`AppModule` объединяет `PrismaModule`, `AuthModule`, `UsersModule`, `TasksModule`, `RoutinesModule`, `NotificationsModule` и `PlanModule`.

| Module | Ответственность |
|---|---|
| Auth | password JWT и OAuth controllers |
| Users | операции текущего профиля |
| Tasks | задачи, подзадачи, completion |
| Routines | recurring weekday templates |
| Notifications | device token registry, push queue, delivery logs | ADR-006 / ADR-009 |
| Plan | Free/Pro и лимиты |
| Prisma | общий Prisma client lifecycle |

## Validation и CORS

Global strict `ValidationPipe` описан в `apps/api/src/main.ts`. Development CORS разрешает localhost origins; production policy должна быть задана отдельно. API слушает `PORT` или 3000.

## Конфигурация очереди

Notifications используют BullMQ. `AppModule` подключает Redis host/port defaults; `.env.example` также документирует `REDIS_URL`, поэтому перед production deployment нужно подтвердить фактически используемые переменные.

## Tasks: Inbox read и Recovery

`TasksModule` содержит два use case поверх одной модели `Task`.

**Inbox read.** `TasksService.findAll` имеет отдельную ветку: при `inbox=true` фильтр —
`startTime: null`, а параметр `date` игнорируется. Boolean-поля `GetTasksQueryDto` проходят через
строгий `@Transform`, поэтому `"1"`, `"yes"` и произвольный текст отклоняются, а не приводятся к
`true`. `enableImplicitConversion` в `main.ts` отключён намеренно: он конвертировал `"false"` в
`true` до срабатывания `@Transform`.

**Recovery.** `TaskRecoveryService` (внутри `TasksModule`, отдельный модуль не создавался):

- `getOverdueTasks(userId, referenceInstant?)` — границу локального дня считает сервер по
  `user.timezone` через `toDate` из `date-fns-tz`. Клиентский `?date=` на вычисление не влияет.
- `rescheduleOverdueTasks(userId, items, referenceInstant?)` — порядок работы: проверка пустого
  массива и дублей `taskId` → валидация destinations → batch ownership-check одним запросом
  (без N+1) → транзакция → post-commit reminder sync.

**Concurrency.** Условия eligibility (`userId`, `completedAt: null`, `parentTaskId: null`,
`isRecurring: false`, `startTime: { not: null, lt: localDayStart }`) находятся в `where` самого
`tx.task.updateMany`, а не в предварительном чтении. Если `result.count !== 1`, бросается
`ConflictException` с `code: 'STALE_RECOVERY_STATE'`, и транзакция откатывается целиком. Это
закрывает гонку read-then-write: параллельное завершение задачи не может быть перезаписано.

**Reminder side effect.** Синхронизация напоминаний выполняется **после** commit и вне транзакции.
Сбой BullMQ/Redis логируется и попадает в `failedReminderSyncs`, но не откатывает перенос задач:
ответ разделяет `taskUpdateStatus: "ok"` и `reminderSyncStatus: "ok" | "partial"`. Backend не
сохраняет запрос на повторную синхронизацию и не повторяет её при следующем подключении клиента.

## Notifications: Device Token и Reminder Delivery (Package 0011)

`NotificationsModule` предоставляет:

- **`POST /notifications/devices`** — регистрация push-токена устройства (idempotent).
  Каждый авторизованный пользователь может иметь несколько активных `DeviceToken` записей.
- **`DELETE /notifications/devices/:id`** — отзыв токена по ID (ownership-enforced).
- **`NotificationsService.sendPushNotification(userId)`** — fan-out на все активные
  `DeviceToken` пользователя. Generic payload: `title: 'Focus'`, `body: 'Пора начинать'`,
  `data: { type: 'task-reminder' }`. Никаких task title, notes, IDs в push.
- **Job payload** (`TaskReminderJobData`) содержит только `taskId`, `userId`, `scheduledFor` —
  никаких `taskTitle` или user-owned content (privacy contract ADR-009).
- **`DeviceNotRegistered`** отзывает только затронутый токен, не трогая остальные устройства.
- **`User.expoPushToken`** сохраняется как legacy fallback на период миграции.

Все reminder log-строки следуют observability-контракту ADR-008:
outcome, counts, `latencyMs`, `failureClass` — без идентификаторов пользователей и задач.

## Tests

Unit tests присутствуют для tasks и notifications: `apps/api/src/**/*.spec.ts`. Реальные
HTTP-boundary тесты (полный Nest-пайплайн через supertest с production `ValidationPipe`) —
`tasks.controller.recovery.http.spec.ts` и `tasks.controller.inbox.http.spec.ts`.

Проверено на 2026-08-05 (после 0007C): `npm run test:api` — **160 passed / 10 suites**
(задействован `tasks.controller.recovery.auth-integration.spec.ts` — реальный
JwtAuthGuard + JwtStrategy + TaskRecoveryService с двумя различными пользователями).

E2E configuration — `apps/api/test/jest-e2e.json`; `notification-reliability.e2e-spec.ts` требует
поднятых Redis и PostgreSQL и не запускается `test:api` (другой testRegex). Точные команды — в
`Development.md`.