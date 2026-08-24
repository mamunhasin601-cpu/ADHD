# Task 0033 - Honest fail-closed OAuth account-linking boundary

## Root cause and policy

OAuth callbacks previously treated provider-supplied email or phone as sufficient proof to attach a new provider ID to an existing Focus user and issue application tokens. That unauthenticated mutation had no Focus session, step-up proof, consent, verified linking intent, or dedicated linking endpoint, and it did not resolve ambiguous identity or unique-conflict races safely.

The callback now fails closed. An already persisted exact provider-ID link remains authoritative for compatibility: it issues tokens for that linked user without mutation and ignores current provider email or phone for account selection. If an unlinked provider callback supplies an email or phone matching any existing Focus user, it neither updates nor creates a user, generates no bootstrap secret or hash, and issues no application tokens. Email-only, phone-only, same-user, different-user, repeated-callback, Yandex, VK, and Mail.ru cases share this outcome.

All three controllers map the typed condition to HTTP `409 Conflict` with exactly:

```json
{
  "code": "OAUTH_ACCOUNT_LINKING_REQUIRED",
  "message": "Sign in with your existing method before linking this provider."
}
```

No application-token redirect occurs, and the response discloses no matched identifier, user/provider record, payload, token, secret, URL, query, caught message, cause, or stack.

## Creation and race boundary

When no exact provider link or existing email/phone match exists and at least one identity field is present, new-account behavior remains unchanged: exactly 32 CSPRNG bytes are base64url encoded, bcrypt hashed at cost 12, persisted with the correct provider ID, and followed by token issuance. Missing identity remains a calm 400 with no persistence or tokens.

Unique constraints remain the final race boundary. After Prisma `P2002`, the service re-reads only the exact provider ID authenticated by the callback. If present, that concurrent same-provider creation is an idempotent replay and tokens are issued only for that exact user. If absent, the shared linking-required outcome is returned. Email/phone matches never authorize conflict recovery, and Prisma metadata is not disclosed. Unexpected persistence failures remain generic and issue no tokens.

## Deliberate limits

This task does not implement authenticated account linking. That future flow still requires Product Owner/security decisions for an authenticated Focus session, explicit intent and consent, step-up proof, OAuth state/PKCE/session binding, audit, unlink/recovery, mobile UX, identifier canonicalization, provider verification metadata, and historical-link remediation.

Existing exact provider-ID links remain accepted for compatibility, but their historical provenance is unresolved and this task does not classify or rewrite them. No schema, migration, endpoint, queue, mobile, provider configuration, external HTTP transport, deployment, or database-data change is included. Local smoke-test data was not changed.

## Validation evidence and limitations

Focused auth validation passes with `npm test --workspace=apps/api -- --runInBand src/auth/oauth.service.spec.ts src/auth/oauth-external-http.controllers.spec.ts src/auth/auth.service.spec.ts`: 3 suites / 39 tests. The complete API suite passes with `npm test --workspace=apps/api -- --runInBand`: 35 suites / 468 tests. API TypeScript validation and the API production build pass. The first Prisma Client generation attempt hit the documented Windows `EPERM` while unlinking `node_modules/.prisma/client/index.js`; a controlled retry then generated Prisma Client v5.16.2 successfully with exit code 0. No process was terminated, and `node_modules` and database data were not manually deleted or changed. Prisma schema validation with a process-local, non-secret placeholder `DATABASE_URL` passes without changing `.env`. `git diff --check` passes. Production-source audits confirm that OAuthService has no `user.update()` path, identity matches do not issue tokens, all three callback controllers use the shared safe linking-required contract, and raw provider or caught-error content is not returned or logged.

Automated tests and builds are validation, not runtime evidence. Live API, PostgreSQL, real Yandex/VK/Mail.ru providers, production deployment, Android emulator, and physical-device verification remain NOT VERIFIED.
