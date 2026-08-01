# Yandex OAuth Setup Guide

## Что реализовано

**Yandex OAuth 2.0 интеграция для авторизации через Яндекс.**

### Backend (NestJS)

**Новые файлы:**
```
apps/api/src/auth/oauth.service.ts              — универсальный OAuth сервис
apps/api/src/auth/yandex-oauth.controller.ts    — Yandex OAuth endpoints
apps/api/src/auth/dto/oauth-callback.dto.ts     — DTO для OAuth callback
```

**Обновленные файлы:**
```
apps/api/src/auth/auth.module.ts                — регистрация OAuthService и YandexOAuthController
apps/api/prisma/schema.prisma                   — добавлены yandexId, vkId, mailruId
```

**Endpoints:**
- `GET /auth/yandex` — инициирует OAuth flow, редиректит на Яндекс
- `GET /auth/yandex/callback` — обрабатывает callback от Яндекса с code

**Логика:**
1. Mobile app открывает `/auth/yandex` через WebBrowser
2. Backend редиректит на `oauth.yandex.ru/authorize`
3. Пользователь логинится на Яндексе
4. Яндекс редиректит на `/auth/yandex/callback?code=...`
5. Backend обменивает code на access_token
6. Backend получает профиль пользователя (email, id)
7. Backend находит/создаёт User в БД
8. Backend генерирует JWT токены
9. Backend редиректит в mobile app через deep link: `focus://auth/callback?accessToken=...&refreshToken=...`

---

### Mobile (Expo)

**Новые файлы:**
```
apps/mobile/app/auth-provider-select.tsx        — экран выбора OAuth провайдера
```

**Обновленные файлы:**
```
apps/mobile/app/_layout.tsx                     — регистрация auth-provider-select
apps/mobile/app/login.tsx                       — кнопка "Войти через соцсети"
apps/mobile/app/register.tsx                    — кнопка "Войти через соцсети"
```

**Установленные пакеты:**
```
expo-web-browser        — для открытия OAuth в браузере
expo-linking            — для обработки deep links
```

**Deep link схема:** `focus://auth/callback`

---

## Настройка Yandex OAuth

### Шаг 1: Создать приложение на Яндексе

1. Перейти на https://oauth.yandex.ru/
2. Войти под аккаунтом Яндекса
3. Нажать **"Создать новое приложение"**
4. Заполнить форму:
   - **Название:** Focus ADHD Planner
   - **Платформы:** выбрать **"Веб-сервис"**
   - **Redirect URI (Callback URL):**
     - Для локальной разработки: `http://localhost:3000/auth/yandex/callback`
     - Для production: `https://api.yourdomain.com/auth/yandex/callback`
   - **Доступы:** выбрать:
     - ✅ `login:email` — доступ к email
     - ✅ `login:info` — доступ к профилю (имя, фамилия)
5. Сохранить приложение
6. Скопировать **Client ID** и **Client Secret**

---

### Шаг 2: Настроить переменные окружения

**Backend (`apps/api/.env`):**

```bash
# Yandex OAuth
YANDEX_CLIENT_ID="your-yandex-client-id-here"
YANDEX_CLIENT_SECRET="your-yandex-client-secret-here"
YANDEX_REDIRECT_URI="http://localhost:3000/auth/yandex/callback"
```

**Важно:** Не коммитьте `.env` файл в git!

---

### Шаг 3: Применить миграцию БД

```bash
cd apps/api
npx prisma migrate dev --name add_oauth_provider_ids
```

Или вручную:

```sql
ALTER TABLE "users" ADD COLUMN "yandexId" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN "vkId" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN "mailruId" TEXT UNIQUE;
```

---

### Шаг 4: Запустить приложение

**Backend:**
```bash
cd apps/api
npm run start:dev
```

**Mobile:**
```bash
cd apps/mobile
npx expo start
```

---

## Тестирование Yandex OAuth

### Сценарий 1: Новый пользователь (регистрация через Яндекс)

1. Открыть mobile app
2. На экране Login нажать **"Войти через соцсети"**
3. Выбрать **"Яндекс"**
4. Откроется браузер с формой входа Яндекса
5. Войти под аккаунтом Яндекса
6. Разрешить доступ к email и профилю
7. Браузер закроется, вы вернётесь в app
8. Проверить, что вы вошли (перенаправлены на Today screen)
9. В базе данных появится новый User с:
   - `yandexId` = ID пользователя из Яндекса
   - `email` = email из Яндекса
   - `passwordHash` = случайный (пользователь его не знает)

