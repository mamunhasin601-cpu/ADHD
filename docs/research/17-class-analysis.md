# 17. Class Analysis

Дата анализа: 03.08.2026.

## Резюме

Проанализированы TypeScript-источники в `apps/api/src`, `packages/shared-types/src` и `apps/mobile`. Найдено деклараций: **58**, из них классов: **38**, интерфейсов/контрактов: **20**. В `apps/mobile` class/interface-декларации не найдены; мобильная часть использует преимущественно функциональный стиль React/Expo.

Главные зоны внимания: `AuthService`, `OAuthService`, `TasksService`, `NotificationsService`, `PrismaService`. Явных God Objects критического уровня не найдено, но есть кандидаты с концентрацией ответственности в auth/tasks/notifications.

## Методика

- Паспорт строился по структурному разбору TypeScript: `export class` и `export interface`, границы блока, поля верхнего уровня, constructor, методы верхнего уровня.
- Зависимости считались по `import`, наследованию/implements и ссылкам на другие найденные декларации внутри блока.
- "Кто использует" — файлы проекта, где встречается имя класса/интерфейса.
- Сложность: эвристика по строкам, количеству методов, условным операторам и числу зависимостей.

## Сводная таблица

| # | Тип | Название | Файл | Строк | Методов | Исх. завис. | Вх. завис. | Сложность |
|---:|---|---|---|---:|---:|---:|---:|---|
| 1 | class | `AppModule` | `apps/api/src/app.module.ts` | 1 | 0 | 10 | 1 | высокая |
| 2 | class | `AuthController` | `apps/api/src/auth/auth.controller.ts` | 31 | 4 | 14 | 2 | высокая |
| 3 | class | `AuthModule` | `apps/api/src/auth/auth.module.ts` | 1 | 0 | 10 | 1 | высокая |
| 4 | class | `AuthService` | `apps/api/src/auth/auth.service.ts` | 105 | 4 | 15 | 3 | высокая |
| 5 | class | `LoginDto` | `apps/api/src/auth/dto/login.dto.ts` | 13 | 0 | 1 | 2 | низкая |
| 6 | class | `OAuthCallbackDto` | `apps/api/src/auth/dto/oauth-callback.dto.ts` | 8 | 0 | 1 | 0 | низкая |
| 7 | class | `RefreshTokenDto` | `apps/api/src/auth/dto/refresh-token.dto.ts` | 5 | 0 | 1 | 1 | низкая |
| 8 | class | `RegisterDto` | `apps/api/src/auth/dto/register.dto.ts` | 22 | 0 | 1 | 2 | низкая |
| 9 | class | `JwtAuthGuard` | `apps/api/src/auth/guards/jwt-auth.guard.ts` | 1 | 0 | 3 | 6 | низкая |
| 10 | class | `MailruOAuthController` | `apps/api/src/auth/mailru-oauth.controller.ts` | 134 | 2 | 6 | 1 | высокая |
| 11 | interface | `OAuthProfile` | `apps/api/src/auth/oauth.service.ts` | 8 | 0 | 5 | 3 | средняя |
| 12 | class | `OAuthService` | `apps/api/src/auth/oauth.service.ts` | 84 | 1 | 9 | 4 | высокая |
| 13 | class | `JwtStrategy` | `apps/api/src/auth/strategies/jwt.strategy.ts` | 21 | 1 | 11 | 1 | высокая |
| 14 | class | `VkOAuthController` | `apps/api/src/auth/vk-oauth.controller.ts` | 113 | 2 | 5 | 1 | высокая |
| 15 | class | `YandexOAuthController` | `apps/api/src/auth/yandex-oauth.controller.ts` | 109 | 2 | 5 | 1 | высокая |
| 16 | class | `RegisterPushTokenDto` | `apps/api/src/notifications/dto/register-push-token.dto.ts` | 12 | 0 | 1 | 0 | низкая |
| 17 | class | `NotificationsModule` | `apps/api/src/notifications/notifications.module.ts` | 1 | 0 | 6 | 2 | средняя |
| 18 | class | `NotificationsProcessor` | `apps/api/src/notifications/notifications.processor.ts` | 37 | 1 | 8 | 3 | средняя |
| 19 | interface | `TaskReminderJobData` | `apps/api/src/notifications/notifications.service.ts` | 6 | 0 | 6 | 1 | средняя |
| 20 | class | `NotificationsService` | `apps/api/src/notifications/notifications.service.ts` | 165 | 5 | 11 | 5 | высокая |
| 21 | class | `PlanController` | `apps/api/src/plan/plan.controller.ts` | 35 | 3 | 7 | 1 | средняя |
| 22 | class | `PlanModule` | `apps/api/src/plan/plan.module.ts` | 1 | 0 | 3 | 2 | низкая |
| 23 | class | `PlanService` | `apps/api/src/plan/plan.service.ts` | 107 | 5 | 4 | 3 | высокая |
| 24 | class | `PrismaModule` | `apps/api/src/prisma/prisma.module.ts` | 1 | 0 | 2 | 2 | низкая |
| 25 | class | `PrismaService` | `apps/api/src/prisma/prisma.service.ts` | 12 | 2 | 4 | 9 | низкая |
| 26 | class | `CreateRoutineDto` | `apps/api/src/routines/dto/create-routine.dto.ts` | 12 | 0 | 1 | 4 | низкая |
| 27 | class | `UpdateRoutineDto` | `apps/api/src/routines/dto/update-routine.dto.ts` | 1 | 0 | 4 | 3 | низкая |
| 28 | class | `RoutinesController` | `apps/api/src/routines/routines.controller.ts` | 44 | 5 | 11 | 1 | высокая |
| 29 | class | `RoutinesModule` | `apps/api/src/routines/routines.module.ts` | 1 | 0 | 3 | 1 | низкая |
| 30 | class | `RoutinesService` | `apps/api/src/routines/routines.service.ts` | 48 | 5 | 9 | 2 | высокая |
| 31 | class | `CreateTaskDto` | `apps/api/src/tasks/dto/create-task.dto.ts` | 31 | 0 | 1 | 5 | низкая |
| 32 | class | `GetTasksQueryDto` | `apps/api/src/tasks/dto/get-tasks-query.dto.ts` | 16 | 0 | 1 | 2 | низкая |
| 33 | class | `UpdateTaskDto` | `apps/api/src/tasks/dto/update-task.dto.ts` | 5 | 0 | 5 | 4 | средняя |
| 34 | class | `TasksController` | `apps/api/src/tasks/tasks.controller.ts` | 54 | 6 | 13 | 1 | высокая |
| 35 | class | `TasksModule` | `apps/api/src/tasks/tasks.module.ts` | 1 | 0 | 5 | 1 | средняя |
| 36 | class | `TasksService` | `apps/api/src/tasks/tasks.service.ts` | 162 | 8 | 16 | 3 | высокая |
| 37 | class | `UpdateUserDto` | `apps/api/src/users/dto/update-user.dto.ts` | 21 | 0 | 1 | 2 | низкая |
| 38 | class | `UsersController` | `apps/api/src/users/users.controller.ts` | 22 | 3 | 9 | 1 | средняя |
| 39 | class | `UsersModule` | `apps/api/src/users/users.module.ts` | 1 | 0 | 3 | 1 | низкая |
| 40 | class | `UsersService` | `apps/api/src/users/users.service.ts` | 23 | 3 | 6 | 2 | средняя |
| 41 | interface | `LoginPayload` | `apps/mobile/lib/api/auth.ts` | 5 | 0 | 2 | 0 | низкая |
| 42 | interface | `RegisterPayload` | `apps/mobile/lib/api/auth.ts` | 3 | 0 | 3 | 0 | низкая |
| 43 | interface | `PlanInfo` | `apps/mobile/lib/api/plan.ts` | 9 | 0 | 3 | 0 | низкая |
| 44 | interface | `TaskLayout` | `apps/mobile/lib/timeline-layout.ts` | 4 | 0 | 2 | 0 | низкая |
| 45 | interface | `User` | `packages/shared-types/src/index.ts` | 10 | 0 | 0 | 15 | низкая |
| 46 | interface | `Task` | `packages/shared-types/src/index.ts` | 15 | 0 | 0 | 9 | низкая |
| 47 | interface | `CreateTaskDto` | `packages/shared-types/src/index.ts` | 9 | 0 | 0 | 5 | низкая |
| 48 | interface | `UpdateTaskDto` | `packages/shared-types/src/index.ts` | 3 | 0 | 2 | 4 | низкая |
| 49 | interface | `Routine` | `packages/shared-types/src/index.ts` | 8 | 0 | 0 | 1 | низкая |
| 50 | interface | `CreateRoutineDto` | `packages/shared-types/src/index.ts` | 4 | 0 | 0 | 4 | низкая |
| 51 | interface | `UpdateRoutineDto` | `packages/shared-types/src/index.ts` | 1 | 0 | 2 | 3 | низкая |
| 52 | interface | `FocusSession` | `packages/shared-types/src/index.ts` | 10 | 0 | 0 | 0 | низкая |
| 53 | interface | `FocusSessionParticipant` | `packages/shared-types/src/index.ts` | 7 | 0 | 0 | 0 | низкая |
| 54 | interface | `AuthTokens` | `packages/shared-types/src/index.ts` | 4 | 0 | 0 | 6 | низкая |
| 55 | interface | `JwtPayload` | `packages/shared-types/src/index.ts` | 7 | 0 | 0 | 2 | низкая |
| 56 | interface | `NotificationLog` | `packages/shared-types/src/index.ts` | 7 | 0 | 0 | 1 | низкая |
| 57 | interface | `ApiResponse` | `packages/shared-types/src/index.ts` | 4 | 0 | 0 | 0 | низкая |
| 58 | interface | `PaginatedResponse` | `packages/shared-types/src/index.ts` | 6 | 0 | 0 | 0 | низкая |

