# ADR-003: Prisma and PostgreSQL persistence

## Context

`apps/api/prisma/schema.prisma` задаёт Prisma generator `prisma-client-js` и datasource `db` с provider `postgresql`, использующим `DATABASE_URL`.

Модель `User` связана с `Task`, `Routine`, `FocusSession`, `FocusSessionParticipant` и `NotificationLog`. User-owned модели содержат `userId`. Для `Task` объявлены индексы `@@index([userId])` и `@@index([userId, startTime])`; для `Routine` и `NotificationLog` также объявлены индексы по `userId`.

Документация указывает, что services должны выполнять запросы в контексте текущего пользователя.

## Decision

Использовать Prisma ORM поверх PostgreSQL как persistence layer backend API.

Моделировать ownership через `userId` в user-owned сущностях и поддерживать запросы по пользователю индексами в Prisma schema.

## Consequences

- Схема данных и связи фиксируются в `apps/api/prisma/schema.prisma`.
- Backend services работают с persistence через Prisma client lifecycle, предоставляемый `PrismaModule`/`PrismaService`.
- PostgreSQL является фактическим database provider для текущей реализации.
- Ownership-aware queries должны опираться на текущего пользователя и поля `userId`.

## Alternatives

В коде не найдено альтернативного database provider или второго ORM. `schema.prisma` явно задаёт `postgresql`.

## Sources

- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `docs/Database.md`
- `docs/Architecture.md`
- `docs/research/15-data-flow.md`
- `docs/research/19-architecture-risk-report.md`