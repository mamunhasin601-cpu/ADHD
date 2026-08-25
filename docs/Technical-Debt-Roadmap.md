# Technical Debt Roadmap

Дата аудита: **2026-08-03**  
Область: `apps/api`, `apps/mobile`, `packages/shared-types`, workspace/tooling и эксплуатационная документация.

## 1. Назначение и baseline

Этот документ — **план устранения долга**, а не второй Risk Report. Предыдущий анализ сохранён в [`docs/research/19-architecture-risk-report.md`](research/19-architecture-risk-report.md) и использован как baseline. Здесь его находки преобразованы в исполнимые задачи, добавлены зависимости, порядок, Definition of Done и критерии измеримого результата. Новые наблюдения выделены явно там, где они влияют на план: отсутствие `*.tsbuildinfo` в `.gitignore`, слабая автоматизация quality gates, недостаточная граница API-типов и возможность запуска upgrade-flow без платёжного подтверждения.

### Шкалы

| Атрибут | Значения |
|---|---|
| Сложность | **S** — до 1 дня; **M** — 1–3 дня; **L** — 3–5 дней; **XL** — больше недели/несколько PR |
| Риск внедрения | **Low** — локальное изменение; **Medium** — затрагивает контракт/модуль; **High** — auth, billing, persistence или массовый UI refactor |
| Влияние | **Low / Medium / High / Critical** — эффект на безопасность, деньги, стабильность, скорость разработки или UX |
| Порядок | Глобальный приоритет внутри critical path; меньший номер выполняется раньше зависимых задач |

## 2. Executive summary

### Текущее состояние

- Монорепо разделено на API, mobile и shared types, но бизнес-границы пока проходят по сервисным вызовам и прямому доступу к Prisma.
- Самые опасные пути — `POST /plan/upgrade`, OAuth account linking/token exchange и внешние HTTP-вызовы без единой политики timeout/retry/redaction.
- Mobile-экраны `today.tsx` и `task-form.tsx` одновременно управляют состоянием, бизнес-правилами и представлением; это замедляет изменения и повышает regression risk.
- Тесты присутствуют преимущественно в backend service/processor слоях; отсутствуют обязательные CI-gates для security/business invariants, циклов зависимостей и coverage threshold.

### Целевое состояние после Sprint 5

1. Production не имеет обходного upgrade endpoint; платный план активируется только после проверяемого server-side entitlement/receipt.
2. OAuth и внешние API используют безопасный общий transport, provider adapters и контрактные тесты.
3. Auth/session transport не связан циклически с singleton API client.
4. Mobile screens являются composition layers, а policy/theme/API serialization — централизованными контрактами.
5. Task side effects отделены событиями/портами, а CI ловит регрессии типов, тестов, циклов и security rules.

## 3. Приоритизированный портфель

### Critical Bugs

| ID | Проблема | Файл(ы) | Сложность | Риск | Влияние | Зависимости | Порядок |
|---|---|---|---|---|---|---|---:|
| C-01 (boundary complete; billing pending) | Production plan mutation now fails closed; no receipt/payment entitlement provider exists. | `apps/api/src/plan/plan.controller.ts`, `apps/api/src/plan/plan.service.ts`, `apps/mobile/app/paywall.tsx` | S/M | Critical | Critical | A future billing decision and verified server-side entitlement flow remain separate work | 1 |
| C-02 (complete) | Regression coverage locks production denial, exact dev gating, authentication, ownership, unchanged state, GET compatibility, and safe audit output. | `apps/api/src/plan/plan.controller.auth.spec.ts`, `apps/mobile/tests/paywall.spec.tsx` | M | High | Critical | C-01 boundary | 2 |

**Definition of Done:** в production route отсутствует/возвращает `404/403` без entitlement proof; dev flag fail-closed; добавлены unit/e2e tests и audit event для plan changes.

Task 0029 satisfies this fail-closed boundary and test requirement. It does **not** claim that billing, subscriptions, prices, receipts, or production entitlement activation exist; see [`tasks/0029-honest-production-safe-plan-entitlement-boundary.md`](tasks/0029-honest-production-safe-plan-entitlement-boundary.md).

### Security Improvements

