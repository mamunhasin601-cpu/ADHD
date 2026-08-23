# Task 0032 - Honest bounded and redacted external HTTP transport

## Outcome

The API previously called Yandex, VK, Mail.ru, and Expo through direct, unbounded external requests. The bounded shared ExternalHttpService is now the only production owner of native fetch for these integrations. It is injected explicitly into AuthModule and NotificationsModule; ExternalHttpModule is not global, is not imported by AppModule, and NotificationsService has no optional injection or direct-construction fallback.

## Deadline, retry, and cleanup contract

Each operation has a total deadline of 5,000 ms, including fetch, JSON body consumption, response cleanup, and retry delay. safe-transient makes at most two attempts: attempt one is capped at 2,400 ms, the delay is 100 ms, and attempt two is capped at 2,400 ms and the remaining total budget. none makes one attempt bounded by the remaining 5,000 ms. No retry begins after the total deadline.

Only safe-transient profile operations may retry timeout, network, or HTTP 408/429/500/502/503/504 failures. Token exchanges and Expo delivery explicitly use none, including the GET-based VK token exchange. Immediate malformed JSON is invalid-response and is never retried. An abort while consuming response JSON is timeout and can be retried only under safe-transient while budget remains. Before a failed non-success response is retried or reported, its body is cancelled best-effort; neither cleanup failure nor body content changes the safe result.

Requests must be valid absolute HTTPS URLs before fetch is called. Relative, malformed, and non-HTTPS requests become the stable, non-retryable invalid-request class. The supplied URL is never exposed.

## Redaction and preserved behavior

The only final transport-failure log is one structured external-http.failure event after the final failed attempt. Its allowlist is operation, normalized method, attempt count, safe failure class, optional HTTP status, and elapsed milliseconds bounded to 5,000. It excludes URLs, hosts, queries, headers, request and response bodies, provider content, original messages, stack/cause, codes, OAuth secrets, application tokens, and Expo device tokens. Intermediate failures that will retry are not logged by the transport.

OAuth retains its existing provider parameters, profile mapping, OAuthService issuance, and successful focus callback link with issued access and refresh tokens. Missing code and provider callback error paths make no external call; provider and transport failures use generic responses without reflecting provider content. An HTTP-200 token payload without a usable provider access token is rejected safely for Yandex, VK, and Mail.ru.

Expo retains its generic privacy-safe payload, multi-device fan-out, per-device deduplication, legacy-token compatibility, DeviceNotRegistered revocation, and BullMQ-owned retry behavior. Its transport failures map to stable safe device outcomes without raw provider/network messages or tokens. This task adds no database schema, migration, endpoint, queue, payload-content, mobile UI, or deployment behavior.

## Validation evidence and limitations

Initial `npm run prisma:generate --workspace=apps/api` attempts failed on Windows with `EPERM` while unlinking `node_modules/.prisma/client/index.js`. After the API development/watch process tree was stopped and an accidentally retained exclusive PowerShell file handle was released, the exact required generation command succeeded and generated Prisma Client v5.16.2. No unexpected tracked file changed from generation. No `node_modules` deletion, Prisma reset, or database-data action was performed.

Focused validation passes with `npm test --workspace=apps/api -- --runInBand external-http.service.spec.ts oauth-external-http.controllers.spec.ts notifications.service.spec.ts notifications.processor.spec.ts`: 4 suites / 74 tests. The complete API suite passes with `npm test --workspace=apps/api -- --runInBand`: 35 suites / 454 tests. API TypeScript validation (`npx tsc --noEmit -p apps/api/tsconfig.json`) and production builds (`npm run build --workspace=apps/api` and `npm run build:api`) pass. Prisma generation and schema validation with a non-secret placeholder `DATABASE_URL` pass. `git diff --check` passes. Production-source searches confirm native `fetch` exists only in ExternalHttpService, OAuth callback responses do not expose caught/provider details, there is no production optional/fallback/direct ExternalHttpService construction, and push outcomes expose only the stable safe failure class.

Automated tests are not runtime evidence. Live API, PostgreSQL, Redis, OAuth and Expo providers, deployment, Android emulator, and physical-device verification remain NOT VERIFIED. Provider configuration, provider adapters and full schemas, production runtime verification, broader observability, H-02, H-03, D-04, and S-05 remain unresolved. S-02 and P-03 are complete only when the corrected implementation and final validation pass. S-04 remains partial. The Task 0028 Android wording is unchanged.
