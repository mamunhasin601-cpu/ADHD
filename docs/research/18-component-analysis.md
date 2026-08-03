# 18. React Component Analysis

Дата исследования: 03.08.2026  
Область: `apps/mobile` — Expo Router / React Native frontend.

## 1. Executive Summary

React-слой приложения сосредоточен в `apps/mobile/app` и `apps/mobile/components`. Найдено 17 React-компонентов/экранов:

- Route/layout компоненты Expo Router: `RootLayout`, `Index`, `TabsLayout`, `TodayScreen`, `FocusScreen`, `SettingsScreen`, `LoginScreen`, `RegisterScreen`, `AuthProviderSelectScreen`, `OnboardingScreen`, `PaywallScreen`, `TaskFormScreen`.
- UI/components: `Timeline`, `TaskBlock`, `NowIndicator`, `ProgressRing`, `EmptyState`.

Ключевые выводы:

1. Самые крупные и сложные компоненты: `TodayScreen` (`apps/mobile/app/(tabs)/today.tsx`, 527 строк), `TaskFormScreen` (`apps/mobile/app/task-form.tsx`, 519 строк), `PaywallScreen` (316 строк), `OnboardingScreen` (318 строк).
2. Самое заметное дублирование: `LoginScreen` и `RegisterScreen` почти полностью повторяют форму выбора email/phone, поля, OAuth-link, стили и flow получения токенов/user.
3. Потенциальные лишние ререндеры: `TodayScreen` каждую минуту пересоздаёт массивы `scheduledTasks`/`unscheduledTasks`, callbacks для `Timeline`, inline navigation params; `Timeline` пересчитывает layout при изменении ссылки `tasks`; `NowIndicator` имеет собственный minute interval, параллельно с interval в `TodayScreen`.
4. React Query используется точечно и корректно: `tasksKey = ['tasks', YYYY-MM-DD]`, `planInfoKey = ['plan']`; мутации задач инвалидируют date-specific cache, но часть прямых API вызовов инвалидирует слишком широко (`['tasks']`) или вручную.
5. Zustand store используется только для auth/session (`useAuthStore`). UI-state почти весь локальный.
6. Навигация построена через Expo Router: root stack + tabs + modal `task-form`.

## 2. Component Tree

```text
app/_layout.tsx — RootLayout
└─ QueryClientProvider
   └─ Stack(headerShown=false)
      ├─ app/index.tsx — Index
      │  ├─ ActivityIndicator while auth bootstrap
      │  └─ Redirect → /login | /onboarding | /(tabs)/today
      ├─ app/login.tsx — LoginScreen
      │  └─ SafeAreaView
      │     └─ KeyboardAvoidingView
      │        └─ login form + Link(/auth-provider-select) + Link(/register)
      ├─ app/register.tsx — RegisterScreen
      │  └─ SafeAreaView
      │     └─ KeyboardAvoidingView
      │        └─ registration form + Link(/auth-provider-select) + Link(/login)
      ├─ app/auth-provider-select.tsx — AuthProviderSelectScreen
      │  └─ SafeAreaView
      │     └─ provider buttons: Yandex / VK / Mail.ru
      ├─ app/onboarding.tsx — OnboardingScreen
      │  ├─ Step 1 welcome
      │  ├─ Step 2 first task form
      │  └─ Step 3 features explanation
      ├─ app/paywall.tsx — PaywallScreen
      │  └─ plan usage + Free/Pro comparison + upgrade CTA
      ├─ app/task-form.tsx — TaskFormScreen (modal)
      │  └─ ScrollView task editor
      │     ├─ title input
      │     ├─ time section
      │     ├─ duration chips
      │     ├─ color chips
      │     ├─ recurrence chips
      │     ├─ subtasks editor
      │     └─ save/delete actions
      └─ app/(tabs)/_layout.tsx — TabsLayout
         └─ Tabs
            ├─ app/(tabs)/today.tsx — TodayScreen
            │  └─ SafeAreaView
            │     ├─ header + date navigation + ProgressRing
            │     ├─ loading/error/empty states
            │     ├─ now/next card
            │     ├─ unscheduled inbox list
            │     ├─ Timeline
            │     │  ├─ hour rows
            │     │  ├─ NowIndicator
            │     │  └─ TaskBlock[]
            │     ├─ FAB
            │     └─ quick-add Modal
            ├─ app/(tabs)/focus.tsx — FocusScreen
            │  └─ static body-doubling placeholder
            └─ app/(tabs)/settings.tsx — SettingsScreen
               └─ profile + subscription + logout
```

