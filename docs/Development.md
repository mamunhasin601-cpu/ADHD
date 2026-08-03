# Development

## Требования

Node.js LTS >= 20, npm >= 10, Docker Desktop >= 24 и Git (`README.md`).

```bash
npm install
copy .env.example .env
docker compose up -d
cd apps/api
npx prisma migrate dev
npx prisma generate
cd ../..
npm run dev:api
```

В отдельном терминале:

```bash
npm run dev:mobile
```

## Полезные команды

```bash
npm run build:api
npm run test:api
cd apps/api
npm run test:e2e
npm run prisma:studio
```

Из `apps/mobile` доступны platform scripts `android`, `ios`, `web`. Root web script ссылается на `apps/web`, которого нет в текущем дереве.

## Local services

`docker-compose.yml` поднимает PostgreSQL 16 на 5432 и Redis 7 на 6379 с named volumes. Проверка: `docker compose ps`.

Не коммитьте `.env`, JWT, OAuth/API keys и push credentials.