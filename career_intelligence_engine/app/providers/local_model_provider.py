from __future__ import annotations

import re
from typing import Set

from app.providers.model_provider import ModelProvider


TOKEN_PATTERN = re.compile(r"[a-zA-Z][a-zA-Z0-9\+\#\.\-]{1,}")


class LocalModelProvider(ModelProvider):
    """
    Lightweight, deterministic mock provider for local development.
    """

    def semantic_similarity(self, text_a: str, text_b: str) -> float:
        a_tokens = self._tokenize(text_a)
        b_tokens = self._tokenize(text_b)

        if not a_tokens or not b_tokens:
            return 0.0

        overlap = len(a_tokens & b_tokens)
        union = len(a_tokens | b_tokens)

        jaccard = overlap / max(union, 1)
        target_coverage = overlap / max(len(b_tokens), 1)
        score = (0.6 * jaccard) + (0.4 * target_coverage)
        return max(0.0, min(1.0, score))

    def _tokenize(self, value: str) -> Set[str]:
        tokens = {token.lower() for token in TOKEN_PATTERN.findall(value)}
        return {token for token in tokens if len(token) > 1}

