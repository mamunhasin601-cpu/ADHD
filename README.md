# Focus — СДВГ-планер

Монорепозиторий мобильного + веб-приложения планировщика дня для людей с СДВГ.

**Стек:** React Native (Expo) · Next.js · NestJS · PostgreSQL · Redis · BullMQ

---

## Быстрый старт

### 1. Требования

| Инструмент | Версия | Проверить |
|---|---|---|
| Node.js LTS | ≥ 20 | `node -v` |
| npm | ≥ 10 | `npm -v` |
| Docker Desktop | ≥ 24 | `docker -v` |
| Git | любая | `git --version` |

### 2. Клонировать и установить зависимости

```bash
git clone <repo-url>
cd focus-app
npm install
```

### 3. Настроить переменные окружения

```bash
cp .env.example .env
# Отредактировать .env: убедиться что секреты заменены на реальные
```

### 4. Поднять базу данных и Redis

```bash
docker compose up -d
# Проверить: docker compose ps  — postgres и redis должны быть healthy
```

### 5. Накатить миграции Prisma

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
cd ../..
```

### 6. Запустить Backend

```bash
npm run dev:api
# API доступен на http://localhost:3000
```

### 7. Запустить мобильное приложение

```bash
npm run dev:mobile
# Expo Metro bundler стартует, открывает QR-код
# Отсканировать через Expo Go на телефоне
# Или нажать 'a' для Android-эмулятора
```

---

## Структура монорепозитория

```
focus-app/
├── apps/
│   ├── api/          NestJS backend  (порт 3000)
│   ├── mobile/       React Native / Expo
│   └── web/          Next.js  (порт 3001, реализуется после валидации MVP)
├── packages/
│   └── shared-types/ Общие TypeScript-типы
├── docker-compose.yml         PostgreSQL 16 + Redis 7
└── .env                       Переменные окружения (не коммитить!)
```

---

## API-эндпоинты

### Auth

| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/register` | Регистрация по email или телефону |
| POST | `/auth/login` | Вход, получение токенов |
| POST | `/auth/refresh` | Обновление access-токена |
| GET | `/auth/me` | Текущий пользователь (требует JWT) |

### Tasks

| Метод | Путь | Описание |
|---|---|---|
| GET | `/tasks?date=2026-07-23` | Задачи на день |
| POST | `/tasks` | Создать задачу |
| PATCH | `/tasks/:id` | Обновить задачу |
| PATCH | `/tasks/:id/toggle` | Пометить выполненной/нет |
| DELETE | `/tasks/:id` | Удалить задачу |

### Routines

| Метод | Путь | Описание |
|---|---|---|
| GET | `/routines` | Все рутины пользователя |
| POST | `/routines` | Создать рутину |
| PATCH | `/routines/:id` | Обновить рутину |
| DELETE | `/routines/:id` | Удалить рутину |

---

## Тесты

```bash
cd apps/api
npm test              # unit-тесты (Jest)
npm run test:cov      # с покрытием
```

---

## Роадмап разработки

- [x] Монорепо + Docker Compose + Prisma-схема
- [x] Backend: Auth (JWT) + Tasks + Routines CRUD
- [x] Mobile: базовый скаффолд Expo Router
- [ ] Mobile: экран таймлайна дня (таски на вертикальной шкале)
- [ ] Mobile: создание/редактирование задач
- [ ] Backend: очередь BullMQ + push-уведомления (Expo)
- [ ] Mobile: body doubling — Daily.co интеграция
- [ ] Web: Next.js версия (после валидации мобильного MVP)

---

## Юридические ограничения (читать обязательно)

- ПДн хранятся на серверах в РФ (в продакшне — Selectel / VK Cloud / Yandex Cloud)
- Медицинские данные, диагноз, лекарства — **не собираем** (152-ФЗ, спецкатегории)
- AI-функции — только через YandexGPT или GigaChat, не через западные API
- Daily.co для body doubling — live-видео без записи (запись сессий не включать в MVP)
