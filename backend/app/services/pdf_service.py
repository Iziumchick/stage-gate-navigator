import fitz
import hashlib
import re
from dataclasses import dataclass
from typing import Optional, Tuple


MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_PDF_MIME_TYPES = {
    "application/pdf",
    "application/x-pdf",
}


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    code: Optional[str] = None
    safe_message: Optional[str] = None
    size_bytes: Optional[int] = None
    content_type: Optional[str] = None


class PdfValidationError(Exception):
    def __init__(self, safe_message: str, code: str = "invalid_pdf"):
        super().__init__(safe_message)
        self.safe_message = safe_message
        self.code = code


class PdfProcessingError(Exception):
    def __init__(self, safe_message: str = "Invalid or unreadable PDF"):
        super().__init__(safe_message)
        self.safe_message = safe_message


def validate_pdf_upload(
    *,
    filename: Optional[str],
    content_type: Optional[str],
    data: bytes,
    max_size_bytes: int = MAX_PDF_SIZE_BYTES,
) -> ValidationResult:
    """
    Обязательная валидация ДО любого parsing.
    Проверяем:
    - extension
    - non-empty
    - file size
    - MIME type
    - magic bytes (%PDF- в первых 1024 байтах)
    """
    safe_filename = (filename or "").strip()
    safe_content_type = (content_type or "").strip().lower()
    size_bytes = len(data) if data is not None else 0

    if not safe_filename.lower().endswith(".pdf"):
        raise PdfValidationError(
            safe_message="Please upload a PDF file",
            code="invalid_extension",
        )

    if not data:
        raise PdfValidationError(
            safe_message="Empty file",
            code="empty_file",
        )

    if size_bytes > max_size_bytes:
        raise PdfValidationError(
            safe_message=f"File is too large (max {max_size_bytes // (1024 * 1024)} MB)",
            code="file_too_large",
        )

    # MIME check (практичный старт: используем content_type от UploadFile)
    # Если content_type отсутствует — не валим файл только из-за этого.
    if safe_content_type and safe_content_type not in ALLOWED_PDF_MIME_TYPES:
        raise PdfValidationError(
            safe_message="Unsupported file type",
            code="invalid_mime",
        )

    # Magic bytes: PDF header обычно должен встретиться в первых ~1024 байтах
    header_window = data[:1024]
    if b"%PDF-" not in header_window:
        raise PdfValidationError(
            safe_message="File content does not look like a valid PDF",
            code="invalid_magic_bytes",
        )

    return ValidationResult(
        ok=True,
        code=None,
        safe_message=None,
        size_bytes=size_bytes,
        content_type=safe_content_type or None,
    )


def calculate_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract_text(pdf_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            parts = [page.get_text() for page in doc]
            return "\n".join(parts).strip()
        finally:
            doc.close()
    except Exception as e:
        raise PdfProcessingError("Invalid or unreadable PDF") from e


def extract_styled_lines(pdf_bytes: bytes) -> list[dict]:
    """
    Возвращает список "логических строк" с признаком bold.
    Объединяем спаны в одну строку, bold = True если любой спан в этой строке bold.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        out: list[dict] = []

        try:
            for page_index, page in enumerate(doc, start=1):
                data = page.get_text("dict")

                for block in data.get("blocks", []):
                    if block.get("type") != 0:  # 0 = text
                        continue

                    for line in block.get("lines", []):
                        parts = []
                        line_bold = False

                        for span in line.get("spans", []):
                            text = (span.get("text") or "").strip()
                            if not text:
                                continue

                            parts.append(text)

                            flags = int(span.get("flags", 0))
                            font = str(span.get("font", "")).lower()

                            is_bold_by_flags = (flags & 16) != 0
                            is_bold_by_font = "bold" in font
                            if is_bold_by_flags or is_bold_by_font:
                                line_bold = True

                        full = " ".join(parts).strip()
                        if full:
                            out.append({
                                "page": page_index,
                                "text": full,
                                "bold": line_bold,
                            })

            return out
        finally:
            doc.close()

    except Exception as e:
        raise PdfProcessingError("Invalid or unreadable PDF") from e


def parse_overall(full_text: str) -> Tuple[Optional[float], Optional[int]]:
    m = re.search(
        r"Vorläufige Gesamtleistung:\s*([0-9],[0-9])\s*/\s*([0-9]+)\s*Credits",
        full_text
    )
    if not m:
        return None, None

    grade = float(m.group(1).replace(",", "."))
    credits = int(m.group(2))
    return grade, credits


def parse_degree_program(full_text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (degree_program_raw, degree_program_key)
    Example raw: "Wirtschaftsinformatik"
    Example key: "wi"
    """
    m = re.search(r"Studiengang:\s*\n\s*([^\n]+)", full_text)
    if not m:
        return None, None

    raw = m.group(1).strip()
    key = None

    low = raw.lower()
    if "wirtschaftsinformatik" in low:
        key = "wi"

    return raw, key