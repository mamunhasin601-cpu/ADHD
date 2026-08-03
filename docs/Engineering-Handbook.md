# Focus Engineering Handbook

## Назначение

Focus — монорепозиторий мобильного планировщика дня для людей с СДВГ. Текущий код содержит Expo/React Native-клиент в `apps/mobile`, NestJS API в `apps/api` и общие типы в `packages/shared-types`.

## Быстрый маршрут по документации

- Архитектура: [Architecture](Architecture.md)
- Разработка: [Development](Development.md)
- Backend и API: [Backend](Backend.md), [API](API.md)
- Mobile: [Frontend](Frontend.md)
- Auth и данные: [Authentication](Authentication.md), [Database](Database.md)
- Эксплуатация: [Deployment](Deployment.md)

## Стек

| Слой | Технологии | Источник |
|---|---|---|
| Mobile | Expo, React Native, Expo Router | `apps/mobile/package.json`, `apps/mobile/app/` |
| API | NestJS, TypeScript | `apps/api/package.json`, `apps/api/src/` |
| Persistence | Prisma, PostgreSQL | `apps/api/prisma/schema.prisma` |
| Async jobs | BullMQ, Redis | `apps/api/src/notifications/` |
| Local infra | Docker Compose | `docker-compose.yml` |

## Важные ограничения

Факты в этом handbook основаны на файлах репозитория. CI/CD, production hosting, monitoring и backup automation в исследованном дереве не найдены. Web-приложение указано в roadmap, но `apps/web` отсутствует. Такие возможности не следует считать реализованными.