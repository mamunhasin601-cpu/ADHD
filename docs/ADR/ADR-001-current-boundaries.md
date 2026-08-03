# ADR-001: Current system boundaries

## Context

Репозиторий содержит npm workspaces для `apps/*` и `packages/*`. В найденном дереве есть `apps/api`, `apps/mobile` и `packages/shared-types`. Документация описывает backend boundary как `apps/api`, mobile client boundary как `apps/mobile`, shared TypeScript-типы как `packages/shared-types`, persistence boundary как Prisma/PostgreSQL, а asynchronous infrastructure как BullMQ/Redis.

`README.md` упоминает `apps/web` как Next.js часть, реализуемую после валидации MVP. В текущем дереве из предоставленного списка файлов `apps/web` отсутствует.

## Decision

Считать текущими архитектурными границами:

- `apps/api` — backend boundary;
- `apps/mobile` — текущий mobile client boundary;
- `packages/shared-types` — shared TypeScript types boundary;
- Prisma/PostgreSQL — persistence boundary;
- BullMQ/Redis — asynchronous infrastructure boundary.

Web, полноценный production deployment и не подтверждённые внешние интеграции считать planned/unspecified до появления кода или конфигурации.

## Consequences

- Архитектурная документация остаётся traceable к текущему дереву проекта.
- Roadmap-элементы не документируются как уже реализованные system boundaries.
- Интеграции и deployment-настройки, отсутствующие в коде/конфигурации, не считаются принятыми решениями.

## Alternatives

В коде не найдено альтернативной текущей boundary-модели. `README.md` содержит planned `apps/web`, но это описано как будущая часть после валидации MVP, а не как текущая реализация.

## Sources

- `package.json`
- `README.md`
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma`
- `docs/Architecture.md`
- `docs/Backend.md`
- `docs/Frontend.md`