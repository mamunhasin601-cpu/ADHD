# API

Local base URL: `http://localhost:3000`. Защищённые routes требуют `Authorization: Bearer <accessToken>`.

## Routes

| Method | Route | Auth | Назначение |
|---|---|---|---|
| POST | `/auth/register` | — | Регистрация |
| POST | `/auth/login` | — | Вход |
| POST | `/auth/refresh` | — | Обновление JWT |
| GET | `/auth/me` | JWT | Текущий пользователь |
| GET | `/auth/yandex`, `/callback` | OAuth | Yandex flow |
| GET | `/auth/vk`, `/callback` | OAuth | VK flow |
| GET | `/auth/mailru`, `/callback` | OAuth | Mail.ru flow |
| GET/POST/PATCH/DELETE | `/tasks`, `/tasks/:id` | JWT | Task CRUD |
| PATCH | `/tasks/:id/toggle` | JWT | Toggle completion |
| GET/POST/PATCH/DELETE | `/routines`, `/routines/:id` | JWT | Routine CRUD |
| GET/PATCH/DELETE | `/users/me` | JWT | Profile operations |
| GET | `/plan` | JWT | Plan info |
| POST | `/plan/upgrade`, `/plan/downgrade` | JWT | Plan change |

## DTO validation

DTOs расположены в `apps/api/src/**/dto/`. Global pipe в `main.ts` включает `whitelist`, `forbidNonWhitelisted`, `transform`. Task fields validate ISO dates, positive duration, HEX color, RRULE and UUID parent; routines validate non-empty weekday integers 0–6. Unknown fields rejected.

## Errors

Services используют стандартные Nest exceptions: bad request, unauthorized, conflict, not found и forbidden. Custom global exception filter не найден, поэтому точный error envelope следует проверять runtime.