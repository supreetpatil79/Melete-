from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


RoleType = Literal["internship", "fte"]


class ResumeStructuredData(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    links: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    skill_evidence: Dict[str, int] = Field(default_factory=dict)
    education: List[str] = Field(default_factory=list)
    experience: List[str] = Field(default_factory=list)
    projects: List[str] = Field(default_factory=list)
    years_experience: Optional[float] = None
    raw_text: str = ""


class ResumeUploadResponse(BaseModel):
    extracted_characters: int
    structured_resume: ResumeStructuredData


class PerformanceInput(BaseModel):
    accuracy: float = Field(ge=0, le=100)
    consistency: float = Field(ge=0, le=100)
    difficulty_factor: float = Field(
        default=0.5,
        ge=0,
        description="Accepts 0..1, or 0..100 which will be normalized.",
    )


class MatchRequest(BaseModel):
    structured_resume: ResumeStructuredData
    performance: PerformanceInput
    role_type: RoleType = "internship"
    target_companies: Optional[List[str]] = None


class RecommendedSprint(BaseModel):
    title: str
    duration_weeks: int
    focus_skills: List[str]
    actions: List[str]


class CompanyMatchResult(BaseModel):
    company_id: str
    company_name: str
    company_logo_url: str
    role_type: RoleType
    structured_coverage_percent: float
    semantic_similarity_percent: float
    performance_score: float
    match_percent: float
    missing_skills: List[str]
    weak_skills: List[str]
    recommended_sprint: RecommendedSprint


class RoadmapResponse(BaseModel):
    generated_at: datetime
    results: List[CompanyMatchResult]


class CompanySummary(BaseModel):
    company_id: str
    company_name: str
    company_logo_url: str
    roles_supported: List[RoleType]


class CompanyListResponse(BaseModel):
    companies: List[CompanySummary]

