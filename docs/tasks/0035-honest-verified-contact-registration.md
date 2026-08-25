# Task 0035 — Enforce verified-contact password registration

## Implemented contract

Ordinary password registration now requires a usable one-time ticket for every supplied email or phone. Contacts use the contact-verification service's canonical form. A read-only ticket precheck happens before bcrypt; authoritative ticket consumption and user creation happen in one Prisma transaction; access and refresh tokens are generated only after commit. Missing, mismatched, expired, consumed, raced, or disabled verification fails closed without user creation or application tokens.

The mobile registration screen starts a challenge, accepts one six-digit PIN, confirms it, and submits only the matching verification ticket with registration. It masks the destination, rate-limits resend in the UI, guards rapid duplicate taps, supports changing the contact, and keeps challenge IDs, PINs, and tickets in component memory rather than storage, navigation parameters, or logs. OAuth and existing-login entry points remain available.

## Data and infrastructure boundary

No Prisma schema or migration changed in Task 0035, and no migration was applied. The Task 0034 Russian-provider boundary remains authoritative: SMS Aero for SMS and authenticated Timeweb SMTP for email, with explicit Russian placement required for production API, PostgreSQL, Redis, backups, and logs. Expo push and Daily.co remain documented foreign-service exceptions. Runtime region, provider delivery, processor contracts, legal consent, incident controls, and end-to-end 152-FZ evidence remain **NOT VERIFIED**.

## Validation record

Focused API validation passed 3 suites / 38 tests. Focused mobile validation passed 3 suites / 13 tests. The full API suite passed 40 suites / 560 tests. API and mobile TypeScript validation, API production build, Prisma schema validation with a process-local placeholder, and `git diff --check` passed.

The full mobile suite passed 46 suites / 574 tests with process-local `TZ=UTC`, matching the suite's UTC instant expectations without changing `.env`. An initial invocation under the host timezone exposed unrelated timezone-sensitive expectations; no production or test files outside Task 0035 were changed.

The successful Task 0034 Prisma Client v5.16.2 generation remains authoritative because the schema is unchanged; Task 0035 did not rerun generation. Automated tests are not live provider, deployment, database-migration, physical-device, or legal-compliance evidence.

## Compatibility and remaining work

Historical users retain password login, refresh and sessions without backfilled verification timestamps. OAuth provider-ID login and account-creation boundaries are unchanged. Still unresolved: live SMS Aero/Timeweb accounts and delivery, production deployment and migration evidence, existing-user remediation, contact change/recovery, disposable-email and virtual-number controls, CAPTCHA/fraud/device/IP controls, authenticated OAuth linking, physical-device verification, legal identity/full 152-FZ evidence, and the Expo push/Daily.co foreign-service decisions.

Safe rollout order is: provision explicitly Russian-region infrastructure and providers; back up the database; apply the already committed additive Task 0034 migration through the approved process; configure the dedicated verification secret and Russian delivery credentials; enable verification; deploy compatible API and mobile builds; perform live provider/runtime checks; retain tested rollback procedures. None of these deployment operations was performed here.
