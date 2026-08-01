# Альтернативный способ тестирования - Expo Go

## Проблема
Gradle сборка падает с ошибкой метаданных. Это известная проблема Windows + Gradle 8.8.

## Решение: Использовать Expo Go (быстрее и проще)

### Что такое Expo Go?
Expo Go - это приложение для Android/iOS, которое позволяет запускать Expo проекты без нативной сборки.

### ✅ Преимущества:
- Не нужна сборка (запуск за 10 секунд)
- Работает на реальном устройстве и эмуляторе
- Поддерживает hot reload
- Достаточно для тестирования MVP функционала

### ❌ Ограничения:
- Не поддерживает кастомные нативные модули (Daily.co для body doubling)
- Но для текущего функционала (auth, tasks, timeline) - идеально!

---

## 🚀 Как протестировать через Expo Go

### Вариант 1: На реальном устройстве

1. **Скачайте Expo Go на телефон:**
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Убедитесь, что телефон и компьютер в одной WiFi сети**

3. **Обновите .env для реального устройства:**
   ```env
   # apps/mobile/.env
   EXPO_PUBLIC_API_URL=http://172.18.0.1:3000
   ```

4. **Запустите Expo:**
   ```powershell
   cd D:\ADHD\ADHD\apps\mobile
   npx expo start -c
   ```

5. **Отсканируйте QR-код:**
   - Android: камерой или в приложении Expo Go
   - iOS: камерой (автоматически откроет Expo Go)

### Вариант 2: На Android эмуляторе

1. **Установите Expo Go на эмулятор:**
   ```powershell
   # Запустите эмулятор из Android Studio (если ещё не запущен)
   
   # Установите Expo Go APK
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   & "$env:ANDROID_HOME\platform-tools\adb.exe" install path\to\expo-go.apk
   ```

   Или проще - откройте Play Store на эмуляторе и установите Expo Go.

2. **Запустите Expo и нажмите 'a' для Android:**
   ```powershell
   cd D:\ADHD\ADHD\apps\mobile
   npx expo start -c
   # Нажмите 'a' в терминале
   ```

---

## 🧪 Тестовый сценарий (тот же)

После запуска в Expo Go:

### ✅ Проверка 1: Авторизация
- Войти: test@example.com / testpass123
- **Ожидается:** Переход на экран таймлайна

### ✅ Проверка 2: Push-токены
- Проверьте консоль Metro
- **Ожидается:** "Push token registered: ExponentPushToken[...]"

### ✅ Проверка 3: Таймлайн
- Автоскролл на текущее время
- Задачи на сегодня видны

### ✅ Проверка 4-7: Задачи
- Создание (FAB / тап по фону)
- Toggle выполнения (короткий тап)
- Редактирование (долгий тап)

---

## 🔄 Если всё равно нужна нативная сборка

### Проблема с Gradle решается так:

1. **Закройте все процессы Java/Gradle:**
   ```powershell
   Get-Process | Where-Object {$_.Name -like "*java*" -or $_.Name -like "*gradle*"} | Stop-Process -Force
   ```

2. **Удалите весь кэш:**
   ```powershell
   Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle"
   Remove-Item -Recurse -Force "D:\ADHD\ADHD\apps\mobile\android\.gradle"
   Remove-Item -Recurse -Force "D:\ADHD\ADHD\apps\mobile\android\build"
   ```

3. **Попробуйте через gradlew напрямую:**
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   cd D:\ADHD\ADHD\apps\mobile\android
   .\gradlew clean
   .\gradlew assembleDebug
   ```

---

## 📊 Рекомендация

**Используйте Expo Go для текущего тестирования MVP.**

Нативная сборка понадобится только когда:
- Добавите Daily.co (body doubling)
- Нужно тестировать push-уведомления (реальные, не Expo)
- Подготовка к публикации в Play Store

Для тестирования auth, tasks, timeline - Expo Go достаточно!

---

## 🎯 Следующий шаг

```powershell
cd D:\ADHD\ADHD\apps\mobile
npx expo start -c
```

Затем:
- **Реальное устройство:** отсканируйте QR
- **Эмулятор:** нажмите 'a' в терминале