## 3. Route / Screen Components

### 3.1 `RootLayout` — `apps/mobile/app/_layout.tsx`

| Aspect | Details |
|---|---|
| Props | Нет внешних props. Expo Router вызывает как layout route. |
| State | Нет локального state. |
| Hooks | `useEffect` x2; `useAuthStore` x2. |
| Children | `QueryClientProvider` → `Stack` → registered screens. |
| Parent | Expo Router root. |
| API Calls | Через `apiClient.patch('/users/me', { expoPushToken })` после авторизации. Через `bootstrap()` косвенно `GET /auth/me`. |
| Store Usage | `useAuthStore((s) => s.bootstrap)`, `useAuthStore((s) => s.user)`. |
| React Query | Создаёт singleton `QueryClient`, оборачивает всё приложение в `QueryClientProvider`. |
| Navigation | Регистрирует stack screens: `login`, `register`, `auth-provider-select`, `onboarding`, `paywall`, `(tabs)`, `task-form` modal. |
| Rendering Flow | На mount запускает auth bootstrap. При появлении `user` запускает push permission/token registration. Рендерит providers и stack. |

Notes:
- `QueryClient` создан вне компонента — хорошо, не пересоздаётся на ререндер.
- Push registration находится в root layout. Это удобно, но root layout смешивает app shell, auth bootstrap и notifications side effect.

### 3.2 `Index` — `apps/mobile/app/index.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | Нет локального state. |
| Hooks | `useAuthStore` x3: `isLoading`, `isAuthenticated`, `user`. |
| Children | `ActivityIndicator` или `Redirect`. |
| Parent | `RootLayout` stack route `/`. |
| API Calls | Нет прямых; зависит от результата `bootstrap()` в `RootLayout`. |
| Store Usage | Auth/session state. |
| React Query | Нет. |
| Navigation | Declarative redirects: `/login`, `/onboarding`, `/(tabs)/today`. |
| Rendering Flow | Если `isLoading` — spinner; если unauthenticated — login; если onboarding incomplete — onboarding; иначе today. |

### 3.3 `LoginScreen` — `apps/mobile/app/login.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | `identifierType`, `identifier`, `password`, `loading`. |
| Hooks | `useState` x4, `useRouter`, `useAuthStore` x2. |
| Children | `SafeAreaView` → `KeyboardAvoidingView` → form, OAuth link, register link. |
| Parent | `RootLayout` stack screen `login`; may be reached from `Index`, `RegisterScreen`, logout. |
| API Calls | `loginRequest(...)` → auth login endpoint; `getMe()` → `/auth/me`. |
| Store Usage | `setTokens`, `setUser`. |
| React Query | Нет. Auth не кешируется через React Query. |
| Navigation | `router.replace('/(tabs)/today')`, `Link` to `/auth-provider-select`, `/register`. |
| Rendering Flow | User edits fields → state updates → disabled state recalculated. Submit sets loading, stores tokens/user, redirects or shows alert. |

### 3.4 `RegisterScreen` — `apps/mobile/app/register.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | `identifierType`, `identifier`, `password`, `loading`; derived `passwordTooShort`. |
| Hooks | `useState` x4, `useRouter`, `useAuthStore` x2. |
| Children | Почти та же форма, что LoginScreen, с password hint. |
| Parent | `RootLayout` stack screen `register`; reachable from login. |
| API Calls | `registerRequest(...)`; `getMe()`. |
| Store Usage | `setTokens`, `setUser`. |
| React Query | Нет. |
| Navigation | `router.replace('/(tabs)/today')`, `Link` to `/auth-provider-select`, `/login`. |
| Rendering Flow | Аналог LoginScreen; password validation requires length >= 8. |

