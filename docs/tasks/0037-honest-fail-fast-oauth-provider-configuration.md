# Task 0037 — Honest fail-fast OAuth provider configuration

## Root cause and decision

Yandex, VK, and Mail.ru controllers previously read `process.env` directly and silently substituted fake client credentials and localhost callbacks. Task 0037 adds one pure, typed startup validation boundary in `apps/api/src/config/oauth-environment.ts` and exposes validated values through the global `ConfigService`.

Each provider has an independent exact flag: absent or exact lowercase `false` disables it; exact lowercase `true` enables it; every other value is invalid. Disabled providers require no credentials. Enabled providers require their client ID, client secret, and provider-specific callback URI. Empty, padded, placeholder, malformed, or policy-invalid values fail startup without disclosing supplied values.

Redirect URIs must be absolute, host-bearing, credential-free URLs without query or fragment and with the exact callback pathname. Production requires HTTPS and forbids localhost/loopback and `.test`, `.example`, and `.invalid` hosts. Development and test permit HTTP only for localhost or loopback; arbitrary remote HTTP is rejected.

## Runtime contract

Controllers use only validated `ConfigService` values and contain no fake credential or localhost fallback. When a provider is disabled, both initiation and callback return the same `503 Service Unavailable` body:

```json
{
  "code": "OAUTH_PROVIDER_UNAVAILABLE",
  "message": "This sign-in method is temporarily unavailable."
}
```

The disabled callback fails closed before examining callback details: it cannot redirect, call `ExternalHttpService`, handle a profile, or issue Focus tokens. Correctly enabled providers preserve existing provider endpoints, scopes, VK GET token exchange, bounded/redacted transport and retry policies, generic errors, provider-ID validation, account-linking policy, and Focus deep-link behavior.

## Boundaries and evidence

Mobile code was intentionally not changed. The provider-selection screen still shows all three buttons; dynamic discovery/hiding and disabled-provider mobile UX remain future work. No provider account was contacted and no real credential was added. Prisma schema, migrations, database data, push notifications, contact verification, password registration, and `main` were not changed.

Focused configuration/controller validation passes 3 suites / 173 tests. The complete API suite passes 41 suites / 653 tests. API TypeScript validation, the production API build, and `git diff --check` pass. Prisma Client generation was intentionally not run because Prisma schema and migrations did not change.

These automated results are not live runtime evidence. Production API, PostgreSQL/Redis runtime, deployment, real provider accounts/delivery, device UX, broader observability, and full 152-FZ evidence remain **NOT VERIFIED**.
