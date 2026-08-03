# Developer Bible

Практическое руководство разработчика для Focus ADHD planner. Документ описывает **текущую** реализацию репозитория и использует существующий код как шаблон. Если пример в руководстве отличается от архитектурных документов, приоритет имеют код, тесты и актуальные ADR.

## Содержание

1. [Ментальная модель и границы](#1-ментальная-модель-и-границы)
2. [Как поднять проект](#2-как-поднять-проект)
3. [Общий workflow изменения](#3-общий-workflow-изменения)
4. [Как добавить экран](#4-как-добавить-экран)
5. [Как добавить страницу](#5-как-добавить-страницу)
6. [Как добавить API](#6-как-добавить-api)
7. [Как добавить Prisma Model](#7-как-добавить-prisma-model)
8. [Как добавить миграцию](#8-как-добавить-миграцию)
9. [Как добавить Service](#9-как-добавить-service)
10. [Как добавить Controller](#10-как-добавить-controller)
11. [Как добавить DTO](#11-как-добавить-dto)
12. [Как добавить React Query](#12-как-добавить-react-query)
13. [Как добавить Zustand Store](#13-как-добавить-zustand-store)
14. [Как добавить Notification](#14-как-добавить-notification)
15. [Как добавить подписку](#15-как-добавить-подписку)
16. [Как обновлять документацию](#16-как-обновлять-документацию)
17. [Безопасный рефакторинг](#17-безопасный-рефакторинг)
18. [Как не ломать архитектуру](#18-как-не-ломать-архитектуру)
19. [Definition of Done](#19-definition-of-done)

---

## 1. Ментальная модель и границы

Репозиторий — npm workspaces monorepo:

```text
apps/api/                 NestJS API, Prisma, BullMQ
apps/mobile/              Expo Router mobile client
packages/shared-types/    общие TypeScript-типы и DTO-контракты
docs/                     архитектура, ADR, эксплуатационные инструкции
```

Основная цепочка:

```text
Mobile screen -> lib/api/* -> api-client -> Nest Controller
              -> DTO/Validation -> Service -> PrismaService -> PostgreSQL
                                                     -> BullMQ/Redis (если async)
```

### Границы ответственности

- **Controller** принимает HTTP-запрос, извлекает пользователя и делегирует работу.
- **DTO** описывает и валидирует внешний ввод.
- **Service** содержит use case, ownership/security checks и orchestration.
- **PrismaService** — единственная точка доступа backend к Prisma Client.
- **React Query** хранит server state, запросы и мутации.
- **Zustand** хранит client state: сессия, UI-предпочтения, временное состояние.
- **Expo Router** определяет маршруты файловой системой.
- **Notifications** отделяют постановку job от фактической доставки.

Не переносите бизнес-логику в экран или Controller и не обращайтесь к Prisma из mobile.

---

## 2. Как поднять проект

### Требования

- Node.js LTS >= 20;
- npm >= 10;
- Docker Desktop >= 24;
- Git;
- для Android: Android Studio/emulator или физическое устройство.

### Первый запуск (Windows, из корня)

```bat
npm install
copy .env.example .env
docker compose up -d
cd apps\api
npx prisma migrate dev
npx prisma generate
cd ..\..
npm run dev:api
```

В другом терминале:

```bat
npm run dev:mobile
```

Откройте QR-код в Expo Go либо используйте platform script из `apps/mobile`:

```bat
cd apps\mobile
npm run android
```

Проверка сервисов:

```bat
docker compose ps
curl http://localhost:3000
```


### Если baseline-сборка не проходит

Перед началом работы сохраните результат `npm run build:api`. В текущем состоянии репозитория сборка может остановиться на уже существующих ошибках в `apps/api/src/auth/oauth.service.ts`, `apps/api/src/plan/plan.service.ts` и `apps/api/src/tasks/tasks.service.spec.ts`. В частности, Prisma-схема содержит `User.plan` и `User.proExpiresAt`, но локально сгенерированный `@prisma/client` может быть устаревшим. Сначала выполните:

```bat
cd apps\api
npx prisma generate
cd ..\..
```

`docker-compose.yml` поднимает PostgreSQL на `5432` и Redis на `6379`. API читает `DATABASE_URL`, JWT/OAuth и push-настройки из `apps/api/.env` (локальные env-файлы не коммитятся). Mobile читает свой `apps/mobile/.env`; адрес API должен быть достижим с устройства, поэтому для физического телефона обычно нужен LAN IP компьютера, а не `localhost`.

Если ошибки OAuth или тестового конструктора остаются, это baseline-проблема, а не основание менять DTO, Controller или Service новой фичи. Зафиксируйте её в PR и отделите исправление baseline от функционального diff. Не обходите проблему через `as any`, отключение TypeScript или коммит generated client.

### Полезные команды

```bat
npm run build:api
npm run test:api
cd apps\api && npm run test:e2e
cd apps\api && npm run prisma:studio
cd apps\api && npm run prisma:reset
```

`prisma:reset` удаляет локальные данные — используйте только осознанно. Root-скрипт `dev:web` сейчас ссылается на отсутствующий `apps/web`; не используйте его как источник истины.

---

## 3. Общий workflow изменения

1. Найдите доменную границу: `tasks`, `users`, `auth`, `plan`, `notifications` или новый модуль.
2. Сначала обновите контракт/схему, затем backend use case, затем mobile integration.
3. Для каждого нового пользовательского сценария добавьте позитивный и негативный путь.
4. Проверьте ownership: пользователь никогда не должен читать или менять чужую запись.
5. Запустите форматные/типовые проверки проекта: `npm run build:api`, `npm run test:api`.
6. Обновите API/архитектурную документацию и ADR, если изменилась граница или решение.

---

## 4. Как добавить экран

В этом проекте «экран» — React Native/Expo-компонент, обычно файл в `apps/mobile/app/`. Для экрана, доступного из tab bar, создайте файл в `app/(tabs)/`.

### Шаблон tab-экрана

Существующие экраны: `app/(tabs)/today.tsx`, `focus.tsx`, `settings.tsx`. Новый `insights.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function InsightsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Статистика</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
});
```

Затем добавьте tab в `app/(tabs)/_layout.tsx`, используя существующий стиль конфигурации. Не создавайте ручной React Navigation route мимо Expo Router.

Если экран использует данные, экран только вызывает hook:

```tsx
const { data: tasks, isPending, error } = useTasksForDate(selectedDate);
```

Запрос и cache invalidation должны находиться в `lib/api/`, не в JSX.

---

## 5. Как добавить страницу

Страница — route за пределами tab group: например `app/task-form.tsx`, `app/login.tsx`, `app/onboarding.tsx`.

Создайте `apps/mobile/app/analytics.tsx`:

```tsx
import { Stack, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function AnalyticsPage() {
  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Stack.Screen options={{ title: 'Статистика' }} />
      <Text>Аналитика дня</Text>
      <Pressable onPress={() => router.back()}>
        <Text>Назад</Text>
      </Pressable>
    </View>
  );
}
```

Переход из существующего экрана:

```tsx
import { router } from 'expo-router';

router.push('/analytics');
```

Проверьте auth gating в `app/_layout.tsx`: приватная страница не должна становиться доступной анонимному пользователю только из-за нового `router.push`.

---

## 6. Как добавить API

Новый API добавляется вертикальным срезом: endpoint → DTO → service → module → mobile API function/hook → экран.

Пример: `GET /tasks` уже реализован в `apps/api/src/tasks/tasks.controller.ts`:

```ts
@Get()
findAll(@CurrentUser() user: User, @Query() query: GetTasksQueryDto) {
  return this.tasksService.findAll(user.id, query);
}
```

Для нового `GET /routines`:

1. создайте/расширьте `routines.controller.ts`, `routines.service.ts`, DTO;
2. зарегистрируйте `RoutinesModule` в `app.module.ts`;
3. добавьте mobile function в `apps/mobile/lib/api/routines.ts`;
4. если данные показываются на экране — добавьте React Query hook;
5. обновите `docs/API.md`.

Всегда определите: HTTP method/status, auth requirement, request DTO, response shape, error codes, ownership и cache key.

---

## 7. Как добавить Prisma Model

Модель добавляется в `apps/api/prisma/schema.prisma`. Реальный шаблон владения — `Task.userId` + relation + index:

```prisma
model Task {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("tasks")
}
```

Новая модель `UserPreference` должна иметь user boundary:

```prisma
model UserPreference {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  compactUi Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("user_preferences")
}
```

Добавьте обратное поле `preferences UserPreference?` в `User`, если Prisma требует relation field. Не храните пароль/токены без явной security-модели и не добавляйте глобальные записи без объяснения ownership.

После изменения schema выполните migration и generate (разделы ниже), затем используйте типы `@prisma/client` в backend.

---

## 8. Как добавить миграцию

1. Измените `apps/api/prisma/schema.prisma`.
2. Убедитесь, что PostgreSQL запущен и `DATABASE_URL` указывает на нужную БД.
3. Создайте именованную migration:

```bat
cd apps\api
npx prisma migrate dev --name add_user_preferences
npx prisma generate
```

4. Проверьте созданную папку `apps/api/prisma/migrations/.../migration.sql`.
5. Запустите build/tests.
6. Закоммитьте schema и migration вместе.

Для production применяйте уже созданные migration через `npx prisma migrate deploy`, а не `migrate dev`. Не редактируйте старую применённую migration и не используйте `db push` как замену истории миграций. Перед destructive migration сделайте backup и спланируйте backfill/совместимость старого и нового кода.

---

## 9. Как добавить Service

Service — use-case слой. Реальный `TasksService` (`apps/api/src/tasks/tasks.service.ts`) показывает правильный порядок: dependencies через DI, проверка лимита, запись, побочный effect.

```ts
@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.routine.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine) throw new NotFoundException('Шаблон не найден');
    if (routine.userId !== userId) throw new ForbiddenException('Нет доступа');
    await this.prisma.routine.delete({ where: { id } });
  }
}
```

В production предпочтительнее сразу включать `userId` в `where` там, где Prisma-constraint это позволяет. Service не должен принимать user id из body: его передаёт Controller из JWT.

Если вызывается внешний/асинхронный компонент, изолируйте ошибку согласно доменной политике. В `TasksService` `syncReminder` логирует ошибку очереди, потому что уже сохранённая задача не должна исчезнуть из-за временного Redis outage.

---

## 10. Как добавить Controller

Controller должен быть тонким. Шаблон `TasksController`:

```ts
@Controller('routines')
@UseGuards(JwtAuthGuard)
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.routinesService.findAll(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.routinesService.remove(user.id, id);
  }
}
```

Правила:

- приватный endpoint получает `@UseGuards(JwtAuthGuard)`;
- user берётся через `@CurrentUser()`, не из `:userId` и не из body;
- UUID проверяется `ParseUUIDPipe`;
- body/query проходят DTO;
- статус `204` задаётся явно для delete;
- Controller не содержит Prisma-запросов и сложных ветвлений.

---

## 11. Как добавить DTO

DTO живут рядом с доменом, например `apps/api/src/tasks/dto/`. Глобальный `ValidationPipe` в `main.ts` включает `whitelist`, `forbidNonWhitelisted` и `transform`, поэтому лишние поля будут отклонены.

Реальный стиль DTO для задачи — декораторы `class-validator` на каждом внешнем поле. Например, DTO для routine:

```ts
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateRoutineDto {
  @IsString()
  name!: string;

  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  daysOfWeek!: number[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
```

Для ограничений каждого элемента массива используйте `@IsInt({ each: true })`. Если домен требует диапазон `0..6`, добавьте кастомный validator для массива либо проверяйте диапазон в Service; не оставляйте ложное ощущение валидации.

Для update используйте `PartialType(CreateRoutineDto)` из `@nestjs/mapped-types`, как существующий `UpdateTaskDto`, но убедитесь, что правила nullable/clear value действительно нужны. DTO — внешний контракт, не Prisma model.

---

## 12. Как добавить React Query

React Query находится в `apps/mobile/lib/api/`. Реальный `lib/api/tasks.ts` задаёт key-фабрику, typed `apiClient`, invalidation и optimistic update.

Новый query:

```ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { Routine } from '@focus/shared-types';

export function useRoutines() {
  return useQuery({
    queryKey: ['routines'],
    queryFn: async () => {
      const { data } = await apiClient.get<Routine[]>('/routines');
      return data;
    },
  });
}
```

Новая mutation:

```ts
export function useCreateRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateRoutineDto) => {
      const { data } = await apiClient.post<Routine>('/routines', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });
}
```

Для частого действия используйте optimistic update как `useToggleTask`: `cancelQueries` → сохранить `previous` → `setQueryData` → rollback в `onError` → invalidate в `onSettled`. Не помещайте server state в Zustand и не делайте ручной глобальный fetch в каждом компоненте.

---

## 13. Как добавить Zustand Store

Zustand — для client state. Реальный `apps/mobile/stores/auth.store.ts` хранит токены/пользователя, синхронизирует SecureStore и вызывает `getMe()` при bootstrap.

Шаблон UI store:

```ts
import { create } from 'zustand';

interface UiState {
  isCompact: boolean;
  setCompact: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCompact: false,
  setCompact: (isCompact) => set({ isCompact }),
}));
```

Если state должен переживать перезапуск, используйте существующий `secure-storage.ts` или явный persistence adapter. Не сохраняйте в обычном AsyncStorage access/refresh token. После добавления store решите, кто отвечает за bootstrap и loading state; для auth это уже `app/_layout.tsx` + `useAuthStore.bootstrap()`.

---

## 14. Как добавить Notification

Текущий pipeline:

```text
TasksService.syncReminder
  -> NotificationsService.scheduleTaskReminder
  -> BullMQ task-reminders queue / Redis
  -> NotificationsProcessor
  -> Expo Push API
  -> NotificationLog
```

Добавление нового вида уведомления:

1. Добавьте имя queue/job в `notifications.constants.ts`.
2. Определите минимальный typed payload, как `TaskReminderJobData`; не кладите чувствительные детали в push `data`.
3. В `NotificationsService` добавьте schedule/cancel с детерминированным `jobId`, retry/backoff и `removeOn...`.
4. В `NotificationsProcessor` добавьте обработчик job.
5. Используйте `sendPushNotification`; обрабатывайте отсутствие токена и `DeviceNotRegistered`.
6. Логируйте доставку через `logNotification`.
7. Добавьте unit tests для service и processor.

Реальный принцип дедупликации:

```ts
const jobId = `task-reminder-${task.id}`;
await queue.add(JOBS.TASK_REMINDER, data, {
  jobId,
  delay: delayMs,
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
});
```

Ошибки очереди не должны ломать уже успешный основной CRUD, если уведомление является вторичным эффектом: существующий `TasksService.syncReminder` именно логирует такую ошибку. Но не скрывайте ошибки, если notification — обязательная часть бизнес-транзакции.

---

## 15. Как добавить подписку

В текущей модели подписка выражена политикой пользователя: `Plan.FREE | PRO` и `User.proExpiresAt` в `schema.prisma`. Доступ проверяет `PlanService`; например `TasksService.create` вызывает `enforceTaskLimit(userId)` перед созданием root task.

Важно: это текущая модель entitlement, а не завершённая интеграция платежей. В репозитории уже есть `PlanService` и поля Prisma, но перед добавлением provider необходимо убедиться, что локальный Prisma Client обновлён (`npx prisma generate`) и что существующие migration применены. Не описывайте checkout/webhook как готовый функционал, пока соответствующий provider, проверка подписи и идемпотентные tests действительно не добавлены.

Добавляя платёжный provider:

1. Создайте отдельный `subscription/` или `billing/` domain module.
2. Не помещайте billing logic в `AuthService`, `TasksService` или mobile screen.
3. Определите provider transaction id, status, plan, expiry и idempotency key в Prisma.
4. Webhook controller должен проверять подпись provider и быть идемпотентным.
5. Service обновляет plan только после валидного события provider.
6. `PlanService` остаётся единой точкой policy checks для других доменов.
7. Mobile получает `GET /plan` через `apps/mobile/lib/api/plan.ts`; экран оплаты только запускает checkout и отображает состояние.

Минимальный API-контракт должен описывать `GET /plan`, `POST /subscription/checkout`, webhook и error cases. Не доверяйте `plan: PRO` из mobile body.

---

## 16. Как обновлять документацию

Изменяйте документацию в том же PR, что и код:

| Изменение | Документ |
|---|---|
| Новый/изменённый endpoint | `docs/API.md` |
| Новая граница, поток или правило | `docs/Architecture.md`, `docs/System-Bible.md` |
| Архитектурное решение с trade-off | новый `docs/ADR/ADR-NNN-*.md` |
| Запуск, env, миграции, deployment | `docs/Development.md`, `docs/Deployment.md` |
| Повторяемый workflow разработчика | `docs/Developer-Bible.md` |

Шаблон ADR: Context → Decision → Alternatives → Consequences → Status. Не обновляйте только «карту» (`System-Bible`) без проверки реального call/data flow. После изменения endpoint обновите request/response, auth, пример curl и mobile caller.

---

## 17. Безопасный рефакторинг

### Перед началом

- найдите все usages через поиск по символу и route;
- прочитайте tests и вызывающие слои;
- зафиксируйте текущий контракт: status codes, DTO, query keys, DB columns;
- проверьте ADR и `docs/research/*`, если меняется boundary.

### Безопасная последовательность

1. Добавьте/обновите тест, фиксирующий старое поведение.
2. Сделайте маленькое изменение в одном слое.
3. Не меняйте одновременно naming, API contract и schema без миграционного плана.
4. Для API поддержите переходный контракт: сначала новый endpoint/поле, потом мигрируйте caller, затем удаляйте старое.
5. Для Prisma сначала additive migration, backfill, переключение чтения/записи, и только потом удаление.
6. Для React Query сохраняйте совместимые query keys либо сознательно инвалидируйте старые.
7. Запустите `npm run build:api` и `npm run test:api`; вручную пройдите auth → today → task toggle → notification.

Не «улучшайте» заодно форматирование всего файла: маленький diff проще проверить и откатить.

---

## 18. Как не ломать архитектуру

### Обязательные правила

- Все приватные backend routes защищены `JwtAuthGuard`.
- User identity берётся из JWT (`@CurrentUser()`), а не из запроса пользователя.
- Каждый user-owned query фильтруется по `userId`; `findOne` проверяет ownership и возвращает `ForbiddenException`.
- Controllers не знают Prisma и не содержат бизнес-правил.
- DTO валидируют внешний ввод; Prisma-типы не являются DTO автоматически.
- Server state не дублируется в Zustand.
- Экраны не делают raw `axios` calls; используйте `api-client` и `lib/api`.
- Async side effects имеют retry/deduplication и наблюдаемость.
- OAuth/JWT/secrets/env не логируются и не коммитятся.
- Domain module импортирует только необходимые зависимости; не создавайте циклические связи.
- Shared types не должны становиться свалкой backend implementation details.

### Красные флаги code review

```ts
// Плохо: userId можно подменить и бизнес-логика находится в Controller
@Post()
create(@Body() body: { userId: string }) {
  return this.prisma.task.create({ data: body });
}
```

```tsx
// Плохо: server state и API вызов внутри UI вместо React Query
useEffect(() => {
  fetch('/tasks').then((response) => setTasks(response));
}, []);
```

Правильный путь — `@CurrentUser()` → DTO → Service → Prisma и `useQuery`/`useMutation` в `lib/api`.

---

## 19. Definition of Done

Перед PR убедитесь:

- [ ] новый код находится в правильной domain boundary;
- [ ] endpoint имеет DTO, auth и ownership policy;
- [ ] Prisma schema/migration/generate выполнены, migration committed;
- [ ] mobile route подключён корректно через Expo Router;
- [ ] React Query key и invalidation определены;
- [ ] Zustand используется только для client state;
- [ ] notifications имеют job id, retry, deduplication и tests;
- [ ] subscription policy не обходится через client input;
- [ ] есть тесты на success, validation/error и чужой ownership;
- [ ] `npm run build:api` проходит;
- [ ] `npm run test:api` проходит;
- [ ] API/architecture/ADR docs обновлены;
- [ ] в diff нет `.env`, секретов и случайных generated artifacts.

### Быстрый smoke test

```bat
npm run build:api
npm run test:api
docker compose ps
```

После этого вручную проверьте в приложении восстановление сессии, создание задачи, toggle, удаление, переход на новый route и поведение при отключённом Redis. Цель проекта — не просто сохранить данные, а уменьшить friction между намерением и действием; новые изменения должны сохранять этот принцип.