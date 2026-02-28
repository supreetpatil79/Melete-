from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from app.core.logging import get_logger
from app.models.schemas import CompanySummary, RoleType


@dataclass(frozen=True)
class SkillRequirement:
    name: str
    weight: float
    min_proficiency: str


@dataclass(frozen=True)
class CompanyRoleProfile:
    company_id: str
    company_name: str
    company_logo_url: str
    role_type: RoleType
    requirements: List[SkillRequirement]


class SkillGraphService:
    def __init__(self, config_path: Path) -> None:
        self.logger = get_logger("career-intelligence.skill-graph")
        self.config_path = config_path
        self._raw = self._load_config(config_path)

    def list_companies(self) -> List[CompanySummary]:
        companies: List[CompanySummary] = []
        for company_id, company_data in self._raw.get("companies", {}).items():
            roles = list((company_data.get("roles") or {}).keys())
            normalized_roles: List[RoleType] = [role for role in roles if role in {"internship", "fte"}]
            companies.append(
                CompanySummary(
                    company_id=company_id,
                    company_name=company_data.get("name", company_id.title()),
                    company_logo_url=company_data.get("logo_url", ""),
                    roles_supported=normalized_roles,
                )
            )
        return companies

    def get_role_profile(self, company_id: str, role_type: RoleType) -> Optional[CompanyRoleProfile]:
        company_data = self._raw.get("companies", {}).get(company_id)
        if not company_data:
            return None

        role_data = (company_data.get("roles") or {}).get(role_type)
        if not role_data:
            return None

        requirements: List[SkillRequirement] = []
        for raw_req in role_data.get("required_skills", []):
            weight = float(raw_req.get("weight", 0.0))
            if weight <= 0:
                continue
            requirements.append(
                SkillRequirement(
                    name=str(raw_req.get("name", "")).strip().lower(),
                    weight=weight,
                    min_proficiency=str(raw_req.get("min_proficiency", "intermediate")).strip().lower(),
                )
            )

        return CompanyRoleProfile(
            company_id=company_id,
            company_name=company_data.get("name", company_id.title()),
            company_logo_url=company_data.get("logo_url", ""),
            role_type=role_type,
            requirements=requirements,
        )

    def resolve_company_ids(self, role_type: RoleType, target_companies: Optional[List[str]]) -> List[str]:
        all_company_ids = list((self._raw.get("companies") or {}).keys())

        if not target_companies:
            return [company_id for company_id in all_company_ids if self.get_role_profile(company_id, role_type)]

        requested = {company.strip().lower() for company in target_companies if company.strip()}
        matched: List[str] = []
        for company_id in all_company_ids:
            company_name = str(self._raw["companies"][company_id].get("name", company_id)).lower()
            if company_id.lower() in requested or company_name in requested:
                if self.get_role_profile(company_id, role_type):
                    matched.append(company_id)

        return matched

    def role_prompt(self, profile: CompanyRoleProfile) -> str:
        weighted = ", ".join(f"{item.name} ({item.weight:.2f})" for item in profile.requirements)
        return f"{profile.company_name} {profile.role_type} skill requirements: {weighted}"

    def all_unique_skills(self) -> List[str]:
        unique = set()
        for company in self._raw.get("companies", {}).values():
            for role in (company.get("roles") or {}).values():
                for req in role.get("required_skills", []):
                    name = str(req.get("name", "")).strip().lower()
                    if name:
                        unique.add(name)
        return sorted(unique)

    def _load_config(self, path: Path) -> Dict[str, object]:
        if not path.exists():
            raise FileNotFoundError(f"Skill graph config not found: {path}")
        with path.open("r", encoding="utf-8") as handle:
            loaded = yaml.safe_load(handle) or {}
        self.logger.info("loaded skill graph configuration", extra={"config_path": str(path)})
        return loaded

