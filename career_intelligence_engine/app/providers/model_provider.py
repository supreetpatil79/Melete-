from __future__ import annotations

from abc import ABC, abstractmethod


class ModelProvider(ABC):
    """
    Pluggable ML model interface.

    Backend logic depends on this abstraction, so switching to AMD GPU model
    services later only requires implementing this interface.
    """

    @abstractmethod
    def semantic_similarity(self, text_a: str, text_b: str) -> float:
        """
        Return a score in [0, 1].
        """
        raise NotImplementedError

