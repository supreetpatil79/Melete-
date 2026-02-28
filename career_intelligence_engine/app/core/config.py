from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str
    env: str
    log_level: str
    model_provider: str
    skill_graph_config_path: Path


def load_settings() -> Settings:
    root = Path(__file__).resolve().parents[2]
    default_config_path = root / "app" / "config" / "company_skill_matrix.yaml"

    configured_path = os.getenv("SKILL_GRAPH_CONFIG_PATH")
    config_path = Path(configured_path).expanduser().resolve() if configured_path else default_config_path

    return Settings(
        app_name=os.getenv("APP_NAME", "Melete Career Intelligence Engine"),
        env=os.getenv("APP_ENV", "development"),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        model_provider=os.getenv("MODEL_PROVIDER", "local").strip().lower(),
        skill_graph_config_path=config_path,
    )
