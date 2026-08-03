# Backend

## Modules

`AppModule` объединяет `PrismaModule`, `AuthModule`, `UsersModule`, `TasksModule`, `RoutinesModule`, `NotificationsModule` и `PlanModule`.

| Module | Ответственность |
|---|---|
| Auth | password JWT и OAuth controllers |
| Users | операции текущего профиля |
| Tasks | задачи, подзадачи, completion |
| Routines | recurring weekday templates |
| Notifications | push token, queue processor, delivery logs |
| Plan | Free/Pro и лимиты |
| Prisma | общий Prisma client lifecycle |

## Validation и CORS

Global strict `ValidationPipe` описан в `apps/api/src/main.ts`. Development CORS разрешает localhost origins; production policy должна быть задана отдельно. API слушает `PORT` или 3000.

## Конфигурация очереди

Notifications используют BullMQ. `AppModule` подключает Redis host/port defaults; `.env.example` также документирует `REDIS_URL`, поэтому перед production deployment нужно подтвердить фактически используемые переменные.

## Tests

Unit tests присутствуют для tasks и notifications: `apps/api/src/**/*.spec.ts`. E2E test configuration находится в `apps/api/test/`. Точные команды — в `Development.md`.