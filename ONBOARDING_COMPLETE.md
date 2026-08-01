# 5-Minute Start Onboarding — Завершено ✅

## Что реализовано

**Быстрый онбординг для новых пользователей:**

### Экран онбординга (`apps/mobile/app/onboarding.tsx`)

**3 шага:**

#### Шаг 1: Приветствие
- Эмодзи 👋
- "Добро пожаловать в Focus"
- Краткое описание приложения
- Кнопка "Начать" / "Пропустить"

#### Шаг 2: Создание первой задачи
- Эмодзи ✨
- Форма создания задачи:
  - Название (обязательное)
  - Время (опциональное, формат HH:MM)
  - Подсказка про Inbox для задач без времени
- Кнопка "Создать" / "Пропустить"
- Интеграция с `useCreateTask` hook

#### Шаг 3: Объяснение основных концепций
- Эмодзи 🎯
- Список фич с иконками:
  - 📅 Таймлайн (все задачи на день)
  - ⏰ Сейчас / Дальше (текущая задача)
  - 📥 Inbox (незапланированные задачи)
- Кнопка "Перейти к планированию"

---

## Роутинг и логика

### 1. Определение нового пользователя

**Prisma schema:**
```prisma
model User {
  hasCompletedOnboarding  Boolean  @default(false)
  // ... остальные поля
}
```

**Shared types:**
```typescript
export interface User {
  hasCompletedOnboarding: boolean;
  // ... остальные поля
}
```

### 2. Редирект на онбординг

**`apps/mobile/app/index.tsx`:**
```typescript
if (!isAuthenticated) {
  return <Redirect href="/login" />;
}

// Если пользователь не завершил онбординг — ведем на /onboarding
if (user && !user.hasCompletedOnboarding) {
  return <Redirect href="/onboarding" />;
}

return <Redirect href="/(tabs)/today" />;
```

### 3. Завершение онбординга

**`apps/mobile/app/onboarding.tsx`:**
```typescript
async function completeOnboarding() {
  await apiClient.patch('/users/me', { hasCompletedOnboarding: true });
  router.replace('/(tabs)/today');
}
```

### 4. Backend endpoint

**`apps/api/src/users/dto/update-user.dto.ts`:**
```typescript
export class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  hasCompletedOnboarding?: boolean;
  // ... остальные поля
}
```

**Endpoint:** `PATCH /users/me` (уже существует)

---

## Файлы

```
created:    apps/mobile/app/onboarding.tsx                      — onboarding screen
modified:   apps/mobile/app/index.tsx                           — redirect logic
modified:   apps/mobile/app/_layout.tsx                         — register onboarding route
modified:   packages/shared-types/src/index.ts                  — User.hasCompletedOnboarding
modified:   apps/api/prisma/schema.prisma                       — User.hasCompletedOnboarding
modified:   apps/api/src/users/dto/update-user.dto.ts          — UpdateUserDto validation
```

---

## UX особенности

**Дружелюбность:**
- Крупные эмодзи для эмоционального контакта
- Простой язык без жаргона
- Кнопка "Пропустить" на каждом шаге (не принуждаем)
- Минимум текста, максимум визуала

**Быстрота:**
- 3 шага, каждый занимает ~1 минуту
- Можно создать задачу прямо в онбординге
- Опциональное время (не заставляем думать)

**Практичность:**
- Не просто туториал, а сразу создание первой задачи
- Объяснение через реальные фичи (Таймлайн, Inbox)
- Мгновенный переход к работе

---

## Требования к запуску

**Database migration (когда запустите Docker):**
```bash
cd apps/api
npx prisma migrate dev --name add_onboarding_flag
```

**Или создайте миграцию вручную:**
```sql
ALTER TABLE "users" ADD COLUMN "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;
```

---

## Тестирование

**Сценарий 1: Новый пользователь**
1. Зарегистрироваться через `/register`
2. Автоматически попадаем на `/onboarding`
3. Пройти 3 шага
4. Попадаем на `/(tabs)/today`

**Сценарий 2: Пропуск онбординга**
1. На любом шаге нажать "Пропустить"
2. Сразу попадаем на Today screen
3. Флаг `hasCompletedOnboarding` устанавливается в `true`

**Сценарий 3: Существующий пользователь**
1. Войти через `/login`
2. Если `hasCompletedOnboarding === true` → сразу на Today
3. Онбординг не показывается повторно

---

## Прогресс Release A

**До этого:** 13/25 (52%)  
**После этого:** **14/25 (56%)** 🎉

**Week 1 — Core UX: ЗАВЕРШЕНА ✅**
- ✅ Now / Next indicator
- ✅ Progress indicator
- ✅ Empty states
- ✅ 5-minute start onboarding ← NEW

---

## Следующие шаги

**Week 2 — Business Critical:**
1. **Yandex/VK/Mail OAuth** (3-5 дней) — авторизация для РФ рынка
2. **Free/Pro architecture** (2 дня) — монетизация

**Week 3 — Week View + Recurring:**
3. **Basic week view** (6-8 часов)
4. **Basic recurring tasks** (1-2 дня)

---

## Git Commit

```bash
git add apps/mobile/app/onboarding.tsx
git add apps/mobile/app/index.tsx
git add apps/mobile/app/_layout.tsx
git add packages/shared-types/src/index.ts
git add apps/api/prisma/schema.prisma
git add apps/api/src/users/dto/update-user.dto.ts
git commit -m "feat: add 5-minute start onboarding

- Created 3-step onboarding flow: welcome, create first task, explain features
- Added User.hasCompletedOnboarding flag (Prisma + shared types)
- Updated redirect logic in index.tsx to check onboarding status
- Added PATCH /users/me support for hasCompletedOnboarding
- Friendly UX with emojis, skip buttons, and minimal friction
- Users can create first task directly in onboarding

Week 1 Core UX: 100% complete (4/4 features)"
```

---

## Статус

✅ **5-minute start onboarding завершен**  
✅ **Week 1 Core UX: 100% завершена**  
✅ **Release A: 56% готов** (14/25 фич)

🎯 **Next milestone:** Week 2 — OAuth + Monetization (business critical для запуска)
</contents>