# ADR-002: NestJS modular API

## Context

Backend находится в `apps/api`. Корневой `AppModule` импортирует `ConfigModule`, `BullModule`, `PrismaModule`, `AuthModule`, `UsersModule`, `TasksModule`, `RoutinesModule`, `NotificationsModule` и `PlanModule`.

Документация описывает controllers как HTTP boundary, services как слой use cases и Prisma operations, modules как Nest dependency graph.

## Decision

Использовать NestJS module structure для backend API:

- `AppModule` собирает feature/infrastructure modules;
- `*.controller.ts` файлы являются HTTP boundary;
- `*.service.ts` файлы реализуют use cases и операции через зависимости;
- `*.module.ts` файлы задают dependency graph Nest-приложения.

## Consequences

- Backend разделён по Nest modules: auth, users, tasks, routines, notifications, plan и prisma.
- Feature modules подключаются через `AppModule`.
- Services могут зависеть от infrastructure services, например `PrismaService`, и от соседних application services, что уже отмечено в research-документации как зона связности.

## Alternatives

В коде не найдено альтернативной backend-архитектуры рядом с NestJS modules. Другие backend frameworks или non-modular структура в найденных файлах не представлены.

## Sources

- `apps/api/src/app.module.ts`
- `docs/Architecture.md`
- `docs/Backend.md`
- `docs/research/16-module-analysis.md`
- `docs/research/19-architecture-risk-report.md`