### 3.5 `AuthProviderSelectScreen` — `apps/mobile/app/auth-provider-select.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | `isLoading`. |
| Hooks | `useRouter`, `useAuthStore`, `useState`, `useEffect`. |
| Children | Provider buttons: Yandex/VK/Mail.ru + back to email/phone. |
| Parent | `RootLayout`; navigated from login/register links. |
| API Calls | OAuth browser opens `${API_BASE_URL}/auth/yandex`, `/auth/vk`, `/auth/mailru`; deep link receives tokens. |
| Store Usage | `setTokens`. User object is not loaded here after OAuth. |
| React Query | Нет. |
| Navigation | Deep link success → `router.replace('/(tabs)/today')`; fallback button → `router.back()`. |
| Rendering Flow | Mount subscribes to `Linking` URL events. Provider button opens auth session. Deep link stores tokens and redirects. |

Issues:
- OAuth flow sets tokens but does not call `getMe()`/`setUser`, unlike email login/register. Root push-registration and onboarding redirect may not see `user` until next bootstrap or explicit fetch.
- `handleDeepLink` is referenced in `useEffect([])` but defined as function declaration; technically works, но handler captures initial `setTokens/router`. Сейчас безопасно, но lint exhaustive-deps будет ругаться.
- Formatting issues around `handleVKLogin` and braces reduce readability.

### 3.6 `OnboardingScreen` — `apps/mobile/app/onboarding.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | `step`, `taskTitle`, `taskTime`. |
| Hooks | `useRouter`, `useState` x3, `useCreateTask(new Date())`. |
| Children | Conditional tree per step: welcome, first task form, final feature list. |
| Parent | `RootLayout`; redirected from `Index` if user has not completed onboarding. |
| API Calls | `apiClient.patch('/users/me', { hasCompletedOnboarding: true })`; `POST /tasks` via `useCreateTask`. |
| Store Usage | Нет прямого store usage. User in auth store is not updated after completion. |
| React Query | `useCreateTask(new Date())` invalidates `['tasks', today]` on success. |
| Navigation | `router.replace('/(tabs)/today')`. |
| Rendering Flow | `step` selects one of three full-screen branches. Step 2 can create first task, then goes to step 3. Complete patches user and redirects. |

Issue:
- После `hasCompletedOnboarding: true` auth store `user` не обновляется. Если пользователь вернётся на `/`, `Index` может снова видеть stale `user.hasCompletedOnboarding === false` до bootstrap/refetch.

### 3.7 `PaywallScreen` — `apps/mobile/app/paywall.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | `isLoading`. |
| Hooks | `useRouter`, `useState`, `usePlanInfo`, `useInvalidatePlan`. |
| Children | Header, usage bar, Free/Pro comparison, pricing, CTA, dismiss. |
| Parent | `RootLayout`; opened from `TodayScreen`, `TaskFormScreen`, `SettingsScreen`. |
| API Calls | `GET /plan` via query; `POST /plan/upgrade` via `apiClient`. |
| Store Usage | Нет. |
| React Query | Reads `['plan']`; invalidates `['plan']` after upgrade. |
| Navigation | Upgrade success alert → `router.back()`; dismiss → `router.back()`. |
| Rendering Flow | Query data derives usage; CTA sets loading, upgrades, invalidates plan, shows alert. |

### 3.8 `TabsLayout` — `apps/mobile/app/(tabs)/_layout.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | Нет. |
| Hooks | Нет React hooks. |
| Children | `Tabs.Screen`: `today`, `focus`, `settings`. |
| Parent | `RootLayout` stack screen `(tabs)`. |
| API Calls | Нет. |
| Store Usage | Нет. |
| React Query | Нет. |
| Navigation | Bottom tabs with Ionicons. |
| Rendering Flow | Static tab navigator. |

### 3.9 `TodayScreen` — `apps/mobile/app/(tabs)/today.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | `selectedDate`, `currentTime`, `quickAddOpen`, `quickAddTime`, `title`. |
| Hooks | `useRouter`, `useState` x5, `useMemo` x3, `useEffect`, `useTasksForDate`, `useCreateTask`, `useToggleTask`. |
| Children | `ProgressRing`, `EmptyState`, unscheduled task rows, `Timeline`, `Modal` quick-add. |
| Parent | `TabsLayout` tab `today`; root redirect target. |
| API Calls | `GET /tasks?date=YYYY-MM-DD&includeSubTasks=true`; `POST /tasks`; `PATCH /tasks/:id/toggle`. |
| Store Usage | Нет. |
| React Query | `useTasksForDate(selectedDate)` → `['tasks', date]`; `useCreateTask(selectedDate)` invalidates date key; `useToggleTask(selectedDate)` optimistic update + invalidate date key. |
| Navigation | `router.push('/paywall')`; push modal `/task-form` with serialized task/prefill/selectedDate. |
| Rendering Flow | Date change → tasks query key changes → loading/data states. Minute interval updates `currentTime`, recomputes now/next. Empty/filled state decides whether to show `Timeline`, inbox, now/next, modal. |

