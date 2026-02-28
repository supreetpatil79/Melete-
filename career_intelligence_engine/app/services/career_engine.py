from __future__ import annotations

from datetime import datetime, timezone

from app.models.schemas import MatchRequest, ResumeUploadResponse, RoadmapResponse
from app.services.match_engine import MatchEngine
from app.services.resume_extraction import ResumeExtractionService
from app.services.resume_parser import ResumeParserService
from app.services.skill_graph_service import SkillGraphService


class CareerIntelligenceService:
    def __init__(
        self,
        resume_extractor: ResumeExtractionService,
        resume_parser: ResumeParserService,
        skill_graph: SkillGraphService,
        match_engine: MatchEngine,
    ) -> None:
        self.resume_extractor = resume_extractor
        self.resume_parser = resume_parser
        self.skill_graph = skill_graph
        self.match_engine = match_engine

    def parse_resume_upload(self, file_bytes: bytes) -> ResumeUploadResponse:
        extracted = self.resume_extractor.extract_text_from_pdf(file_bytes)
        vocabulary = self.skill_graph.all_unique_skills()
        structured = self.resume_parser.parse_resume_text(extracted, vocabulary)
        return ResumeUploadResponse(
            extracted_characters=len(extracted),
            structured_resume=structured,
        )

    def generate_roadmap(self, request: MatchRequest) -> RoadmapResponse:
        results = self.match_engine.evaluate(request)
        return RoadmapResponse(generated_at=datetime.now(timezone.utc), results=results)

