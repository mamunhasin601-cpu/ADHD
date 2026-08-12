# ADR-006: BullMQ, Redis and Expo Push notifications

## Context

`AppModule` подключает `BullModule.forRoot` с Redis connection через `REDIS_HOST`/`REDIS_PORT`
(defaults `localhost`/`6379`).

`NotificationsModule` регистрирует BullMQ queue `TASK_REMINDERS_QUEUE`, контроллер
`NotificationsController`, `NotificationsService`, и `NotificationsProcessor`.

## Decision

Использовать BullMQ/Redis для асинхронного планирования task reminders и Expo Push API для
доставки push notifications. Дополнен ADR-009 (device token lifecycle и local/remote channel
contract).

**Final implementation rules (Package 0011 / ADR-009):**

- Deterministic `jobId = task-reminder-${task.id}`, delay = `task.startTime - now`,
  `attempts: 3`, exponential backoff (30s, 60s, 120s), `removeOnComplete: true`.
- Job payload contains only `taskId`, `userId`, `scheduledFor` — never `taskTitle` or
  user-owned content (privacy contract, ADR-009 §D-3).
- Worker sends a generic, non-sensitive Expo payload:
  `title: 'Focus'`, `body: 'Пора начинать'`, `data: { type: 'task-reminder' }`.
  No task title, notes, IDs, or user content in push body (ADR-009 §D-4).
- `DeviceNotRegistered` revokes only the affected `DeviceToken` row; other devices
  for the same user remain active (ADR-009 §D-5).
- Task CRUD (create/update/toggle/delete) always succeeds even when Redis/Expo is
  unavailable. Queue failures are secondary effects, not primary write blockers.
- `NotificationLog` records outcome, `delivered` boolean, `userId`, and `taskId`
  for reliability monitoring. Log lines follow the observability contract in ADR-008
  (outcome/counts/latency/failureClass — no user-owned content).

## Consequences

- Redis is a runtime dependency for the reminder queue; its unavailability degrades
  delivery but does not break task CRUD.
- Per-device token registry (`DeviceToken` table, ADR-009) replaces single
  `User.expoPushToken`. The legacy field is retained as a fallback during migration.
- Authenticated token lifecycle: `POST /notifications/devices` (register),
  `DELETE /notifications/devices/:id` (revoke).
- Mobile schedules local notifications in addition to server-side remote delivery
  using `expo-notifications` with deterministic identifiers (ADR-009 §D-6).
- Bootstrap reconciliation on mobile re-syncs the bounded local schedule after
  permission grant or app restart (7-day horizon).

## Unavailable verification (current environment)

PostgreSQL/Redis e2e and device smoke — **not verified** (no Docker/Redis/Postgres).
Verified: API unit/integration tests (170/170), mobile typecheck, mobile tests (168/168),
API build. See IMPLEMENTATION_STATE for current counts.

## Sources

- `apps/api/src/notifications/`
- `apps/api/prisma/schema.prisma`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/lib/local-notifications.ts`
- `docs/ADR/ADR-009-device-token-and-reminder-channels.md`