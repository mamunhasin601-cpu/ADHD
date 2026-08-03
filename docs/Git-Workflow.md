# Git Workflow

Репозиторий использует Git и remote `origin`. В inspected tree не найдены branch policy, release flow, commit convention, PR template или CI workflow.

## Рекомендуемая практика

- держать feature changes сфокусированными;
- обновлять handbook вместе с изменением архитектуры/API;
- запускать build и релевантные tests до PR;
- добавлять migration files при изменении schema;
- не коммитить `.env` и credentials;
- в PR описывать behavior, validation commands и migration/operational impact.

Это рекомендации документации, а не утверждение об уже enforced policy.