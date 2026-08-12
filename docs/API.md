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
| GET | `/tasks?inbox=true` | JWT | Inbox list (unscheduled tasks) |
| GET | `/tasks/recovery` | JWT | Overdue task list for recovery flow |
| POST | `/tasks/recovery/reschedule` | JWT | Confirm overdue task destination mapping |
| POST | `/notifications/devices` | JWT | Register device push token (ADR-009) |
| DELETE | `/notifications/devices/:id` | JWT | Revoke device push token |
| GET/POST/PATCH/DELETE | `/routines`, `/routines/:id` | JWT | Routine CRUD |
| GET/PATCH/DELETE | `/users/me` | JWT | Profile operations |
| GET | `/plan` | JWT | Plan info |
| POST | `/plan/upgrade`, `/plan/downgrade` | JWT | Plan change |

## DTO validation

DTOs расположены в `apps/api/src/**/dto/`. Global pipe в `main.ts` включает `whitelist`, `forbidNonWhitelisted`, `transform`. Task fields validate ISO dates, positive duration, HEX color, RRULE and UUID parent; routines validate non-empty weekday integers 0–6. Unknown fields rejected.

## Errors

Services используют стандартные Nest exceptions: bad request, unauthorized, conflict, not found и forbidden. Custom global exception filter не найден, поэтому точный error envelope следует проверять runtime.

## Inbox и Recovery endpoints

Полный контракт вертикального слайса «Come Back Without Guilt». Нормативная семантика — в
[ADR-008](ADR/ADR-008-overdue-task-recovery.md).

### GET /tasks?inbox=true — Inbox

- **Auth:** JWT обязателен. `userId` берётся только из `@CurrentUser()`.
- **Query:** `inbox` — строгий boolean. Принимаются исключительно строки `"true"` / `"false"`;
  `1`, `0`, `yes`, пустое значение и произвольный текст → **400**. Реализовано через
  `@Transform(toBooleanStrict)`; `enableImplicitConversion` в `main.ts` намеренно отключён,
  иначе `"false"` превращалось бы в `true`.
- **Поведение:** `inbox=true` возвращает задачи с `startTime: null` и **игнорирует** `date`.
- **Ownership:** `?userId=` отклоняется `forbidNonWhitelisted` → **400**.
- **Cache key (mobile):** `['tasks','inbox']`.

### GET /tasks/recovery — список просроченных задач

- **Auth:** JWT обязателен.
- **Query:** `date=YYYY-MM-DD` — необязательный. Используется мобильным клиентом для cache key.
  **Границу дня определяет сервер** по сохранённому `user.timezone`; переданный `date` не влияет
  на вычисление (ADR-008 D-2). Если timezone у пользователя нет — fallback `UTC`.
- **Overdue =** `userId` совпадает, `parentTaskId IS NULL`, `completedAt IS NULL`,
  `isRecurring = false`, `startTime IS NOT NULL` и `startTime < localDayStart` (строго `lt`).
- **Response 200:**

```json
{
  "tasks": [ /* Task[] */ ],
  "userTimezone": "Europe/Moscow",
  "localDayStart": "2026-08-04T21:00:00.000Z"
}
```

- **Route order:** объявлен до `GET /tasks/:id`, иначе `ParseUUIDPipe` вернул бы 400 (ADR-008 D-9).
- **Cache key (mobile):** `['tasks','recovery',dateParam]`, где `dateParam` считается в profile
  timezone.

### POST /tasks/recovery/reschedule — подтверждение переноса

- **Auth:** JWT обязателен. `userId` из тела запроса отклоняется (**400**).
- **Request:**

```json
{
  "items": [
    { "taskId": "<uuid>", "targetStartTime": "2026-08-06T10:00:00.000Z" },
    { "taskId": "<uuid>", "targetStartTime": null }
  ]
}
```

- **Explicit null:** `null` означает «перенести в Inbox» (`startTime = null`) и никогда не является
  неявным fallback. **Отсутствующий ключ** `targetStartTime` — не Inbox, а ошибка валидации (400).
- **Ограничения:** `items` непустой, без дублей `taskId`, не длиннее
  `FREE_TIER_LIMITS.maxActiveTasks` (сейчас 50, согласовано с `PlanService`).
- **Атомарность:** условия eligibility входят в `where` самого `updateMany`, поэтому параллельное
  завершение задачи не может быть перезаписано. Любая невалидная позиция отклоняет весь batch —
  частичной записи нет.
- **Response 200:**

```json
{
  "updatedCount": 2,
  "taskUpdateStatus": "ok",
  "reminderSyncStatus": "partial",
  "failedReminderSyncs": ["<uuid>"]
}
```

- **Partial reminder:** `reminderSyncStatus: "partial"` — это **не** HTTP-ошибка. Перенос задач
  закоммичен; не удалось синхронизировать только часть напоминаний. Backend не сохраняет
  запрос на повторную синхронизацию и не повторяет её при следующем подключении, поэтому UI
  сообщает об этом нейтрально и предлагает переоткрыть задачу и сохранить время заново.
- **Идемпотентность:** повторная отправка того же подтверждённого payload не даёт второй записи —
  задача уже не подходит под условия overdue, поэтому приходит **409**, а напоминание
  доставляется ровно один раз.

#### Status codes

| Условие | Статус |
|---|---|
| валидный ISO destination или явный `null` | 200 |
| `reminderSyncStatus: "partial"` (запись прошла) | 200 |
| `targetStartTime` отсутствует / malformed / пустая строка | 400 |
| невалидный UUID, пустой `items`, превышен размер `items` | 400 |
| неизвестное поле в теле или в item | 400 |
| чужая или несуществующая задача | 403 |
| stale state (`code: "STALE_RECOVERY_STATE"`, `staleTaskIds`) | 409 |
| destination не является абсолютным ISO-инстантом (без `Z`/offset, date-only) | 400 |
| destination ≤ текущему `referenceInstant` сервиса (включая equal-to-now и earlier-today) | 422 |

#### Cache invalidation (mobile)

После успешной мутации инвалидируются `['tasks','recovery',dateParam]` и `['tasks',dateParam]`;
`['tasks','inbox']` — только если в batch присутствует destination `null`. При 409 инвалидируется
recovery-ключ для повторной загрузки актуального списка; прочие ошибки оставляют состояние
экрана нетронутым и допускают повтор.