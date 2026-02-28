# Melete Career Intelligence Engine (FastAPI)

Modular backend service for company-fit scoring and personalized roadmaps.

## Design Goals
- Pluggable ML provider (`ModelProvider`) so AMD GPU-backed models can be added later without changing business logic.
- Config-driven company skill graph with internship vs FTE separation.
- Resume PDF upload + heuristic parsing.
- Match scoring using:
  - Structured skill coverage
  - Mock semantic similarity
  - Platform performance score

## Folder Layout
```
career_intelligence_engine/
  app/
    api/
    core/
    models/
    providers/
    services/
    config/company_skill_matrix.yaml
  requirements.txt
```

## Run
```bash
cd career_intelligence_engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8101
```

## API
- `GET /api/v1/career-intelligence/health`
- `GET /api/v1/career-intelligence/companies`
- `POST /api/v1/career-intelligence/resume/upload` (PDF file)
- `POST /api/v1/career-intelligence/match`
- `POST /api/v1/career-intelligence/roadmap`

## Swap in AMD Model Service Later
1. Implement a new provider class in `app/providers/` that satisfies `ModelProvider`.
2. Update dependency wiring in `app/api/dependencies.py` to return that provider when `MODEL_PROVIDER=amd`.
3. Keep all services unchanged (resume parsing, match engine, roadmap engine remain stable).