Complexity:
- Смешаны responsibilities: date navigation, task querying, progress, now/next derivation, inbox list, quick add modal, route params for editor.
- `scheduledTasks`, `unscheduledTasks`, `completedCount` вычисляются на каждом render без `useMemo`.
- Inline callbacks passed into `Timeline`/`EmptyState`/lists create new function identities each render.

### 3.10 `FocusScreen` — `apps/mobile/app/(tabs)/focus.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | Нет. |
| Hooks | Нет. |
| Children | Static placeholder UI. |
| Parent | `TabsLayout` tab `focus`. |
| API Calls | Нет. |
| Store Usage | Нет. |
| React Query | Нет. |
| Navigation | Нет. |
| Rendering Flow | Static render. |

### 3.11 `SettingsScreen` — `apps/mobile/app/(tabs)/settings.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | Нет локального state. |
| Hooks | `useRouter`, `useAuthStore` x2, `usePlanInfo`. |
| Children | Profile section, subscription section, logout action. |
| Parent | `TabsLayout` tab `settings`. |
| API Calls | `GET /plan`; logout clears SecureStore/local auth token. |
| Store Usage | `user`, `logout`. |
| React Query | `usePlanInfo()` → `['plan']`. |
| Navigation | Upgrade → `/paywall`; logout → `router.replace('/login')`. |
| Rendering Flow | Renders profile from store and subscription from React Query. Logout confirmation mutates auth store and redirects. |

### 3.12 `TaskFormScreen` — `apps/mobile/app/task-form.tsx`

| Aspect | Details |
|---|---|
| Props | Нет component props; получает route params через `useLocalSearchParams`: `task`, `prefillStartTime`, `prefillTitle`, `selectedDate`. |
| State | `title`, `hasTime`, `hour`, `minute`, `durationMinutes`, `color`, `recurrencePreset`, `existingSubtasks`, `newSubtasks`, `subtaskInput`, `saving`. |
| Hooks | `useRouter`, `useQueryClient`, `useLocalSearchParams`, `useMemo` x2, `useState` x11, `useCreateTask`, `useUpdateTask`, `useDeleteTask`. |
| Children | Long form sections: title, time stepper, duration chips, color swatches, recurrence chips, subtask presets/lists/input, save/delete buttons. |
| Parent | `RootLayout` stack modal; opened from `TodayScreen`. |
| API Calls | `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`, `POST /tasks` for subtasks, `DELETE /tasks/:id` for subtask. |
| Store Usage | Нет. |
| React Query | Mutations invalidate `['tasks', selectedDate]`; manual `queryClient.invalidateQueries({ queryKey: ['tasks'] })` after subtask changes. |
| Navigation | Save/delete success → `router.back()`; free tier error → `router.replace('/paywall')`. |
| Rendering Flow | Parses serialized `task` param into `existingTask`; initializes local state once. Save builds DTO, chooses create/update, creates subtasks sequentially, invalidates cache, navigates back. |

Issues:
- Очень много локального state в одном экране.
- `existingTask` передаётся через URL as `JSON.stringify(task)`, что хрупко для больших объектов/Date/null/subtasks.
- Subtask operations mix React Query mutations and direct API helpers.
- `existingSubtasks` optimistic removal не откатывается при ошибке.

## 4. Reusable / UI Components

### 4.1 `Timeline` — `apps/mobile/components/timeline/Timeline.tsx`

