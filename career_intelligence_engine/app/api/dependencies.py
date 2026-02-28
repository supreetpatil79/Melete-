from __future__ import annotations

from functools import lru_cache

from app.core.config import Settings, load_settings
from app.providers.local_model_provider import LocalModelProvider
from app.providers.model_provider import ModelProvider
from app.services.career_engine import CareerIntelligenceService
from app.services.match_engine import MatchEngine
from app.services.performance_engine import PerformanceEngine
from app.services.resume_extraction import ResumeExtractionService
from app.services.resume_parser import ResumeParserService
from app.services.roadmap_service import RoadmapService
from app.services.skill_graph_service import SkillGraphService


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()


@lru_cache(maxsize=1)
def get_model_provider() -> ModelProvider:
    settings = get_settings()
    if settings.model_provider == "local":
        return LocalModelProvider()
    raise ValueError(f"Unsupported MODEL_PROVIDER={settings.model_provider!r}")


@lru_cache(maxsize=1)
def get_skill_graph_service() -> SkillGraphService:
    settings = get_settings()
    return SkillGraphService(settings.skill_graph_config_path)


@lru_cache(maxsize=1)
def get_match_engine() -> MatchEngine:
    return MatchEngine(
        model_provider=get_model_provider(),
        skill_graph=get_skill_graph_service(),
        performance_engine=PerformanceEngine(),
        roadmap_service=RoadmapService(),
    )


@lru_cache(maxsize=1)
def get_career_service() -> CareerIntelligenceService:
    return CareerIntelligenceService(
        resume_extractor=ResumeExtractionService(),
        resume_parser=ResumeParserService(),
        skill_graph=get_skill_graph_service(),
        match_engine=get_match_engine(),
    )

