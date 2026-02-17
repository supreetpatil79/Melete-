# Melete

Melete is a full-stack learning platform for students and developers.

It combines:
- adaptive learning paths
- coding practice with execution feedback
- personalized insights
- ranked search across tracks and courses
- community features (TechVise)

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui (Radix primitives)
- TanStack Query
- React Router
- Monaco Editor
- Framer Motion

### Backend
- Node.js + TypeScript
- Fastify
- Zod request validation
- In-memory cache with optional Redis (`ioredis`)
- Optional external compiler providers (Judge0 / RapidAPI / Piston) with local JS fallback

### Integrations
- OpenAI API (profile insights, gap analysis, hints)
- YouTube Data API (learning recommendations)
- Hacker News Algolia API (tech news feed)

## Repository Layout

- `src/` frontend application
- `server/` backend API
- `src/shared/` shared search logic
- `docker/` nginx and container config
- `deploy/cloudrun/` Cloud Run deployment scripts

## Local Development

### Prerequisites
- Node.js 20+
- npm

### Install

```bash
npm install
```

### Run frontend + backend

Terminal 1:

```bash
npm run server:dev
```

Terminal 2:

```bash
npm run dev
```

App: `http://localhost:8080`

Backend health:

```bash
curl http://127.0.0.1:4000/healthz
```

## Docker (recommended for parity)

1. Add secrets/config in `.env.docker`
2. Start:

```bash
npm run docker:up
```

3. Open:
- App: `http://localhost:8090`
- Backend: `http://localhost:4000`

4. Stop:

```bash
npm run docker:down
```

5. Logs:

```bash
npm run docker:logs
```

## Core API Endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /api/search`
- `GET /api/code/languages`
- `POST /api/code/execute`
- `POST /api/news/tech`
- `POST /api/graph/learning`
- `POST /api/learning/videos`
- `POST /api/questions/recommendations`
- `POST /api/ai/profile-insight`
- `POST /api/ai/gap-analysis`
- `POST /api/ai/hint`

## Product Features

- Mission-based daily learning flow
- Practice IDE with compiler/runtime diagnostics
- Personalized hints and learning gap analysis
- Knowledge graph driven profile insights
- Personalized and general tech news feed
- Tech hackathons/events board with Google Calendar add links
- PDF wrap-up export for revision

## Environment Variables

Use:
- `.env.backend.example`
- `.env.frontend.example`
- `.env.docker.example`

Important keys:
- `PORT`, `HOST`
- `REDIS_URL`
- `CODE_EXEC_PROVIDER`, `CODE_EXEC_API_URL`, `CODE_EXEC_API_KEY`, `CODE_EXEC_API_HOST`
- `CODE_EXEC_FALLBACK_PROVIDER`, `CODE_EXEC_FALLBACK_API_URL`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `YOUTUBE_API_KEY`
- `VITE_API_BASE_URL`

## Deployment

### Recommended
- Backend: Google Cloud Run
- Frontend: Vercel

This gives:
- horizontal scaling
- managed health checks
- stateless rollout safety
- CDN delivery for frontend

### Cloud Run script

```bash
PROJECT_ID=<your-project-id> REGION=us-central1 npm run deploy:gcp
```

### Vercel
Set:
- build command: `npm run build`
- output directory: `dist`
- env: `VITE_API_BASE_URL=<backend-url>`

## Scale Notes (10k+ users)

- Run multiple backend instances behind load balancer
- Keep backend stateless
- Use Redis for shared cache/rate-limit state in multi-instance environments
- Track p95 latency, error rate, and saturation
- Keep one warm instance in production to avoid cold-start spikes

## Quality Checks

```bash
npm test
npm run build
```