| ID | Проблема | Файл(ы) | Сложность | Риск | Влияние | Зависимости | Порядок |
|---|---|---|---|---|---|---|---:|
| S-01 | **Частично выполнено:** новые OAuth users получают неизвестный им CSPRNG bootstrap secret (32 bytes, bcrypt cost 12), без `Math.random()`. Исторические OAuth-created hashes не ротированы; passwordless/auth-method policy и required `passwordHash` остаются нерешёнными. | `apps/api/src/auth/oauth.service.ts`, `apps/api/src/auth/auth.constants.ts`, Prisma schema | S/M | High | High | New-account boundary complete; historical/account policy requires a separate decision | 3 |
| S-02 (complete for identified calls) | OAuth and Expo calls use one bounded transport with explicit retry and redaction policy. | `apps/api/src/external-http/`, OAuth controllers, notifications service | L | High | High | Provider adapters and broader observability remain separate | 4 |
| S-03 (fail-closed boundary complete; linking pending) | Unauthenticated automatic linking by provider email/phone now fails closed, including ambiguous identity and unique-conflict recovery. A real authenticated linking flow, unlink/recovery, identity canonicalization, provider-verification metadata, historical-link remediation, and transaction/repository architecture remain future work. | `apps/api/src/auth/oauth.service.ts`, OAuth controllers, `oauth-account-linking.error.ts` | L | High | High | S-01; future authenticated linking policy; repository transaction из A-03 | 5 |
| S-04 (partially complete) | Core validation and bounded external transport are complete. OAuth provider configuration, production deployment/runtime verification, and broader observability remain unresolved. | `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/config/`, `apps/api/src/external-http/`, `.env.example` | M | Medium | High | Provider configuration and operations work remain | 6 |
| S-05 | Push payload может расшириться до названий задач/notes и отправить PII внешнему провайдеру. | `apps/api/src/notifications/notifications.service.ts`, `notifications.constants.ts` | M | Medium | Medium/High | S-02 | 7 |
| S-06 (implemented; runtime evidence pending) | Password registration consumes a matching one-time verification ticket atomically with user creation, canonical email login remains case-insensitive for historical compatibility, and mobile distinguishes confirmation, account creation, and post-registration authentication outcomes. Russian placement is an explicit production requirement. Live SMS/email delivery, Expo push and Daily.co remain unresolved evidence or foreign-service gaps; 152-FZ compliance is not complete. | `apps/api/src/auth/`, `apps/mobile/app/register.tsx`, `docs/ADR/ADR-010-russian-production-infrastructure-and-data-residency.md` | L | High | High | S-04; production evidence | 8 |

**Definition of Done:** security-sensitive randomness устранена; OAuth-only accounts не имеют usable password либо получают CSPRNG secret; timeout покрыт тестами; payload имеет typed allowlist snapshot; secrets валидируются fail-fast и не логируются.

Task 0033 completes only the fail-closed automatic-linking boundary; see [`tasks/0033-honest-fail-closed-oauth-account-linking.md`](tasks/0033-honest-fail-closed-oauth-account-linking.md). It does not complete S-01, H-02, H-03, or A-03, and it does not provide authenticated linking or resolve historical link provenance.

### Quick Wins

| ID | Проблема | Файл(ы) | Сложность | Риск | Влияние | Зависимости | Порядок |
|---|---|---|---|---|---|---|---:|
| Q-01 | `tsconfig.tsbuildinfo` — build artifact в рабочем дереве; ignore rule отсутствует. | `.gitignore`, `apps/api/tsconfig.tsbuildinfo` | S | Low | Medium | Нет | 8 |
| Q-02 | Мёртвый `clusterStart`/`void clusterStart` и forced casts скрывают незавершённый refactor. | `apps/mobile/lib/timeline-layout.ts` | S | Low | Low/Medium | Нет | 9 |
| Q-03 | Брендовые цвета, spacing и бизнес-дефолты дублируются inline. | `apps/mobile/components/`, `apps/mobile/app/`, `apps/api/src/tasks/tasks.service.ts` | M | Low | Medium | A-02 shared policies | 10 |
| Q-04 | Повторяются auth-screen layout, error extraction и submit flow. | `apps/mobile/app/login.tsx`, `register.tsx`, `auth-provider-select.tsx` | M | Medium | Medium | A-01 token boundary | 11 |

