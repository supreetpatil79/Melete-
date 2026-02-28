from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.career import router as career_router


api_router = APIRouter()
api_router.include_router(career_router)

