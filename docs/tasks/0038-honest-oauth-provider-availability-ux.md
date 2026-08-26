# Task 0038 — Honest OAuth provider availability UX

## Решение

API публикует `GET /auth/oauth/providers` без авторизации. Ответ содержит только точные boolean-флаги `yandex`, `vk` и `mailru`, полученные из уже провалидированного `ConfigService`; credentials, redirect URI и другие секреты наружу не попадают. Ответ помечен `Cache-Control: no-store`, чтобы доступность не устаревала из-за кэша.

Mobile запрашивает этот endpoint через общий `API_BASE_URL` и принимает только объект с ровно тремя boolean-ключами. При ошибке сети, malformed payload или неизвестной схеме экран fail-closed: OAuth-кнопки не показываются, а пользователю предлагается email/телефон. Во время discovery и при отказе провайдеров email/телефон остаётся доступным. Показываются только провайдеры с явным `true`; повторное нажатие во время запуска OAuth блокируется.

## Границы и доказательства

- API unit tests проверяют все-disabled, независимые и смешанные комбинации, точную форму ответа и отсутствие credential reads.
- Mobile tests проверяют loading, all-disabled, mixed availability, network failure, duplicate presses, callback token exchange и cancellation UX.
- Provider endpoints по-прежнему защищены серверной конфигурацией и возвращают honest `503`, если клиент обошёл discovery.
- Реальные credentials, production deployment, device deep-link и live provider callback в этой задаче не проверяются и требуют отдельного runtime evidence.