**Definition of Done:** артефакт не попадает в git; casts/dead code уменьшены без изменения поведения; новые UI constants проходят через tokens; auth screens используют общие primitives.

### High Impact Changes

| ID | Проблема | Файл(ы) | Сложность | Риск | Влияние | Зависимости | Порядок |
|---|---|---|---|---|---|---|---:|
| H-01 | Auth store напрямую управляет singleton API client и token state; refresh/logout добавление создаст coupling/cycle. | `apps/mobile/lib/api-client.ts`, `apps/mobile/stores/auth.store.ts`, `apps/mobile/lib/secure-storage.ts` | L | High | High | S-01 auth tests | 12 |
| H-02 | OAuth providers дублируют exchange/profile/error handling. | `apps/api/src/auth/*oauth*.controller.ts`, `oauth.service.ts` | L | High | High | S-02 transport, S-04 config | 13 |
| H-03 | Прямой fetch и provider-specific DTO mapping не имеют contract tests. | Те же OAuth controllers, `apps/api/test/` | M | Medium | High | H-02 | 14 |

### Architecture Refactoring

| ID | Проблема | Файл(ы) | Сложность | Риск | Влияние | Зависимости | Порядок |
|---|---|---|---|---|---|---|---:|
| A-01 | `today.tsx` — God Object: query, filters, timeline, modal, progress и тарифные ошибки в одном экране. | `apps/mobile/app/(tabs)/today.tsx`, `apps/mobile/components/timeline/` | XL | High | High | H-01; Q-03 | 15 |
| A-02 | `task-form.tsx` содержит form state, validation, subtasks, recurrence, navigation и стили. | `apps/mobile/app/task-form.tsx` | XL | High | High | shared policy; API response mapper | 16 |
| A-03 | `TasksService` владеет CRUD и side effects Plan/Notifications; сервисы напрямую используют Prisma. | `apps/api/src/tasks/tasks.service.ts`, `plan/plan.service.ts`, `notifications/notifications.service.ts`, `prisma/` | XL | High | High | S-02, H-02, A-04 design | 17 |
| A-04 | Нет зафиксированного dependency direction; cross-feature вызовы могут привести к циклам. | `apps/api/src/tasks/tasks.module.ts`, `notifications/notifications.module.ts`, `plan/plan.module.ts`, `apps/mobile/lib/` | M | Medium | High | Нет | 16 |
| A-05 | Domain types смешаны с serialized API dates и production casts (`as any`, `unknown as`). | `packages/shared-types/`, `apps/mobile/lib/`, DTOs | L | Medium | High | A-02; API contract inventory | 19 |

### Performance Improvements

| ID | Проблема | Файл(ы) | Сложность | Риск | Влияние | Зависимости | Порядок |
|---|---|---|---|---|---|---|---:|
| P-01 | Timeline через `ScrollView` рендерит все часы/tasks; auto-scroll effect имеет риск неполных dependencies. | `apps/mobile/components/timeline/Timeline.tsx` | L | Medium | High при росте данных | A-01 | 20 |
| P-02 | Task blocks и layout calculations не имеют измерений/профиля и могут повторно вычисляться. | `apps/mobile/components/timeline/`, `apps/mobile/lib/timeline-layout.ts` | M | Low | Medium | Q-02, P-01 | 21 |
| P-03 (complete) | Current OAuth and Expo external calls share one tested 5,000 ms total deadline. | External HTTP transport, OAuth controllers, notifications service | M | High | High | S-02 | 22 |

### Developer Experience Improvements

| ID | Проблема | Файл(ы) | Сложность | Риск | Влияние | Зависимости | Порядок |
|---|---|---|---|---|---|---|---:|
| D-01 | Root scripts не дают единого `lint/typecheck/test/build` gate; `dev:web` ссылается на workspace, которого нет в обозримой структуре. | `package.json`, `apps/api/package.json`, `apps/mobile/package.json` | M | Low | High | Q-01 | 23 |
| D-02 | Нет обязательных cycle/dependency-direction checks и правил против unsafe randomness/floating fetch. | `package.json`, `.github/workflows/` (если добавляется), ESLint config | M | Medium | High | A-04 | 24 |
| D-03 | Backend coverage сосредоточен на отдельных services/processors; critical auth/plan/e2e invariants не закреплены. | `apps/api/test/`, `apps/api/src/**/*.spec.ts` | L | Medium | High | C-02, S-02 | 25 |
| D-04 | Нет стандартного structured logging/metrics для OAuth, push и plan transitions. | `apps/api/src/main.ts`, auth/notifications/plan | L | Medium | Medium/High | S-02, C-01 | 26 |