### Сценарий 2: Существующий пользователь (account linking)

1. Создать пользователя через обычную регистрацию (email + password)
2. Выйти из аккаунта
3. Нажать **"Войти через соцсети"** → **"Яндекс"**
4. Войти под Яндекс аккаунтом с **тем же email**
5. Проверить, что вы вошли под существующим аккаунтом
6. В базе данных у User появится поле `yandexId`
7. Теперь можно входить как через email/password, так и через Яндекс

### Сценарий 3: Повторный вход через Яндекс

1. После успешного связывания аккаунта (сценарий 2)
2. Выйти из аккаунта
3. Нажать **"Войти через соцсети"** → **"Яндекс"**
4. Вход происходит мгновенно (без повторной авторизации)

### Сценарий 4: Отмена OAuth flow

1. Нажать **"Войти через соцсети"** → **"Яндекс"**
2. На форме Яндекса нажать **"Отменить"** или закрыть браузер
3. Вы вернётесь на экран выбора провайдера
4. Появится alert: "Вход через Яндекс был отменён"

---

## Troubleshooting

### Ошибка: "Can't reach database server"

**Причина:** Docker с PostgreSQL не запущен.

**Решение:**
```bash
docker-compose up -d
```

### Ошибка: "YANDEX_CLIENT_ID is not defined"

**Причина:** Переменные окружения не настроены.

**Решение:**
1. Создать файл `apps/api/.env`
2. Добавить `YANDEX_CLIENT_ID` и `YANDEX_CLIENT_SECRET`
3. Перезапустить backend

### Ошибка: "redirect_uri_mismatch"

**Причина:** Redirect URI в настройках Яндекс приложения не совпадает с `YANDEX_REDIRECT_URI`.

**Решение:**
1. Открыть https://oauth.yandex.ru/
2. Выбрать своё приложение
3. Проверить Redirect URI:
   - Для локальной разработки: `http://localhost:3000/auth/yandex/callback`
   - Должен точно совпадать с `YANDEX_REDIRECT_URI` в `.env`

### Ошибка: "Failed to exchange code for token"

**Причина:** Неверный `YANDEX_CLIENT_SECRET` или проблема с сетью.

**Решение:**
1. Проверить `YANDEX_CLIENT_SECRET` в `.env`
2. Проверить, что backend может делать запросы на `oauth.yandex.ru`

### Deep link не срабатывает

**Причина:** Схема `focus://` не зарегистрирована или app не в фокусе.

**Решение:**
1. Проверить `app.json`: должна быть строка `"scheme": "focus"`
2. Перезапустить Expo: `npx expo start --clear`
3. На iOS может потребоваться `npx expo prebuild` и пересборка

---

## Security Notes

**✅ Безопасно:**
- OAuth flow через браузер (не в WebView)
- JWT токены передаются через deep link (только один раз)
- Client secret хранится только на backend
- Пароль для OAuth пользователей генерируется случайно (они его не знают)

**⚠️ Важно:**
- Не коммитьте `.env` файлы с реальными секретами
- Используйте HTTPS в production для redirect URI
- Ротируйте JWT секреты периодически
- В production используйте secure deep links (App Links / Universal Links)

---

## Next Steps

**После тестирования Yandex OAuth:**

1. **VK OAuth** (аналогично Yandex)
   - Создать приложение на https://vk.com/apps?act=manage
   - Добавить контроллер `vk-oauth.controller.ts`
   - Обновить `auth-provider-select.tsx`

2. **Mail.ru OAuth** (аналогично Yandex)
   - Создать приложение на https://oauth.mail.ru/
   - Добавить контроллер `mailru-oauth.controller.ts`
   - Обновить `auth-provider-select.tsx`

3. **Production готовность:**
   - Настроить HTTPS redirect URIs
   - Настроить Universal Links (iOS) / App Links (Android)
   - Добавить rate limiting на OAuth endpoints
   - Добавить логирование OAuth попыток

---

## Статус

✅ **Yandex OAuth — готов к тестированию**
⏳ **VK OAuth — UI готов, backend pending**
⏳ **Mail.ru OAuth — UI готов, backend pending**

📝 **Требует настройки:**
- Создать Yandex OAuth приложение
- Добавить credentials в `.env`
- Применить миграцию БД
</contents>