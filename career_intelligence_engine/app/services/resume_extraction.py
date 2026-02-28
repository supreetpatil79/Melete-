from __future__ import annotations

import re
import zlib
from typing import Iterable, List

from app.core.logging import get_logger


STREAM_PATTERN = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.DOTALL)
PDF_STRING_PATTERN = re.compile(rb"\((?:\\.|[^\\)])*\)")
TEXT_TJ_PATTERN = re.compile(rb"\[(.*?)\]\s*TJ", re.DOTALL)


class ResumeExtractionService:
    def __init__(self) -> None:
        self.logger = get_logger("career-intelligence.resume-extraction")

    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        if not file_bytes.startswith(b"%PDF"):
            raise ValueError("Uploaded file is not a valid PDF stream.")

        extracted_chunks: List[str] = []
        stream_count = 0

        for stream_count, stream_bytes in enumerate(self._iter_streams(file_bytes), start=1):
            candidates = [stream_bytes, self._maybe_decompress(stream_bytes)]
            for candidate in candidates:
                if not candidate:
                    continue
                extracted_chunks.extend(self._extract_text_fragments(candidate))

        if not extracted_chunks:
            extracted_chunks.extend(self._extract_text_fragments(file_bytes))

        text = self._normalize_text(extracted_chunks)
        self.logger.info(
            "resume extraction completed",
            extra={"streams": stream_count, "characters": len(text)},
        )
        return text

    def _iter_streams(self, content: bytes) -> Iterable[bytes]:
        for match in STREAM_PATTERN.finditer(content):
            yield match.group(1).strip(b"\r\n")

    def _maybe_decompress(self, data: bytes) -> bytes:
        for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
            try:
                return zlib.decompress(data, wbits)
            except zlib.error:
                continue
        return b""

    def _extract_text_fragments(self, content: bytes) -> List[str]:
        fragments: List[str] = []

        for text_array in TEXT_TJ_PATTERN.findall(content):
            for raw_string in PDF_STRING_PATTERN.findall(text_array):
                decoded = self._decode_pdf_literal(raw_string)
                if decoded:
                    fragments.append(decoded)

        for raw_string in PDF_STRING_PATTERN.findall(content):
            decoded = self._decode_pdf_literal(raw_string)
            if decoded:
                fragments.append(decoded)

        if not fragments:
            fallback = self._decode_binary_to_text(content)
            if fallback:
                fragments.append(fallback)

        return fragments

    def _decode_pdf_literal(self, token: bytes) -> str:
        if len(token) < 2:
            return ""
        literal = token[1:-1]
        literal = re.sub(rb"\\([\\\(\)])", rb"\1", literal)
        literal = literal.replace(rb"\n", b"\n").replace(rb"\r", b" ").replace(rb"\t", b" ")

        try:
            decoded = literal.decode("utf-8", errors="ignore")
        except UnicodeDecodeError:
            decoded = literal.decode("latin-1", errors="ignore")
        return decoded.strip()

    def _decode_binary_to_text(self, content: bytes) -> str:
        decoded = content.decode("latin-1", errors="ignore")
        visible = re.findall(r"[A-Za-z][A-Za-z0-9,\.\+\-\(\)\/ ]{2,}", decoded)
        return "\n".join(visible[:400])

    def _normalize_text(self, chunks: List[str]) -> str:
        merged = "\n".join(chunks)
        merged = merged.replace("\x00", " ")
        merged = re.sub(r"[ \t]+", " ", merged)
        merged = re.sub(r"\n{3,}", "\n\n", merged)
        return merged.strip()