| Aspect | Details |
|---|---|
| Props | `tasks`, `onToggle`, `onOpenTask`, `onCreateAt`, `shouldAutoScroll?`, `currentDate?`, `currentTaskId?`. |
| State | `hasScrolledToNow`. |
| Hooks | `useRef`, `useState`, `useMemo`, `useEffect`. |
| Children | Hour rows, `NowIndicator`, `TaskBlock[]`. |
| Parent | `TodayScreen`. |
| API Calls | Нет. |
| Store Usage | Нет. |
| React Query | Нет напрямую; receives query data through props. |
| Navigation | Нет напрямую; delegates `onOpenTask`. |
| Rendering Flow | Memoizes `computeTimelineLayout(tasks)`. On first render for today scrolls to now. Background press converts y-coordinate to Date and calls `onCreateAt`. Maps tasks to `TaskBlock`. |

Potential issue:
- Effect dependency array omits `shouldAutoScroll`; если prop меняется, effect может вести себя неожиданно.
- `currentDate = new Date()` default creates new Date during render when prop absent, but parent currently passes it.

### 4.2 `TaskBlock` — `apps/mobile/components/timeline/TaskBlock.tsx`

| Aspect | Details |
|---|---|
| Props | `task`, `onToggle`, `onOpen`, `columnIndex?`, `columnCount?`, `isCurrent?`. |
| State | Нет. |
| Hooks | Нет. |
| Children | `Pressable` with title/subtask count. |
| Parent | `Timeline`. |
| API Calls | Нет. |
| Store Usage | Нет. |
| React Query | Нет. |
| Navigation | Нет напрямую; long press calls `onOpen(task)`. |
| Rendering Flow | Returns `null` for unscheduled tasks. Computes absolute position/height from `task.startTime` and `durationMinutes`, renders block. |

Potential issue:
- Not wrapped in `React.memo`; all blocks rerender when parent rerenders, even if task unchanged.

### 4.3 `NowIndicator` — `apps/mobile/components/timeline/NowIndicator.tsx`

| Aspect | Details |
|---|---|
| Props | Нет. |
| State | `now`. |
| Hooks | `useState`, `useEffect`. |
| Children | Red line/dot/time label. |
| Parent | `Timeline`. |
| API Calls | Нет. |
| Store Usage | Нет. |
| React Query | Нет. |
| Navigation | Нет. |
| Rendering Flow | On mount sets interval each minute, updates `now`, computes top position; hides outside configured timeline range. |

Potential issue:
- Дублирует minute timer с `TodayScreen`, где `currentTime` тоже обновляется каждую минуту.

### 4.4 `ProgressRing` — `apps/mobile/components/ProgressRing.tsx`

| Aspect | Details |
|---|---|
| Props | `completed`, `total`, `size? = 48`, `strokeWidth? = 4`. |
| State | Нет. |
| Hooks | Нет. |
| Children | SVG circle background/progress + percent text. |
| Parent | `TodayScreen`. |
| API Calls | Нет. |
| Store Usage | Нет. |
| React Query | Нет. |
| Navigation | Нет. |
| Rendering Flow | If `total === 0`, returns `null`; otherwise computes percentage/circumference and renders SVG. |

### 4.5 `EmptyState` — `apps/mobile/components/EmptyState.tsx`

| Aspect | Details |
|---|---|
| Props | `emoji`, `title`, `description`, `actionLabel?`, `onAction?`. |
| State | Нет. |
| Hooks | Нет. |
| Children | Emoji/title/description and optional action button. |
| Parent | `TodayScreen`; reusable candidate for other empty screens. |
| API Calls | Нет. |
| Store Usage | Нет. |
| React Query | Нет. |
| Navigation | Нет напрямую; delegates `onAction`. |
| Rendering Flow | Static presentational render; action rendered only if both `actionLabel` and `onAction` exist. |

## 5. API Calls Matrix

| Component | Direct / Hook API calls |
|---|---|
| `RootLayout` | `PATCH /users/me` for `expoPushToken`; auth bootstrap indirectly `GET /auth/me`. |
| `LoginScreen` | Login endpoint via `loginRequest`; `GET /auth/me`. |
| `RegisterScreen` | Register endpoint via `registerRequest`; `GET /auth/me`. |
| `AuthProviderSelectScreen` | Browser OAuth URLs: `/auth/yandex`, `/auth/vk`, `/auth/mailru`; deep link tokens. |
| `OnboardingScreen` | `PATCH /users/me`; `POST /tasks` via `useCreateTask`. |
| `TodayScreen` | `GET /tasks`; `POST /tasks`; `PATCH /tasks/:id/toggle`. |
| `TaskFormScreen` | `POST /tasks`; `PATCH /tasks/:id`; `DELETE /tasks/:id`; subtask `POST /tasks`; subtask `DELETE /tasks/:id`. |
| `SettingsScreen` | `GET /plan`; logout local side effects. |
| `PaywallScreen` | `GET /plan`; `POST /plan/upgrade`. |

