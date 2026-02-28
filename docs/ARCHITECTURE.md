# Architecture

## Frontend Runtime

- React + React Router for route composition
- TanStack Query for server-state patterns
- shadcn/ui + Tailwind token system for consistent UI primitives
- Monaco-based editor for coding practice workflows

## Backend Runtime

- Fastify as HTTP core
- Zod for request contract validation
- Operational middleware:
  - rate limiting
  - compression
  - helmet
  - pressure guard (`under-pressure`)

## Search Architecture

### Unified Search Path

1. Request enters `GET /search` or `GET /search/autocomplete`.
2. Query parameters are normalized and validated.
3. User activity boosts are applied (if `userId` present).
4. Elasticsearch query executes against unified index.
5. If search cluster fails, in-memory ranking fallback executes.
6. Highlighted results are returned with section/type metadata.

### Index Shape (Unified)

Document fields include:

- `title`
- `description`
- `tags`
- `type`
- `section`
- `popularity`
- `user_engagement`
- `difficulty`
- `url`
- `updated_at`

## Practice Execution Path

1. Frontend calls `/api/code/languages` to resolve available runtimes.
2. User code + test cases post to `/api/code/execute`.
3. Backend executes through configured provider.
4. If provider is unavailable and fallback is enabled, local JS sandbox is used.
5. Submission records are persisted in backend in-memory store.

## Reliability Model

- Search fallback guards critical discovery flows.
- Code execution fallback guards practice continuity.
- Readiness endpoint includes backend and search status metadata.