## 4. Roadmap по спринтам

Предполагается, что один sprint — 1–2 недели с обязательным code review и зелёными regression tests. Порядок внутри таблиц — порядок выполнения.

### Sprint 1 — Stop the bleeding

| Задача | Результат | Сложность | Риск | Влияние | Зависимости |
|---|---|---|---|---|---|
| C-01 | Production-safe plan entitlement; dev route fail-closed/удалён | S/M | Critical | Critical | — |
| C-02 | Tests для production запрета и ownership текущего плана | M | High | Critical | C-01 |
| S-01 | CSPRNG или passwordless OAuth account policy | S/M | High | High | — |
| S-04 (частично) | Core validation для `NODE_ENV`/PostgreSQL/Redis/JWT/port завершена; OAuth config, production runtime и observability остаются | M | Medium | High | C-01 |
| Q-01 | Ignore/remove build artifact | S | Low | Medium | — |
| D-03 (часть 1) | Минимальные auth/plan regression tests | M | Medium | High | C-01, S-01 |

**Exit criteria:** нельзя получить Pro одним JWT-запросом; production startup не проходит с отсутствующими secrets; OAuth randomness не использует `Math.random`; tests воспроизводят эти гарантии.

### Sprint 2 — Secure integration boundaries

| Задача | Результат | Сложность | Риск | Влияние | Зависимости |
|---|---|---|---|---|---|
| S-02 | `HttpClientService` с deadline, selective retry и redaction | L | High | High | S-04 |
| H-02 | `OAuthProviderStrategy` + общий callback orchestration | L | High | High | S-02 |
| H-03 | Provider contract tests и negative cases | M | Medium | High | H-02 |
| H-01 | `TokenStorage`/`AuthTokenProvider`, client не импортирует store | L | High | High | S-01 |
| S-03 | Explicit account-linking policy, transaction/unique conflict handling | L | High | High | S-01 |

**Exit criteria:** OAuth provider добавляется adapter-ом без копирования controller flow; внешние requests имеют timeout; token persistence и transport можно тестировать отдельно.

### Sprint 3 — Mobile maintainability and contracts

| Задача | Результат | Сложность | Риск | Влияние | Зависимости |
|---|---|---|---|---|---|
| A-01 | Today composition screen + `useTodayViewModel`, header, quick-create | XL | High | High | H-01, Q-03 |
| A-02 | `useTaskForm`, typed field components и изолированная validation | XL | High | High | shared policy |
| Q-03 | Theme tokens и shared business policies | M | Low | Medium | — |
| Q-04 | Shared auth shell/form/submit hook | M | Medium | Medium | H-01 |
| A-05 (часть 1) | `TaskResponse` ISO mapper; сокращение casts | L | Medium | High | API contract inventory |

**Exit criteria:** крупные экраны — composition-only; form/view-model pure logic имеет unit tests; mobile/backend defaults не расходятся; даты парсятся на boundary.

### Sprint 4 — Domain boundaries and persistence

| Задача | Результат | Сложность | Риск | Влияние | Зависимости |
|---|---|---|---|---|---|
| A-03 | Task use-cases отделены от quota/reminder side effects через events/handlers | XL | High | High | S-02, H-02 |
| A-04 | Dependency direction rules и cycle check | M | Medium | High | A-03 |
| A-05 (часть 2) | Repository ports для Task/User и Prisma только на infrastructure boundary | XL | High | High | A-03 |
| D-02 | CI check dependency graph + ESLint security guards | M | Medium | High | A-04 |
| D-03 (часть 2) | E2E для task quota/reminder/plan invariants | L | Medium | High | A-03 |

**Exit criteria:** Tasks не вызывает соседние feature services для side effects напрямую; Prisma dependency mockable через ports; циклы запрещены автоматикой.

