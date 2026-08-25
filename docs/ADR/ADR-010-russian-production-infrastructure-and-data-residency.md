# ADR-010: Russian production infrastructure and data residency

## Context

Focus targets users in the Russian market and must minimize contact data exposure. A provider brand alone does not prove Russian placement: regions and processors must be explicit and verified at deployment time.

## Decision

Use Timeweb Cloud as the preferred production platform with an explicitly selected Russian region (Moscow, Saint Petersburg, or Novosibirsk). API, PostgreSQL, Redis, backups, logs, and future object storage must remain in Russian infrastructure. Use SMS Aero for SMS verification and authenticated Timeweb corporate mail through fixed TLS SMTP `smtp.timeweb.ru:465` for email verification. Contact-delivery providers may not be silently replaced by foreign processors.

Adapters minimize data: SMS contains only the product name, six-digit PIN, and ten-minute validity; email contains only the calm verification content. Secrets, PINs, tickets, destinations, provider bodies, and credentials are not logged.

Task 0035 connects this boundary to ordinary password registration: every supplied contact needs its matching verified ticket, ticket consumption and user creation share one transaction, and application tokens are issued only after commit. The mobile client keeps the challenge, PIN, and verification ticket in component memory only.

## Alternatives

Foreign SMS or email relays would violate the product boundary. Timeweb Cloud without an explicit Russian region is insufficient evidence. Replacing existing Expo push or Daily.co video is outside Task 0034.

## Consequences and gaps

Russian placement, processor contracts, legal consent, operator registration, access policy, incident handling, and 152-FZ certification remain production/legal gates. Expo push and Daily.co remain documented unresolved foreign-service exceptions and must be replaced or formally resolved before claiming Russian-only production infrastructure. Code is not legal certification.

## Status

Accepted as the implementation boundary for Tasks 0034–0035; runtime placement and live-provider evidence remain **NOT VERIFIED**.

Official references: [Timeweb data centers](https://timeweb.cloud/docs/nashi-data-centry), [Timeweb 152-FZ offering](https://timeweb.cloud/solutions/152fz), [Timeweb mail configuration](https://timeweb.cloud/docs/mail/configuring-email-clients/yandex-pochta), [SMS Aero API](https://smsaero.ru/integration/documentation/api/), [SMS Aero privacy policy](https://smsaero.ru/papers/privacy/).
