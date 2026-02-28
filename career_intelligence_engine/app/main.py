from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.dependencies import get_model_provider, get_settings, get_skill_graph_service
from app.api.router import api_router
from app.core.logging import configure_logging, get_logger


settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger("career-intelligence.app")

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def on_startup() -> None:
    # Fail fast when config/provider setup is broken.
    get_model_provider()
    get_skill_graph_service()
    logger.info(
        "career intelligence engine ready",
        extra={
            "env": settings.env,
            "model_provider": settings.model_provider,
            "skill_graph_config_path": str(settings.skill_graph_config_path),
        },
    )

