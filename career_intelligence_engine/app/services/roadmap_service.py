from __future__ import annotations

from typing import List

from app.models.schemas import RecommendedSprint, RoleType


class RoadmapService:
    def recommend_sprint(
        self,
        company_name: str,
        role_type: RoleType,
        missing_skills: List[str],
        weak_skills: List[str],
    ) -> RecommendedSprint:
        focus_skills = (missing_skills + weak_skills)[:5]
        if not focus_skills:
            focus_skills = ["system design", "problem solving"]

        duration_weeks = 4 if role_type == "fte" else 2
        title = f"{company_name} {role_type.title()} Readiness Sprint"

        actions = [
            f"Complete curated practice track for {focus_skills[0]}.",
            "Solve 8 timed coding challenges and review mistakes.",
            "Build one mini-project that demonstrates the focus stack.",
            "Run a mock interview and update the resume with outcomes.",
        ]

        if len(focus_skills) > 1:
            actions.insert(1, f"Close fundamentals for: {', '.join(focus_skills[1:])}.")

        return RecommendedSprint(
            title=title,
            duration_weeks=duration_weeks,
            focus_skills=focus_skills,
            actions=actions[:5],
        )

