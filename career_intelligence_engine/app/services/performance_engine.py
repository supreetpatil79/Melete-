from __future__ import annotations

from app.models.schemas import PerformanceInput


class PerformanceEngine:
    """
    Computes learner performance score from platform metrics.
    """

    def score(self, performance: PerformanceInput) -> float:
        accuracy = self._clamp(performance.accuracy / 100.0)
        consistency = self._clamp(performance.consistency / 100.0)

        difficulty = performance.difficulty_factor
        difficulty = difficulty / 100.0 if difficulty > 1 else difficulty
        difficulty = self._clamp(difficulty)

        score = (0.50 * accuracy) + (0.30 * consistency) + (0.20 * difficulty)
        return round(score * 100, 2)

    def _clamp(self, value: float) -> float:
        return max(0.0, min(1.0, value))

