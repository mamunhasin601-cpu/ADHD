# Изменения в проекте Focus

## 5. Free/Pro архитектура — Paywall, план в Settings, исправление бага даты (2026-08-02)

### Что изменено

- `apps/mobile/lib/api-error.ts` — добавлен `isFreeTierLimitError(err)`: распознаёт ответ 403 с кодом `FREE_TIER_LIMIT_REACHED`.
- `apps/mobile/lib/api/plan.ts` — НОВЫЙ. `usePlanInfo()` (React Query, кэш 5 мин), `useInvalidatePlan()` — инвалидация после апгрейда.
- `apps/mobile/app/paywall.tsx` — ОБНОВЛЁН: показывает реальный прогресс (activeTasks/50), инвалидирует кэш плана после апгрейда.
- `apps/mobile/app/(tabs)/settings.tsx` — ПЕРЕПИСАН: секция Профиль (email/телефон, таймзона), секция Подписка (бейдж Free/Pro, полоса использования красная при ≥90%, кнопка Улучшить для Free, срок Pro).
- `apps/mobile/app/(tabs)/today.tsx` — обработка FREE_TIER_LIMIT_REACHED при quick-add → автопереход на /paywall; все переходы на task-form передают selectedDate.
- `apps/mobile/app/task-form.tsx` — ИСПРАВЛЕН БАГ: использовал new Date() вместо даты выбранного дня. Теперь принимает параметр selectedDate из роутера. Обработка FREE_TIER_LIMIT_REACHED при сохранении.
- `apps/mobile/tsconfig.json` — добавлен `module: ESNext` (bundler moduleResolution требует ES2015+).

### Исправленные TypeScript ошибки

- `today.tsx`: implicit any в колбэках filter/sort/map.
- `lib/api/tasks.ts`: implicit any в setQueryData колбэке.
- `lib/api-client.ts`: неправильный тип originalRequest в 401-интерцепторе.
- `lib/timeline-layout.ts`: неверный cast Date|null → string.

### Поведение при достижении лимита (Free)

1.51-я задача → бэкенд отвечает 403 FREE_TIER_LIMIT_REACHED.
2. Мобильное приложение переходит на /paywall.
3. Paywall показывает полосу «50/50 активных задач».
4. После апгрейда кэш плана инвалидируется, Settings обновляется мгновенно.

---


## 1. Авторизация в мобильном приложении

### Что внутри

- `apps/mobile/lib/secure-storage.ts` — НОВЫЙ. Хранение токенов в `expo-secure-store`
  (Keychain на iOS / Keystore на Android — не обычный AsyncStorage, безопаснее).
- `apps/mobile/lib/api/auth.ts` — НОВЫЙ. `login`, `register`, `getMe`.
- `apps/mobile/stores/auth.store.ts` — ПЕРЕПИСАН. Добавлены `isLoading`, `bootstrap()`
  (восстановление сессии при старте), `setTokens`/`logout` теперь пишут/чистят
  SecureStore, а не только память.
- `apps/mobile/app/login.tsx` — НОВЫЙ.
- `apps/mobile/app/register.tsx` — НОВЫЙ.
- `apps/mobile/app/index.tsx` — ПЕРЕПИСАН. Раньше сразу редиректил на таймлайн.
  Теперь ждёт `bootstrap()` и ведёт на `/login`, если сессии нет.
- `apps/mobile/app/_layout.tsx` — ОБНОВЛЁН. Вызывает `bootstrap()` при старте,
  регистрирует `login`/`register` как экраны Stack.
- `apps/mobile/app/(tabs)/settings.tsx` — ОБНОВЛЁН. Показывает email/телефон,
  кнопка "Выйти".

## 2. Экран таймлайна (Today) с API интеграцией

### Что реализовано

- `apps/mobile/lib/api/tasks.ts` — ГОТОВ. React Query хуки для работы с задачами:
  - `useTasksForDate(date)` — загрузка задач за день
  - `useCreateTask(date)` — создание задачи
  - `useUpdateTask(date)` — обновление задачи
  - `useToggleTask(date)` — переключение статуса с оптимистичным обновлением
  - `useDeleteTask(date)` — удаление задачи
  - `createSubtask()` и `deleteTaskById()` — прямые API вызовы
  
- `apps/mobile/app/(tabs)/today.tsx` — ПОЛНОСТЬЮ РЕАЛИЗОВАН:
  - Отображает задачи на вертикальном таймлайне (6:00-24:00)
  - Автоматический скролл к текущему времени при открытии
  - Тап по задаче → мгновенный toggle "выполнено"
  - Долгий тап → открыть детали (переход на /task-form)
  - Тап по фону таймлайна → быстрое создание задачи в это время
  - FAB кнопка → создание задачи без времени
  - Модальное окно быстрого создания с кнопкой "Подробнее →"
  - Обработка состояний загрузки и ошибок
  
- `apps/mobile/components/timeline/` — ГОТОВЫЕ КОМПОНЕНТЫ:
  - `Timeline.tsx` — основной компонент таймлайна
  - `TaskBlock.tsx` — блок задачи с цветом и прогрессом подзадач
  - `NowIndicator.tsx` — красная линия текущего времени
  
- `apps/mobile/lib/timeline-config.ts` — конфигурация таймлайна

## ОБЯЗАТЕЛЬНО перед запуском

Нужна одна новая зависимость — поставьте именно через `expo install`
(не `npm install`), чтобы версия точно легла под вашу SDK 51:

```powershell
cd D:\ADHD\ADHD\apps\mobile
npx expo install expo-secure-store
npx expo start -c
```

Без этого шага приложение упадёт с ошибкой на импорте `secure-storage.ts`.

## Как это работает

1. При старте приложения `_layout.tsx` вызывает `bootstrap()`.
2. `bootstrap()` смотрит SecureStore — если токенов нет, сразу показывает `/login`.
3. Если токены есть — подставляет их в `apiClient` и проверяет через `GET /auth/me`.
   Если `accessToken` протух — интерцептор в `api-client.ts` (он был у вас уже готов)
   сам обновит его через `refreshToken`, прежде чем `bootstrap()` получит ответ.
4. Если всё ок — сразу таймлайн, без повторного ввода пароля.
5. Логин/регистрация запрашивают только токены (`/auth/login`, `/auth/register`
   по вашему `auth.service.ts` возвращают именно `{accessToken, refreshToken}`,
   не пользователя) — данные пользователя после этого отдельно берутся через
   `GET /auth/me`.

## Допущения

- **Вход по email ИЛИ телефону** — переключатель-чипса вверху формы, как и
  задумано в `LoginDto`/`RegisterDto` (оба поля опциональны, но хотя бы одно нужно).
- **Пароль на регистрации — мин. 8 символов**, как в `RegisterDto` (`MinLength(8)`).
- **Таймзона на регистрации** — берётся автоматически с телефона
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`), не спрашивается у
  пользователя отдельным полем — меньше трения на входе.
- Ошибки от сервера (400/401/409) показываются как есть в `Alert` — например,
  "Email или телефон уже зарегистрирован" от `ConflictException` дойдёт до
  пользователя дословно.
