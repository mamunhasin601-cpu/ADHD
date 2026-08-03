# Deployment

## Что найдено

Docker Compose описывает локальные PostgreSQL 16 и Redis 7. API собирается Nest build и имеет Node start command. Dockerfile, CI workflow, Kubernetes manifests, hosting config, health endpoint, monitoring и backup automation в исследованном дереве не найдены.

## Production checklist

1. Собрать API через `npm run build:api`.
2. Выполнить Prisma generate в build environment.
3. Применить reviewed migrations production-safe командой.
4. Настроить PostgreSQL, Redis, HTTPS и allowed origins.
5. Передать сильные отдельные JWT secrets через secret manager.
6. Добавить health checks, logging, backups и rollback policy.

Конкретный cloud provider, scaling, backup schedule и release procedure — **не определены в репозитории**.