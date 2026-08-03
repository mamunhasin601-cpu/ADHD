# AI Guide

Правила AI-assisted engineering заданы в `AI_Engineering_Handbook_Bootstrap.md`.

## Обязательные принципы

1. Сначала reverse engineer repository, затем писать документацию.
2. Не изобретать факты; каждое утверждение привязывать к файлу.
3. Цитировать source paths.
4. Использовать Mermaid, когда диаграмма яснее текста.
5. Явно указывать отсутствующую информацию.
6. Сохранять документы в `/docs` и обновлять их вместе с проектом.

## Workflow агента

Repository overview → architecture → frontend → backend → authentication → API → database → infrastructure → Git workflow → final validation.

Документация не должна содержать значения из локального `.env`, access tokens или provider secrets.