## 6. Store Usage Matrix

| Store | Components | Usage |
|---|---|---|
| `useAuthStore` | `RootLayout` | `bootstrap`, `user`. |
| `useAuthStore` | `Index` | `isLoading`, `isAuthenticated`, `user`. |
| `useAuthStore` | `LoginScreen`, `RegisterScreen` | `setTokens`, `setUser`. |
| `useAuthStore` | `AuthProviderSelectScreen` | `setTokens`. |
| `useAuthStore` | `SettingsScreen` | `user`, `logout`. |

Observations:
- Store selectors are granular, which limits unrelated rerenders.
- Auth/user mutations are inconsistent: email login/register set user, OAuth only sets tokens, onboarding completion patches backend but not store.

## 7. React Query Usage Matrix

| Query / Mutation | Key | Components | Notes |
|---|---|---|---|
| `useTasksForDate(date)` | `['tasks', YYYY-MM-DD]` | `TodayScreen` | Fetches tasks with subtasks. |
| `useCreateTask(date)` | invalidates `['tasks', YYYY-MM-DD]` | `TodayScreen`, `OnboardingScreen`, `TaskFormScreen` | Date param comes from selected/today date. |
| `useUpdateTask(date)` | invalidates `['tasks', YYYY-MM-DD]` | `TaskFormScreen` | Good date-specific invalidation. |
| `useToggleTask(date)` | optimistic update on `['tasks', YYYY-MM-DD]` | `TodayScreen` | Good UX; invalidates on settled. |
| `useDeleteTask(date)` | invalidates `['tasks', YYYY-MM-DD]` | `TaskFormScreen` | Good date-specific invalidation. |
| `createSubtask` helper | manual invalidation | `TaskFormScreen` | Uses direct API; caller invalidates `['tasks']`. |
| `deleteTaskById` helper | manual invalidation | `TaskFormScreen` | Existing subtask deletion invalidates broad `['tasks']`. |
| `usePlanInfo()` | `['plan']` | `SettingsScreen`, `PaywallScreen` | `staleTime` 5 minutes. |
| `useInvalidatePlan()` | invalidates `['plan']` | `PaywallScreen` | Used after upgrade. |

## 8. Navigation Map

```text
Index
├─ unauthenticated → /login
├─ onboarding incomplete → /onboarding
└─ authenticated + complete → /(tabs)/today

LoginScreen
├─ success → replace /(tabs)/today
├─ Link → /auth-provider-select
└─ Link → /register

RegisterScreen
├─ success → replace /(tabs)/today
├─ Link → /auth-provider-select
└─ Link → /login

AuthProviderSelectScreen
├─ OAuth deep link success → replace /(tabs)/today
└─ Email/Phone → router.back()

OnboardingScreen
└─ complete/skip → replace /(tabs)/today

TodayScreen
├─ free tier limit → /paywall
├─ create/edit/details → /task-form modal
└─ tab shell from /(tabs)

TaskFormScreen
├─ save/delete success → back
└─ free tier limit → replace /paywall

SettingsScreen
├─ upgrade → /paywall
└─ logout → replace /login

PaywallScreen
└─ back after upgrade/dismiss
```

## 9. Huge Components

| Component | Lines | Why huge / risk |
|---|---:|---|
| `TodayScreen` | 527 | Главный экран содержит data fetching, date navigation, derived task selectors, quick-add modal, inbox list, now/next card, timeline orchestration. Высокая вероятность регрессий при изменениях. |
| `TaskFormScreen` | 519 | Большая форма с 10+ state variables, create/update/delete/subtasks/recurrence/time UI. Сложно тестировать и переиспользовать. |
| `PaywallScreen` | 316 | Много статической разметки Free/Pro comparison; можно декомпозировать на pricing/feature components. |
| `OnboardingScreen` | 318 | Три разных экрана внутри одного компонента; step-specific UI и side effects смешаны. |
| `AuthProviderSelectScreen` | 241 | Небольшой по UX, но три почти одинаковых OAuth handlers. |

