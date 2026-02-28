from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.api.dependencies import get_career_service, get_skill_graph_service
from app.core.logging import get_logger
from app.models.schemas import (
    CompanyListResponse,
    MatchRequest,
    ResumeUploadResponse,
    RoadmapResponse,
    RoleType,
)
from app.services.career_engine import CareerIntelligenceService
from app.services.skill_graph_service import SkillGraphService


router = APIRouter(prefix="/api/v1/career-intelligence", tags=["career-intelligence"])
logger = get_logger("career-intelligence.api")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/companies", response_model=CompanyListResponse)
def list_companies(
    role_type: RoleType | None = Query(default=None),
    skill_graph: SkillGraphService = Depends(get_skill_graph_service),
) -> CompanyListResponse:
    companies = skill_graph.list_companies()
    if role_type:
        companies = [company for company in companies if role_type in company.roles_supported]
    return CompanyListResponse(companies=companies)


@router.post("/resume/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    service: CareerIntelligenceService = Depends(get_career_service),
) -> ResumeUploadResponse:
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()

    if not filename.endswith(".pdf") and "pdf" not in content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF resumes are accepted.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded resume is empty.",
        )

    try:
        response = service.parse_resume_upload(file_bytes)
        logger.info(
            "resume uploaded",
            extra={"filename": file.filename, "chars": response.extracted_characters},
        )
        return response
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/match", response_model=RoadmapResponse)
def compute_match(
    request: MatchRequest,
    service: CareerIntelligenceService = Depends(get_career_service),
) -> RoadmapResponse:
    logger.info(
        "match request",
        extra={"role_type": request.role_type, "target_companies": request.target_companies},
    )
    return service.generate_roadmap(request)


@router.post("/roadmap", response_model=RoadmapResponse)
def personalized_roadmap(
    request: MatchRequest,
    service: CareerIntelligenceService = Depends(get_career_service),
) -> RoadmapResponse:
    logger.info(
        "roadmap request",
        extra={"role_type": request.role_type, "target_companies": request.target_companies},
    )
    return service.generate_roadmap(request)

