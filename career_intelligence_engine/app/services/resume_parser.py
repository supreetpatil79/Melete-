from __future__ import annotations

import re
from collections import defaultdict
from typing import Dict, List, Sequence

from app.models.schemas import ResumeStructuredData


EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(\+?\d[\d\-\s]{7,}\d)")
URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
YEARS_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)", re.IGNORECASE)

SECTION_TITLES = {
    "skills": ("skills", "technical skills", "technologies", "tech stack"),
    "education": ("education", "academics", "qualifications"),
    "experience": ("experience", "work experience", "internship", "professional experience"),
    "projects": ("projects", "project work"),
}

DEFAULT_SKILL_VOCAB = [
    "python",
    "java",
    "c++",
    "javascript",
    "typescript",
    "react",
    "node.js",
    "fastapi",
    "sql",
    "nosql",
    "data structures",
    "algorithms",
    "operating systems",
    "computer networks",
    "dbms",
    "system design",
    "aws",
    "docker",
    "kubernetes",
    "git",
    "machine learning",
    "deep learning",
    "nlp",
    "llm",
    "pytorch",
    "tensorflow",
    "redis",
    "elasticsearch",
    "linux",
]


class ResumeParserService:
    def parse_resume_text(self, text: str, skill_vocab: Sequence[str] | None = None) -> ResumeStructuredData:
        cleaned_text = text.strip()
        lines = [line.strip(" -•\t") for line in cleaned_text.splitlines()]
        lines = [line for line in lines if line]

        email = self._first_match(EMAIL_PATTERN, cleaned_text)
        phone = self._first_match(PHONE_PATTERN, cleaned_text)
        links = list(dict.fromkeys(URL_PATTERN.findall(cleaned_text)))
        years_experience = self._parse_years_experience(cleaned_text)
        name = self._guess_name(lines, email)

        sections = self._split_sections(lines)
        vocabulary = self._normalize_skills(skill_vocab or DEFAULT_SKILL_VOCAB)
        skills, evidence = self._extract_skills(cleaned_text, sections.get("skills", []), vocabulary)

        return ResumeStructuredData(
            name=name,
            email=email,
            phone=phone,
            links=links,
            skills=skills,
            skill_evidence=evidence,
            education=sections.get("education", []),
            experience=sections.get("experience", []),
            projects=sections.get("projects", []),
            years_experience=years_experience,
            raw_text=cleaned_text,
        )

    def _first_match(self, pattern: re.Pattern[str], value: str) -> str | None:
        match = pattern.search(value)
        if not match:
            return None
        return match.group(1) if match.lastindex else match.group(0)

    def _parse_years_experience(self, value: str) -> float | None:
        matches = YEARS_PATTERN.findall(value)
        if not matches:
            return None
        return max(float(entry) for entry in matches)

    def _guess_name(self, lines: List[str], email: str | None) -> str | None:
        if not lines:
            return None

        for line in lines[:6]:
            lowered = line.lower()
            if email and email.lower() in lowered:
                continue
            if len(line.split()) > 6:
                continue
            if any(token in lowered for token in ("resume", "curriculum", "vitae", "@", "http")):
                continue
            if re.search(r"\d", line):
                continue
            if all(word[0].isupper() for word in line.split() if word):
                return line
        return lines[0]

    def _split_sections(self, lines: List[str]) -> Dict[str, List[str]]:
        sections: Dict[str, List[str]] = {key: [] for key in SECTION_TITLES}
        current = None

        for line in lines:
            lowered = line.lower().rstrip(":")
            matched = next(
                (section for section, titles in SECTION_TITLES.items() if lowered in titles),
                None,
            )
            if matched:
                current = matched
                continue

            if current and len(line) > 1:
                sections[current].append(line)

        return sections

    def _normalize_skills(self, skills: Sequence[str]) -> List[str]:
        return sorted({skill.strip().lower() for skill in skills if skill.strip()})

    def _extract_skills(
        self,
        full_text: str,
        skill_section_lines: List[str],
        skill_vocab: List[str],
    ) -> tuple[List[str], Dict[str, int]]:
        section_candidates = re.split(r"[,|/]", " ".join(skill_section_lines))
        section_candidates = [candidate.strip().lower() for candidate in section_candidates if candidate.strip()]

        normalized_text = full_text.lower()
        evidence: Dict[str, int] = defaultdict(int)

        for skill in skill_vocab:
            pattern = re.escape(skill).replace(r"\ ", r"\s+")
            matches = re.findall(rf"\b{pattern}\b", normalized_text)
            if matches:
                evidence[skill] += len(matches)

        extracted = set()
        for candidate in section_candidates:
            extracted.add(candidate)
            evidence[candidate] += 1

        # Keep only meaningful skills and map unknowns from section explicitly.
        selected = sorted({skill for skill in extracted | set(evidence.keys()) if len(skill) >= 2})[:80]
        ordered = sorted(selected, key=lambda skill: (-evidence.get(skill, 0), skill))

        return ordered, dict(evidence)

