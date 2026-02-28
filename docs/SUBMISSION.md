# Submission Overview

## Project Identity

**Name:** Melete  
**Type:** Full-stack learning platform  
**Primary Goal:** Help learners move from exploration to measurable readiness through mission-driven learning, coding practice, and ranked discovery.

## What Makes This Submission Distinct

- End-to-end experience in one codebase: discovery, practice, roadmaping, and feedback loops.
- Production-oriented backend patterns: rate limiting, compression, pressure guard, validation.
- Search designed as a platform feature, not a utility endpoint:
  - autocomplete
  - relevance scoring
  - highlights
  - personalized type boosts
  - fallback continuity when search infrastructure is unavailable
- Coding workspace includes run/submit lifecycle with provider fallback behavior.

## Demo Path (5-7 min walkthrough)

1. Open `/tracks` and navigate learning tracks by branch.
2. Use global search (`Cmd/Ctrl + K`) and open `/search-results` for filtered results.
3. Open `/practice`, run code against test cases, then submit.
4. Visit `/roadmaps` to inspect company path recommendations.
5. Check `GET /readyz` to validate backend/search health.

## Evaluation Checklist

- [ ] App boots successfully in Docker
- [ ] Search endpoints return grouped, highlighted results
- [ ] Practice run and submit endpoints respond correctly
- [ ] Backend health and readiness endpoints are operational
- [ ] Codebase structure and docs are navigable for new contributors

## Delivery Artifacts

- UI (React + Vite) in `src/`
- API (Fastify) in `server/`
- Deployment/runtime configs in `docker/`, `deploy/`, `docker-compose.yml`
- Project docs in `docs/`