## Слишком большие классы


## Возможные God Objects

- `TasksService` (apps/api/src/tasks/tasks.service.ts) — 162 строк, 8 методов, 16 исходящих зависимостей. Риск: смешение CRUD, фильтрации, лимитов тарифа, recurring/subtasks и уведомлений.
- `AuthService` (apps/api/src/auth/auth.service.ts) — 105 строк, 4 методов, 15 исходящих зависимостей. Риск: разрастание auth/provider flows и token lifecycle.
- `TasksController` (apps/api/src/tasks/tasks.controller.ts) — 54 строк, 6 методов, 13 исходящих зависимостей. Риск: смешение CRUD, фильтрации, лимитов тарифа, recurring/subtasks и уведомлений.
- `AuthController` (apps/api/src/auth/auth.controller.ts) — 31 строк, 4 методов, 14 исходящих зависимостей. Риск: разрастание auth/provider flows и token lifecycle.

## Классы/контракты с высокой связностью


## Подробные паспорта

### AppModule

- **Название:** `AppModule`
- **Тип:** класс
- **Файл:** `apps/api/src/app.module.ts`
- **Назначение:** Модуль NestJS: агрегирует providers/controllers/imports/exports для DI-контейнера.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./auth/auth.module`, `./notifications/notifications.module`, `./plan/plan.module`, `./prisma/prisma.module`, `./routines/routines.module`, `./tasks/tasks.module`, `./users/users.module`, `@nestjs/bullmq`, `@nestjs/common`, `@nestjs/config`
- **Кто использует:** `apps/api/src/main.ts`
- **Что использует он:** `./auth/auth.module`, `./notifications/notifications.module`, `./plan/plan.module`, `./prisma/prisma.module`, `./routines/routines.module`, `./tasks/tasks.module`, `./users/users.module`, `@nestjs/bullmq`, `@nestjs/common`, `@nestjs/config`
- **Количество строк:** 1 (36-36)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность; композиционный NestJS-модуль, пустое тело ожидаемо

### AuthController

- **Название:** `AuthController`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/auth.controller.ts`
- **Назначение:** HTTP-контроллер NestJS: принимает запросы, применяет guard/decorator-слой и делегирует бизнес-логику сервисам.
- **Поля:** нет
- **Конструктор:** `constructor(private readonly authService: AuthService)`
- **Все методы:** `register`, `login`, `refresh`, `getMe`
- **Все зависимости:** `./auth.service`, `./decorators/current-user.decorator`, `./dto/login.dto`, `./dto/refresh-token.dto`, `./dto/register.dto`, `./guards/jwt-auth.guard`, `@nestjs/common`, `@prisma/client`, `AuthService`, `JwtAuthGuard`, `LoginDto`, `RefreshTokenDto`, `RegisterDto`, `User`
- **Кто использует:** `apps/api/src/auth/auth.module.ts`, `apps/mobile/lib/api/auth.ts`
- **Что использует он:** `./auth.service`, `./decorators/current-user.decorator`, `./dto/login.dto`, `./dto/refresh-token.dto`, `./dto/register.dto`, `./guards/jwt-auth.guard`, `@nestjs/common`, `@prisma/client`, `AuthService`, `JwtAuthGuard`, `LoginDto`, `RefreshTokenDto`, `RegisterDto`, `User`
- **Количество строк:** 31 (11-41)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность

### AuthModule

- **Название:** `AuthModule`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/auth.module.ts`
- **Назначение:** Модуль NestJS: агрегирует providers/controllers/imports/exports для DI-контейнера.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./auth.controller`, `./auth.service`, `./mailru-oauth.controller`, `./oauth.service`, `./strategies/jwt.strategy`, `./vk-oauth.controller`, `./yandex-oauth.controller`, `@nestjs/common`, `@nestjs/jwt`, `@nestjs/passport`
- **Кто использует:** `apps/api/src/app.module.ts`
- **Что использует он:** `./auth.controller`, `./auth.service`, `./mailru-oauth.controller`, `./oauth.service`, `./strategies/jwt.strategy`, `./vk-oauth.controller`, `./yandex-oauth.controller`, `@nestjs/common`, `@nestjs/jwt`, `@nestjs/passport`
- **Количество строк:** 1 (21-21)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность; композиционный NestJS-модуль, пустое тело ожидаемо

### AuthService