Рекомендованная декомпозиция:

- `TodayScreen` → `TodayHeader`, `DateNavigator`, `NowNextCard`, `InboxList`, `QuickAddModal`, hooks `useTodayTasksViewModel`, `useCurrentAndNextTask`.
- `TaskFormScreen` → `TaskTitleField`, `TimeSection`, `DurationSection`, `ColorSection`, `RecurrenceSection`, `SubtasksSection`, hook `useTaskFormState`, service/hook `useSaveTaskForm`.
- `LoginScreen`/`RegisterScreen` → shared `AuthIdentifierForm`, `IdentifierTypeToggle`, shared styles or design-system primitives.
- `PaywallScreen` → `UsageLimitBar`, `PlanComparisonCard`, `PricingBlock`.
- `OnboardingScreen` → separate step components.

## 10. Duplication

### High duplication

1. `LoginScreen` and `RegisterScreen`
   - Same layout: `SafeAreaView`, `KeyboardAvoidingView`, title/subtitle, email/phone toggle, identifier input, password input, submit button, divider, OAuth button, link button.
   - Same store flow: `setTokens`, `getMe`, `setUser`, redirect.
   - Same styles names and values almost line-for-line.

2. OAuth provider handlers in `AuthProviderSelectScreen`
   - `handleYandexLogin`, `handleVKLogin`, `handleMailRuLogin` duplicate `setIsLoading`, `openAuthSessionAsync`, cancel alert, catch/finally.
   - Can become `handleProviderLogin(provider: 'yandex' | 'vk' | 'mailru')` with config map.

3. Subscription usage UI in `SettingsScreen` and `PaywallScreen`
   - Both calculate `activeTasks`, `limit`, `usagePercent`; both render usage bar.
   - Candidate: `PlanUsageBar`.

4. Chip UI patterns
   - `toggleChip`, `chip`, active text styles duplicated in login/register/task-form.
   - Candidate: generic `Chip`/`SegmentedControl`.

### Medium duplication

- Repeated navigation to `task-form` with serialized task and selectedDate in `TodayScreen`.
- Repeated `router.replace('/(tabs)/today')` after auth/onboarding.

## 11. Unnecessary Rerenders / Performance Risks

1. `TodayScreen` minute interval rerenders entire main screen every 60 seconds.
   - Necessary for now/next, but currently also rerenders header, inbox, timeline, modal subtree.
   - Recommendation: isolate clock-dependent UI into `NowNextCard` and `NowIndicator` or centralize clock in one hook/context.

2. Duplicate minute timers:
   - `TodayScreen` maintains `currentTime` interval.
   - `NowIndicator` maintains its own `now` interval.
   - Recommendation: one `useNowEveryMinute()` source passed down or localized clock only where needed.

3. Derived arrays in `TodayScreen` are not memoized:
   - `scheduledTasks = tasks.filter(...)`
   - `unscheduledTasks = tasks.filter(...)`
   - `completedCount = tasks.filter(...)`
   - Recommendation: `useMemo` keyed by `tasks`, or a view-model hook returning all derived values.

4. Inline functions passed to children:
   - `onToggle={(id) => toggleTask.mutate(id)}`
   - `onOpenTask={(task) => router.push(...)}`
   - `onCreateAt={(startTime) => openQuickAdd(startTime)}`
   - Recommendation: `useCallback`, especially if `Timeline`/`TaskBlock` are memoized later.

5. `TaskBlock` not memoized:
   - Every timeline rerender rerenders every task block.
   - Recommendation: `React.memo(TaskBlock)` after stabilizing callbacks.

6. `Timeline` auto-scroll effect dependency incomplete:
   - Uses `shouldAutoScroll`, `dayStartHour`, `dayEndHour`, `hourHeight`, but dependency array only `[hasScrolledToNow]`.
   - Recommendation: include relevant dependencies and reset `hasScrolledToNow` when switching date if desired.

7. Passing serialized task through navigation params:
   - JSON serialization creates large strings and can cause route updates with heavy params.
   - Recommendation: pass `taskId` and load from React Query cache/API in `TaskFormScreen`.

## 12. Too Complex Components

### `TodayScreen`

