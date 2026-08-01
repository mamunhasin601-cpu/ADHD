# Команды для запуска в отдельных терминалах

## Терминал 1: Backend API

Откройте первый PowerShell/CMD и выполните:

```powershell
cd D:\ADHD\ADHD\apps\api
npm run start:dev
```

**Ожидаемый результат:**
```
Nest application successfully started
Server listening on http://localhost:3000
```

---

## Терминал 2: Expo Metro Bundler

Откройте второй PowerShell/CMD и выполните:

```powershell
cd D:\ADHD\ADHD\apps\mobile
npx expo start
```

**Ожидаемый результат:**
```
Metro Bundler is ready
› Metro waiting on exp://192.168.137.74:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press ? │ show all commands
```

---

## 📱 Подключение к приложению

После запуска обоих терминалов:

1. **Откройте Expo Go** на телефоне
2. **Введите URL:** `exp://192.168.137.74:8081`
3. Или **отсканируйте QR-код** из терминала 2

---

## 🔍 Что смотреть в логах

### Backend (Терминал 1):
- `POST /auth/login` - запросы авторизации
- `GET /tasks` - получение задач
- `POST /tasks` - создание задач
- `PATCH /tasks/:id` - обновление задач
- `PATCH /users/me` - регистрация push-токена

### Metro (Терминал 2):
- Bundle building progress
- `Push token registered: ExponentPushToken[...]`
- Ошибки компиляции (если есть)
- Hot reload события

---

## 🐛 Если что-то не работает

### Backend не запускается:
```powershell
# Проверить, что Docker контейнеры работают
docker ps

# Если не работают - запустить
docker-compose up -d
```

### Metro не запускается (порт занят):
```powershell
# Найти процесс на порту 8081
netstat -ano | findstr :8081

# Остановить (замените PID на реальный)
Stop-Process -Id <PID> -Force
```

### Expo Go не подключается:
- Убедитесь, что телефон и ПК в одной WiFi сети
- Проверьте `.env`: `EXPO_PUBLIC_API_URL=http://192.168.137.74:3000`
- Попробуйте перезапустить Metro с очисткой: `npx expo start -c`

---

## ✅ Готово к тестированию

После запуска обоих терминалов у вас будет:
- ✅ Backend API на http://localhost:3000
- ✅ Metro Bundler на http://localhost:8081
- ✅ Видимые логи в реальном времени

**Запускайте оба терминала и подключайте Expo Go!** 🚀
