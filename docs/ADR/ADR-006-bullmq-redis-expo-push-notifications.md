# ADR-006: BullMQ, Redis and Expo Push notifications

## Context

`AppModule` подключает `BullModule.forRoot` с Redis connection через `REDIS_HOST`/`REDIS_PORT` и defaults `localhost`/`6379`.

`NotificationsModule` регистрирует BullMQ queue с именем `TASK_REMINDERS_QUEUE`, подключает `PrismaModule`, `NotificationsService` и `NotificationsProcessor`.

`NotificationsService` планирует task reminder jobs через BullMQ queue. Для задачи используется детерминированный `jobId = task-reminder-${task.id}`, delay до `task.startTime`, `attempts: 3`, exponential backoff и удаление completed jobs. Отправка push выполняется через Expo Push HTTP API `https://exp.host/--/api/v2/push/send`.

Mobile root layout после авторизации запрашивает notification permissions, получает Expo Push Token и отправляет его на backend через `PATCH /users/me`.

## Decision

Использовать BullMQ/Redis для асинхронного планирования task reminders и Expo Push API для доставки push notifications.

Mobile client отвечает за регистрацию Expo Push Token после успешной авторизации и передачу токена backend API.

## Consequences

- Redis является инфраструктурной зависимостью для reminder queue.
- Push delivery отделена от создания/обновления задачи через delayed BullMQ jobs.
- Backend хранит `expoPushToken` на модели `User` и очищает его при `DeviceNotRegistered` response от Expo.
- Notification attempts логируются через `NotificationLog`.
- Внешний Expo Push API является runtime dependency для фактической доставки уведомлений.

## Alternatives

В найденном коде не обнаружено альтернативной очереди, scheduler mechanism или другого push provider для текущей реализации. `README.md` и документация также указывают BullMQ/Redis и Expo Push.

## Sources

- `apps/api/src/app.module.ts`
- `apps/api/src/notifications/notifications.module.ts`
- `apps/api/src/notifications/notifications.service.ts`
- `apps/api/prisma/schema.prisma`
- `apps/mobile/app/_layout.tsx`
- `docs/Architecture.md`
- `docs/Backend.md`
- `docs/research/15-data-flow.md`
- `docs/research/19-architecture-risk-report.md`