### Sprint 5 — Scale, observe, harden

| Задача | Результат | Сложность | Риск | Влияние | Зависимости |
|---|---|---|---|---|---|
| P-01 | Virtualized/windowed timeline либо подтверждённый threshold-based ScrollView | L | Medium | High | A-01 |
| P-02 | Memoization, pure layout tests и performance baseline | M | Low | Medium | P-01 |
| D-01 | Unified install/lint/typecheck/test/build/coverage scripts; исправить stale workspace script | M | Low | High | Q-01 |
| D-04 | Structured logs, latency/error metrics и safe audit trail | L | Medium | Medium/High | S-02, C-01 |
| S-05 | Push payload allowlist и privacy regression test | M | Medium | High | S-02 |
| Security/ops review | Dependency audit, secret scan, release checklist, rollback drill | M | Medium | High | Все предыдущие |

**Exit criteria:** timeline сохраняет целевой FPS/время интеракции на representative dataset; CI блокирует type/test/security regressions; plan/OAuth/push flows наблюдаемы без token/PII leakage.

## 5. Critical path и зависимости

```text
C-01 -> C-02 -> D-03(1)
S-04 -> S-02 -> H-02 -> H-03
S-01 -> H-01 -> A-01
S-01 + API contracts -> A-02 -> A-05
S-02/H-02 -> A-03 -> A-04 -> A-05(2) -> D-02
A-01 -> P-01 -> P-02
C-01 + S-02 -> D-04/S-05
```

Параллельно можно выполнять Q-01/Q-02 и часть D-01, если они не меняют runtime contracts. Нельзя начинать широкую декомпозицию mobile или событийную миграцию до фиксации auth/plan invariants: иначе regression сложно отличить от уже существующего security debt.

## 6. Метрики успеха

| Область | Baseline/проблема | Цель после Sprint 5 |
|---|---|---|
| Billing security | dev upgrade без receipt | 0 production bypasses; negative e2e green |
| OAuth reliability | прямые fetch без общего deadline | 100% external calls через timeout wrapper; retry только transient |
| Security hygiene | `Math.random`, потенциальный PII payload | 0 security-sensitive `Math.random`; payload allowlist test |
| Type safety | forced casts в API/date/style boundaries | все API dates проходят mapper; новые production `any` запрещены review rule |
| Architecture | feature services вызывают side effects напрямую | tasks side effects через events/ports; cycle check в CI |
| Mobile performance | full timeline rendering | representative dataset измерен; no regression в scroll/interaction budget |
| Delivery | нет единого quality gate | каждый PR: typecheck, tests, build, dependency/security checks |
| Observability | provider/plan transitions трудно диагностировать | structured event + latency/error metrics без secrets/PII |

## 7. Правила выполнения

1. Каждая задача — отдельный небольшой PR или вертикальный slice; для C-01/S-01 сначала security review.
2. Не смешивать механический formatting/renaming с изменением auth, billing или persistence semantics.
3. Для миграций API сохранять backward compatibility или явно версионировать endpoint/DTO.
4. После каждого sprint обновлять ADR при изменении границ, особенно [`ADR-001-current-boundaries.md`](ADR/ADR-001-current-boundaries.md), [`ADR-004-jwt-bearer-authentication.md`](ADR/ADR-004-jwt-bearer-authentication.md) и [`ADR-006-bullmq-redis-expo-push-notifications.md`](ADR/ADR-006-bullmq-redis-expo-push-notifications.md).
5. Финальный sign-off должен включать security, data privacy, performance и rollback checklist, а не только успешную сборку.

## 8. Источники аудита

- [`docs/research/19-architecture-risk-report.md`](research/19-architecture-risk-report.md) — предыдущий risk baseline, намеренно не дублируемый.
- [`docs/research/13-dependency-graph.md`](research/13-dependency-graph.md), [`14-call-graph.md`](research/14-call-graph.md), [`15-data-flow.md`](research/15-data-flow.md), [`16-module-analysis.md`](research/16-module-analysis.md), [`18-component-analysis.md`](research/18-component-analysis.md).
- `package.json`, `apps/api/package.json`, `.gitignore`, реальные исходники `apps/api/src/**` и `apps/mobile/**`.
