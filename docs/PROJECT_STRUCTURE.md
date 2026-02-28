# Project Structure

This repository is organized for fast navigation between product layers.

## Top-Level

- `src/` Frontend application
- `server/` Backend API and integration layer
- `public/` Static web assets
- `docker/` Runtime reverse-proxy configuration
- `deploy/` Deployment scripts
- `career_intelligence_engine/` Optional Python service
- `docs/` Documentation and submission guides

## Frontend (`src/`)

- `components/` UI building blocks and feature components
- `pages/` Route-level screens
- `services/` Client-side service adapters and API calls
- `data/` Local datasets and seed-like content
- `shared/` Shared ranking/search utilities and tests
- `context/` React app providers
- `styles/` Global theme tokens

## Backend (`server/`)

- `app.ts` Main Fastify app with routes and middleware
- `config.ts` Environment and config normalization
- `unifiedSearch.ts` Unified search client + fallback ranking
- `searchDocuments.ts` Unified document builder
- `codeExecution.ts` Runtime execution orchestration
- `openAiCoach.ts` AI coaching integration

## Suggested Contribution Conventions

- Keep new business logic in `services/` or `server/` modules, not page files.
- Keep route handlers thin; isolate computation into helper modules.
- Keep environment-variable additions reflected in:
  - `.env.backend.example`
  - `.env.docker.example`
  - `README.md`
