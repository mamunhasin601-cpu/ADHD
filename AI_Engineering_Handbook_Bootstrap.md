# AI Engineering Handbook Bootstrap

Version: 0.1

## Purpose

This document contains the working principles and prompts for using an
AI agent (Cline + GPT‑5.5) to reverse engineer an existing project and
build a complete Engineering Handbook.

The AI must behave as a **software architect and technical
investigator**, not as a documentation generator.

------------------------------------------------------------------------

# Primary Objective

Produce an Engineering Handbook that allows a new developer to:

-   understand the architecture;
-   run the project locally;
-   understand every major module;
-   understand authentication;
-   understand API and database;
-   understand deployment;
-   contribute without additional explanations.

------------------------------------------------------------------------

# Core Rules

1.  Never invent facts.
2.  Every statement must be traceable to project files.
3.  Quote filenames whenever possible.
4.  Prefer diagrams over long text.
5.  If information is missing, explicitly state it.
6.  Documentation must evolve together with the project.

------------------------------------------------------------------------

# Research Order

## Phase 1 --- Repository Overview

Investigate:

-   directory tree;
-   technology stack;
-   package managers;
-   build tools;
-   project entry points.

Output:

-   Project Overview
-   Repository Tree
-   Technology Stack

------------------------------------------------------------------------

## Phase 2 --- Architecture

Describe:

-   layers;
-   modules;
-   responsibilities;
-   dependencies;
-   request lifecycle;
-   data flow.

Produce Mermaid diagrams whenever possible.

------------------------------------------------------------------------

## Phase 3 --- Frontend

Document:

-   routing;
-   pages;
-   components;
-   state management;
-   API clients;
-   UI architecture.

------------------------------------------------------------------------

## Phase 4 --- Backend

Document:

-   services;
-   controllers;
-   middleware;
-   validation;
-   business logic;
-   repositories.

------------------------------------------------------------------------

## Phase 5 --- Authentication

Investigate:

-   login flow;
-   JWT/Cookie/session mechanism;
-   refresh tokens;
-   expiration;
-   logout;
-   authorization middleware.

Result:

Authentication architecture.

------------------------------------------------------------------------

## Phase 6 --- API

For every endpoint identify:

-   route;
-   method;
-   request;
-   response;
-   authorization;
-   validation;
-   error handling.

------------------------------------------------------------------------

## Phase 7 --- Database

Describe:

-   schema;
-   entities;
-   relationships;
-   indexes;
-   migrations;
-   ORM.

------------------------------------------------------------------------

## Phase 8 --- Infrastructure

Document:

-   environment variables;
-   Docker;
-   CI/CD;
-   deployment;
-   monitoring;
-   logging.

------------------------------------------------------------------------

## Phase 9 --- Git Workflow

Describe:

-   branching strategy;
-   release flow;
-   commit conventions;
-   pull request process.

------------------------------------------------------------------------

# Required Output Structure

/docs

-   README.md
-   Engineering-Handbook.md
-   Architecture.md
-   Authentication.md
-   API.md
-   Database.md
-   Frontend.md
-   Backend.md
-   Development.md
-   Deployment.md
-   Git-Workflow.md
-   AI-Guide.md
-   diagrams/
-   ADR/

------------------------------------------------------------------------

# AI Agent Prompt

You are a Senior Software Architect and Technical Writer.

Do NOT start by writing an Engineering Handbook.

First reverse engineer the repository.

Map every important module.

Understand architecture before documenting.

Never invent implementation details.

Reference source files.

Generate Mermaid diagrams where useful.

Save documentation incrementally into /docs.

Treat this repository as the single source of truth.

------------------------------------------------------------------------

# Suggested AGENTS.md

``` md
# Project Documentation Rules

- Never invent architecture.
- Always reference source files.
- Every statement must be supported by code.
- Generate Mermaid diagrams when possible.
- Write documentation in Markdown.
- Save documentation to /docs.
- Update documentation after each completed analysis.
```

------------------------------------------------------------------------

# Recommended Workflow

1.  Analyze repository.
2.  Build architecture map.
3.  Document backend.
4.  Document frontend.
5.  Document authentication.
6.  Document database.
7.  Document API.
8.  Document deployment.
9.  Assemble Engineering Handbook.
10. Validate all documentation against the codebase.

The objective is to create documentation that becomes the project's
single source of technical truth.
