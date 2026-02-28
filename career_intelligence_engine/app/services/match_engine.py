from __future__ import annotations

import re
from typing import Dict, List

from app.models.schemas import CompanyMatchResult, MatchRequest, RoleType
from app.providers.model_provider import ModelProvider
from app.services.performance_engine import PerformanceEngine
from app.services.roadmap_service import RoadmapService
from app.services.skill_graph_service import CompanyRoleProfile, SkillGraphService


class MatchEngine:
    def __init__(
        self,
        model_provider: ModelProvider,
        skill_graph: SkillGraphService,
        performance_engine: PerformanceEngine,
        roadmap_service: RoadmapService,
    ) -> None:
        self.model_provider = model_provider
        self.skill_graph = skill_graph
        self.performance_engine = performance_engine
        self.roadmap_service = roadmap_service

    def evaluate(self, request: MatchRequest) -> List[CompanyMatchResult]:
        performance_score = self.performance_engine.score(request.performance)
        role_type: RoleType = request.role_type

        company_ids = self.skill_graph.resolve_company_ids(role_type, request.target_companies)
        results: List[CompanyMatchResult] = []

        for company_id in company_ids:
            role_profile = self.skill_graph.get_role_profile(company_id, role_type)
            if role_profile is None:
                continue

            coverage = self._structured_coverage(role_profile, request.structured_resume.skills, request.structured_resume.skill_evidence)
            semantic = round(
                self.model_provider.semantic_similarity(
                    request.structured_resume.raw_text,
                    self.skill_graph.role_prompt(role_profile),
                )
                * 100,
                2,
            )

            match_percent = round(
                (0.55 * coverage["coverage_percent"])
                + (0.25 * semantic)
                + (0.20 * performance_score),
                2,
            )

            sprint = self.roadmap_service.recommend_sprint(
                company_name=role_profile.company_name,
                role_type=role_type,
                missing_skills=coverage["missing_skills"],
                weak_skills=coverage["weak_skills"],
            )

            results.append(
                CompanyMatchResult(
                    company_id=role_profile.company_id,
                    company_name=role_profile.company_name,
                    company_logo_url=role_profile.company_logo_url,
                    role_type=role_type,
                    structured_coverage_percent=coverage["coverage_percent"],
                    semantic_similarity_percent=semantic,
                    performance_score=performance_score,
                    match_percent=match_percent,
                    missing_skills=coverage["missing_skills"],
                    weak_skills=coverage["weak_skills"],
                    recommended_sprint=sprint,
                )
            )

        return sorted(results, key=lambda item: item.match_percent, reverse=True)

    def _structured_coverage(
        self,
        profile: CompanyRoleProfile,
        resume_skills: List[str],
        skill_evidence: Dict[str, int],
    ) -> Dict[str, object]:
        normalized_resume = {self._normalize(skill) for skill in resume_skills if skill.strip()}
        total_weight = sum(item.weight for item in profile.requirements) or 1.0
        covered_weight = 0.0
        missing_skills: List[str] = []
        weak_skills: List[str] = []

        for requirement in profile.requirements:
            requirement_key = self._normalize(requirement.name)
            present = self._skill_present(requirement_key, normalized_resume)
            if present:
                covered_weight += requirement.weight
                evidence = self._lookup_evidence(requirement.name, skill_evidence)
                if evidence <= 1:
                    weak_skills.append(requirement.name)
            else:
                missing_skills.append(requirement.name)

        coverage_percent = round((covered_weight / total_weight) * 100, 2)
        return {
            "coverage_percent": coverage_percent,
            "missing_skills": missing_skills,
            "weak_skills": weak_skills,
        }

    def _lookup_evidence(self, skill: str, evidence_map: Dict[str, int]) -> int:
        direct = evidence_map.get(skill.lower())
        if direct is not None:
            return direct
        normalized_target = self._normalize(skill)
        for key, value in evidence_map.items():
            if self._normalize(key) == normalized_target:
                return value
        return 0

    def _skill_present(self, requirement: str, resume_skills: set[str]) -> bool:
        if requirement in resume_skills:
            return True
        req_tokens = set(requirement.split())
        for skill in resume_skills:
            if skill in requirement or requirement in skill:
                return True
            skill_tokens = set(skill.split())
            if req_tokens and len(req_tokens & skill_tokens) >= max(1, len(req_tokens) - 1):
                return True
        return False

    def _normalize(self, value: str) -> str:
        lowered = value.lower()
        lowered = lowered.replace("nodejs", "node.js")
        lowered = lowered.replace("js", "javascript") if lowered == "js" else lowered
        lowered = re.sub(r"[^a-z0-9\+\#\. ]+", " ", lowered)
        lowered = re.sub(r"\s+", " ", lowered)
        return lowered.strip()

