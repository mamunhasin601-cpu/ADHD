# ADR-007: npm workspaces monorepo

## Context

Root `package.json` объявляет проект `focus-app`, `private: true` и npm workspaces:

- `apps/*`
- `packages/*`

Root scripts делегируют команды в workspaces:

- `dev:api` → `apps/api`
- `dev:mobile` → `apps/mobile`
- `build:api` → `apps/api`
- `test:api` → `apps/api`
- Prisma scripts → `apps/api`

`README.md` описывает структуру монорепозитория с `apps/api`, `apps/mobile`, planned `apps/web` и `packages/shared-types`.

## Decision

Использовать npm workspaces monorepo для организации приложений и общих пакетов:

- applications размещаются под `apps/*`;
- shared packages размещаются под `packages/*`;
- root scripts запускают workspace-specific команды.

## Consequences

- Backend, mobile client и shared TypeScript-типы живут в одном репозитории.
- Общие типы доступны как workspace package, например `@focus/shared-types` в backend и mobile коде.
- Root package управляет общими scripts и TypeScript dev dependency.
- Planned `apps/web` описан в документации, но в текущем дереве файлов не подтверждён как реализованное workspace-приложение.

## Alternatives

В коде не найдено альтернативной workspace-системы вроде pnpm/yarn workspaces или polyrepo layout. Текущий root `package.json` явно использует npm workspaces.

## Sources

- `package.json`
- `README.md`
- `apps/api/src/auth/auth.service.ts`
- `apps/mobile/stores/auth.store.ts`
- `apps/mobile/lib/api-client.ts`
- `docs/Architecture.md`