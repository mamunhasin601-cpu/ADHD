# Task 0032 - Honest bounded and redacted external HTTP transport

The API previously called Yandex, VK, Mail.ru, and Expo through direct unbounded `fetch` calls. A shared injectable transport now owns native Node fetch, one 5,000 ms total deadline including JSON consumption and retry delay, aborts in-flight work, and clears attempt timers.

Retry safety is selected explicitly per operation. OAuth token exchanges and Expo push use `none`; profile lookups use `safe-transient`, with at most two attempts and one 100 ms delay for timeout, network errors, or HTTP 408/429/500/502/503/504. Safety is never inferred from HTTP method, so the GET-based VK token exchange remains non-retryable.

Transport errors expose only `timeout`, `network`, `http`, or `invalid-response`, plus operation, attempt count, and safe HTTP status. URLs, queries, headers, bodies, OAuth codes and secrets, access and refresh tokens, Expo tokens, provider content, and original network messages or stacks are prohibited from errors and logs.

Existing OAuth parameters, profile mapping, OAuthService issuance, and `focus://auth/callback` success redirects remain. Expo keeps its generic payload, multi-device fan-out, deduplication, legacy tokens, `DeviceNotRegistered` revocation, and BullMQ retry ownership. No schema, migration, mobile UI, payload content, or deployment change is included.

Automated validation covers transport retry/deadline/redaction behavior, API tests, TypeScript build, Prisma generation/validation, whitespace checks, and production-source searches. These checks are not runtime evidence: real providers, production deployment, Android, and physical devices are not verified. Provider configuration, adapters, full response schemas, broader observability, H-02, H-03, D-04, and S-05 remain future work.
