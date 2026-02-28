from __future__ import annotations

import logging
from typing import Optional


DEFAULT_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"


def configure_logging(level: str, fmt: str = DEFAULT_FORMAT) -> None:
    logging.basicConfig(level=level, format=fmt, force=True)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    return logging.getLogger(name or "career-intelligence")