Complexity drivers:
- Data fetching + mutations.
- Date navigation.
- Derived selectors for current/next/progress/scheduled/unscheduled.
- Multiple conditional render branches.
- Modal state and task creation flow.
- Navigation construction with params.

Suggested target structure:

```text
TodayScreen
├─ useTodayTasksViewModel(selectedDate)
├─ TodayHeader
├─ TodayContent
│  ├─ EmptyState
│  ├─ NowNextCard
│  ├─ InboxList
│  └─ Timeline
├─ FloatingAddButton
└─ QuickAddModal
```

### `TaskFormScreen`

Complexity drivers:
- Parsing route params.
- Initializing many states from edit/create mode.
- Time math.
- Recurrence mapping.
- Subtask CRUD.
- Main task CRUD.
- Error handling and navigation.

Suggested target structure:

```text
TaskFormScreen
├─ useTaskFormInitialData(params)
├─ useTaskFormState(initialData)
├─ useTaskFormMutations(selectedDate)
├─ TaskTitleField
├─ TaskTimeSection
├─ DurationPicker
├─ ColorPicker
├─ RecurrencePicker
├─ SubtasksEditor
└─ TaskFormActions
```

## 13. Rendering Flow: Key Screens

### App startup

```text
RootLayout render
→ QueryClientProvider + Stack
→ useEffect bootstrap()
→ useAuthStore loads SecureStore tokens
→ optional GET /auth/me
→ Index reads auth store
→ Redirect to login/onboarding/today
→ if user exists, RootLayout push-token effect may PATCH /users/me
```

### Today screen

```text
TodayScreen mount
→ selectedDate initialized to new Date()
→ useTasksForDate(selectedDate) fetches tasks
→ loading spinner
→ data arrives
→ derive scheduled/unscheduled/progress/current/next
→ render empty state or now/next + inbox + timeline
→ each minute currentTime updates
→ current/next recompute
→ screen rerenders
```

### Quick add

```text
FAB/timeline press
→ openQuickAdd(startTime|null)
→ modal opens
→ title state updates while typing
→ submit calls useCreateTask mutation
→ POST /tasks
→ invalidate ['tasks', selectedDate]
→ modal closes
→ if free-tier limit error, navigate /paywall
```

### Full task form

```text
TodayScreen push /task-form with params
→ TaskFormScreen parses task JSON or prefill params
→ initializes form state
→ Save builds dto
→ create/update task mutation
→ optional sequential createSubtask calls
→ invalidate tasks
→ router.back()
```

## 14. Prioritized Recommendations

### P0 / Correctness

1. Make OAuth auth state consistent with email login:
   - after receiving OAuth tokens, call `getMe()` and `setUser(user)`.
2. Update auth store after onboarding completion:
   - either `setUser({ ...user, hasCompletedOnboarding: true })` or refetch `getMe()`.
3. Avoid passing full task JSON through route params; migrate to `taskId` + query/cache lookup.

### P1 / Maintainability

1. Split `TodayScreen` into view-model hook and presentational components.
2. Split `TaskFormScreen` into form sections and mutation hook.
3. Extract shared auth form from `LoginScreen`/`RegisterScreen`.
4. Extract repeated `PlanUsageBar` and chip primitives.

### P2 / Performance

1. Memoize derived task collections in `TodayScreen`.
2. Stabilize callbacks with `useCallback` where passed to memoized children.
3. Wrap `TaskBlock` in `React.memo` after callback stabilization.
4. Remove duplicate minute timers or isolate rerenders to clock-dependent components.
5. Fix `Timeline` effect dependencies.

## 15. Final Assessment

Frontend currently functional and relatively small, but main feature screens are growing as “god components”. The highest ROI refactor is to split `TodayScreen` and `TaskFormScreen`, because they concentrate most app behavior: task data, navigation, optimistic mutations, time calculations and condition-heavy rendering.

The codebase already has good foundations:

- React Query is centralized for tasks and plan.
- Auth store selectors are granular.
- Timeline layout is separated into `lib/timeline-layout`.
- Presentational components (`EmptyState`, `ProgressRing`, `TaskBlock`) exist and can be expanded.

Next architectural step: introduce screen-level view-model hooks and small presentational components, while keeping API/mutation hooks in `lib/api/*`.