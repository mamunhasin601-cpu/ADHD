# Изменения в проекте Focus

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
