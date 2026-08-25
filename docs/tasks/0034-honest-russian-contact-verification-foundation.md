# Task 0034 — Honest Russian contact-verification foundation

**Status:** foundation implemented; registration enforcement remains pending Task 0035.

## Boundary and root cause

Ordinary `POST /auth/register` still accepts a syntactically valid email or arbitrary phone, creates the user, and issues tokens. Task 0034 deliberately does not change registration, login, refresh, OAuth callbacks, or mobile registration UI. Task 0035 must consume a verification ticket, enforce verified contacts, and add the mobile two-step PIN flow.

This foundation proves access to a mailbox or phone at that moment; it does not prove legal identity. Disposable email, virtual numbers, SIM reassignment, fraud scoring, CAPTCHA, identity documents, consent, and operator documentation remain separate work.

## Policy

- Channels are exactly `EMAIL` and `PHONE`. Email is trimmed, validated, and lower-case canonicalized. Phone must already be strict E.164 (`+` followed by 8–15 digits); Russian `8...` values are not guessed or rewritten.
- PINs are six numeric digits from Node CSPRNG, valid for 10 minutes, with five attempts, a 60-second resend cooldown, and five sends per canonical destination in a rolling hour.
- Only a dedicated HMAC-SHA-256 digest is persisted. It is bound to challenge ID, channel, destination, and PIN and compared with a constant-time check. Plaintext exists only briefly for delivery.
- A successful PIN returns one 32-byte base64url ticket. Only its channel/destination-bound HMAC digest is persisted; the ticket expires after 15 minutes and is consumed atomically once.
- Existing destinations receive the same accepted shape with an opaque unusable synthetic challenge and no delivery. API error bodies are generic: `CONTACT_VERIFICATION_INVALID_OR_EXPIRED` (400), `CONTACT_VERIFICATION_RATE_LIMITED` (429), and `CONTACT_VERIFICATION_UNAVAILABLE` (503).
- Challenge rows are superseded transactionally, use conditional atomic updates for final race boundaries, and are cleaned only after a maximum 24-hour retention boundary.
- PIN confirmation is serialized per challenge inside a transaction-scoped PostgreSQL advisory lock. The authoritative read, expiry/state checks, constant-time PIN comparison, attempt decrement/exhaustion, and one-ticket transition all occur inside that lock; stale pre-lock state cannot authorize a PIN, five wrong attempts exhaust the challenge, and concurrent correct confirmations can issue at most one ticket.

## Delivery and Russian boundary

SMS uses SMS Aero over the fixed HTTPS endpoint through `ExternalHttpService`, with header authentication and no retry. The message contains only Focus, the six-digit code, and 10-minute validity. Email uses authenticated TLS Nodemailer to fixed `smtp.timeweb.ru:465`, bounded connection/greeting/socket/total-send deadlines, no retry, and a minimal non-tracking message.

Production deployment is required to use Timeweb Cloud with an explicitly selected Russian region (Moscow, Saint Petersburg, or Novosibirsk), with API, PostgreSQL, Redis, backups, logs, and future storage in Russian infrastructure. Existing Expo push and Daily.co video are unresolved foreign-service exceptions and are not replaced here. This code and tests are not legal certification and do not claim 152-FZ compliance.

## Persistence and safe API

The additive migration adds nullable `emailVerifiedAt` and `phoneVerifiedAt` to `users`, plus `ContactVerificationChannel` and `contact_verification_challenges`. Existing users remain null; no migration was applied and no database data was changed. Start returns HTTP 202 with opaque challenge ID and timing fields; confirm returns HTTP 200 with the one-time ticket and expiry. Neither response returns a destination or PIN.

## Abuse boundaries and future work

Persistent cooldown/hourly cap, attempt exhaustion, replay prevention, one active challenge, generic account-existence behavior, keyed secret storage, safe logging, and bounded cleanup are implemented. IP/device/global limits, trusted-proxy policy, CAPTCHA, fraud scoring, disposable/virtual-number detection, delivery receipts, failover, recovery, contact-change flows, legal consent, and operator registration remain future work. No untrusted forwarding-header rate limit is invented.

## Validation and runtime evidence

Focused repository tests cover challenge policy, controllers/DTOs, configuration, SMS Aero and Timeweb adapters, OAuth compatibility, and bounded external HTTP. Automated tests/builds are not runtime evidence. The following remain **NOT VERIFIED** without configured accounts and deployment: Timeweb Russian-region placement, live API/PostgreSQL/Redis, real SMTP delivery, real SMS Aero delivery, provider account contracts, production 152-FZ compliance, Android emulator, and physical device.

Final automated validation: focused auth/external-HTTP/config coverage passed with 9 suites and 175 tests; the full API suite passed with 39 suites and 547 tests; TypeScript validation and the API production build passed; Prisma Client generation passed on the controlled manual invocation (`npm run prisma:generate --workspace=apps/api`, Prisma 5.16.2, 185 ms); Prisma schema validation passed with a process-local non-secret placeholder; and `git diff --check` passed.
