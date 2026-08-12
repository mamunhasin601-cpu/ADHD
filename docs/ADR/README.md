# Architecture Decision Records

Формат каждого ADR: `Context → Decision → Alternatives → Consequences → Status`.

## Индекс

| ADR | Название | Статус |
|-----|----------|--------|
| [ADR-001](ADR-001-current-boundaries.md) | Current Boundaries | active |
| [ADR-002](ADR-002-nestjs-modular-api.md) | NestJS Modular API | active |
| [ADR-003](ADR-003-prisma-postgresql-persistence.md) | Prisma / PostgreSQL Persistence | active |
| [ADR-004](ADR-004-jwt-bearer-authentication.md) | JWT Bearer Authentication | active |
| [ADR-005](ADR-005-expo-router-mobile-state-and-data.md) | Expo Router, Mobile State and Data | active |
| [ADR-006](ADR-006-bullmq-redis-expo-push-notifications.md) | BullMQ, Redis and Expo Push Notifications | active |
| [ADR-007](ADR-007-npm-workspaces-monorepo.md) | npm Workspaces Monorepo | active |
| [ADR-008](ADR-008-overdue-task-recovery.md) | Overdue-Task Recovery Semantics | accepted — pre-implementation |

## Процесс

Новые ADR создаются до реализации или одновременно с ней, если меняется архитектурная граница,
публичный API-контракт, схема данных, модель auth/security, внешняя интеграция или поток состояния.

См. `Operating-System.md` раздел 10 для полного списка условий обязательного ADR.