- **Название:** `AuthService`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/auth.service.ts`
- **Назначение:** Сервис NestJS: содержит прикладную/инфраструктурную логику доменного модуля.
- **Поля:** 
- `private readonly prisma: PrismaService`
- `private readonly jwtService: JwtService`
- `async register(dto: RegisterDto): Promise<AuthTokens> {`
- `async login(dto: LoginDto): Promise<AuthTokens> {`
- `async refreshTokens(refreshToken: string): Promise<AuthTokens> {`
- `private generateTokens(user: User): AuthTokens {`
- **Конструктор:** `constructor( private readonly prisma: PrismaService, private readonly jwtService: JwtService, )`
- **Все методы:** `register`, `login`, `refreshTokens`, `generateTokens`
- **Все зависимости:** `../prisma/prisma.service`, `./dto/login.dto`, `./dto/register.dto`, `./jwt-secrets`, `@focus/shared-types`, `@nestjs/common`, `@nestjs/jwt`, `@prisma/client`, `AuthTokens`, `JwtPayload`, `LoginDto`, `PrismaService`, `RegisterDto`, `User`, `bcrypt`
- **Кто использует:** `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/oauth.service.ts`
- **Что использует он:** `../prisma/prisma.service`, `./dto/login.dto`, `./dto/register.dto`, `./jwt-secrets`, `@focus/shared-types`, `@nestjs/common`, `@nestjs/jwt`, `@prisma/client`, `AuthTokens`, `JwtPayload`, `LoginDto`, `PrismaService`, `RegisterDto`, `User`, `bcrypt`
- **Количество строк:** 105 (19-123)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность

### LoginDto

- **Название:** `LoginDto`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/dto/login.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `email?: string`
- `phone?: string`
- `password: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`
- **Что использует он:** `class-validator`
- **Количество строк:** 13 (3-15)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### OAuthCallbackDto

- **Название:** `OAuthCallbackDto`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/dto/oauth-callback.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `code: string`
- `state?: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** `class-validator`
- **Количество строк:** 8 (3-10)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### RefreshTokenDto

- **Название:** `RefreshTokenDto`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/dto/refresh-token.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `refreshToken: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** `apps/api/src/auth/auth.controller.ts`
- **Что использует он:** `class-validator`
- **Количество строк:** 5 (3-7)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### RegisterDto

- **Название:** `RegisterDto`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/dto/register.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `email?: string`
- `phone?: string`
- `password: string`
- `timezone?: string`
- `_emailOrPhone?: never`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`
- **Что использует он:** `class-validator`
- **Количество строк:** 22 (3-24)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### JwtAuthGuard

- **Название:** `JwtAuthGuard`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/guards/jwt-auth.guard.ts`
- **Назначение:** Guard NestJS/Passport: ограничивает доступ к маршрутам.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `@nestjs/common`, `@nestjs/passport`, `AuthGuard('jwt')`
- **Кто использует:** `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/decorators/current-user.decorator.ts`, `apps/api/src/plan/plan.controller.ts`, `apps/api/src/routines/routines.controller.ts`, `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/users/users.controller.ts`
- **Что использует он:** `@nestjs/common`, `@nestjs/passport`, `AuthGuard('jwt')`
- **Количество строк:** 1 (5-5)
- **Сложность:** низкая
- **Замечания:** существенных замечаний нет

### MailruOAuthController

- **Название:** `MailruOAuthController`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/mailru-oauth.controller.ts`
- **Назначение:** HTTP-контроллер NestJS: принимает запросы, применяет guard/decorator-слой и делегирует бизнес-логику сервисам.
- **Поля:** 
- `private readonly clientId = process.env.MAILRU_CLIENT_ID || 'dev-client-id'`
- `private readonly clientSecret = process.env.MAILRU_CLIENT_SECRET || 'dev-secret'`
- `private readonly redirectUri =`
- `process.env.MAILRU_REDIRECT_URI || 'http://localhost:3000/auth/mailru/callback'`
- **Конструктор:** `constructor(private readonly oauthService: OAuthService)`
- **Все методы:** `initiateOAuth`, `handleCallback`
- **Все зависимости:** `./oauth.service`, `@nestjs/common`, `OAuthProfile`, `OAuthService`, `crypto`, `express`
- **Кто использует:** `apps/api/src/auth/auth.module.ts`
- **Что использует он:** `./oauth.service`, `@nestjs/common`, `OAuthProfile`, `OAuthService`, `crypto`, `express`
- **Количество строк:** 134 (21-154)
- **Сложность:** высокая
- **Замечания:** существенных замечаний нет

### OAuthProfile

- **Название:** `OAuthProfile`
- **Тип:** интерфейс/контракт
- **Файл:** `apps/api/src/auth/oauth.service.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `provider: 'yandex' | 'vk' | 'mailru'`
- `providerId: string`
- `email?: string`
- `phone?: string`
- `firstName?: string`
- `lastName?: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `../prisma/prisma.service`, `./auth.service`, `@focus/shared-types`, `@nestjs/common`, `bcrypt`
- **Кто использует:** `apps/api/src/auth/mailru-oauth.controller.ts`, `apps/api/src/auth/vk-oauth.controller.ts`, `apps/api/src/auth/yandex-oauth.controller.ts`
- **Что использует он:** `../prisma/prisma.service`, `./auth.service`, `@focus/shared-types`, `@nestjs/common`, `bcrypt`
- **Количество строк:** 8 (7-14)
- **Сложность:** средняя
- **Замечания:** контракт типов; runtime-логики нет

### OAuthService

- **Название:** `OAuthService`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/oauth.service.ts`
- **Назначение:** Сервис NestJS: содержит прикладную/инфраструктурную логику доменного модуля.
- **Поля:** 
- `private readonly prisma: PrismaService`
- `private readonly authService: AuthService`
- `async handleOAuthCallback(profile: OAuthProfile): Promise<AuthTokens> {`
- **Конструктор:** `constructor( private readonly prisma: PrismaService, private readonly authService: AuthService, )`
- **Все методы:** `handleOAuthCallback`
- **Все зависимости:** `../prisma/prisma.service`, `./auth.service`, `@focus/shared-types`, `@nestjs/common`, `AuthService`, `AuthTokens`, `OAuthProfile`, `PrismaService`, `bcrypt`
- **Кто использует:** `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/mailru-oauth.controller.ts`, `apps/api/src/auth/vk-oauth.controller.ts`, `apps/api/src/auth/yandex-oauth.controller.ts`
- **Что использует он:** `../prisma/prisma.service`, `./auth.service`, `@focus/shared-types`, `@nestjs/common`, `AuthService`, `AuthTokens`, `OAuthProfile`, `PrismaService`, `bcrypt`
- **Количество строк:** 84 (17-100)
- **Сложность:** высокая
- **Замечания:** существенных замечаний нет

### JwtStrategy

- **Название:** `JwtStrategy`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/strategies/jwt.strategy.ts`
- **Назначение:** Passport strategy: валидирует JWT/учётные данные и формирует user payload.
- **Поля:** 
- `async validate(payload: JwtPayload): Promise<User> {`
- **Конструктор:** `constructor(private readonly prisma: PrismaService)`
- **Все методы:** `validate`
- **Все зависимости:** `../../prisma/prisma.service`, `../jwt-secrets`, `@focus/shared-types`, `@nestjs/common`, `@nestjs/passport`, `@prisma/client`, `JwtPayload`, `PassportStrategy(Strategy)`, `PrismaService`, `User`, `passport-jwt`
- **Кто использует:** `apps/api/src/auth/auth.module.ts`
- **Что использует он:** `../../prisma/prisma.service`, `../jwt-secrets`, `@focus/shared-types`, `@nestjs/common`, `@nestjs/passport`, `@prisma/client`, `JwtPayload`, `PassportStrategy(Strategy)`, `PrismaService`, `User`, `passport-jwt`
- **Количество строк:** 21 (10-30)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность

### VkOAuthController

- **Название:** `VkOAuthController`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/vk-oauth.controller.ts`
- **Назначение:** HTTP-контроллер NestJS: принимает запросы, применяет guard/decorator-слой и делегирует бизнес-логику сервисам.
- **Поля:** 
- `private readonly clientId = process.env.VK_CLIENT_ID || 'dev-client-id'`
- `private readonly clientSecret = process.env.VK_CLIENT_SECRET || 'dev-secret'`
- `private readonly redirectUri =`
- `process.env.VK_REDIRECT_URI || 'http://localhost:3000/auth/vk/callback'`
- **Конструктор:** `constructor(private readonly oauthService: OAuthService)`
- **Все методы:** `initiateOAuth`, `handleCallback`
- **Все зависимости:** `./oauth.service`, `@nestjs/common`, `OAuthProfile`, `OAuthService`, `express`
- **Кто использует:** `apps/api/src/auth/auth.module.ts`
- **Что использует он:** `./oauth.service`, `@nestjs/common`, `OAuthProfile`, `OAuthService`, `express`
- **Количество строк:** 113 (20-132)
- **Сложность:** высокая
- **Замечания:** существенных замечаний нет

### YandexOAuthController

- **Название:** `YandexOAuthController`
- **Тип:** класс
- **Файл:** `apps/api/src/auth/yandex-oauth.controller.ts`
- **Назначение:** HTTP-контроллер NestJS: принимает запросы, применяет guard/decorator-слой и делегирует бизнес-логику сервисам.
- **Поля:** 
- `private readonly clientId = process.env.YANDEX_CLIENT_ID || 'dev-client-id'`
- `private readonly clientSecret = process.env.YANDEX_CLIENT_SECRET || 'dev-secret'`
- `private readonly redirectUri =`
- `process.env.YANDEX_REDIRECT_URI || 'http://localhost:3000/auth/yandex/callback'`
- **Конструктор:** `constructor(private readonly oauthService: OAuthService)`
- **Все методы:** `initiateOAuth`, `handleCallback`
- **Все зависимости:** `./oauth.service`, `@nestjs/common`, `OAuthProfile`, `OAuthService`, `express`
- **Кто использует:** `apps/api/src/auth/auth.module.ts`
- **Что использует он:** `./oauth.service`, `@nestjs/common`, `OAuthProfile`, `OAuthService`, `express`
- **Количество строк:** 109 (20-128)
- **Сложность:** высокая
- **Замечания:** существенных замечаний нет

### RegisterPushTokenDto

- **Название:** `RegisterPushTokenDto`
- **Тип:** класс
- **Файл:** `apps/api/src/notifications/dto/register-push-token.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `token: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** `class-validator`
- **Количество строк:** 12 (3-14)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### NotificationsModule

- **Название:** `NotificationsModule`
- **Тип:** класс
- **Файл:** `apps/api/src/notifications/notifications.module.ts`
- **Назначение:** Модуль NestJS: агрегирует providers/controllers/imports/exports для DI-контейнера.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `../prisma/prisma.module`, `./notifications.constants`, `./notifications.processor`, `./notifications.service`, `@nestjs/bullmq`, `@nestjs/common`
- **Кто использует:** `apps/api/src/app.module.ts`, `apps/api/src/tasks/tasks.module.ts`
- **Что использует он:** `../prisma/prisma.module`, `./notifications.constants`, `./notifications.processor`, `./notifications.service`, `@nestjs/bullmq`, `@nestjs/common`
- **Количество строк:** 1 (13-13)
- **Сложность:** средняя
- **Замечания:** композиционный NestJS-модуль, пустое тело ожидаемо

### NotificationsProcessor

- **Название:** `NotificationsProcessor`
- **Тип:** класс
- **Файл:** `apps/api/src/notifications/notifications.processor.ts`
- **Назначение:** BullMQ worker/processor: обрабатывает фоновые задачи очереди.
- **Поля:** 
- `private readonly logger = new Logger(NotificationsProcessor.name)`
- `async process(job: Job<TaskReminderJobData>): Promise<void> {`
- **Конструктор:** `constructor(private readonly notifications: NotificationsService)`
- **Все методы:** `process`
- **Все зависимости:** `./notifications.constants`, `./notifications.service`, `@nestjs/bullmq`, `@nestjs/common`, `NotificationsService`, `TaskReminderJobData`, `WorkerHost`, `bullmq`
- **Кто использует:** `apps/api/src/notifications/notifications.module.ts`, `apps/api/src/notifications/notifications.processor.spec.ts`, `apps/api/src/notifications/notifications.service.ts`
- **Что использует он:** `./notifications.constants`, `./notifications.service`, `@nestjs/bullmq`, `@nestjs/common`, `NotificationsService`, `TaskReminderJobData`, `WorkerHost`, `bullmq`
- **Количество строк:** 37 (8-44)
- **Сложность:** средняя
- **Замечания:** существенных замечаний нет

### TaskReminderJobData

- **Название:** `TaskReminderJobData`
- **Тип:** интерфейс/контракт
- **Файл:** `apps/api/src/notifications/notifications.service.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `taskId: string`
- `userId: string`
- `taskTitle: string`
- `scheduledFor: string; // ISO 8601`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `../prisma/prisma.service`, `./notifications.constants`, `@nestjs/bullmq`, `@nestjs/common`, `@prisma/client`, `bullmq`
- **Кто использует:** `apps/api/src/notifications/notifications.processor.ts`
- **Что использует он:** `../prisma/prisma.service`, `./notifications.constants`, `@nestjs/bullmq`, `@nestjs/common`, `@prisma/client`, `bullmq`
- **Количество строк:** 6 (9-14)
- **Сложность:** средняя
- **Замечания:** контракт типов; runtime-логики нет

### NotificationsService

- **Название:** `NotificationsService`
- **Тип:** класс
- **Файл:** `apps/api/src/notifications/notifications.service.ts`
- **Назначение:** Сервис NestJS: содержит прикладную/инфраструктурную логику доменного модуля.
- **Поля:** 
- `private readonly logger = new Logger(NotificationsService.name)`
- `private readonly taskReminderQueue: Queue<TaskReminderJobData>`
- `private readonly prisma: PrismaService`
- `async scheduleTaskReminder(task: Task): Promise<void> {`
- `async cancelTaskReminder(taskId: string): Promise<void> {`
- `async sendPushNotification(userId: string, title: string, body: string): Promise<PushSendResult> {`
- `userId: string`
- `taskId: string | null`
- `delivered: boolean`
- `async wasRecentlyDelivered(taskId: string, withinMs = 2 * 60_000): Promise<boolean> {`
- **Конструктор:** `constructor( @InjectQueue(TASK_REMINDERS_QUEUE)`
- **Все методы:** `scheduleTaskReminder`, `cancelTaskReminder`, `sendPushNotification`, `logNotification`, `wasRecentlyDelivered`
- **Все зависимости:** `../prisma/prisma.service`, `./notifications.constants`, `@nestjs/bullmq`, `@nestjs/common`, `@prisma/client`, `NotificationLog`, `NotificationsProcessor`, `PrismaService`, `Task`, `TaskReminderJobData`, `bullmq`
- **Кто использует:** `apps/api/src/notifications/notifications.module.ts`, `apps/api/src/notifications/notifications.processor.spec.ts`, `apps/api/src/notifications/notifications.processor.ts`, `apps/api/src/notifications/notifications.service.spec.ts`, `apps/api/src/tasks/tasks.service.ts`
- **Что использует он:** `../prisma/prisma.service`, `./notifications.constants`, `@nestjs/bullmq`, `@nestjs/common`, `@prisma/client`, `NotificationLog`, `NotificationsProcessor`, `PrismaService`, `Task`, `TaskReminderJobData`, `bullmq`
- **Количество строк:** 165 (24-188)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность

### PlanController

- **Название:** `PlanController`
- **Тип:** класс
- **Файл:** `apps/api/src/plan/plan.controller.ts`
- **Назначение:** HTTP-контроллер NestJS: принимает запросы, применяет guard/decorator-слой и делегирует бизнес-логику сервисам.
- **Поля:** 
- `async upgradeToPro(@CurrentUser() user: User) {`
- `async downgradeToFree(@CurrentUser() user: User) {`
- **Конструктор:** `constructor(private readonly planService: PlanService)`
- **Все методы:** `getPlanInfo`, `upgradeToPro`, `downgradeToFree`
- **Все зависимости:** `../auth/decorators/current-user.decorator`, `../auth/guards/jwt-auth.guard`, `./plan.service`, `@nestjs/common`, `@prisma/client`, `PlanService`, `User`
- **Кто использует:** `apps/api/src/plan/plan.module.ts`
- **Что использует он:** `../auth/decorators/current-user.decorator`, `../auth/guards/jwt-auth.guard`, `./plan.service`, `@nestjs/common`, `@prisma/client`, `PlanService`, `User`
- **Количество строк:** 35 (9-43)
- **Сложность:** средняя
- **Замечания:** существенных замечаний нет

### PlanModule

- **Название:** `PlanModule`
- **Тип:** класс
- **Файл:** `apps/api/src/plan/plan.module.ts`
- **Назначение:** Модуль NestJS: агрегирует providers/controllers/imports/exports для DI-контейнера.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./plan.controller`, `./plan.service`, `@nestjs/common`
- **Кто использует:** `apps/api/src/app.module.ts`, `apps/api/src/tasks/tasks.module.ts`
- **Что использует он:** `./plan.controller`, `./plan.service`, `@nestjs/common`
- **Количество строк:** 1 (10-10)
- **Сложность:** низкая
- **Замечания:** композиционный NestJS-модуль, пустое тело ожидаемо

### PlanService

- **Название:** `PlanService`
- **Тип:** класс
- **Файл:** `apps/api/src/plan/plan.service.ts`
- **Назначение:** Сервис NestJS: содержит прикладную/инфраструктурную логику доменного модуля.
- **Поля:** 
- `async isProUser(userId: string): Promise<boolean> {`
- `async enforceTaskLimit(userId: string): Promise<void> {`
- `async getPlanInfo(userId: string): Promise<{`
- `async upgradeToPro(userId: string, expiresAt?: Date): Promise<void> {`
- `async downgradeToFree(userId: string): Promise<void> {`
- **Конструктор:** `constructor(private readonly prisma: PrismaService)`
- **Все методы:** `isProUser`, `enforceTaskLimit`, `getPlanInfo`, `upgradeToPro`, `downgradeToFree`
- **Все зависимости:** `../prisma/prisma.service`, `@focus/shared-types`, `@nestjs/common`, `PrismaService`
- **Кто использует:** `apps/api/src/plan/plan.controller.ts`, `apps/api/src/plan/plan.module.ts`, `apps/api/src/tasks/tasks.service.ts`
- **Что использует он:** `../prisma/prisma.service`, `@focus/shared-types`, `@nestjs/common`, `PrismaService`
- **Количество строк:** 107 (6-112)
- **Сложность:** высокая
- **Замечания:** существенных замечаний нет

### PrismaModule

- **Название:** `PrismaModule`
- **Тип:** класс
- **Файл:** `apps/api/src/prisma/prisma.module.ts`
- **Назначение:** Модуль NestJS: агрегирует providers/controllers/imports/exports для DI-контейнера.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./prisma.service`, `@nestjs/common`
- **Кто использует:** `apps/api/src/app.module.ts`, `apps/api/src/notifications/notifications.module.ts`
- **Что использует он:** `./prisma.service`, `@nestjs/common`
- **Количество строк:** 1 (9-9)
- **Сложность:** низкая
- **Замечания:** композиционный NestJS-модуль, пустое тело ожидаемо

### PrismaService

- **Название:** `PrismaService`
- **Тип:** класс
- **Файл:** `apps/api/src/prisma/prisma.service.ts`
- **Назначение:** Сервис NestJS: содержит прикладную/инфраструктурную логику доменного модуля.
- **Поля:** 
- `private readonly logger = new Logger(PrismaService.name)`
- **Конструктор:** нет
- **Все методы:** `onModuleInit`, `onModuleDestroy`
- **Все зависимости:** `@nestjs/common`, `@prisma/client`, `OnModuleInit, OnModuleDestroy`, `PrismaClient`
- **Кто использует:** `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/oauth.service.ts`, `apps/api/src/auth/strategies/jwt.strategy.ts`, `apps/api/src/notifications/notifications.service.ts`, `apps/api/src/plan/plan.service.ts`, `apps/api/src/prisma/prisma.module.ts`, `apps/api/src/routines/routines.service.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/api/src/users/users.service.ts`
- **Что использует он:** `@nestjs/common`, `@prisma/client`, `OnModuleInit, OnModuleDestroy`, `PrismaClient`
- **Количество строк:** 12 (5-16)
- **Сложность:** низкая
- **Замечания:** центральная точка входящих зависимостей

### CreateRoutineDto

- **Название:** `CreateRoutineDto`
- **Тип:** класс
- **Файл:** `apps/api/src/routines/dto/create-routine.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `name: string`
- `daysOfWeek: number[]`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** `apps/api/src/routines/dto/update-routine.dto.ts`, `apps/api/src/routines/routines.controller.ts`, `apps/api/src/routines/routines.service.ts`, `packages/shared-types/src/index.ts`
- **Что использует он:** `class-validator`
- **Количество строк:** 12 (3-14)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### UpdateRoutineDto

- **Название:** `UpdateRoutineDto`
- **Тип:** класс
- **Файл:** `apps/api/src/routines/dto/update-routine.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./create-routine.dto`, `@nestjs/mapped-types`, `CreateRoutineDto`, `PartialType(CreateRoutineDto)`
- **Кто использует:** `apps/api/src/routines/routines.controller.ts`, `apps/api/src/routines/routines.service.ts`, `packages/shared-types/src/index.ts`
- **Что использует он:** `./create-routine.dto`, `@nestjs/mapped-types`, `CreateRoutineDto`, `PartialType(CreateRoutineDto)`
- **Количество строк:** 1 (4-4)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### RoutinesController

- **Название:** `RoutinesController`
- **Тип:** класс
- **Файл:** `apps/api/src/routines/routines.controller.ts`
- **Назначение:** HTTP-контроллер NestJS: принимает запросы, применяет guard/decorator-слой и делегирует бизнес-логику сервисам.
- **Поля:** нет
- **Конструктор:** `constructor(private readonly routinesService: RoutinesService)`
- **Все методы:** `create`, `findAll`, `findOne`, `update`, `remove`
- **Все зависимости:** `../auth/decorators/current-user.decorator`, `../auth/guards/jwt-auth.guard`, `./dto/create-routine.dto`, `./dto/update-routine.dto`, `./routines.service`, `@nestjs/common`, `@prisma/client`, `CreateRoutineDto`, `RoutinesService`, `UpdateRoutineDto`, `User`
- **Кто использует:** `apps/api/src/routines/routines.module.ts`
- **Что использует он:** `../auth/decorators/current-user.decorator`, `../auth/guards/jwt-auth.guard`, `./dto/create-routine.dto`, `./dto/update-routine.dto`, `./routines.service`, `@nestjs/common`, `@prisma/client`, `CreateRoutineDto`, `RoutinesService`, `UpdateRoutineDto`, `User`
- **Количество строк:** 44 (23-66)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность

### RoutinesModule

- **Название:** `RoutinesModule`
- **Тип:** класс
- **Файл:** `apps/api/src/routines/routines.module.ts`
- **Назначение:** Модуль NestJS: агрегирует providers/controllers/imports/exports для DI-контейнера.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./routines.controller`, `./routines.service`, `@nestjs/common`
- **Кто использует:** `apps/api/src/app.module.ts`
- **Что использует он:** `./routines.controller`, `./routines.service`, `@nestjs/common`
- **Количество строк:** 1 (9-9)
- **Сложность:** низкая
- **Замечания:** композиционный NestJS-модуль, пустое тело ожидаемо

### RoutinesService

- **Название:** `RoutinesService`
- **Тип:** класс
- **Файл:** `apps/api/src/routines/routines.service.ts`
- **Назначение:** Сервис NestJS: содержит прикладную/инфраструктурную логику доменного модуля.
- **Поля:** 
- `async create(userId: string, dto: CreateRoutineDto): Promise<Routine> {`
- `async findAll(userId: string): Promise<Routine[]> {`
- `async findOne(userId: string, routineId: string): Promise<Routine> {`
- `async update(userId: string, routineId: string, dto: UpdateRoutineDto): Promise<Routine> {`
- `async remove(userId: string, routineId: string): Promise<void> {`
- **Конструктор:** `constructor(private readonly prisma: PrismaService)`
- **Все методы:** `create`, `findAll`, `findOne`, `update`, `remove`
- **Все зависимости:** `../prisma/prisma.service`, `./dto/create-routine.dto`, `./dto/update-routine.dto`, `@nestjs/common`, `@prisma/client`, `CreateRoutineDto`, `PrismaService`, `Routine`, `UpdateRoutineDto`
- **Кто использует:** `apps/api/src/routines/routines.controller.ts`, `apps/api/src/routines/routines.module.ts`
- **Что использует он:** `../prisma/prisma.service`, `./dto/create-routine.dto`, `./dto/update-routine.dto`, `@nestjs/common`, `@prisma/client`, `CreateRoutineDto`, `PrismaService`, `Routine`, `UpdateRoutineDto`
- **Количество строк:** 48 (8-55)
- **Сложность:** высокая
- **Замечания:** существенных замечаний нет

### CreateTaskDto

- **Название:** `CreateTaskDto`
- **Тип:** класс
- **Файл:** `apps/api/src/tasks/dto/create-task.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `title: string`
- `startTime?: string | null`
- `durationMinutes?: number`
- `color?: string`
- `isRecurring?: boolean`
- `recurrenceRule?: string | null`
- `parentTaskId?: string | null`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** `apps/api/src/tasks/dto/update-task.dto.ts`, `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/mobile/lib/api/tasks.ts`, `packages/shared-types/src/index.ts`
- **Что использует он:** `class-validator`
- **Количество строк:** 31 (14-44)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### GetTasksQueryDto

- **Название:** `GetTasksQueryDto`
- **Тип:** класс
- **Файл:** `apps/api/src/tasks/dto/get-tasks-query.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `date?: string`
- `includeSubTasks?: boolean`
- `incomplete?: boolean`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/tasks/tasks.service.ts`
- **Что использует он:** `class-validator`
- **Количество строк:** 16 (3-18)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### UpdateTaskDto

- **Название:** `UpdateTaskDto`
- **Тип:** класс
- **Файл:** `apps/api/src/tasks/dto/update-task.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `completedAt?: string | null`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./create-task.dto`, `@nestjs/mapped-types`, `CreateTaskDto`, `PartialType(CreateTaskDto)`, `class-validator`
- **Кто использует:** `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/mobile/lib/api/tasks.ts`, `packages/shared-types/src/index.ts`
- **Что использует он:** `./create-task.dto`, `@nestjs/mapped-types`, `CreateTaskDto`, `PartialType(CreateTaskDto)`, `class-validator`
- **Количество строк:** 5 (5-9)
- **Сложность:** средняя
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### TasksController

- **Название:** `TasksController`
- **Тип:** класс
- **Файл:** `apps/api/src/tasks/tasks.controller.ts`
- **Назначение:** HTTP-контроллер NestJS: принимает запросы, применяет guard/decorator-слой и делегирует бизнес-логику сервисам.
- **Поля:** нет
- **Конструктор:** `constructor(private readonly tasksService: TasksService)`
- **Все методы:** `create`, `findAll`, `findOne`, `update`, `toggle`, `remove`
- **Все зависимости:** `../auth/decorators/current-user.decorator`, `../auth/guards/jwt-auth.guard`, `./dto/create-task.dto`, `./dto/get-tasks-query.dto`, `./dto/update-task.dto`, `./tasks.service`, `@nestjs/common`, `@prisma/client`, `CreateTaskDto`, `GetTasksQueryDto`, `TasksService`, `UpdateTaskDto`, `User`
- **Кто использует:** `apps/api/src/tasks/tasks.module.ts`
- **Что использует он:** `../auth/decorators/current-user.decorator`, `../auth/guards/jwt-auth.guard`, `./dto/create-task.dto`, `./dto/get-tasks-query.dto`, `./dto/update-task.dto`, `./tasks.service`, `@nestjs/common`, `@prisma/client`, `CreateTaskDto`, `GetTasksQueryDto`, `TasksService`, `UpdateTaskDto`, `User`
- **Количество строк:** 54 (25-78)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность

### TasksModule

- **Название:** `TasksModule`
- **Тип:** класс
- **Файл:** `apps/api/src/tasks/tasks.module.ts`
- **Назначение:** Модуль NestJS: агрегирует providers/controllers/imports/exports для DI-контейнера.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `../notifications/notifications.module`, `../plan/plan.module`, `./tasks.controller`, `./tasks.service`, `@nestjs/common`
- **Кто использует:** `apps/api/src/app.module.ts`
- **Что использует он:** `../notifications/notifications.module`, `../plan/plan.module`, `./tasks.controller`, `./tasks.service`, `@nestjs/common`
- **Количество строк:** 1 (13-13)
- **Сложность:** средняя
- **Замечания:** композиционный NestJS-модуль, пустое тело ожидаемо

### TasksService

- **Название:** `TasksService`
- **Тип:** класс
- **Файл:** `apps/api/src/tasks/tasks.service.ts`
- **Назначение:** Сервис NestJS: содержит прикладную/инфраструктурную логику доменного модуля.
- **Поля:** 
- `private readonly logger = new Logger(TasksService.name)`
- `private readonly prisma: PrismaService`
- `private readonly notifications: NotificationsService`
- `private readonly planService: PlanService`
- `async create(userId: string, dto: CreateTaskDto): Promise<Task> {`
- `async findAll(userId: string, query: GetTasksQueryDto): Promise<Task[]> {`
- `async findOne(userId: string, taskId: string): Promise<Task> {`
- `async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<Task> {`
- `async remove(userId: string, taskId: string): Promise<void> {`
- `async toggleComplete(userId: string, taskId: string): Promise<Task> {`
- `private async syncReminder(task: Task): Promise<void> {`
- `private async safeCancelReminder(taskId: string): Promise<void> {`
- **Конструктор:** `constructor( private readonly prisma: PrismaService, private readonly notifications: NotificationsService, private readonly planService: PlanService, )`
- **Все методы:** `create`, `findAll`, `findOne`, `update`, `remove`, `toggleComplete`, `syncReminder`, `safeCancelReminder`
- **Все зависимости:** `../notifications/notifications.service`, `../plan/plan.service`, `../prisma/prisma.service`, `./dto/create-task.dto`, `./dto/get-tasks-query.dto`, `./dto/update-task.dto`, `@nestjs/common`, `@prisma/client`, `CreateTaskDto`, `GetTasksQueryDto`, `NotificationsService`, `PlanService`, `PrismaService`, `Task`, `UpdateTaskDto`, `date-fns-tz`
- **Кто использует:** `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/tasks/tasks.module.ts`, `apps/api/src/tasks/tasks.service.spec.ts`
- **Что использует он:** `../notifications/notifications.service`, `../plan/plan.service`, `../prisma/prisma.service`, `./dto/create-task.dto`, `./dto/get-tasks-query.dto`, `./dto/update-task.dto`, `@nestjs/common`, `@prisma/client`, `CreateTaskDto`, `GetTasksQueryDto`, `NotificationsService`, `PlanService`, `PrismaService`, `Task`, `UpdateTaskDto`, `date-fns-tz`
- **Количество строк:** 162 (12-173)
- **Сложность:** высокая
- **Замечания:** много исходящих зависимостей — высокая связность

### UpdateUserDto

- **Название:** `UpdateUserDto`
- **Тип:** класс
- **Файл:** `apps/api/src/users/dto/update-user.dto.ts`
- **Назначение:** DTO: схема входных данных API с class-validator/class-transformer декораторами.
- **Поля:** 
- `email?: string`
- `phone?: string`
- `timezone?: string`
- `hasCompletedOnboarding?: boolean`
- `expoPushToken?: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `class-validator`
- **Кто использует:** `apps/api/src/users/users.controller.ts`, `apps/api/src/users/users.service.ts`
- **Что использует он:** `class-validator`
- **Количество строк:** 21 (3-23)
- **Сложность:** низкая
- **Замечания:** пассивный DTO, логика отсутствует — нормально

### UsersController

- **Название:** `UsersController`
- **Тип:** класс
- **Файл:** `apps/api/src/users/users.controller.ts`
- **Назначение:** HTTP-контроллер NestJS: принимает запросы, применяет guard/decorator-слой и делегирует бизнес-логику сервисам.
- **Поля:** нет
- **Конструктор:** `constructor(private readonly usersService: UsersService)`
- **Все методы:** `getMe`, `update`, `remove`
- **Все зависимости:** `../auth/decorators/current-user.decorator`, `../auth/guards/jwt-auth.guard`, `./dto/update-user.dto`, `./users.service`, `@nestjs/common`, `@prisma/client`, `UpdateUserDto`, `User`, `UsersService`
- **Кто использует:** `apps/api/src/users/users.module.ts`
- **Что использует он:** `../auth/decorators/current-user.decorator`, `../auth/guards/jwt-auth.guard`, `./dto/update-user.dto`, `./users.service`, `@nestjs/common`, `@prisma/client`, `UpdateUserDto`, `User`, `UsersService`
- **Количество строк:** 22 (10-31)
- **Сложность:** средняя
- **Замечания:** существенных замечаний нет

### UsersModule

- **Название:** `UsersModule`
- **Тип:** класс
- **Файл:** `apps/api/src/users/users.module.ts`
- **Назначение:** Модуль NestJS: агрегирует providers/controllers/imports/exports для DI-контейнера.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./users.controller`, `./users.service`, `@nestjs/common`
- **Кто использует:** `apps/api/src/app.module.ts`
- **Что использует он:** `./users.controller`, `./users.service`, `@nestjs/common`
- **Количество строк:** 1 (10-10)
- **Сложность:** низкая
- **Замечания:** композиционный NestJS-модуль, пустое тело ожидаемо

### UsersService

- **Название:** `UsersService`
- **Тип:** класс
- **Файл:** `apps/api/src/users/users.service.ts`
- **Назначение:** Сервис NestJS: содержит прикладную/инфраструктурную логику доменного модуля.
- **Поля:** 
- `async findById(id: string): Promise<SafeUser> {`
- `async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {`
- `async remove(id: string): Promise<void> {`
- **Конструктор:** `constructor(private readonly prisma: PrismaService)`
- **Все методы:** `findById`, `update`, `remove`
- **Все зависимости:** `../prisma/prisma.service`, `./dto/update-user.dto`, `@nestjs/common`, `@prisma/client`, `PrismaService`, `UpdateUserDto`
- **Кто использует:** `apps/api/src/users/users.controller.ts`, `apps/api/src/users/users.module.ts`
- **Что использует он:** `../prisma/prisma.service`, `./dto/update-user.dto`, `@nestjs/common`, `@prisma/client`, `PrismaService`, `UpdateUserDto`
- **Количество строк:** 23 (9-31)
- **Сложность:** средняя
- **Замечания:** существенных замечаний нет

### LoginPayload

- **Название:** `LoginPayload`
- **Тип:** интерфейс/контракт
- **Файл:** `apps/mobile/lib/api/auth.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `email?: string`
- `phone?: string`
- `password: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `../api-client`, `@focus/shared-types`
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** `../api-client`, `@focus/shared-types`
- **Количество строк:** 5 (4-8)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### RegisterPayload

- **Название:** `RegisterPayload`
- **Тип:** интерфейс/контракт
- **Файл:** `apps/mobile/lib/api/auth.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `timezone?: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `../api-client`, `@focus/shared-types`, `LoginPayload`
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** `../api-client`, `@focus/shared-types`, `LoginPayload`
- **Количество строк:** 3 (10-12)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### PlanInfo

- **Название:** `PlanInfo`
- **Тип:** интерфейс/контракт
- **Файл:** `apps/mobile/lib/api/plan.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `plan: Plan`
- `isPro: boolean`
- `proExpiresAt: string | null`
- `usage: {`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `../api-client`, `@focus/shared-types`, `@tanstack/react-query`
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** `../api-client`, `@focus/shared-types`, `@tanstack/react-query`
- **Количество строк:** 9 (5-13)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### TaskLayout

- **Название:** `TaskLayout`
- **Тип:** интерфейс/контракт
- **Файл:** `apps/mobile/lib/timeline-layout.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `columnIndex: number`
- `columnCount: number`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `./timeline-config`, `@focus/shared-types`
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** `./timeline-config`, `@focus/shared-types`
- **Количество строк:** 4 (4-7)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### User

- **Название:** `User`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `id: string`
- `email: string | null`
- `phone: string | null`
- `timezone: string`
- `hasCompletedOnboarding: boolean`
- `plan: Plan`
- `proExpiresAt: Date | null`
- `createdAt: Date`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/decorators/current-user.decorator.ts`, `apps/api/src/auth/mailru-oauth.controller.ts`, `apps/api/src/auth/strategies/jwt.strategy.ts`, `apps/api/src/auth/vk-oauth.controller.ts`, `apps/api/src/auth/yandex-oauth.controller.ts`, `apps/api/src/plan/plan.controller.ts`, `apps/api/src/routines/routines.controller.ts`, `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/users/users.controller.ts`, `apps/api/src/users/users.service.ts`, `apps/mobile/lib/api/auth.ts`, `apps/mobile/lib/timeline-config.ts`, `apps/mobile/stores/auth.store.ts`
- **Что использует он:** нет
- **Количество строк:** 10 (17-26)
- **Сложность:** низкая
- **Замечания:** центральная точка входящих зависимостей; контракт типов; runtime-логики нет

### Task

- **Название:** `Task`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `id: string`
- `userId: string`
- `title: string`
- `startTime: Date | null`
- `durationMinutes: number`
- `color: string`
- `isRecurring: boolean`
- `recurrenceRule: string | null; // iCal RRULE, напр. "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR"`
- `parentTaskId: string | null;   // для подзадач`
- `completedAt: Date | null`
- `createdAt: Date`
- `updatedAt: Date`
- `subTasks?: Task[]`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** `apps/api/src/notifications/notifications.service.spec.ts`, `apps/api/src/notifications/notifications.service.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/mobile/app/(tabs)/today.tsx`, `apps/mobile/app/task-form.tsx`, `apps/mobile/components/timeline/TaskBlock.tsx`, `apps/mobile/components/timeline/Timeline.tsx`, `apps/mobile/lib/api/tasks.ts`, `apps/mobile/lib/timeline-layout.ts`
- **Что использует он:** нет
- **Количество строк:** 15 (32-46)
- **Сложность:** низкая
- **Замечания:** центральная точка входящих зависимостей; контракт типов; runtime-логики нет

### CreateTaskDto

- **Название:** `CreateTaskDto`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `title: string`
- `startTime?: string | null; // ISO 8601`
- `durationMinutes?: number`
- `color?: string`
- `isRecurring?: boolean`
- `recurrenceRule?: string | null`
- `parentTaskId?: string | null`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** `apps/api/src/tasks/dto/create-task.dto.ts`, `apps/api/src/tasks/dto/update-task.dto.ts`, `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/mobile/lib/api/tasks.ts`
- **Что использует он:** нет
- **Количество строк:** 9 (48-56)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### UpdateTaskDto

- **Название:** `UpdateTaskDto`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `completedAt?: string | null`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `CreateTaskDto`, `Partial<CreateTaskDto>`
- **Кто использует:** `apps/api/src/tasks/dto/update-task.dto.ts`, `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/mobile/lib/api/tasks.ts`
- **Что использует он:** `CreateTaskDto`, `Partial<CreateTaskDto>`
- **Количество строк:** 3 (58-60)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### Routine

- **Название:** `Routine`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `id: string`
- `userId: string`
- `name: string`
- `daysOfWeek: number[]`
- `createdAt: Date`
- `updatedAt: Date`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** `apps/api/src/routines/routines.service.ts`
- **Что использует он:** нет
- **Количество строк:** 8 (67-74)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### CreateRoutineDto

- **Название:** `CreateRoutineDto`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `name: string`
- `daysOfWeek: number[]`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** `apps/api/src/routines/dto/create-routine.dto.ts`, `apps/api/src/routines/dto/update-routine.dto.ts`, `apps/api/src/routines/routines.controller.ts`, `apps/api/src/routines/routines.service.ts`
- **Что использует он:** нет
- **Количество строк:** 4 (76-79)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### UpdateRoutineDto

- **Название:** `UpdateRoutineDto`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** нет
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** `CreateRoutineDto`, `Partial<CreateRoutineDto>`
- **Кто использует:** `apps/api/src/routines/dto/update-routine.dto.ts`, `apps/api/src/routines/routines.controller.ts`, `apps/api/src/routines/routines.service.ts`
- **Что использует он:** `CreateRoutineDto`, `Partial<CreateRoutineDto>`
- **Количество строк:** 1 (81-81)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### FocusSession

- **Название:** `FocusSession`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `id: string`
- `hostUserId: string`
- `dailyRoomUrl: string | null`
- `isPublic: boolean`
- `maxParticipants: number`
- `timerMinutes: number`
- `createdAt: Date`
- `endedAt: Date | null`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** нет
- **Количество строк:** 10 (87-96)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### FocusSessionParticipant

- **Название:** `FocusSessionParticipant`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `id: string`
- `sessionId: string`
- `userId: string`
- `joinedAt: Date`
- `leftAt: Date | null`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** нет
- **Количество строк:** 7 (98-104)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### AuthTokens

- **Название:** `AuthTokens`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `accessToken: string`
- `refreshToken: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/oauth.service.ts`, `apps/mobile/lib/api-client.ts`, `apps/mobile/lib/api/auth.ts`, `apps/mobile/lib/secure-storage.ts`, `apps/mobile/stores/auth.store.ts`
- **Что использует он:** нет
- **Количество строк:** 4 (110-113)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### JwtPayload

- **Название:** `JwtPayload`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `sub: string;  // userId`
- `email: string | null`
- `phone: string | null`
- `iat?: number`
- `exp?: number`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/strategies/jwt.strategy.ts`
- **Что использует он:** нет
- **Количество строк:** 7 (115-121)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### NotificationLog

- **Название:** `NotificationLog`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `id: string`
- `userId: string`
- `taskId: string | null`
- `sentAt: Date`
- `delivered: boolean`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** `apps/api/src/notifications/notifications.service.ts`
- **Что использует он:** нет
- **Количество строк:** 7 (127-133)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### ApiResponse

- **Название:** `ApiResponse`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `data: T`
- `message?: string`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** нет
- **Количество строк:** 4 (139-142)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

### PaginatedResponse

- **Название:** `PaginatedResponse`
- **Тип:** интерфейс/контракт
- **Файл:** `packages/shared-types/src/index.ts`
- **Назначение:** TypeScript-контракт/форма данных для типизации обмена и внутренних структур.
- **Поля:** 
- `data: T[]`
- `total: number`
- `page: number`
- `pageSize: number`
- **Конструктор:** нет
- **Все методы:** нет
- **Все зависимости:** нет
- **Кто использует:** нет явных внешних ссылок
- **Что использует он:** нет
- **Количество строк:** 6 (144-149)
- **Сложность:** низкая
- **Замечания:** контракт типов; runtime-логики нет

## Рекомендации

1. Следить за ростом `TasksService`: при добавлении recurrence/planning/notification сценариев выделить отдельные domain-сервисы.
2. В `AuthService` и `OAuthService` удерживать разделение: token lifecycle, provider clients и user provisioning лучше не смешивать в одном классе.
3. Для `NotificationsService` при росте логики выделить scheduler, push-token registry и sender.
4. `PrismaService` закономерно высоко связан как инфраструктурная точка доступа к БД; не добавлять в него бизнес-логику.
5. DTO и shared interfaces имеют низкую поведенческую сложность; поддерживать синхронизацию backend DTO и `packages/shared-types`, чтобы избежать расхождений контрактов.
